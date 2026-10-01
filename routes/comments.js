const express = require('express');
const router = express.Router();
const Automation = require('../models/Automation');
const Page = require('../models/Page');
const WebhookEvent = require('../models/WebhookEvent');
const webhookRouter = require('./webhook');

/**
 * GET /api/comments/automations - Get all comment automations (post-specific and global)
 */
router.get('/automations', async (req, res) => {
  try {
    const automations = await Automation.find({ type: 'comment' }).sort({ isGlobal: -1, createdAt: -1 });
    res.json({
      success: true,
      automations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/comments/global - Get global fallback comment automation
 */
router.get('/global', async (req, res) => {
  try {
    let globalAuto = await Automation.findOne({ type: 'comment', isGlobal: true });
    if (!globalAuto) {
      globalAuto = {
        isGlobal: true,
        isEnabled: false,
        autoLike: false,
        publicReply: 'Thanks for engaging with our Page!',
        messengerReply: ''
      };
    }
    res.json({
      success: true,
      automation: globalAuto
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments/global - Save global fallback comment automation
 */
router.post('/global', async (req, res) => {
  try {
    const { isEnabled, autoLike, publicReply, messengerReply, keywords } = req.body;

    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map(k => k.trim()).filter(Boolean)
      : (typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(Boolean) : []);

    const auto = await Automation.findOneAndUpdate(
      { type: 'comment', isGlobal: true },
      {
        type: 'comment',
        isGlobal: true,
        isEnabled: Boolean(isEnabled),
        autoLike: Boolean(autoLike),
        publicReply: publicReply || 'Thanks for engaging with our Page!',
        messengerReply: messengerReply || '',
        keywords: cleanKeywords
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Global comment automation updated successfully',
      automation: auto
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments/automations - Create or update a post-specific comment automation
 */
router.post('/automations', async (req, res) => {
  try {
    const { postId, postMessage, trigger, publicReply, messengerReply, isEnabled, autoLike, keywords } = req.body;

    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }

    if (!publicReply && !messengerReply) {
      return res.status(400).json({ error: 'At least a Public Reply or Messenger Reply is required.' });
    }

    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map(k => k.trim()).filter(Boolean)
      : (typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(Boolean) : []);

    const automation = await Automation.findOneAndUpdate(
      { type: 'comment', postId, isGlobal: false },
      {
        type: 'comment',
        isGlobal: false,
        postId,
        postMessage: postMessage || '',
        trigger: trigger || 'any_comment',
        publicReply: publicReply || 'Thanks for your comment!',
        messengerReply: messengerReply || '',
        autoLike: Boolean(autoLike),
        keywords: cleanKeywords,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Post comment automation saved successfully',
      automation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/comments/automations/:id/toggle - Toggle automation on/off
 */
router.patch('/automations/:id/toggle', async (req, res) => {
  try {
    const auto = await Automation.findById(req.params.id);
    if (!auto) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    auto.isEnabled = !auto.isEnabled;
    await auto.save();

    res.json({ success: true, isEnabled: auto.isEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/comments/automations/:id - Delete automation
 */
router.delete('/automations/:id', async (req, res) => {
  try {
    await Automation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Automation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments/simulate - Test comment automation matching without calling Facebook
 */
router.post('/simulate', async (req, res) => {
  try {
    const { postId, messageText } = req.body;
    const testText = (messageText || '').trim();
    const commentLower = testText.toLowerCase();

    const connectedPage = await Page.findOne({ isConnected: true });
    const pageId = connectedPage?.pageId || '';

    // Search for post-specific rule first using candidate IDs
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
    let ruleLevel = 'none';

    if (postCandidates.length > 0) {
      commentAuto = await Automation.findOne({
        type: 'comment',
        isEnabled: true,
        isGlobal: false,
        postId: { $in: postCandidates }
      });
      if (commentAuto) {
        ruleLevel = 'post-specific';
      }
    }

    // Fall back to global rule
    if (!commentAuto) {
      commentAuto = await Automation.findOne({
        type: 'comment',
        isEnabled: true,
        isGlobal: true
      });
      if (commentAuto) {
        ruleLevel = 'global';
      }
    }

    if (!commentAuto) {
      return res.json({
        success: true,
        matched: false,
        reason: 'No enabled comment automation found for this post or globally.'
      });
    }

    // Check keyword filter
    let keywordMatched = true;
    let matchedKeyword = null;
    if (Array.isArray(commentAuto.keywords) && commentAuto.keywords.length > 0) {
      const found = commentAuto.keywords.find(k => commentLower.includes(k.toLowerCase().trim()));
      if (!found) {
        keywordMatched = false;
      } else {
        matchedKeyword = found;
      }
    }

    if (!keywordMatched) {
      return res.json({
        success: true,
        matched: false,
        ruleLevel,
        reason: `Comment did not contain any required keyword [${commentAuto.keywords.join(', ')}]`
      });
    }

    return res.json({
      success: true,
      matched: true,
      ruleLevel,
      targetPostId: commentAuto.postId || 'All Posts (Global)',
      autoLike: Boolean(commentAuto.autoLike),
      publicReply: commentAuto.publicReply || '(None)',
      messengerReply: commentAuto.messengerReply || '(None)',
      keywordMatched: matchedKeyword ? `Matched keyword: "${matchedKeyword}"` : 'Any comment (No keyword filter)'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments/test-webhook - Dispatch a mock comment webhook event locally for end-to-end testing
 */
router.post('/test-webhook', async (req, res) => {
  try {
    const { postId, messageText, commentId, senderId, commenterName } = req.body;
    const connectedPage = await Page.findOne({ isConnected: true });

    if (!connectedPage) {
      return res.status(400).json({ error: 'No active Page connected. Connect a Page first.' });
    }

    const testCommentId = commentId || `mock_cmt_${Date.now()}`;
    const testPostId = postId || `${connectedPage.pageId}_122109890193476905`;
    const testSenderId = senderId || '28978406821795412';
    const testSenderName = commenterName || 'Test User';
    const testMessage = messageText || 'Hello from test comment simulator!';

    const changeItem = {
      field: 'feed',
      value: {
        item: 'comment',
        verb: 'add',
        comment_id: testCommentId,
        post_id: testPostId,
        sender_id: testSenderId,
        sender_name: testSenderName,
        message: testMessage,
        created_time: Math.floor(Date.now() / 1000)
      }
    };

    const rawEntry = {
      id: connectedPage.pageId,
      time: Date.now(),
      changes: [changeItem]
    };

    // Invoke handleFeedEvent directly
    if (typeof webhookRouter.handleFeedEvent === 'function') {
      await webhookRouter.handleFeedEvent(changeItem, rawEntry);
    }

    // Retrieve the recorded event from DB
    const event = await WebhookEvent.findOne({ commentId: testCommentId });

    res.json({
      success: true,
      message: 'Mock comment webhook processed successfully!',
      event
    });
  } catch (err) {
    console.error('[Test Webhook Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/comments/sync - Synchronize and process live Facebook comments immediately
 */
router.post('/sync', async (req, res) => {
  try {
    const commentPoller = require('../services/commentPoller');
    const result = await commentPoller.syncRecentComments();
    res.json(result);
  } catch (err) {
    console.error('[Comment Sync Route Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

