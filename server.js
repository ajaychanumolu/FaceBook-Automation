require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const Page = require('./models/Page');
const ScheduledPost = require('./models/ScheduledPost');
const WebhookEvent = require('./models/WebhookEvent');
const metaService = require('./services/meta');
const commentPoller = require('./services/commentPoller');

const webhookRoutes = require('./routes/webhook');
const pagesRoutes = require('./routes/pages');
const messengerRoutes = require('./routes/messenger');
const commentsRoutes = require('./routes/comments');
const postsRoutes = require('./routes/posts');
const eventsRoutes = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable reverse proxy trust for Render / Cloudflare / HTTPS headers
app.set('trust proxy', 1);

// Enable CORS
app.use(cors());

// Parse JSON with rawBody capture for Meta Webhook HMAC SHA-256 signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/webhook', webhookRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/messenger', messengerRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/events', eventsRoutes);

// Helper: Build the EXACT redirect_uri for OAuth dialog and token exchange
function buildRedirectUri(req) {
  if (process.env.BASE_URL) {
    return `${process.env.BASE_URL.replace(/\/$/, '')}/auth/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/auth/callback`;
}

// Server-side OAuth redirect flow
app.get('/auth/facebook', (req, res) => {
  const redirectUri = buildRedirectUri(req);
  const version = process.env.META_GRAPH_API_VERSION || 'v26.0';
  const appId = process.env.META_APP_ID;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata,pages_messaging,pages_manage_engagement,pages_read_user_content',
    auth_type: 'rerequest',
    state: 'fb_mvp_' + Date.now()
  });

  const oauthUrl = `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
  console.log(`[OAuth] Redirecting to Meta OAuth Dialog`);
  console.log(`[OAuth]   redirect_uri: ${redirectUri}`);
  console.log(`[OAuth]   Full URL: ${oauthUrl}`);
  res.redirect(oauthUrl);
});

app.get('/auth/callback', async (req, res) => {
  try {
    console.log(`[OAuth Callback] Full query params:`, JSON.stringify(req.query));

    const { code, error, error_reason, error_description } = req.query;

    if (error) {
      console.error('[OAuth Callback] Error from Meta:', { error, error_reason, error_description });
      return res.redirect(`/index.html?error=${encodeURIComponent(error_description || error_reason || error)}`);
    }

    if (!code) {
      console.error('[OAuth Callback] No code in query params. Full URL:', req.originalUrl);
      return res.redirect('/index.html?error=' + encodeURIComponent('No authorization code received from Facebook. Please try again.'));
    }

    const redirectUri = buildRedirectUri(req);
    console.log(`[OAuth] Exchanging code for token with redirect_uri: ${redirectUri}`);

    const tokenData = await metaService.exchangeCodeForToken(code, redirectUri);
    let userToken = tokenData.access_token;
    console.log(`[OAuth] Got user access token (length: ${userToken.length})`);

    try {
      const longLived = await metaService.getLongLivedUserToken(userToken);
      if (longLived.access_token) {
        userToken = longLived.access_token;
        console.log(`[OAuth] Upgraded to long-lived token`);
      }
    } catch (e) {
      console.warn('[OAuth] Long-lived token exchange skipped:', e.message);
    }

    const pages = await metaService.getAvailablePages(userToken);
    console.log(`[OAuth] Retrieved ${pages.length} Page(s) from Meta`);

    if (pages.length === 1) {
      const p = pages[0];
      await Page.updateMany({}, { isConnected: false });

      let webhookSubscribed = false;
      let webhookError = null;
      try {
        await metaService.subscribePageToWebhooks(p.id, p.access_token);
        webhookSubscribed = true;
      } catch (subErr) {
        webhookError = subErr.metaError?.message || subErr.message;
        console.warn(`[OAuth] Webhook subscription notice: ${webhookError}`);
      }

      await Page.findOneAndUpdate(
        { pageId: p.id },
        {
          pageId: p.id,
          pageName: p.name,
          pageAccessToken: p.access_token,
          userAccessToken: userToken,
          category: p.category,
          tasks: p.tasks,
          isConnected: true,
          webhookSubscribed,
          webhookError,
          connectedAt: new Date()
        },
        { upsert: true, new: true }
      );

      console.log(`[OAuth] ✅ Auto-connected Page "${p.name}" (${p.id})`);
      return res.redirect('/dashboard.html?connected=true');
    }

    // Multiple pages — send token to frontend for user to pick
    return res.redirect(`/index.html?token=${encodeURIComponent(userToken)}`);
  } catch (err) {
    console.error('[OAuth Callback Exception]:', err.metaError || err.message);
    const msg = err.metaError?.message || err.message;
    return res.redirect(`/index.html?error=${encodeURIComponent(msg)}`);
  }
});

// Detailed health and diagnostics check endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : (dbState === 2 ? 'connecting' : 'disconnected');

  res.json({
    status: 'ok',
    timestamp: new Date(),
    mongodb: {
      status: dbStatus,
      readyState: dbState,
      note: dbState !== 1 ? 'If disconnected, check MongoDB Atlas Network Access (IP Whitelist 0.0.0.0/0).' : 'Active'
    },
    meta: {
      appId: process.env.META_APP_ID ? `${process.env.META_APP_ID.substring(0, 6)}...` : 'missing',
      graphVersion: process.env.META_GRAPH_API_VERSION || 'v26.0',
      baseUrl: process.env.BASE_URL || null,
      webhookVerifyTokenConfigured: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN)
    }
  });
});

// Setup scheduled posts cron worker (runs once every minute)
cron.schedule('* * * * *', async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return; // Wait until DB is connected
    }

    const now = new Date();
    const duePosts = await ScheduledPost.find({
      status: 'scheduled',
      scheduledTime: { $lte: now }
    });

    if (duePosts.length === 0) return;

    console.log(`[Cron] Found ${duePosts.length} due scheduled post(s) to publish.`);

    const connectedPage = await Page.findOne({ isConnected: true });
    if (!connectedPage) {
      console.warn('[Cron] Cannot publish scheduled posts: No active Facebook Page connected.');
      return;
    }

    for (const post of duePosts) {
      try {
        console.log(`[Cron] Publishing scheduled post ${post._id}: "${post.message.substring(0, 30)}..."`);
        let result;

        if (post.photoUrl) {
          result = await metaService.publishPagePhoto(
            connectedPage.pageId,
            connectedPage.pageAccessToken,
            post.photoUrl,
            post.message
          );
        } else {
          result = await metaService.publishPagePost(
            connectedPage.pageId,
            connectedPage.pageAccessToken,
            post.message,
            post.link
          );
        }

        const postIdResult = result.id || result.post_id;
        post.status = 'published';
        post.metaPostId = postIdResult;
        post.publishedAt = new Date();
        post.error = null;
        await post.save();

        await WebhookEvent.create({
          eventType: 'post',
          postId: postIdResult,
          messageText: post.message,
          status: 'processed',
          actionsTaken: [`Cron published scheduled post: ID ${postIdResult}`],
          rawPayload: result
        }).catch(() => {});

        console.log(`[Cron] Successfully published scheduled post: ${postIdResult}`);
      } catch (postErr) {
        const errorInfo = postErr.metaError || { message: postErr.message };
        console.error(`[Cron] Failed to publish scheduled post ${post._id}:`, errorInfo);

        post.status = 'failed';
        post.error = errorInfo;
        await post.save();

        await WebhookEvent.create({
          eventType: 'error',
          messageText: post.message,
          status: 'failed',
          error: errorInfo,
          actionsTaken: ['Cron failed to publish scheduled post']
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Cron Worker Error]:', err.message);
  }
});

// Resilient MongoDB connection manager
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/facebook_mvp';
  console.log('[Database] Connecting to MongoDB...');

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[Database] ✅ Successfully connected to MongoDB Atlas!');
  } catch (err) {
    console.warn('========================================================================');
    console.warn('[Database] ⚠️ Notice: MongoDB connection failed on startup:');
    console.warn(`   Reason: ${err.message}`);
    console.warn('   👉 Action: If using MongoDB Atlas, verify your IP is whitelisted at:');
    console.warn('      MongoDB Atlas -> Network Access -> Add IP Address (use 0.0.0.0/0 for dev)');
    console.warn('   The server will keep running and retry connecting in the background...');
    console.warn('========================================================================');

    // Retry connection periodically without crashing the server
    const retryInterval = setInterval(async () => {
      try {
        console.log('[Database] Retrying MongoDB connection...');
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('[Database] ✅ MongoDB connected successfully on retry!');
        clearInterval(retryInterval);
      } catch (retryErr) {
        console.warn(`[Database] Retry failed (${retryErr.message}). Next attempt in 15s.`);
      }
    }, 15000);
  }
}

// Start Server
function startServer() {
  connectDatabase();
  commentPoller.startPoller(25000);

  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Facebook Page Automation MVP running at:`);
    console.log(`   Local Website: http://localhost:${PORT}`);
    console.log(`   Webhook URL:   http://localhost:${PORT}/webhook`);
    console.log(`   Public Domain: ${process.env.BASE_URL || 'Not specified in .env'}`);
    console.log(`   Meta App ID:   ${process.env.META_APP_ID}`);
    console.log(`   Graph Version: ${process.env.META_GRAPH_API_VERSION || 'v26.0'}`);
    console.log('====================================================');
  });
}

startServer();
