// Content script for UK Jobs Insider Job Tracker
// Automatically captures job application details from job boards

interface JobDetails {
  company: string;
  position: string;
  location?: string;
  salary?: string;
  jobUrl: string;
  jobBoardSource: string;
  description?: string;
  requirements?: string[];
  captureMethod: 'EXTENSION';
  confidence: number;
  timestamp: Date;
}

interface CaptureResult {
  success: boolean;
  data?: JobDetails;
  error?: string;
}

// Site-specific selectors for job boards
const SITE_SELECTORS = {
  'linkedin.com': {
    company: '.job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link',
    position: '.job-details-jobs-unified-top-card__job-title h1, .topcard__title',
    location: '.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet',
    salary: '.salary-main-rail-card__salary-range, .compensation__salary',
    description: '.jobs-description__content, .description__text',
  },
  'indeed.com': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"]',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description',
  },
  'indeed.co.uk': {
    company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating > div:first-child',
    position: '.jobsearch-JobInfoHeader-title, h1[data-testid="job-title"]',
    location: '[data-testid="job-location"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)',
    salary: '[data-testid="job-salary"], .attribute_snippet',
    description: '#jobDescriptionText, .jobsearch-JobComponent-description',
  },
  'reed.co.uk': {
    company: '[itemprop="hiringOrganization"] [itemprop="name"], .company-name',
    position: 'h1[itemprop="title"], .job-header h1',
    location: '[itemprop="jobLocation"] [itemprop="address"], .location',
    salary: '[itemprop="baseSalary"], .salary',
    description: '[itemprop="description"], .description',
  },
  'totaljobs.com': {
    company: '.company h2, [data-testid="job-company-name"]',
    position: '.job-title h1, [data-testid="job-title"]',
    location: '.location, [data-testid="job-location"]',
    salary: '.salary, [data-testid="job-salary"]',
    description: '.job-description, [data-testid="job-description"]',
  },
};

// Job capture class
class JobCapture {
  private startTime: number;
  private currentJob: JobDetails | null = null;
  private observer: MutationObserver | null = null;

  constructor() {
    this.startTime = Date.now();
    this.init();
  }

  private init() {
    // Listen for messages from popup or background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'captureJob') {
        this.captureCurrentJob().then(sendResponse);
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'getJobDetails') {
        sendResponse(this.currentJob);
      }

      if (request.action === 'startTracking') {
        this.startTimeTracking();
        sendResponse({ success: true });
      }

      if (request.action === 'stopTracking') {
        const timeSpent = this.stopTimeTracking();
        sendResponse({ timeSpent });
      }
    });

    // Auto-detect when on a job page
    this.detectJobPage();
    this.observePageChanges();
  }

  private detectJobPage() {
    const url = window.location.href;
    const isJobPage = 
      url.includes('/jobs/view/') ||
      url.includes('/viewjob') ||
      url.includes('/job/') ||
      url.includes('/jobs/') ||
      url.includes('/rc/clk');

    if (isJobPage) {
      // Wait for page to load then capture
      setTimeout(() => this.captureCurrentJob(), 1500);
    }
  }

  private observePageChanges() {
    // Observe URL changes for SPAs
    let lastUrl = location.href;
    this.observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.detectJobPage();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private async captureCurrentJob(): Promise<CaptureResult> {
    try {
      const hostname = window.location.hostname;
      const selectors = this.getSelectorsForSite(hostname);

      if (!selectors) {
        // Try generic capture
        return this.genericCapture();
      }

      const jobDetails: JobDetails = {
        company: this.extractText(selectors.company) || '',
        position: this.extractText(selectors.position) || '',
        location: this.extractText(selectors.location),
        salary: this.extractText(selectors.salary),
        jobUrl: window.location.href,
        jobBoardSource: this.getSourceName(hostname),
        description: this.extractText(selectors.description),
        captureMethod: 'EXTENSION',
        confidence: 0.95,
        timestamp: new Date(),
      };

      // Validate captured data
      if (!jobDetails.company || !jobDetails.position) {
        // Try fallback methods
        return this.fallbackCapture(jobDetails);
      }

      this.currentJob = jobDetails;
      
      // Store in local storage
      await this.storeJobLocally(jobDetails);

      // Show success notification
      this.showNotification('Job details captured successfully!', 'success');

      return {
        success: true,
        data: jobDetails,
      };

    } catch (error) {
      console.error('Error capturing job:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getSelectorsForSite(hostname: string): any {
    for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
      if (hostname.includes(domain)) {
        return selectors;
      }
    }
    return null;
  }

  private extractText(selector: string | undefined): string | undefined {
    if (!selector) return undefined;

    const selectors = selector.split(', ');
    for (const sel of selectors) {
      const element = document.querySelector(sel);
      if (element) {
        const text = element.textContent?.trim();
        if (text) return text;
      }
    }
    return undefined;
  }

  private getSourceName(hostname: string): string {
    if (hostname.includes('linkedin')) return 'LinkedIn';
    if (hostname.includes('indeed')) return 'Indeed';
    if (hostname.includes('reed')) return 'Reed';
    if (hostname.includes('totaljobs')) return 'Totaljobs';
    if (hostname.includes('glassdoor')) return 'Glassdoor';
    if (hostname.includes('monster')) return 'Monster';
    return hostname;
  }

  private async genericCapture(): Promise<CaptureResult> {
    // Use AI-like heuristics to find job details
    const jobDetails: JobDetails = {
      company: this.findByPatterns(['company', 'employer', 'organization']) || '',
      position: this.findByPatterns(['title', 'position', 'role', 'job']) || '',
      location: this.findByPatterns(['location', 'city', 'remote']),
      salary: this.findByPatterns(['salary', 'compensation', 'pay']),
      jobUrl: window.location.href,
      jobBoardSource: this.getSourceName(window.location.hostname),
      captureMethod: 'EXTENSION',
      confidence: 0.7,
      timestamp: new Date(),
    };

    if (jobDetails.company && jobDetails.position) {
      return {
        success: true,
        data: jobDetails,
      };
    }

    return {
      success: false,
      error: 'Unable to capture job details from this page',
    };
  }

  private findByPatterns(patterns: string[]): string | undefined {
    for (const pattern of patterns) {
      // Search for elements containing these keywords
      const elements = document.querySelectorAll(`[class*="${pattern}"], [id*="${pattern}"], [data-*="${pattern}"]`);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 2 && text.length < 200) {
          return text;
        }
      }

      // Search headings
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const heading of headings) {
        if (heading.textContent?.toLowerCase().includes(pattern)) {
          const nextElement = heading.nextElementSibling;
          if (nextElement) {
            const text = nextElement.textContent?.trim();
            if (text) return text;
          }
        }
      }
    }
    return undefined;
  }

  private async fallbackCapture(partialData: JobDetails): Promise<CaptureResult> {
    // Try OpenGraph meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content');

    if (ogTitle) {
      // Parse title which often contains "Position at Company"
      const titleParts = ogTitle.split(' at ');
      if (titleParts.length === 2) {
        partialData.position = partialData.position || titleParts[0].trim();
        partialData.company = partialData.company || titleParts[1].trim();
      }
    }

    partialData.description = partialData.description || ogDescription || undefined;
    partialData.confidence = 0.8;

    if (partialData.company && partialData.position) {
      return {
        success: true,
        data: partialData,
      };
    }

    return {
      success: false,
      error: 'Insufficient job details captured',
    };
  }

  private async storeJobLocally(jobDetails: JobDetails) {
    // Store in Chrome storage for offline sync
    const stored = await chrome.storage.local.get(['capturedJobs']) || {};
    const jobs = stored.capturedJobs || [];
    jobs.push(jobDetails);
    
    // Keep only last 50 jobs locally
    if (jobs.length > 50) {
      jobs.shift();
    }

    await chrome.storage.local.set({ capturedJobs: jobs });
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Create and inject notification element
    const notification = document.createElement('div');
    notification.className = `ukji-notification ukji-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private startTimeTracking() {
    this.startTime = Date.now();
    chrome.storage.local.set({ trackingStartTime: this.startTime });
  }

  private stopTimeTracking(): number {
    const endTime = Date.now();
    const timeSpent = Math.floor((endTime - this.startTime) / 1000); // in seconds
    chrome.storage.local.remove(['trackingStartTime']);
    return timeSpent;
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize job capture
const jobCapture = new JobCapture();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JobCapture };
}
