const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Page = require('../models/Page');
const Automation = require('../models/Automation');
const WebhookEvent = require('../models/WebhookEvent');
const metaService = require('../services/meta');
const mongoose = require('mongoose');

/**
 * Verify Webhook Signature with META_APP_SECRET
 * Fixes Node.js crypto.timingSafeEqual crash when buffer lengths differ
 */
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.META_APP_SECRET;

  if (!signature || !appSecret) {
    return false;
  }

  const parts = signature.split('=');
  if (parts.length !== 2) {
    return false;
  }
  const sigHash = parts[1];

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody || '')
    .digest('hex');

  const sigBuf = Buffer.from(sigHash, 'utf8');
  const expBuf = Buffer.from(expectedHash, 'utf8');

  // Prevent timingSafeEqual throw if lengths do not match
  if (sigBuf.length !== expBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * GET /webhook - Meta Webhook Verification Handshake
 */
router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  console.log(`[Webhook Verification] Mode: ${mode}, Token received: ${token}`);

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Webhook Verification] Handshake Successful. Challenge echoed.');
    // Echo challenge IMMEDIATELY to satisfy Meta's tight timeout
    res.status(200).send(challenge);

    if (mongoose.connection.readyState === 1) {
      WebhookEvent.create({
        eventType: 'verification',
        status: 'processed',
        actionsTaken: ['Webhook handshake verified successfully'],
        rawPayload: req.query
      }).catch(err => console.error('Error logging verification event:', err.message));
    }
    return;
  }

  console.warn('[Webhook Verification] Forbidden. Verify token mismatch or invalid mode.');
  return res.sendStatus(403);
});

/**
 * POST /webhook - Meta Webhook Event Receiver
 */
router.post('/', async (req, res) => {
  // Validate signature if secret is present
  if (process.env.META_APP_SECRET) {
    const isValid = verifySignature(req);
    if (!isValid) {
      console.warn('[Webhook] Invalid X-Hub-Signature-256 signature.');
      await WebhookEvent.create({
        eventType: 'error',
        status: 'failed',
        error: { message: 'Invalid webhook signature' },
        rawPayload: req.body
      }).catch(() => {});
      return res.status(403).send('Invalid signature');
    }
  }

  // Respond immediately with 200 OK so Meta never times out
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (!body || body.object !== 'page' || !Array.isArray(body.entry)) {
    return;
  }

  // Asynchronously process the webhook events
  for (const entry of body.entry) {
    try {
      // 1. Handle Messenger Messages & Postbacks
      if (Array.isArray(entry.messaging)) {
        for (const item of entry.messaging) {
          await handleMessengerEvent(item, entry);
        }
      }

      // 2. Handle Feed / Comments
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'feed') {
            await handleFeedEvent(change, entry);
          }
        }
      }
    } catch (err) {
      console.error('[Webhook Processing Error]:', err.message);
      await WebhookEvent.create({
        eventType: 'error',
        status: 'failed',
        error: { message: err.message, stack: err.stack },
        rawPayload: entry
      }).catch(() => {});
    }
  }
});

/**
 * Process Messenger incoming message or postback event
 */
async function handleMessengerEvent(messagingItem, rawEntry) {
  const senderId = messagingItem.sender?.id;
  const recipientId = messagingItem.recipient?.id;
  const message = messagingItem.message;
  const postback = messagingItem.postback;

  // Ignore delivery receipts, read receipts, or echo messages (bot's own echoes)
  if (!message && !postback) {
    return;
  }
  if (message && message.is_echo) {
    return;
  }

  const messageMid = message?.mid || postback?.mid || `pb_${Date.now()}_${senderId}`;
  let messageText = message?.text || postback?.title || postback?.payload || '';

  console.log(`[Messenger Event] Received from ${senderId}: "${messageText}" (mid: ${messageMid})`);

  // Deduplication check: Has this message MID been processed already?
  if (message?.mid) {
    const existing = await WebhookEvent.findOne({
      messageMid: message.mid,
      status: 'processed'
    });
    if (existing) {
      console.log(`[Messenger Event] Duplicate event detected for mid: ${message.mid}. Skipping.`);
      return;
    }
  }

  // Find connected Page
  const connectedPage = await Page.findOne({ isConnected: true });
  if (!connectedPage) {
    console.warn('[Messenger Event] No connected page found in DB.');
    await WebhookEvent.create({
      eventType: 'messenger',
      senderId,
      recipientId,
      messageMid,
      messageText,
      status: 'ignored',
      actionsTaken: ['Ignored: No active Page connected in database'],
      rawPayload: messagingItem
    });
    return;
  }

  // Prevent bot from replying to itself
  if (senderId === connectedPage.pageId) {
    return;
  }

  // Check if Messenger automation is configured and enabled
  const messengerAuto = await Automation.findOne({ type: 'messenger', isEnabled: true });
  if (!messengerAuto) {
    console.log('[Messenger Event] Messenger auto-reply is currently OFF.');
    await WebhookEvent.create({
      eventType: 'messenger',
      senderId,
      recipientId,
      messageMid,
      messageText,
      status: 'ignored',
      actionsTaken: ['Ignored: Messenger auto-reply is turned OFF'],
      rawPayload: messagingItem
    });
    return;
  }

  // Evaluate Keyword Rules vs Default Reply
  let replyText = messengerAuto.replyText || 'Hello! Thanks for messaging us.';
  let matchedRule = null;
  const textLower = (messageText || '').toLowerCase().trim();

  if (Array.isArray(messengerAuto.rules) && messengerAuto.rules.length > 0) {
    for (const rule of messengerAuto.rules) {
      const kw = (rule.keyword || '').toLowerCase().trim();
      if (!kw) continue;

      if (rule.matchType === 'exact') {
        if (textLower === kw) {
          replyText = rule.replyText;
          matchedRule = rule;
          break;
        }
      } else {
        // 'contains' (default)
        if (textLower.includes(kw)) {
          replyText = rule.replyText;
          matchedRule = rule;
          break;
        }
      }
    }
  }

  const actionsTaken = [];
  let errorInfo = null;
  let status = 'processed';

  try {
    const sendResult = await metaService.sendMessengerMessage(
      connectedPage.pageAccessToken,
      senderId,
      replyText
    );
    const ruleInfo = matchedRule ? ` [Matched rule: "${matchedRule.keyword}"]` : ' [Default fallback]';
    actionsTaken.push(`Sent auto-reply${ruleInfo}: "${replyText}" (Message ID: ${sendResult.message_id})`);
    console.log(`[Messenger Event] Successfully sent auto-reply to ${senderId}${ruleInfo}`);
  } catch (err) {
    status = 'failed';
    errorInfo = err.metaError || { message: err.message };
    actionsTaken.push(`Failed to send auto-reply: ${err.message}`);
    console.error(`[Messenger Event] Failed to send reply to ${senderId}:`, errorInfo);
  }

  await WebhookEvent.create({
    eventType: postback ? 'postback' : 'messenger',
    senderId,
    recipientId,
    messageMid,
    messageText,
    status,
    actionsTaken,
    error: errorInfo,
    rawPayload: messagingItem
  });
}

/**
 * Process Page Feed / Comment event
 */
async function handleFeedEvent(changeItem, rawEntry) {
  const val = changeItem.value;
  if (!val || !val.item || val.item.toLowerCase() !== 'comment') {
    return;
  }
  if (val.verb && val.verb.toLowerCase() !== 'add') {
    return;
  }

  const commentId = val.comment_id || val.id;
  const postId = val.post_id || val.parent_id || val.photo_id || val.video_id;
  const commenterId = val.from?.id || val.sender_id || val.user_id;
  const commenterName = val.from?.name || val.sender_name || '';
  const commentText = val.message || '';

  console.log(`[Feed Comment Event] Post: ${postId}, Comment: ${commentId} from ${commenterName || commenterId || 'Unknown'}: "${commentText}"`);

  // Deduplication check: Has this comment ID already been processed?
  if (commentId) {
    const existing = await WebhookEvent.findOne({
      commentId,
      status: 'processed'
    });
    if (existing) {
      console.log(`[Feed Comment Event] Duplicate event for comment ${commentId}. Skipping.`);
      return;
    }
  }

  // Find connected Page
  const connectedPage = await Page.findOne({ isConnected: true });
  if (!connectedPage) {
    console.warn('[Feed Comment Event] No connected page found in DB.');
    await WebhookEvent.create({
      eventType: 'comment',
      senderId: commenterId,
      postId,
      commentId,
      messageText: commentText,
      status: 'ignored',
      actionsTaken: ['Ignored: No active Page connected in database'],
      rawPayload: changeItem
    }).catch(() => {});
    return;
  }

  // Prevent bot from replying to Page's own comments
  const pageId = connectedPage.pageId;
  const rawPageId = rawEntry?.id;
  if (commenterId && (commenterId === pageId || commenterId === rawPageId)) {
    console.log(`[Feed Comment Event] Ignoring comment authored by the Page itself (${commenterId})`);
    return;
  }

  // 1. Search for post-specific automation first using candidate IDs
  const postCandidates = [];
  if (postId) {
    const pStr = String(postId).trim();
    postCandidates.push(pStr);
    if (pStr.includes('_')) {
      postCandidates.push(pStr.split('_')[1].trim());
    } else if (pageId) {
      postCandidates.push(`${pageId}_${pStr}`);
    }
  }

  let commentAuto = null;
  if (postCandidates.length > 0) {
    commentAuto = await Automation.findOne({
      type: 'comment',
      isEnabled: true,
      isGlobal: false,
      postId: { $in: postCandidates }
    });
  }

  // 2. Fall back to Global Default Comment Automation
  let isUsingGlobal = false;
  if (!commentAuto) {
    commentAuto = await Automation.findOne({
      type: 'comment',
      isEnabled: true,
      isGlobal: true
    });
    if (commentAuto) {
      isUsingGlobal = true;
      console.log(`[Feed Comment Event] Using Global Default Comment Automation for post ${postId}`);
    }
  }

  if (!commentAuto) {
    console.log(`[Feed Comment Event] No active automation (post-specific or global) configured for post ${postId}`);
    await WebhookEvent.create({
      eventType: 'comment',
      senderId: commenterId,
      postId,
      commentId,
      messageText: commentText,
      status: 'ignored',
      actionsTaken: [`Ignored: No active automation found for post ${postId || 'unspecified'}`],
      rawPayload: changeItem
    }).catch(() => {});
    return;
  }

  // 3. Keyword Filter (if configured on this automation rule)
  if (Array.isArray(commentAuto.keywords) && commentAuto.keywords.length > 0) {
    const commentLower = (commentText || '').toLowerCase();
    const matchesKeyword = commentAuto.keywords.some(k => commentLower.includes(k.toLowerCase().trim()));
    if (!matchesKeyword) {
      console.log(`[Feed Comment Event] Comment did not match required keywords: ${commentAuto.keywords.join(', ')}`);
      await WebhookEvent.create({
        eventType: 'comment',
        senderId: commenterId,
        postId,
        commentId,
        messageText: commentText,
        status: 'ignored',
        actionsTaken: [`Ignored: Comment did not match keyword filter [${commentAuto.keywords.join(', ')}]`],
        rawPayload: changeItem
      }).catch(() => {});
      return;
    }
  }

  const actionsTaken = [];
  let errorInfo = null;
  let status = 'processed';
  const isMock = String(commentId).startsWith('mock_');

  if (isMock) {
    // In-app mock simulation mode (prevents Meta Graph API #100 Object does not exist error on fake IDs)
    const ruleTag = isUsingGlobal ? ' (via Global Rule)' : ' (via Post-Specific Rule)';
    if (commentAuto.autoLike) {
      actionsTaken.push('Auto-liked user comment (Simulation preview)');
    }
    if (commentAuto.publicReply) {
      actionsTaken.push(`Sent public reply${ruleTag}: "${commentAuto.publicReply}" (Simulation preview)`);
    }
    if (commentAuto.messengerReply) {
      actionsTaken.push(`Sent private Messenger DM: "${commentAuto.messengerReply}" (Simulation preview)`);
    }
    console.log(`[Feed Comment Event] Mock test comment processed successfully (${commentId})`);
  } else {
    // Real Meta Graph API Execution for live comments
    // Step A: Auto-Like Comment (if enabled)
    if (commentAuto.autoLike) {
      const likeRes = await metaService.likeComment(commentId, connectedPage.pageAccessToken);
      if (likeRes.success) {
        actionsTaken.push('Auto-liked user comment');
        console.log(`[Feed Comment Event] Auto-liked comment ${commentId}`);
      } else {
        actionsTaken.push(`Auto-like skipped/failed: ${likeRes.error?.message || 'Unknown'}`);
      }
    }

    // Step B: Send Public Comment Reply
    if (commentAuto.publicReply) {
      try {
        const replyResult = await metaService.replyToComment(
          commentId,
          connectedPage.pageAccessToken,
          commentAuto.publicReply
        );
        const ruleTag = isUsingGlobal ? ' (via Global Rule)' : '';
        actionsTaken.push(`Sent public reply${ruleTag}: "${commentAuto.publicReply}" (Reply ID: ${replyResult.id})`);
        console.log(`[Feed Comment Event] Public reply sent for comment ${commentId}`);
      } catch (err) {
        status = 'failed';
        errorInfo = err.metaError || { message: err.message };
        actionsTaken.push(`Failed to send public reply: ${err.message}`);
        console.error(`[Feed Comment Event] Public reply error:`, errorInfo);
      }
    }

    // Step C: Send Optional Private Reply (Messenger DM)
    if (commentAuto.messengerReply) {
      try {
        const privateResult = await metaService.sendPrivateReplyToComment(
          connectedPage.pageId,
          connectedPage.pageAccessToken,
          commentId,
          commentAuto.messengerReply
        );

        if (privateResult.success) {
          actionsTaken.push(`Sent private Messenger DM: "${commentAuto.messengerReply}"`);
          console.log(`[Feed Comment Event] Private reply sent for comment ${commentId}`);
        } else {
          const pErr = privateResult.error?.message || JSON.stringify(privateResult.error);
          actionsTaken.push(`Private reply not sent by Meta: ${pErr}`);
          console.warn(`[Feed Comment Event] Private reply notice:`, privateResult.error);
          if (!errorInfo) {
            errorInfo = { privateReplyError: privateResult.error };
          } else {
            errorInfo.privateReplyError = privateResult.error;
          }
        }
      } catch (err) {
        actionsTaken.push(`Error calling private reply API: ${err.message}`);
        console.error(`[Feed Comment Event] Private reply exception:`, err);
      }
    }
  }

  await WebhookEvent.create({
    eventType: 'comment',
    senderId: commenterId,
    postId,
    commentId,
    messageText: commentText,
    status,
    actionsTaken,
    error: errorInfo,
    rawPayload: changeItem
  }).catch(err => console.error('Failed to save WebhookEvent:', err.message));
}

router.handleFeedEvent = handleFeedEvent;
module.exports = router;
