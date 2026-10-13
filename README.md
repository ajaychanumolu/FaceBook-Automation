# Facebook Page Automation Platform

A complete, production-ready Facebook Page Automation system built with **Node.js, Express.js, MongoDB, and Vanilla HTML/CSS/JavaScript**, deployed on **Render** with the custom domain **`https://facebook.oneingo.ai`**.

---

## 🚀 Core Features

1. **Facebook Page Connection**:
   - Direct OAuth 2.0 flow with explicit scope requesting (`pages_show_list, pages_messaging, pages_manage_posts, pages_read_engagement, pages_manage_engagement, pages_manage_metadata, pages_read_user_content`).
   - Popup Embedded Signup (via Meta JS SDK and Business Login Config ID).
   - Direct Page Token fallback for instant testing.
2. **Messenger Auto-Reply Bot**:
   - Real-time response to customer inquiries via Meta Send API.
   - Intelligent keyword-matching rules (e.g. `price`, `hours`, `support`) with fallback default greeting.
   - Built-in Live Message Simulator for instant testing without opening Facebook.
3. **Post Comment Automation & Auto-Like**:
   - Threaded public comment responses and optional private Messenger replies.
   - Automated comment liking as the Page.
   - Global default automation rule or granular per-post custom rules.
   - Background Poller (runs every 25s) to guarantee zero missed comments.
4. **Facebook Post Publisher & Scheduler**:
   - Immediate publish to Page feed or photo albums via Meta Graph API.
   - Scheduled post queue powered by resilient `node-cron` workers.
5. **Real-time Diagnostic Dashboard & Live Webhooks Stream**:
   - Inspect live payloads sent by Meta Webhooks.
   - 1-click Webhook Handshake Verification test.
   - Real-time Meta Scopes & Permissions Health audit table for Meta App Reviewers.

---

## 🌐 Production Architecture

- **Domain**: `https://facebook.oneingo.ai`
- **Host**: [Render](https://dashboard.render.com/) (Web Service with automatic SSL)
- **Database**: MongoDB Atlas Cluster
- **Webhook Endpoint**: `https://facebook.oneingo.ai/webhook`
- **Health Check**: `https://facebook.oneingo.ai/health`
- **Legal Compliance Pages**:
  - Privacy Policy: `https://facebook.oneingo.ai/privacy.html`
  - Terms of Service: `https://facebook.oneingo.ai/terms.html`
  - Data Deletion Instructions: `https://facebook.oneingo.ai/data-deletion.html`

---

## 🔐 Meta Permissions & Scopes

The application explicitly requests and displays the following 7 permissions directly on the user interface:

| Permission (Scope) | Platform Feature | Justification for Meta App Review |
| :--- | :--- | :--- |
| `pages_show_list` | Page Discovery | Displays user's managed Facebook Pages to select for automation. |
| `pages_messaging` | Messenger Bot | Listens for incoming direct messages and delivers instant automated replies. |
| `pages_manage_posts` | Post Scheduler | Composes, schedules, and publishes status posts and photos to the Page feed. |
| `pages_read_engagement` | Feed Ingestion | Reads engagement metrics, posts, and comments on the Page. |
| `pages_manage_engagement` | Comment Automation | Publishes automated public replies and likes user comments. |
| `pages_manage_metadata` | Webhook Subscriptions | Subscribes Page to App Webhooks (`subscribed_apps`) for real-time delivery. |
| `pages_read_user_content` | Trigger Keyword Detection | Reads user comment text on Page posts to detect keyword triggers. |

---

## 🛠️ Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Run locally
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 📚 Guides & Documentation

- [META_SETUP.md](file:///c:/Users/PC/Desktop/facebook_automation_mvp/META_SETUP.md) — Step-by-step Meta Developer Portal configuration, Render deployment guide, and Meta App Review screencast script.
- [TROUBLESHOOTING.md](file:///c:/Users/PC/Desktop/facebook_automation_mvp/TROUBLESHOOTING.md) — Common error resolutions, MongoDB Atlas whitelisting, and daily operations guide.
