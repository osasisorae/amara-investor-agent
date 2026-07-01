# Deployment Guide — Amara Investor Agent

This guide walks you through deploying Amara to production.

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 18+ installed
- ✅ Turso database created and credentials in `.env`
- ✅ Resend API key configured
- ✅ Vercel account (for deployment and Blob storage)
- ✅ All environment variables set

---

## Step 1: Initialize Database

Run the migration script to create all tables:

```bash
npm run db:migrate
```

This will create the following tables in your Turso database:
- `leads` - Core investor records
- `messages` - Full conversation history
- `qualification_answers` - Qualification criteria responses
- `kyc_documents` - KYC document metadata
- `audit_events` - Complete audit trail
- `offeree_register` - Human checkpoint 1
- `otp_codes` - Agreement signing OTPs
- `admin_users` - Admin authentication

---

## Step 2: Test Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and test:

1. **Admin Dashboard** (`/admin`):
   - Add an email to the offeree register
   - Verify outreach email is sent
   - Check lead appears in pipeline

2. **Investor Chat** (`/chat/[leadId]`):
   - Open the chat link from the email
   - Go through qualification conversation
   - Test deal room Q&A
   - Verify knowledge base responses

3. **KYC Approval Flow**:
   - Simulate KYC document submission
   - Approve KYC in admin dashboard
   - Verify approval email is sent

---

## Step 3: Deploy to Vercel

### Option A: CLI Deployment

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy
vercel --prod
```

### Option B: GitHub Integration

1. Push your code to GitHub (already done!)
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import `amara-investor-agent` repository
4. Add all environment variables from `.env`
5. Deploy!

---

## Step 4: Configure Vercel Blob Storage

After first deployment:

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Click **Create Database** → **Blob**
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add it to your environment variables:
   - In Vercel: Settings → Environment Variables
   - Locally: Update `.env`

---

## Step 5: Verify Production

Test the full flow in production:

1. **Offeree Registration**:
   ```
   https://your-app.vercel.app/admin
   ```
   - Add a test email
   - Verify outreach email received

2. **Investor Chat**:
   ```
   https://your-app.vercel.app/chat/[leadId]
   ```
   - Complete qualification
   - Ask deal room questions
   - Verify knowledge base responses

3. **KYC Approval**:
   - Return to admin dashboard
   - Approve KYC
   - Verify approval email received

4. **Audit Trail**:
   - Check database for audit_events
   - Verify all actions are logged

---

## Environment Variables Checklist

Ensure all these are set in Vercel:

```
QWEN_API_KEY=sk-ws-...
QWEN_API_BASE_URL=https://...maas.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus

TURSO_DATABASE_URL=libsql://...turso.io
TURSO_AUTH_TOKEN=eyJhbGci...
DATABASE_URL=libsql://...turso.io

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=amara@investfuturex.com

BLOB_READ_WRITE_TOKEN=vercel_blob_...

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-password
ADMIN_JWT_SECRET=replace_with_at_least_32_random_characters
INVESTOR_JWT_SECRET=replace_with_a_different_32_character_secret
ADMIN_ALERT_EMAIL=compliance@investfuturex.com

GREY_API_KEY=grey_live_...

OTP_PROVIDER=resend
OTP_EXPIRES_IN_MINUTES=15

NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Alibaba Cloud ECS Deployment (Alternative)

If deploying to Alibaba Cloud ECS instead of Vercel:

### 1. Provision ECS Instance

- **Instance Type**: ecs.c6.large (2 vCPU, 4GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 40GB SSD

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/osasisorae/amara-investor-agent.git
cd amara-investor-agent

# Install dependencies
npm install

# Create .env file with all variables
nano .env

# Run database migration
npm run db:migrate

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "amara" -- start
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/amara

# Add configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/amara /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Monitoring & Logs

### Vercel Logs
```bash
vercel logs --follow
```

### ECS Logs (with PM2)
```bash
pm2 logs amara
```

### Database Monitoring
Check Turso dashboard for query performance and storage usage.

---

## Troubleshooting

### Issue: Outreach emails not sending
- Verify `RESEND_API_KEY` is set
- Check Resend dashboard for error logs
- Ensure `RESEND_FROM_EMAIL` domain is verified

### Issue: Chat responses slow
- Check Qwen API quota and rate limits
- Monitor Qwen API response times in logs

### Issue: Database connection errors
- Verify Turso database is running
- Check `TURSO_AUTH_TOKEN` is valid
- Test connection: `turso db shell [database-name]`

### Issue: Blob storage errors
- Ensure `BLOB_READ_WRITE_TOKEN` is set
- Verify Vercel Blob is provisioned

---

## Production Checklist

Before going live:

- [ ] All environment variables set
- [ ] Database migrated successfully
- [ ] Email delivery tested (send test offeree email)
- [ ] Chat flow tested end-to-end
- [ ] KYC approval flow tested
- [ ] Audit trail verified in database
- [ ] SSL certificate installed (if using custom domain)
- [ ] Monitoring setup (Vercel Analytics or custom)
- [ ] Backup strategy for database
- [ ] Error tracking configured (Sentry, etc.)

---

## Support

For issues during deployment:
- Email: amara@investfuturex.com
- GitHub Issues: [github.com/osasisorae/amara-investor-agent/issues](https://github.com/osasisorae/amara-investor-agent/issues)
