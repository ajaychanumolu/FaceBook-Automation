# 🛠️ Facebook Automation MVP - Troubleshooting & Daily Operations Guide

This document is your **cheat sheet** for operating the project in production on **Render** (`https://facebook.oneinfo.ai`) or locally.

---

## ⚡ Production Overview (`https://facebook.oneinfo.ai`)

When running on Render with your custom domain:
- **Application URL**: `https://facebook.oneinfo.ai`
- **Dashboard**: `https://facebook.oneinfo.ai/dashboard.html`
- **Webhook Endpoint**: `https://facebook.oneinfo.ai/webhook`
- **Health Check**: `https://facebook.oneinfo.ai/health`
- **No local terminal or ngrok required**: Render keeps your Node.js application running 24/7 in the cloud.

---

## 💻 Local Development (Optional Fallback)

If developing new features locally on your PC:

### Step 1: Start the Local Server
```powershell
npm run dev
```
*(Accessible at `http://localhost:3000`)*

### Step 2: (Optional) Start ngrok Tunnel (Only if not using Render)
```powershell
npm run tunnel
```

---

## 🚨 Top Potential Errors & Exact Fixes

---

### Error 1: Meta Webhook Handshake Fails (`The URL could not be validated`)
**Why this happens:** Meta attempted to verify the webhook, but could not reach the server or verify token.

**How to Fix:**
1. Test your production endpoint directly: Open `https://facebook.oneinfo.ai/health` in your browser. It should return status `ok`.
2. Test the handshake locally or on production: Open `https://facebook.oneinfo.ai/dashboard.html` and click **🧪 Ping Webhook Verification**.
3. Verify Meta Webhook Settings:
   - **Callback URL**: `https://facebook.oneinfo.ai/webhook`
   - **Verify Token**: `fb_mvp_verify_token_2026`
4. Click **Verify and Save** in the Meta Developer Portal.

---

### Error 2: Render Custom Domain Not Loading or SSL Pending
**Why this happens:** DNS CNAME record has not propagated yet or points to the wrong target.

**How to Fix:**
1. In your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap) for `oneinfo.ai`:
   - Check that the CNAME for `facebook` points to your Render service target (e.g., `<service-name>.onrender.com`).
   - If using Cloudflare, temporarily set the Proxy status to **DNS Only (Grey Cloud)** during initial certificate issuance, or ensure SSL is set to **Full**.
2. In Render Dashboard > **Settings** > **Custom Domains**, click **Refresh** on `facebook.oneinfo.ai`.
3. Once Verified, Render's Let's Encrypt certificate will be active.

---

### Error 3: MongoDB Atlas IP Whitelist Block (`Could not connect to any servers in your cluster`)
**Why this happens:** Render cloud servers use dynamic outbound IPs. MongoDB Atlas requires network access from anywhere (`0.0.0.0/0`) or specific peered IPs.

**How to Fix:**
1. Open [MongoDB Atlas](https://cloud.mongodb.com/).
2. In the left menu under **Security**, click **Network Access**.
3. Click **+ Add IP Address**.
4. Select **Allow Access From Anywhere** (`0.0.0.0/0`).
5. Click **Confirm**. Your server on Render will automatically connect within 15 seconds!

---

### Error 4: Messenger Messages Sent, But Bot Does NOT Reply
**Check these 4 items in order:**

1. **Is the sender an App Tester? (CRITICAL in Development Mode)**
   - While the Meta App is in Development Mode, Meta **strictly blocks** regular Facebook users from interacting with the bot.
   - The sender must be added under **Meta Dashboard > App Roles > Roles** as a Tester, Developer, or Admin (e.g., `Ajay Ch`), and must accept the invite at [developers.facebook.com/requests](https://developers.facebook.com/requests).
2. **Is Messenger Auto-Reply turned ON?**
   - Open `https://facebook.oneinfo.ai/messenger.html` and verify the toggle switch is **ON**.
3. **Is the Webhook `messages` field subscribed?**
   - In Meta Developer Portal > **Webhooks > Page**, ensure `messages` and `messaging_postbacks` have **Subscribed** checked.
4. **Is the Page subscribed to the App?**
   - Open `https://facebook.oneinfo.ai/dashboard.html` and click **🔄 Re-subscribe Page Webhooks**.

---

### Error 5: Post Comments Not Triggering Auto-Replies
**Check these items in order:**

1. **Does your Page Token have Comment Permissions?**
   - Both **`pages_manage_engagement`** and **`pages_read_engagement`** are required.
   - Check the **Permissions Health** table on `https://facebook.oneinfo.ai/dashboard.html` or `index.html`.
2. **Is Comment Automation enabled?**
   - Open `https://facebook.oneinfo.ai/comments.html`.
   - Make sure **Global Comment Auto-Reply** is toggled to **ON**, OR you have created a rule for that specific Post ID.
3. **Is the commenter an App Tester? (In Development Mode)**
   - Post comments using your authorized Tester account.
4. **Test Instantly with the Live Comment Simulator:**
   - Open `https://facebook.oneinfo.ai/comments.html`.
   - Under **🧪 Live Comment Simulator & Webhook Tester**, test keyword matching and dispatch mock events.

---

### Error 6: Meta Access Token Expired (Code `190`)
**Why this happens:** Meta Page tokens or User tokens can expire after password changes or session lifetime limits.

**How to Fix:**
1. Open `https://facebook.oneinfo.ai/index.html`.
2. Click **Connect Facebook (Direct OAuth Flow)** to log in and re-authorize.
3. Select your Page; the server automatically updates the token and re-subscribes webhooks.

---

## 🔍 How to Inspect Live Webhook Payloads and Debug

1. Open `https://facebook.oneinfo.ai/dashboard.html`.
2. The **Live Webhooks & Events Stream** table displays every single event in real time.
3. Click the **Inspect** button next to any event to view the full raw payload received from Meta.
