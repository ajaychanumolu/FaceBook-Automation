# Meta Developer App & System Configuration Guide

Complete guide for configuring your **Meta Developer App (`2182342416011858`)**, deploying to **Render hosting** with custom domain **`facebook.oneingo.ai`**, configuring Webhooks, and submitting for **Meta App Review**.

---

## 1. Credentials & Configuration Summary

All production values match your updated `.env` configuration:

| Setting | Value |
| :--- | :--- |
| **Meta App ID** | `2182342416011858` |
| **Meta App Secret** | `76b9ca62fa2750563886385ae3482b1c` |
| **Config ID (Login for Business)** | `1675968454115396` |
| **Graph API Version** | `v26.0` |
| **Webhook Verify Token** | `fb_mvp_verify_token_2026` |
| **Production Domain** | `https://facebook.oneingo.ai` |
| **Production Webhook URL** | `https://facebook.oneingo.ai/webhook` |
| **Local Port** | `3000` |

---

## 2. Render Hosting Deployment Guide

### Step 2.1: Deploy Web Service on Render
1. Sign in to [Render](https://dashboard.render.com/).
2. Click **New +** > **Web Service**.
3. Connect your Git repository (`facebook_automation_mvp`).
4. Configure service settings:
   - **Name**: `facebook-page-automation` (or your choice)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or Starter
5. Under **Environment Variables**, add the following:

| Environment Variable | Recommended Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` *(Render maps its HTTP port automatically)* |
| `BASE_URL` | `https://facebook.oneingo.ai` |
| `MONGODB_URI` | `mongodb+srv://ajayoneinfo_db_user:2B4UmDnX1qQQD7tE@automaton.xg239we.mongodb.net/facebook_mvp?retryWrites=true&w=majority` |
| `META_APP_ID` | `2182342416011858` |
| `META_APP_SECRET` | `76b9ca62fa2750563886385ae3482b1c` |
| `META_CONFIG_ID` | `1675968454115396` |
| `META_GRAPH_API_VERSION` | `v26.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | `fb_mvp_verify_token_2026` |

6. Click **Create Web Service**. Wait for the initial deployment to succeed.

---

### Step 2.2: Attach Custom Domain (`facebook.oneingo.ai`)
1. In your Render Service dashboard, navigate to **Settings** > **Custom Domains**.
2. Click **+ Add Custom Domain** and enter:
   ```text
   facebook.oneingo.ai
   ```
3. Render will provide a **DNS Target** (typically `facebook-page-automation.onrender.com`).
4. Open your DNS provider (Cloudflare, GoDaddy, Namecheap, Route 53, etc.) for `oneingo.ai`:
   - Add a **CNAME** record:
     - **Host / Name**: `facebook`
     - **Target / Value**: `<your-render-service-name>.onrender.com`
     - **TTL**: Auto or 300 seconds
     - *(If using Cloudflare, set Proxy status to DNS Only or Full SSL)*
5. Render will automatically issue a free **Let's Encrypt SSL/TLS Certificate** for `https://facebook.oneingo.ai`.
6. Once the status shows **Verified**, your app is live at `https://facebook.oneingo.ai`!

---

## 3. Meta Developer App Modifications (Step-by-Step)

Log in to [Meta for Developers](https://developers.facebook.com/apps/) and select your App (`2182342416011858`):

### Step 3.1: App Settings > Basic
1. In the left sidebar, click **App Settings > Basic**.
2. Update the following fields:
   - **App Domains**:
     - `facebook.oneingo.ai`
     - `oneingo.ai`
     - `localhost` *(optional for dev)*
   - **Privacy Policy URL**:
     `https://facebook.oneingo.ai/privacy.html`
   - **Terms of Service URL**:
     `https://facebook.oneingo.ai/terms.html`
   - **User Data Deletion**:
     Select **Data Deletion Instructions URL** and enter:
     `https://facebook.oneingo.ai/data-deletion.html`
   - **App Category**: Select `Business and Pages` or `Utility`
   - **App Icon**: Upload a 1024x1024 high-resolution logo (required for App Review submission)
3. Scroll down to the **Website** platform (or click **+ Add Platform > Website**):
   - **Site URL**: `https://facebook.oneingo.ai/`
4. Click **Save Changes** at the bottom right.

---

### Step 3.2: Facebook Login / Login for Business > Settings
1. In the left sidebar, open **Facebook Login** (or **Login for Business**) > **Settings**.
2. Ensure the following toggles are set:
   - **Client OAuth Login**: `Yes`
   - **Web OAuth Login**: `Yes`
   - **Login with the JavaScript SDK**: `Yes`
3. **Allowed Domains for the JavaScript SDK**:
   - `https://facebook.oneingo.ai`
   - `http://localhost:3000` *(for local development)*
4. **Valid OAuth Redirect URIs** (Enter each exact URI):
   - `https://facebook.oneingo.ai/auth/callback`
   - `https://facebook.oneingo.ai/`
   - `http://localhost:3000/auth/callback` *(for local development)*
   - `http://localhost:3000/` *(for local development)*
5. Click **Save Changes**.

---

### Step 3.3: Webhooks Configuration
1. In the left sidebar, click **Webhooks**.
2. Select **Page** from the dropdown menu at the top.
3. Click **Edit Subscription** (or **Subscribe to this object**):
   - **Callback URL**: `https://facebook.oneingo.ai/webhook`
   - **Verify Token**: `fb_mvp_verify_token_2026`
4. Click **Verify and Save**. (Our server on Render answers immediately with HTTP 200 and echoes the challenge).
5. In the Page Webhook fields list, click **Subscribe** on:
   - `messages` (Incoming direct messages)
   - `messaging_postbacks` (Button clicks & Get Started postbacks)
   - `feed` (Comments and posts on your Page)

---

### Step 3.4: Subscribing Your Page to Webhooks
After the App webhook URL is updated, the specific Facebook Page must install the updated webhook target.
- Open `https://facebook.oneingo.ai/dashboard.html`.
- Click **🔄 Re-subscribe Page Webhooks** or re-connect your Page on `https://facebook.oneingo.ai/index.html`.

---

## 4. Meta App Review & Required Scopes

When submitting your app for Meta approval or recording your demonstration video, Meta requires explicit demonstration of why each permission is needed.

### Scopes Requested by the Application:

| Scope | Platform Feature | Justification for Meta App Review |
| :--- | :--- | :--- |
| **`pages_show_list`** | Page Selection & Discovery | Allows business owners to discover and select which of their managed Facebook Pages they wish to connect to the automation platform. |
| **`pages_messaging`** | Messenger Auto-Reply Bot | Allows the app to receive incoming customer inquiries via Messenger and instantly respond with configured keyword answers and fallback greetings. |
| **`pages_manage_posts`** | Post Publisher & Scheduling Queue | Allows Page administrators to compose, publish, and schedule status updates and photo announcements directly to the Page feed. |
| **`pages_read_engagement`** | Feed & Comments Ingestion | Allows reading posts, comments, and reactions on the Facebook Page feed to detect when community members engage with posts. |
| **`pages_manage_engagement`** | Comment Auto-Reply & Auto-Like | Enables publishing automated public responses to customer comments on Page posts and liking commenter feedback. |
| **`pages_manage_metadata`** | Webhooks Event Subscriptions | Subscribes the connected Page to app webhooks (`/{page-id}/subscribed_apps`) for real-time delivery of messages and feed events. |
| **`pages_read_user_content`** | Trigger Keyword Detection | Allows reading commenter message text and profile IDs on Page posts so keyword matching rules can detect triggers and dispatch replies. |

> [!NOTE]
> All 7 scopes are visibly presented and audited with live status badges directly on **`https://facebook.oneingo.ai/index.html`** and **`https://facebook.oneingo.ai/dashboard.html`**! Reviewers will see full transparency during your screencast.

---

## 5. Screen Recording Guide for Meta App Review

Meta requires a **screencast video** (typically 2 to 4 minutes) demonstrating how each requested permission is used in your app.

### Screencast Video Script & Step-by-Step Flow:

1. **Step 1: Introduction & Permissions Transparency (0:00 - 0:45)**
   - Open browser at `https://facebook.oneingo.ai/index.html`.
   - Show the **"Meta App Review Scopes & Permissions Guide"** card. Point out the 7 required scopes and their purposes.
   - Click **Connect Facebook (Direct OAuth Flow)**.
   - Show the Facebook OAuth consent dialog asking for Page management and messaging permissions. Accept and connect.
   - Show the successfully connected Page with active permission badges.

2. **Step 2: Dashboard & Webhook Readiness (0:45 - 1:15)**
   - Navigate to `https://facebook.oneingo.ai/dashboard.html`.
   - Point out the **Ready for Meta Screencast** banner and green readiness checks.
   - Click **🧪 Ping Webhook Verification** to show successful HTTP 200 verification handshake.

3. **Step 3: Messenger Auto-Reply Demonstration (`pages_messaging`) (1:15 - 2:00)**
   - Navigate to `https://facebook.oneingo.ai/messenger.html`.
   - Point out the **Scope: pages_messaging** badge in the header.
   - Show that **Messenger Auto-Reply Status** is ON.
   - Show a keyword rule (e.g., keyword `price` -> *"Our packages start at $29/mo!*").
   - Open Facebook Messenger on a second browser window/phone with a tester account.
   - Send the message: *"What is the price?"* to the Page.
   - Show the automated reply instantly received back in Messenger!
   - Switch back to the Dashboard and show the event logged in the **Live Webhooks Stream**.

4. **Step 4: Comment Auto-Reply Demonstration (`pages_manage_engagement`, `pages_read_engagement`) (2:00 - 3:00)**
   - Navigate to `https://facebook.oneingo.ai/comments.html`.
   - Point out the **Scopes: pages_manage_engagement, pages_read_engagement** badge.
   - Show **Global Comment Auto-Reply** set to ON, with **Auto-Like** enabled and a public reply message.
   - Open Facebook with the tester account and leave a comment on a Page post: *"Awesome post!"*
   - Return to the app and click **🔄 Sync & Reply Comments Now** (or wait for the 25s auto-poller / webhook).
   - Show on Facebook that the Page liked the comment and replied publicly!

5. **Step 5: Post Publishing Demonstration (`pages_manage_posts`) (3:00 - 3:45)**
   - Navigate to `https://facebook.oneingo.ai/posts.html`.
   - Point out the **Scope: pages_manage_posts** badge.
   - Type a post message: *"Announcing our new automated features on facebook.oneingo.ai! 🚀"*
   - Click **🚀 Publish to Facebook Page**.
   - Show the success alert with post ID.
   - Open the live Facebook Page on facebook.com and refresh the feed to show the published post!

6. **Step 6: Compliance & Conclusion (3:45 - 4:00)**
   - Point to the footer links for **Privacy Policy**, **Terms of Service**, and **User Data Deletion**.
   - Conclude the recording.

---

## 6. Live Testing Verification Checklist

Before submitting to Meta, verify the following on `https://facebook.oneingo.ai`:

- [ ] `/health` returns `{ "status": "ok", "mongodb": { "status": "connected" } }`
- [ ] `https://facebook.oneingo.ai/privacy.html` opens cleanly
- [ ] `https://facebook.oneingo.ai/terms.html` opens cleanly
- [ ] `https://facebook.oneingo.ai/data-deletion.html` opens cleanly
- [ ] Meta Developer App Webhook handshake returns green when clicking **Verify and Save**
- [ ] Facebook Page connection OAuth flow redirects cleanly back to `https://facebook.oneingo.ai/dashboard.html?connected=true`
- [ ] All 7 scopes display `✅ Granted` in the Dashboard and Connect page
