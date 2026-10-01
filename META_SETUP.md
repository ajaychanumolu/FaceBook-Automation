# Meta Developer App & System Configuration Guide

Complete guide for configuring your **Meta Developer App (`2182342416011858`)** and running the **Facebook Messenger & Pages Automation** system with **ngrok**.

---

## 1. Credentials & Configuration Summary

All values below match your `.env` configuration:

| Setting | Value |
| :--- | :--- |
| **Meta App ID** | `2182342416011858` |
| **Meta App Secret** | `76b9ca62fa2750563886385ae3482b1c` |
| **Config ID (Login for Business)** | `1675968454115396` |
| **Graph API Version** | `v26.0` |
| **Webhook Verify Token** | `fb_mvp_verify_token_2026` |
| **Active ngrok Domain** | `https://operable-overbook-gravitate.ngrok-free.dev` |
| **Local Port** | `3000` |

---

## 2. Meta Developer App Modifications (Step-by-Step)

Log in to [Meta for Developers](https://developers.facebook.com/apps/) and select your App:

### Step 2.1: App Settings > Basic
1. In the left sidebar, click **App Settings > Basic**.
2. Fill in the following fields:
   - **App Domains**:
     - `operable-overbook-gravitate.ngrok-free.dev`
     - `localhost`
   - **Privacy Policy URL**:
     `https://operable-overbook-gravitate.ngrok-free.dev/privacy.html`
   - **Terms of Service URL**:
     `https://operable-overbook-gravitate.ngrok-free.dev/terms.html`
   - **User Data Deletion**:
     Select **Data Deletion Instructions URL** and enter:
     `https://operable-overbook-gravitate.ngrok-free.dev/data-deletion.html`
3. Scroll down to the **Website** platform (or click **+ Add Platform > Website**):
   - **Site URL**: `https://operable-overbook-gravitate.ngrok-free.dev/`
4. Click **Save Changes** at the bottom right.

---

### Step 2.2: Facebook Login / Login for Business > Settings
1. In the left sidebar, open **Facebook Login** (or **Login for Business**) > **Settings**.
2. Ensure the following toggles are set:
   - **Client OAuth Login**: `Yes`
   - **Web OAuth Login**: `Yes`
   - **Login with the JavaScript SDK**: `Yes`
3. **Allowed Domains for the JavaScript SDK**:
   - `https://operable-overbook-gravitate.ngrok-free.dev`
   - `http://localhost:3000`
4. **Valid OAuth Redirect URIs** (Enter each exact URI):
   - `https://operable-overbook-gravitate.ngrok-free.dev/auth/callback`
   - `https://operable-overbook-gravitate.ngrok-free.dev/`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/`
5. Click **Save Changes**.

---

### Step 2.3: Use Cases & Permissions
Under **Use Cases** (or App Review > Permissions and Features), ensure you have:
1. **Manage everything on your Page** (Pages API)
2. **Engage with customers on Messenger from Meta** (Messenger API)

Verify that the following **6 permissions** are active for testing:
| Permission | Purpose |
| :--- | :--- |
| `pages_show_list` | Fetches your available Facebook Pages via `/me/accounts`. |
| `pages_read_engagement` | Reads Page posts, comments, and engagement. |
| `pages_manage_posts` | Publishes text, link, and photo posts to your Page feed. |
| `pages_manage_metadata` | Subscribes your Page to Webhook events (`/{page-id}/subscribed_apps`). |
| `pages_messaging` | Sends & receives Messenger messages and private replies. |
| `pages_read_user_content` | Reads commenter text and identities on Page posts. |

> [!NOTE]
> In **Development Mode**, you do **not** need App Review or Business Verification to use these permissions! They work immediately for anyone with an App Role.

---

### Step 2.4: Webhooks Configuration
1. In the left sidebar, click **Webhooks**.
2. Select **Page** from the dropdown menu at the top.
3. Click **Edit Subscription** (or **Subscribe to this object**):
   - **Callback URL**: `https://operable-overbook-gravitate.ngrok-free.dev/webhook`
   - **Verify Token**: `fb_mvp_verify_token_2026`
4. Click **Verify and Save**. (Our server answers with HTTP 200 and echoes the challenge).
5. In the Page Webhook fields list, click **Subscribe** on:
   - `messages` (Incoming direct messages)
   - `messaging_postbacks` (Button clicks & Get Started postbacks)
   - `feed` (Comments and posts on your Page)

---

### Step 2.5: Subscribing Your Page to Webhooks
After the App is subscribed to webhooks, the specific Facebook Page must also install the app.
- This happens **automatically** when you click **Connect This Page** in our web interface.
- You can also re-trigger it at any time on the Dashboard by clicking **🔄 Re-subscribe Page Webhooks**.

---

### Step 2.6: App Roles (Crucial for Testing in Development Mode)
Meta blocks non-developers from interacting with apps in Development Mode.
1. In the Meta Dashboard left sidebar, click **App Roles > Roles**.
2. Under **Testers**, verify or add your test user account (e.g. `Ajay Ch`).
3. The invited user must accept the invitation at [developers.facebook.com/requests](https://developers.facebook.com/requests).
4. **Testing Rules**:
   - Send Messenger test messages to the Page using the **Tester account** or Developer account.
   - Post comments on Page posts using the **Tester account**.

---

## 3. MongoDB Atlas IP Whitelisting

If your server logs report:
`Could not connect to any servers in your MongoDB Atlas cluster... Make sure your current IP address is on your Atlas cluster's IP whitelist`:

1. Log in to [MongoDB Cloud Atlas](https://cloud.mongodb.com/).
2. Under **Security** in the left sidebar, click **Network Access**.
3. Click **+ Add IP Address**.
4. Click **Allow Access from Anywhere** (`0.0.0.0/0`) or **Add Current IP Address**.
5. Click **Confirm**. Your server will automatically connect and resume operations without needing a restart!

---

## 4. Running the Complete System

### Terminal 1: Start the Application
```bash
npm run dev
```
Accessible locally at: `http://localhost:3000`

### Terminal 2: Start the ngrok Tunnel
```bash
npm run tunnel
```
Or manually:
```bash
ngrok http --url=operable-overbook-gravitate.ngrok-free.dev 3000
```

---

## 5. Live Testing Checklist

1. Open `http://localhost:3000/dashboard.html` or `https://operable-overbook-gravitate.ngrok-free.dev/dashboard.html`.
2. Click **🧪 Ping Webhook Verification** to confirm your webhook verification handshake is green.
3. Go to `http://localhost:3000/index.html` and connect your Facebook Page.
4. Go to `http://localhost:3000/messenger.html` and configure:
   - Turn **Messenger Auto-Reply Status** to **ON**.
   - Add keyword rules (e.g. `price` -> *"Our packages start at $29/mo!"*).
   - Test it instantly in the **Live Message Simulator**.
5. Go to `http://localhost:3000/comments.html` and configure:
   - Turn **Global Comment Auto-Reply** to **ON**.
   - Check **❤️ Auto-Like User Comments**.
   - Enter your public reply and optional private DM.
6. Go to `http://localhost:3000/posts.html` to publish a text post or photo post to your Page.
7. Have your test user (`Ajay Ch`) send a message to the Page or comment on a post; watch the automated replies fire and monitor the live log stream on the **Dashboard**!
