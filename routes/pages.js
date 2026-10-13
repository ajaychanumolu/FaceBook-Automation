const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const metaService = require('../services/meta');

/**
 * GET /api/pages/config - Return client Meta credentials for JS SDK
 */
router.get('/config', (req, res) => {
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toLowerCase();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  let baseUrl = process.env.BASE_URL || '';
  if (host && (host.includes('oneinfo.ai') || host.includes('localhost') || host.includes('render.com'))) {
    baseUrl = `${protocol}://${host}`;
  } else if (baseUrl) {
    baseUrl = baseUrl.replace(/oneingo\.ai/gi, 'oneinfo.ai');
  }
  res.json({
    appId: process.env.META_APP_ID || '',
    configId: process.env.META_CONFIG_ID || '',
    version: process.env.META_GRAPH_API_VERSION || 'v26.0',
    baseUrl: baseUrl
  });
});

/**
 * GET /api/pages/current - Get currently connected Page
 */
router.get('/current', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ connected: false, dbConnected: false });
    }
    const page = await Page.findOne({ isConnected: true });
    if (!page) {
      return res.json({ connected: false, dbConnected: true });
    }
    res.json({
      connected: true,
      dbConnected: true,
      page: {
        pageId: page.pageId,
        pageName: page.pageName,
        category: page.category,
        webhookSubscribed: page.webhookSubscribed,
        webhookError: page.webhookError,
        connectedAt: page.connectedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pages/permissions - Inspect Page Token permissions and readiness diagnostics
 */
router.get('/permissions', async (req, res) => {
  try {
    const page = await Page.findOne({ isConnected: true });
    if (!page) {
      return res.json({
        success: true,
        connected: false,
        message: 'No Page currently connected'
      });
    }

    let debugInfo = null;
    let scopes = [];
    let isValid = false;

    try {
      const debugRes = await metaService.debugToken(page.pageAccessToken);
      debugInfo = debugRes.data;
      scopes = debugInfo?.scopes || [];
      isValid = Boolean(debugInfo?.is_valid);
    } catch (dErr) {
      console.warn('[Pages] debug_token warning:', dErr.message);
    }

    const hasMessenger = scopes.includes('pages_messaging');
    const hasPosts = scopes.includes('pages_manage_posts');
    const hasCommentsManage = scopes.includes('pages_manage_engagement');
    const hasCommentsRead = scopes.includes('pages_read_engagement');
    const hasComments = hasCommentsManage && hasCommentsRead;

    const missingCommentScopes = [];
    if (!hasCommentsRead) missingCommentScopes.push('pages_read_engagement');
    if (!hasCommentsManage) missingCommentScopes.push('pages_manage_engagement');

    const requiredScopesConfig = [
      {
        scope: 'pages_show_list',
        name: 'Show List of Pages',
        feature: 'Page Selection & Discovery',
        justification: 'Enables the user to view and choose which of their Facebook Pages to connect to the automation platform.',
        required: true
      },
      {
        scope: 'pages_messaging',
        name: 'Send & Receive Messenger Messages',
        feature: 'Messenger Keyword Auto-Reply Bot',
        justification: 'Enables the application to listen for customer inquiries sent to the Page Messenger and deliver instant automated replies based on configured keyword rules.',
        required: true
      },
      {
        scope: 'pages_manage_posts',
        name: 'Manage Page Posts',
        feature: 'Post Publisher & Scheduled Queue',
        justification: 'Allows the user to compose, publish, and schedule status updates and media posts to their Facebook Page feed.',
        required: true
      },
      {
        scope: 'pages_read_engagement',
        name: 'Read Page Engagement',
        feature: 'Feed & Comments Ingestion',
        justification: 'Allows reading posts, comments, and reactions on the Facebook Page feed to monitor user engagement.',
        required: true
      },
      {
        scope: 'pages_manage_engagement',
        name: 'Manage Page Engagement',
        feature: 'Comment Auto-Reply & Auto-Like',
        justification: 'Enables publishing public comment responses and liking customer comments automatically when trigger criteria are met.',
        required: true
      },
      {
        scope: 'pages_manage_metadata',
        name: 'Manage Page Subscriptions',
        feature: 'Webhooks Event Subscriptions',
        justification: 'Subscribes the connected Page to the App Webhooks endpoint (subscribed_apps) for real-time delivery of messages and feed events.',
        required: true
      },
      {
        scope: 'pages_read_user_content',
        name: 'Read User Content on Page',
        feature: 'Trigger Keyword Detection',
        justification: 'Allows reading user comment text and user IDs on Page posts so automation rules can match target keywords.',
        required: false
      }
    ];

    const scopeAudit = requiredScopesConfig.map(item => ({
      ...item,
      granted: scopes.includes(item.scope)
    }));

    res.json({
      success: true,
      connected: true,
      pageId: page.pageId,
      pageName: page.pageName,
      isValid,
      scopes,
      scopeAudit,
      readiness: {
        messenger: hasMessenger,
        posts: hasPosts,
        comments: hasComments
      },
      missingCommentScopes,
      note: missingCommentScopes.length > 0
        ? `To fully enable comment auto-reply, re-authorize your Page on /index.html or generate a token with: ${missingCommentScopes.join(', ')}`
        : 'All required permissions for Messenger, Posts, and Comments are verified!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pages/connect - Exchange code or accept user token to fetch available Pages
 */
router.post('/connect', async (req, res) => {
  try {
    const { code, redirectUri, userAccessToken } = req.body;
    let token = userAccessToken;

    // If an authorization code was received from FB.login
    if (code) {
      console.log('[Pages] Exchanging authorization code for User Access Token...');
      const tokenResponse = await metaService.exchangeCodeForToken(code, redirectUri);
      token = tokenResponse.access_token;
    }

    if (!token) {
      return res.status(400).json({ error: 'User access token or authorization code is required' });
    }

    // Try upgrading to long-lived token
    try {
      const longLived = await metaService.getLongLivedUserToken(token);
      if (longLived.access_token) {
        token = longLived.access_token;
      }
    } catch (llErr) {
      console.warn('[Pages] Could not exchange for long-lived token:', llErr.message);
    }

    // Fetch pages accessible to this user
    console.log('[Pages] Fetching available Pages from /me/accounts...');
    const pages = await metaService.getAvailablePages(token);

    res.json({
      success: true,
      userAccessToken: token,
      pages: pages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks,
        access_token: p.access_token
      }))
    });
  } catch (err) {
    console.error('[Pages] Error during connect/fetch pages:', err.metaError || err.message);
    res.status(400).json({
      success: false,
      error: err.metaError || { message: err.message }
    });
  }
});

/**
 * POST /api/pages/select - Select and save Page to connect
 */
router.post('/select', async (req, res) => {
  try {
    const { pageId, pageName, pageAccessToken, userAccessToken, category, tasks } = req.body;

    if (!pageId || !pageAccessToken) {
      return res.status(400).json({ error: 'Page ID and Page Access Token are required' });
    }

    // Disconnect any existing page (MVP supports ONE active Page)
    await Page.updateMany({}, { isConnected: false });

    // Try subscribing page to webhooks
    let webhookSubscribed = false;
    let webhookError = null;

    try {
      console.log(`[Pages] Subscribing Page ${pageId} to webhooks...`);
      await metaService.subscribePageToWebhooks(pageId, pageAccessToken);
      webhookSubscribed = true;
      console.log(`[Pages] Page ${pageId} successfully subscribed to webhooks!`);
    } catch (subErr) {
      webhookError = subErr.metaError?.message || subErr.message;
      console.warn(`[Pages] Webhook subscription notice: ${webhookError}`);
    }

    // Upsert Page record
    const page = await Page.findOneAndUpdate(
      { pageId },
      {
        pageId,
        pageName: pageName || 'Facebook Page',
        pageAccessToken,
        userAccessToken,
        category,
        tasks,
        isConnected: true,
        webhookSubscribed,
        webhookError,
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Page connected successfully',
      page: {
        pageId: page.pageId,
        pageName: page.pageName,
        category: page.category,
        webhookSubscribed: page.webhookSubscribed,
        webhookError: page.webhookError
      }
    });
  } catch (err) {
    console.error('[Pages] Error selecting page:', err);
    res.status(500).json({
      success: false,
      error: err.metaError || { message: err.message }
    });
  }
});

/**
 * POST /api/pages/direct-connect - Connect directly using a Page Access Token & Page ID
 */
router.post('/direct-connect', async (req, res) => {
  try {
    const { pageId, pageName, pageAccessToken } = req.body;
    if (!pageId || !pageAccessToken) {
      return res.status(400).json({ error: 'Page ID and Page Access Token are required.' });
    }

    let resolvedName = pageName;
    let resolvedCategory = 'Facebook Page';
    try {
      const details = await metaService.getPageDetails(pageId, pageAccessToken);
      if (details.name) resolvedName = details.name;
      if (details.category) resolvedCategory = details.category;
    } catch (e) {
      if (!resolvedName) resolvedName = `Page (${pageId})`;
    }

    await Page.updateMany({}, { isConnected: false });

    let webhookSubscribed = false;
    let webhookError = null;

    try {
      await metaService.subscribePageToWebhooks(pageId, pageAccessToken);
      webhookSubscribed = true;
    } catch (subErr) {
      webhookError = subErr.metaError?.message || subErr.message;
    }

    const page = await Page.findOneAndUpdate(
      { pageId },
      {
        pageId,
        pageName: resolvedName,
        category: resolvedCategory,
        pageAccessToken,
        isConnected: true,
        webhookSubscribed,
        webhookError,
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      page: {
        pageId: page.pageId,
        pageName: page.pageName,
        webhookSubscribed: page.webhookSubscribed,
        webhookError: page.webhookError
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pages/subscribe-webhooks - Re-attempt subscribing the active Page to webhooks
 */
router.post('/subscribe-webhooks', async (req, res) => {
  try {
    const page = await Page.findOne({ isConnected: true });
    if (!page) {
      return res.status(400).json({ error: 'No active Page is connected.' });
    }

    await metaService.subscribePageToWebhooks(page.pageId, page.pageAccessToken);
    page.webhookSubscribed = true;
    page.webhookError = null;
    await page.save();

    res.json({ success: true, message: 'Page successfully subscribed to webhook events!' });
  } catch (err) {
    const errorDetails = err.metaError || { message: err.message };
    if (page) {
      page.webhookSubscribed = false;
      page.webhookError = errorDetails.message;
      await page.save();
    }
    res.status(400).json({ success: false, error: errorDetails });
  }
});

/**
 * POST /api/pages/disconnect - Disconnect active Page
 */
router.post('/disconnect', async (req, res) => {
  try {
    await Page.updateMany({}, { isConnected: false });
    res.json({ success: true, message: 'Page disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
