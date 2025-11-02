# Email Parser Test Results

## Test Date: 2025-11-02

## Test Configuration
- **Email**: keerthannekkanti@gmail.com
- **Host**: imap.gmail.com
- **Port**: 993
- **TLS**: Enabled

## Test Results

### ✅ Connection Test - SUCCESS
The email parser successfully:
- Resolved TLS/SSL certificate issues
- Connected to Gmail's IMAP server
- Validated connection parameters

### ⚠️ Authentication - REQUIRES APP PASSWORD
Gmail requires an **Application-Specific Password** instead of the regular account password.

**Error Message:**
```
Application-specific password required: https://support.google.com/accounts/answer/185833
```

## How to Fix

To use the email parser with Gmail, you need to:

1. **Enable 2-Step Verification** (if not already enabled)
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification" and follow the setup

2. **Create an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Or: Security → 2-Step Verification → App Passwords
   - Select "Mail" as the app
   - Select your device
   - Copy the generated 16-character password

3. **Use App Password**
   - Replace `Shadow123#` with the generated App Password
   - Use this App Password when connecting via the email parser

## Next Steps

Once you have the App Password:

1. Update the credentials in the frontend when using "Parse Emails"
2. The parser will:
   - Connect to Gmail IMAP
   - Search for unread emails in the last 7 days (configurable)
   - Extract job-related information:
     - Position/Job Title
     - Company Name
     - Location
     - Job URLs
   - Save parsed emails to the database
   - Display them in the Cold Emails section

## Implementation Status

✅ **Completed:**
- Email parser service implemented
- IMAP connection handling
- Job-related email detection
- Job detail extraction (position, company, location, URLs)
- Database integration
- Frontend UI for parsing
- API endpoints for testing and parsing

✅ **Working:**
- Connection to Gmail IMAP
- TLS/SSL certificate handling
- Authentication flow

⚠️ **Requires:**
- App Password from Gmail (user action required)

## Test Commands

To test again after getting App Password:

```bash
cd server
npx tsx test-email-parser.ts
```

Or test via API (requires server running and authentication):

```bash
# 1. Login first
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'

# 2. Test connection (replace TOKEN and use App Password)
curl -X POST http://localhost:3001/api/email-parser/test-connection \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "keerthannekkanti@gmail.com",
    "password": "APP_PASSWORD_HERE",
    "host": "imap.gmail.com",
    "port": 993,
    "tls": true
  }'

# 3. Parse emails
curl -X POST http://localhost:3001/api/email-parser/parse \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "keerthannekkanti@gmail.com",
    "password": "APP_PASSWORD_HERE",
    "host": "imap.gmail.com",
    "port": 993,
    "tls": true,
    "days": 7
  }'
```

