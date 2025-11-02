import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

// Create database pool with environment variables
const getDbPool = () => {
  return new Pool({
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'jobtracker',
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: false
  });
};

export interface EmailConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  tlsOptions?: any;
}

export interface ParsedJobEmail {
  position?: string;
  company?: string;
  location?: string;
  jobUrl?: string;
  recipientEmail: string;  // Email sent TO (for sent emails)
  recipientName?: string;  // Name of recipient
  senderEmail: string;     // User's email (who sent it)
  senderName?: string;     // User's name
  subject: string;
  message: string;
  sentAt: Date;
}

export class EmailParserService {
  /**
   * Connect to IMAP server and fetch emails
   */
  async fetchEmails(
    config: EmailConfig,
    userId: string,
    days: number = 7
  ): Promise<ParsedJobEmail[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.user,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: config.tlsOptions || {
          rejectUnauthorized: true,
          servername: config.host,
        },
      });

      const parsedEmails: ParsedJobEmail[] = [];

      imap.once('ready', () => {
        logger.info(`✅ Connected to IMAP server: ${config.host}`);
        
        // Try to open Sent Mail folder (Gmail uses '[Gmail]/Sent Mail', others use 'Sent')
        imap.getBoxes((err, boxes) => {
          if (err) {
            logger.error('Error getting mailbox list:', err);
            imap.end();
            return reject(err);
          }

          // Find the sent mail folder
          let sentFolder = '[Gmail]/Sent Mail'; // Gmail default
          if (config.host.includes('gmail')) {
            sentFolder = '[Gmail]/Sent Mail';
          } else if (boxes['Sent']) {
            sentFolder = 'Sent';
          } else if (boxes['Sent Items']) {
            sentFolder = 'Sent Items';
          } else if (boxes['[Gmail]'] && boxes['[Gmail]']['Sent Mail']) {
            sentFolder = '[Gmail]/Sent Mail';
          }

          logger.info(`Opening sent folder: ${sentFolder}`);
          
          imap.openBox(sentFolder, false, (err, box) => {
            if (err) {
              logger.error(`Error opening ${sentFolder}:`, err);
              // Try fallback to INBOX if sent folder not available
              logger.info('Trying fallback to INBOX...');
              return reject(err);
            }

            // Search for sent emails from the last N days (all sent emails, not just unread)
            const since = new Date();
            since.setDate(since.getDate() - days);
            
            imap.search(['ALL', ['SINCE', since]], (err, results) => {
              if (err) {
                logger.error('Error searching emails:', err);
                imap.end();
                return reject(err);
              }

              if (!results || results.length === 0) {
                logger.info(`No sent emails found in the last ${days} days`);
                imap.end();
                return resolve(parsedEmails);
              }

              logger.info(`Found ${results.length} sent emails in the last ${days} days`);

              const fetch = imap.fetch(results, {
                bodies: '',
                struct: true,
              });

              fetch.on('message', (msg, seqno) => {
              const emailData: any = {};

              msg.on('body', (stream) => {
                const chunks: Buffer[] = [];
                
                stream.on('data', (chunk: Buffer) => {
                  chunks.push(chunk);
                });

                stream.once('end', async () => {
                  try {
                    const buffer = Buffer.concat(chunks);
                    const parsed = await simpleParser(buffer);
                    emailData.parsed = parsed;
                  } catch (parseErr) {
                    logger.error('Error parsing email:', parseErr);
                  }
                });
              });

              msg.once('end', async () => {
                try {
                  if (emailData.parsed) {
                    const parsedEmail = await this.parseJobEmail(emailData.parsed);
                    if (parsedEmail) {
                      parsedEmails.push(parsedEmail);
                      
                      // Save to database (continue even if DB save fails)
                      try {
                        await this.saveParsedEmail(userId, parsedEmail);
                      } catch (dbError: any) {
                        logger.warn(`Could not save email to DB (continuing parsing): ${dbError.message}`);
                        // Continue parsing even if DB save fails
                      }
                    }
                  }
                } catch (err) {
                  logger.error('Error processing email:', err);
                }
              });
            });

              fetch.once('error', (err) => {
                logger.error('Fetch error:', err);
                imap.end();
                reject(err);
              });

              fetch.once('end', () => {
                logger.info(`✅ Processed ${parsedEmails.length} job-related emails`);
                imap.end();
                resolve(parsedEmails);
              });
            });
          });
        });
      });

      imap.once('error', (err) => {
        logger.error('IMAP connection error:', err);
        reject(err);
      });

      imap.once('end', () => {
        logger.info('IMAP connection ended');
      });

      imap.connect();
    });
  }

  /**
   * Parse email content to extract job-related information
   */
  private async parseJobEmail(parsedMail: ParsedMail): Promise<ParsedJobEmail | null> {
    try {
      const subject = parsedMail.subject || '';
      const text = parsedMail.text || parsedMail.html || '';
      
      // For sent emails, get recipient information instead of sender
      let recipientEmail = '';
      let recipientName = '';
      
      // Handle different mailparser formats for 'to' field
      if (parsedMail.to) {
        if (Array.isArray(parsedMail.to.value)) {
          const firstRecipient = parsedMail.to.value[0];
          recipientEmail = firstRecipient.address || '';
          recipientName = firstRecipient.name || '';
        } else if (parsedMail.to.value) {
          recipientEmail = parsedMail.to.value.address || '';
          recipientName = parsedMail.to.value.name || '';
        } else if (typeof parsedMail.to === 'string') {
          recipientEmail = parsedMail.to;
        }
      }
      
      // Fallback: check other recipient fields
      if (!recipientEmail && parsedMail.cc) {
        if (Array.isArray(parsedMail.cc.value)) {
          recipientEmail = parsedMail.cc.value[0]?.address || '';
          recipientName = parsedMail.cc.value[0]?.name || '';
        } else if (parsedMail.cc.value?.address) {
          recipientEmail = parsedMail.cc.value.address;
          recipientName = parsedMail.cc.value.name || '';
        }
      }
      
      if (!recipientEmail) {
        // Try to extract from text if structured data not available
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/gi;
        const matches = text.match(emailRegex);
        if (matches && matches.length > 0) {
          recipientEmail = matches[0];
        }
      }
      
      if (!recipientEmail) {
        return null; // Can't parse without recipient
      }
      
      // Get sender info (should be the user's email)
      const from = parsedMail.from?.value;
      let senderEmail = '';
      let senderName = '';
      
      if (Array.isArray(from) && from.length > 0) {
        senderEmail = from[0].address || '';
        senderName = from[0].name || '';
      } else if (from && from.address) {
        senderEmail = from.address;
        senderName = from.name || '';
      }

      // Check if email is job-related
      const isJobRelated = this.isJobRelatedEmail(subject, text);
      
      if (!isJobRelated) {
        return null;
      }

      // Extract job details
      const position = this.extractPosition(subject, text);
      // For sent emails, try to extract company from recipient email domain
      const company = this.extractCompany(subject, text, recipientEmail);
      const location = this.extractLocation(text);
      const jobUrl = this.extractJobUrl(text);

      // Clean up text content
      const message = text.substring(0, 5000); // Limit to 5000 chars

      return {
        position,
        company,
        location,
        jobUrl,
        recipientEmail, // Email sent TO this address
        recipientName,  // Name of recipient
        senderEmail,    // User's email (who sent it)
        senderName,     // User's name
        subject,
        message,
        sentAt: parsedMail.date || new Date(),
      };
    } catch (error) {
      logger.error('Error parsing job email:', error);
      return null;
    }
  }

  /**
   * Check if email is job-related
   */
  private isJobRelatedEmail(subject: string, text: string): boolean {
    const jobKeywords = [
      'job',
      'position',
      'opportunity',
      'career',
      'hiring',
      'recruiter',
      'recruitment',
      'application',
      'interview',
      'role',
      'vacancy',
      'opening',
      'candidate',
      'resume',
      'cv',
    ];

    const subjectLower = subject.toLowerCase();
    const textLower = text.toLowerCase();
    const combined = subjectLower + ' ' + textLower.substring(0, 500);

    return jobKeywords.some(keyword => combined.includes(keyword));
  }

  /**
   * Extract job position/title from email
   */
  private extractPosition(subject: string, text: string): string | undefined {
    // Common patterns for job titles
    const patterns = [
      /(?:position|role|job|opportunity|opening)[:\s]+([A-Z][a-zA-Z\s&]{5,50})/i,
      /looking for[:\s]+([A-Z][a-zA-Z\s&]{5,50})/i,
      /([A-Z][a-zA-Z\s&]{5,50})\s+(?:engineer|developer|manager|analyst|specialist|director|coordinator|assistant|executive)/i,
      /job title[:\s]+([A-Z][a-zA-Z\s&]{5,50})/i,
    ];

    // Try subject first
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Try text content
    for (const pattern of patterns) {
      const match = text.substring(0, 1000).match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: extract from subject if it looks like a job title
    const subjectWords = subject.split(/[\s-]+/);
    if (subjectWords.length >= 2 && subjectWords.length <= 6) {
      const potentialTitle = subjectWords.slice(0, 4).join(' ');
      if (potentialTitle.length > 5 && potentialTitle.length < 100) {
        return potentialTitle;
      }
    }

    return undefined;
  }

  /**
   * Extract company name from email
   */
  private extractCompany(subject: string, text: string, emailAddress: string): string | undefined {
    // Try to extract from email domain (can be sender or recipient)
    const emailDomain = emailAddress.split('@')[1];
    if (emailDomain && !emailDomain.includes('gmail') && !emailDomain.includes('yahoo') && !emailDomain.includes('hotmail') && !emailDomain.includes('outlook')) {
      // Extract company name from domain (e.g., recruiter@acme.com -> Acme)
      const parts = emailDomain.split('.');
      if (parts.length >= 2) {
        const companyPart = parts[parts.length - 2]; // Get second-to-last part
        // Capitalize first letter
        return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
      }
    }

    // Try patterns in text
    const patterns = [
      /(?:at|with|from)\s+([A-Z][a-zA-Z\s&]{2,50})(?:\s+(?:inc|llc|ltd|corp|company))?/i,
      /company[:\s]+([A-Z][a-zA-Z\s&]{2,50})/i,
      /organization[:\s]+([A-Z][a-zA-Z\s&]{2,50})/i,
    ];

    for (const pattern of patterns) {
      const match = text.substring(0, 500).match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract location from email
   */
  private extractLocation(text: string): string | undefined {
    // Common location patterns
    const patterns = [
      /location[:\s]+([A-Z][a-zA-Z\s,]{3,50})/i,
      /based in[:\s]+([A-Z][a-zA-Z\s,]{3,50})/i,
      /([A-Z][a-zA-Z\s]+(?:,\s*)?(?:UK|England|Scotland|Wales|London|Manchester|Birmingham|Edinburgh|Glasgow|Leeds|Liverpool|Bristol|Newcastle|Sheffield|Belfast|Cardiff))/i,
    ];

    for (const pattern of patterns) {
      const match = text.substring(0, 1000).match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract job URL from email
   */
  private extractJobUrl(text: string): string | undefined {
    // Common URL patterns for job postings
    const urlPatterns = [
      /(?:job|position|apply|application)[\s:]+(?:at|link|url)[\s:]+(https?:\/\/[^\s<>"]+)/i,
      /(https?:\/\/[^\s<>"]*job[^\s<>"]*)/i,
      /(https?:\/\/[^\s<>"]*career[^\s<>"]*)/i,
      /(https?:\/\/[^\s<>"]*opportunity[^\s<>"]*)/i,
      /(https?:\/\/[^\s<>"]*linkedin\.com\/jobs[^\s<>"]*)/i,
      /(https?:\/\/[^\s<>"]*indeed\.com[^\s<>"]*)/i,
    ];

    for (const pattern of urlPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Try to find any URL in the email
    const generalUrlPattern = /https?:\/\/[^\s<>"]+/i;
    const match = text.match(generalUrlPattern);
    if (match && match[0]) {
      return match[0].trim();
    }

    return undefined;
  }

  /**
   * Save parsed email to database
   */
  private async saveParsedEmail(userId: string, parsedEmail: ParsedJobEmail): Promise<void> {
    const pool = getDbPool();
    try {
      // Check if email already exists (by recipient email and sent date)
      const existingCheck = await pool.query(
        `SELECT id FROM cold_emails 
         WHERE user_id = $1 
         AND recipient_email = $2 
         AND sent_at >= $3 
         AND sent_at <= $4`,
        [
          userId,
          parsedEmail.recipientEmail,
          new Date(parsedEmail.sentAt.getTime() - 60000), // 1 minute before
          new Date(parsedEmail.sentAt.getTime() + 60000), // 1 minute after
        ]
      );

      if (existingCheck.rows.length > 0) {
        logger.info(`Email to ${parsedEmail.recipientEmail} already exists, skipping`);
        return;
      }

      // Insert new cold email (user's sent email)
      await pool.query(
        `INSERT INTO cold_emails 
         (user_id, recipient_email, recipient_name, company, subject, message, 
          position, location, job_url, sender_email, sent_at, source, parsed_at, 
          created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EMAIL_PARSED', NOW(), NOW(), NOW())
         RETURNING id`,
        [
          userId,
          parsedEmail.recipientEmail, // Email sent TO
          parsedEmail.recipientName,   // Name of recipient
          parsedEmail.company,
          parsedEmail.subject,
          parsedEmail.message,
          parsedEmail.position,
          parsedEmail.location,
          parsedEmail.jobUrl,
          parsedEmail.senderEmail,     // User's email (who sent it)
          parsedEmail.sentAt,
        ]
      );

      logger.info(`✅ Saved parsed sent email to ${parsedEmail.recipientEmail}`);
    } catch (error) {
      logger.error('Error saving parsed email to database:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  /**
   * Test IMAP connection
   */
  async testConnection(config: EmailConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.user,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: config.tlsOptions || {
          rejectUnauthorized: true,
          servername: config.host,
        },
      });

      imap.once('ready', () => {
        logger.info('✅ IMAP connection test successful');
        imap.end();
        resolve(true);
      });

      imap.once('error', (err) => {
        logger.error('❌ IMAP connection test failed:', err);
        resolve(false);
      });

      imap.connect();
    });
  }
}

