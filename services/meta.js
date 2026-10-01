const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';
const BASE_GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Helper to make HTTP requests to Meta Graph API using native fetch
 */
async function graphRequest(url, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok || data.error) {
    const errorDetails = data.error || { message: `HTTP Error ${response.status}: ${response.statusText}` };
    const err = new Error(errorDetails.message || 'Meta API Error');
    err.metaError = errorDetails;
    err.status = response.status;
    throw err;
  }

  return data;
}

/**
 * Exchange Authorization Code for User Access Token
 */
async function exchangeCodeForToken(code, redirectUri) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const tryUris = [];
  if (redirectUri && redirectUri !== 'undefined' && redirectUri.trim() !== '') {
    tryUris.push(redirectUri);
    const alt = redirectUri.endsWith('/') ? redirectUri.slice(0, -1) : redirectUri + '/';
    if (!tryUris.includes(alt)) tryUris.push(alt);
  }
  // Also try omitted/empty for FB.login JS SDK popup flows
  tryUris.push(null);
  tryUris.push('');

  let lastErr = null;
  for (const uri of tryUris) {
    try {
      const params = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code: code
      });
      if (uri !== null) {
        params.append('redirect_uri', uri);
      }
      const url = `${BASE_GRAPH_URL}/oauth/access_token?${params.toString()}`;
      console.log(`[Meta] Token exchange attempt with redirect_uri: ${uri === null ? '<omitted>' : `"${uri}"`}`);
      const res = await graphRequest(url, { method: 'GET' });
      console.log(`[Meta] Token exchange successful!`);
      return res;
    } catch (err) {
      lastErr = err;
      const isMismatch = err.metaError?.error_subcode === 36008 ||
                         err.message?.includes('redirect_uri') ||
                         err.metaError?.message?.includes('redirect_uri');
      if (!isMismatch) {
        throw err;
      }
      console.warn(`[Meta] Redirect URI mismatch for ${uri === null ? '<omitted>' : `"${uri}"`}. Trying next candidate...`);
    }
  }
  throw lastErr;
}

/**
 * Exchange short-lived User token for long-lived User token (lasts ~60 days)
 */
async function getLongLivedUserToken(shortToken) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken
  });

  const url = `${BASE_GRAPH_URL}/oauth/access_token?${params.toString()}`;
  return await graphRequest(url, { method: 'GET' });
}

/**
 * Get available Pages for the authenticated user
 */
async function getAvailablePages(userAccessToken) {
  const url = `${BASE_GRAPH_URL}/me/accounts?fields=id,name,access_token,category,tasks&access_token=${encodeURIComponent(userAccessToken)}`;
  const result = await graphRequest(url, { method: 'GET' });
  return result.data || [];
}

/**
 * Subscribe a Page to App Webhooks (messages, messaging_postbacks, feed)
 */
async function subscribePageToWebhooks(pageId, pageAccessToken) {
  const url = `${BASE_GRAPH_URL}/${pageId}/subscribed_apps`;
  const body = {
    subscribed_fields: 'messages,messaging_postbacks,feed',
    access_token: pageAccessToken
  };

  return await graphRequest(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Check which webhook fields are currently subscribed for a Page
 */
async function getPageSubscriptionStatus(pageId, pageAccessToken) {
  const url = `${BASE_GRAPH_URL}/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageAccessToken)}`;
  return await graphRequest(url, { method: 'GET' });
}

/**
 * Get Facebook Page details (name, category, etc.)
 */
async function getPageDetails(pageId, pageAccessToken) {
  const url = `${BASE_GRAPH_URL}/${pageId}?fields=id,name,category&access_token=${encodeURIComponent(pageAccessToken)}`;
  return await graphRequest(url, { method: 'GET' });
}

/**
 * Get posts from a Facebook Page
 */
async function getPagePosts(pageId, pageAccessToken) {
  const url = `${BASE_GRAPH_URL}/${pageId}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=25&access_token=${encodeURIComponent(pageAccessToken)}`;
  const result = await graphRequest(url, { method: 'GET' });
  return result.data || [];
}

/**
 * Publish a new text/link post to the Facebook Page feed
 */
async function publishPagePost(pageId, pageAccessToken, message, link) {
  const url = `${BASE_GRAPH_URL}/${pageId}/feed`;
  const body = {
    message: message,
    access_token: pageAccessToken
  };
  if (link && link.trim()) {
    body.link = link.trim();
  }

  return await graphRequest(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Publish a photo with caption to the Facebook Page
 */
async function publishPagePhoto(pageId, pageAccessToken, photoUrl, caption) {
  const url = `${BASE_GRAPH_URL}/${pageId}/photos`;
  const body = {
    url: photoUrl,
    caption: caption || '',
    access_token: pageAccessToken
  };

  return await graphRequest(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Send Messenger reply via Meta Send API
 */
async function sendMessengerMessage(pageAccessToken, recipientId, text, quickReplies = null) {
  const url = `${BASE_GRAPH_URL}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const messagePayload = { text: text };
  if (Array.isArray(quickReplies) && quickReplies.length > 0) {
    messagePayload.quick_replies = quickReplies;
  }

  const body = {
    recipient: { id: recipientId },
    message: messagePayload,
    messaging_type: 'RESPONSE'
  };

  return await graphRequest(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Send a public reply to a comment on a Page post
 */
async function replyToComment(commentId, pageAccessToken, message) {
  const url = `${BASE_GRAPH_URL}/${commentId}/comments?access_token=${encodeURIComponent(pageAccessToken)}`;
  const body = {
    message: message
  };

  return await graphRequest(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Like a comment as the Page
 */
async function likeComment(commentId, pageAccessToken) {
  try {
    const url = `${BASE_GRAPH_URL}/${commentId}/likes?access_token=${encodeURIComponent(pageAccessToken)}`;
    const result = await graphRequest(url, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err.metaError || { message: err.message }
    };
  }
}

/**
 * Send an optional private reply (Messenger DM) to a commenter.
 * Captures Meta error details gracefully so public reply flow continues.
 */
async function sendPrivateReplyToComment(pageId, pageAccessToken, commentId, text) {
  try {
    const url = `${BASE_GRAPH_URL}/${pageId}/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
    const body = {
      recipient: { comment_id: commentId },
      message: { text: text }
    };

    const result = await graphRequest(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return { success: true, result };
  } catch (err) {
    return {
      success: false,
      error: err.metaError || { message: err.message }
    };
  }
}

/**
 * Debug access token to inspect scopes and validity
 */
async function debugToken(inputToken) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const url = `${BASE_GRAPH_URL}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
  return await graphRequest(url, { method: 'GET' });
}

module.exports = {
  GRAPH_VERSION,
  BASE_GRAPH_URL,
  exchangeCodeForToken,
  getLongLivedUserToken,
  getAvailablePages,
  subscribePageToWebhooks,
  getPageSubscriptionStatus,
  getPageDetails,
  getPagePosts,
  publishPagePost,
  publishPagePhoto,
  sendMessengerMessage,
  replyToComment,
  likeComment,
  sendPrivateReplyToComment,
  debugToken
};
