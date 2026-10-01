const mongoose = require('mongoose');
const Page = require('../models/Page');
const Automation = require('../models/Automation');
const WebhookEvent = require('../models/WebhookEvent');
const webhookRoutes = require('../routes/webhook');
const metaService = require('./meta');

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';

let isSyncing = false;
let pollerInterval = null;

/**
 * Fetch and process live Facebook comments for all active automations
 * Solves Meta Development Mode limitation where live feed webhooks are suppressed by Meta.
 */
async function syncRecentComments() {
  if (isSyncing) {
    return { success: true, message: 'Sync already in progress', processedCount: 0 };
  }

  if (mongoose.connection.readyState !== 1) {
    return { success: false, message: 'Database not connected', processedCount: 0 };
  }

  isSyncing = true;
  let totalProcessed = 0;
  let totalChecked = 0;

  try {
    const page = await Page.findOne({ isConnected: true });
    if (!page || !page.pageAccessToken) {
      return { success: false, message: 'No connected Page with valid access token', processedCount: 0 };
    }

    const automations = await Automation.find({ type: 'comment', isEnabled: true });
    if (automations.length === 0) {
      return { success: true, message: 'No enabled comment automations found', processedCount: 0 };
    }

    // Collect target post IDs
    const targetPostIds = new Set();
    const hasGlobal = automations.some(a => a.isGlobal);

    for (const auto of automations) {
      if (!auto.isGlobal && auto.postId) {
        const pId = String(auto.postId).trim();
        const fullId = pId.includes('_') ? pId : `${page.pageId}_${pId}`;
        targetPostIds.add(fullId);
      }
    }

    // If global fallback is enabled, also fetch the top 5 recent posts from the page feed
    if (hasGlobal) {
      try {
        const postsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${page.pageId}/posts?fields=id&limit=5&access_token=${encodeURIComponent(page.pageAccessToken)}`;
        const res = await fetch(postsUrl);
        const data = await res.json();
        if (Array.isArray(data.data)) {
          for (const p of data.data) {
            targetPostIds.add(p.id);
          }
        }
      } catch (err) {
        console.warn('[Comment Poller] Error fetching recent posts for global automation:', err.message);
      }
    }

    totalChecked = targetPostIds.size;

    // Check comments on each target post
    for (const postId of targetPostIds) {
      try {
        const commentsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${postId}/comments?fields=id,message,from,created_time&limit=25&access_token=${encodeURIComponent(page.pageAccessToken)}`;
        const cRes = await fetch(commentsUrl);
        const cData = await cRes.json();

        if (!Array.isArray(cData.data)) {
          continue;
        }

        for (const comment of cData.data) {
          // Skip if comment is authored by the Page itself
          if (comment.from?.id === page.pageId) {
            continue;
          }

          // Skip if already processed
          const existing = await WebhookEvent.findOne({
            commentId: comment.id,
            status: 'processed'
          });
          if (existing) {
            continue;
          }

          console.log(`[Comment Poller] Found unprocessed comment: ${comment.id} from ${comment.from?.name || 'User'} ("${comment.message}") on post ${postId}`);

          // Construct standard Meta feed change structure and execute handler
          const changeItem = {
            field: 'feed',
            value: {
              item: 'comment',
              verb: 'add',
              comment_id: comment.id,
              post_id: postId,
              sender_id: comment.from?.id,
              sender_name: comment.from?.name,
              message: comment.message,
              created_time: Math.floor(new Date(comment.created_time || Date.now()).getTime() / 1000)
            }
          };

          await webhookRoutes.handleFeedEvent(changeItem, { id: page.pageId });
          totalProcessed++;
        }
      } catch (postErr) {
        console.warn(`[Comment Poller] Error checking comments on post ${postId}:`, postErr.message);
      }
    }

    return {
      success: true,
      processedCount: totalProcessed,
      postsChecked: totalChecked,
      message: `Checked ${totalChecked} posts, processed ${totalProcessed} new comments.`
    };
  } catch (err) {
    console.error('[Comment Poller] Error in syncRecentComments:', err.message);
    return { success: false, error: err.message, processedCount: totalProcessed };
  } finally {
    isSyncing = false;
  }
}

/**
 * Start periodic comment poller
 */
function startPoller(intervalMs = 25000) {
  if (pollerInterval) {
    clearInterval(pollerInterval);
  }

  console.log(`[Comment Poller] ⚡ Automated Facebook Comment Poller started (running every ${Math.round(intervalMs / 1000)}s)`);

  // Initial run after brief delay to let MongoDB connect
  setTimeout(() => {
    syncRecentComments().catch(() => {});
  }, 3000);

  pollerInterval = setInterval(() => {
    syncRecentComments().catch(err => {
      console.error('[Comment Poller Interval Error]:', err.message);
    });
  }, intervalMs);

  return pollerInterval;
}

function stopPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('[Comment Poller] Poller stopped.');
  }
}

module.exports = {
  syncRecentComments,
  startPoller,
  stopPoller
};
