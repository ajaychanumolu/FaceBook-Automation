# Facebook Page Automation MVP

A simple, robust Facebook Page Automation MVP built with **Node.js, Express.js, MongoDB, and Vanilla HTML/CSS/JavaScript**.

Designed for **one Facebook account** and **one Facebook Page**, providing:
1. **Facebook Page Connection** (via Meta Embedded Signup / JS SDK Login or Direct Page Token).
2. **Messenger Auto-Reply** (instant automated responses to direct messages via Meta Send API).
3. **Post Comment Automation** (threaded public comment responses and optional private replies).
4. **Facebook Page Publishing & Scheduling** (publish immediately or schedule posts via `node-cron`).
5. **Real-time Event & Webhook Dashboard** (view live webhook payloads, actions taken, and exact Meta responses).

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Verify or edit `.env` (pre-configured with your credentials):
```ini
PORT=3000
MONGODB_URI=mongodb+srv://ajayoneinfo_db_user:2B4UmDnX1qQQD7tE@automaton.xg239we.mongodb.net/facebook_mvp?retryWrites=true&w=majority

META_APP_ID=2182342416011858
META_APP_SECRET=76b9ca62fa2750563886385ae3482b1c
META_CONFIG_ID=1675968454115396
META_GRAPH_API_VERSION=v26.0
META_WEBHOOK_VERIFY_TOKEN=fb_mvp_verify_token_2026
```

### 3. Start the Application
```bash
npm run dev
```

Open your browser to:
[http://localhost:3000](http://localhost:3000)

---

## Testing Webhooks with ngrok

In a separate terminal window:
```bash
ngrok http 3000
```
Copy your forwarding URL (e.g. `https://your-subdomain.ngrok-free.app`) and configure it in the Meta Developer Portal:
- **Callback URL**: `https://your-subdomain.ngrok-free.app/webhook`
- **Verify Token**: `fb_mvp_verify_token_2026`
- **Fields**: `messages`, `messaging_postbacks`, `feed`

See [META_SETUP.md](file:///c:/Users/PC/Desktop/facebook_automation_mvp/META_SETUP.md) for full step-by-step Meta Developer App settings.
See [TROUBLESHOOTING.md](file:///c:/Users/PC/Desktop/facebook_automation_mvp/TROUBLESHOOTING.md) for quick daily startup steps and error solutions.

---

## Features & Verification Walkthrough

### 1. Connect Facebook Page (`/index.html`)
- Click **Connect Facebook with Embedded Signup** to login via Meta JS SDK using your `config_id`.
- Select your Facebook Page from the retrieved list.
- The app saves the Page ID and Page Access Token in MongoDB and automatically subscribes your Page to App Webhooks.
- Alternatively, use the **Direct Page Token** tab to test immediately with a token generated from Meta Graph API Explorer.

### 2. Messenger Auto-Reply (`/messenger.html`)
- Toggle **Messenger Auto-Reply Status** to **ON**.
- Enter your reply message (e.g., *"Hello! Thanks for messaging us."*).
- Click **Save Settings**.
- Have your test account (`Ajay Ch`) send a DM to your Facebook Page; the Page will respond automatically!

### 3. Comment Automation (`/comments.html`)
- Click **Fetch Page Posts** to load existing posts from your Facebook Page.
- Click **Automate This Post** on any post.
- Set:
  - **Public Reply**: e.g., *"Thanks for your comment!"*
  - **Optional Messenger Message**: e.g., *"Thanks! Here is more information."*
  - **Enable Automation**: ON
- Click **Save Automation**.
- Have your test account comment on that post; the server will immediately post the public reply and attempt the private reply.

### 4. Create & Schedule Facebook Page Posts (`/posts.html`)
- **Immediate Publish**: Enter post content and click **Publish to Facebook Page**. The post is published live to Facebook and returns the Meta Post ID.
- **Scheduled Post**: Enter content, pick a future date/time, and click **Schedule Post**. The built-in `node-cron` worker checks every minute and publishes due posts.

### 5. Live Dashboard (`/dashboard.html`)
- Displays current connection status, Page Name, Page ID, Webhook subscription status, and automation states.
- Live recent event feed tracks every incoming webhook, action executed, and Meta API response.
