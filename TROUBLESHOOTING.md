# 🛠️ Facebook Automation MVP - Troubleshooting & Daily Startup Guide

This document is your **cheat sheet** if you face any issues starting or running this project tomorrow or in the future.

---

## ⚡ Daily Startup Checklist (How to Run Tomorrow)

Every time you restart your computer or start a new day:

### Step 1: Open Terminal 1 — Start the Server
```powershell
npm run dev
```
*(Runs at `http://localhost:3000`)*

### Step 2: Open Terminal 2 — Start the ngrok Tunnel
```powershell
npm run tunnel
```
*(Exposes `http://localhost:3000` to `https://operable-overbook-gravitate.ngrok-free.dev`)*

### Step 3: Open the Dashboard in Your Browser
Go to: **[http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)**
Check that all 4 diagnostics checks are **GREEN**:
- [x] MongoDB Atlas Connection: **CONNECTED**
- [x] Public ngrok Webhook Tunnel: **ONLINE**
- [x] Meta Developer App: **CONFIGURED**
- [x] Facebook Page: **CONNECTED**

---

## 🚨 Top 7 Potential Errors & Exact Fixes

---

### Error 1: Port 3000 Already in Use (`EADDRINUSE: address already in use :::3000`)
**Why this happens:** A previous Node.js server process was left running in the background.

**How to Fix (Run in PowerShell):**
```powershell
# Stop all lingering Node.js processes immediately:
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```
Then run `npm run dev` again.

---

### Error 2: MongoDB Atlas IP Whitelist Block (`Could not connect to any servers in your MongoDB Atlas cluster`)
**Why this happens:** If your home or mobile Wi-Fi IP address changes (very common with dynamic IPs), MongoDB Atlas blocks incoming connections.

**How to Fix:**
1. Open [MongoDB Atlas](https://cloud.mongodb.com/).
2. In the left menu under **Security**, click **Network Access**.
3. If your current IP is not listed:
   - Click **+ Add IP Address**.
   - Select **Allow Access From Anywhere** (`0.0.0.0/0`) for development, or click **Add Current IP Address**.
   - Click **Confirm**.
4. Within 1 minute, your running server will automatically detect the connection and show:
   `[Database] ✅ MongoDB connected successfully on retry!`.

---

### Error 3: ngrok Tunnel Error or URL Changed
**Why this happens:** If you ran `ngrok http 3000` without your reserved domain, or if ngrok generated a random new URL.

**How to Fix:**
1. Always run using our configured script:
   ```powershell
   npm run tunnel
   ```
   *(This forces your domain: `operable-overbook-gravitate.ngrok-free.dev`)*.
2. If your ngrok domain **ever permanently changes** in the future:
   - Update `BASE_URL=https://new-url.ngrok-free.dev` in [.env](file:///c:/Users/PC/Desktop/facebook_automation_mvp/.env).
   - Update **App Domains** and **Valid OAuth Redirect URIs** in Meta App Settings.
   - Update **Webhooks Callback URL** in Meta Developer Portal to: `https://new-url.ngrok-free.dev/webhook`.

---

### Error 4: Meta Access Token Expired (`Error validating access token: Session has expired` or Code `190`)
**Why this happens:** Meta Page tokens or User tokens can expire after password changes or when token lifetimes elapse.

**How to Fix:**
1. Open [http://localhost:3000/index.html](http://localhost:3000/index.html).
2. Click **Connect Facebook (Direct OAuth Flow)** to log in and re-authorize.
3. Select your Page; the server automatically saves the fresh Page Access Token and re-subscribes webhooks.
4. Alternatively, generate a fresh Page Token in [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/) and paste it into the **Direct Page Token** tab on `/index.html`.

---

### Error 5: Messenger Messages Sent, But Bot Does NOT Reply
**Check these 4 items in order:**

1. **Is the sender an App Tester? (CRITICAL in Development Mode)**
   - Meta **strictly blocks** regular public Facebook accounts from triggering bots while the Meta App is in Development Mode.
   - The sender MUST be an Administrator, Developer, or Tester in your Meta App.
   - Go to **Meta Dashboard > App Roles > Roles** and verify the tester account (e.g., `Ajay Ch`) is listed and has accepted the invitation.
2. **Is Messenger Auto-Reply turned ON?**
   - Open [http://localhost:3000/messenger.html](http://localhost:3000/messenger.html) and verify the toggle switch is **ON**.
3. **Is the Webhook `messages` field subscribed?**
   - In Meta Developer Portal > **Webhooks > Page**, ensure `messages` and `messaging_postbacks` have **Subscribed** checked.
4. **Is the Page subscribed to the App?**
   - Open [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html) and click **🔄 Re-subscribe Page Webhooks**.

---

### Error 6: Post Comments Not Triggering Auto-Replies
**Check these 5 items in order:**

1. **Does your Page Token have Comment Permissions? (CRITICAL)**
   - Open [http://localhost:3000/comments.html](http://localhost:3000/comments.html).
   - Check the **Comment Permissions Banner** at the top.
   - Meta requires both **`pages_read_user_content`** and **`pages_manage_engagement`**.
   - If missing, click **Re-authorize Facebook Page** on `/index.html` (which now requests these with `rerequest`).
2. **Is Comment Automation enabled?**
   - Open [http://localhost:3000/comments.html](http://localhost:3000/comments.html).
   - Make sure **Global Comment Auto-Reply** is toggled to **ON**, OR you have created an active rule for that specific Post ID.
3. **Did the commenter use required keywords?**
   - If you entered keywords in the keyword filter (e.g. `price, info`), comments without those words are ignored. Leave the keyword field blank to reply to **all comments**.
4. **Is the `feed` Webhook field subscribed in Meta Developer Portal?**
   - In Meta Developer Portal > **Webhooks > Page**, ensure `feed` has **Subscribed** checked with Callback URL:
     `https://operable-overbook-gravitate.ngrok-free.dev/webhook`.
5. **Is the commenter an App Tester? (In Development Mode)**
   - Meta strictly blocks non-tester Facebook accounts from triggering webhooks while the App is in Development Mode. Make sure test comments are posted from your Tester account (e.g., `Ajay Ch`).
6. **Test Instantly with the Live Comment Simulator:**
   - Open [http://localhost:3000/comments.html](http://localhost:3000/comments.html).
   - Under **🧪 Live Comment Simulator & Webhook Tester**, type a test comment and click **Test Rule Matching** or **Dispatch Mock Webhook Event** to verify your rule logic without needing Facebook.

---

### Error 7: Meta Webhook Handshake Verification Fails (`The URL could not be validated`)
**Why this happens:** Meta tried to reach your server, but could not connect or verify token.

**How to Fix:**
1. Check that ngrok is running and can be reached from your phone or external browser.
2. Test the handshake locally by clicking **🧪 Ping Webhook Verification** on the [Dashboard](http://localhost:3000/dashboard.html).
3. Ensure the **Verify Token** entered in Meta is exactly:
   `fb_mvp_verify_token_2026`
4. Ensure the **Callback URL** in Meta is exactly:
   `https://operable-overbook-gravitate.ngrok-free.dev/webhook`

---

## 🔍 How to Inspect Live Webhook Payloads and Debug

1. Open [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html).
2. The **Live Webhooks & Events Stream** table displays every single event in real time.
3. Click the **Inspect** button next to any event to view:
   - Full raw JSON payload sent by Meta
   - Exact API call result
   - Exact Meta error code and message (if any error occurred)

---

## 📞 Quick Reference Commands

| Goal | Command |
| :--- | :--- |
| **Start Backend Server** | `npm run dev` |
| **Start ngrok Tunnel** | `npm run tunnel` |
| **Kill Port 3000 (if stuck)** | `Get-Process node \| Stop-Process -Force` |
| **Check Port 3000 Status** | `Get-NetTCPConnection -LocalPort 3000` |
| **Test Health Endpoint** | `curl http://localhost:3000/health` |
| **View ngrok Web Dashboard** | Open `http://127.0.0.1:4040` in browser |
