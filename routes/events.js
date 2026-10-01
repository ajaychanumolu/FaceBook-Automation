const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const Page = require('../models/Page');
const Automation = require('../models/Automation');
const ScheduledPost = require('../models/ScheduledPost');

/**
 * GET /api/events - Get recent events for dashboard
 */
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, events: [], dbStatus: 'disconnected' });
    }

    const { type, limit = 50 } = req.query;
    const filter = {};
    if (type && type !== 'all') {
      filter.eventType = type;
    }

    const events = await WebhookEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.json({ success: true, events, dbStatus: 'connected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/events/clear - Clear recent events
 */
router.post('/clear', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(400).json({ error: 'Database is not connected.' });
    }
    await WebhookEvent.deleteMany({});
    res.json({ success: true, message: 'All recent events cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/events/stats - Get dashboard high-level status stats
 */
router.get('/stats', async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return res.json({
        success: true,
        dbConnected: false,
        page: { connected: false },
        messenger: { isEnabled: false, rulesCount: 0 },
        commentCount: 0,
        scheduledCount: 0
      });
    }

    const page = await Page.findOne({ isConnected: true });
    const messenger = await Automation.findOne({ type: 'messenger' });
    const commentCount = await Automation.countDocuments({ type: 'comment', isEnabled: true });
    const scheduledCount = await ScheduledPost.countDocuments({ status: 'scheduled' });

    res.json({
      success: true,
      dbConnected: true,
      page: page
        ? {
            connected: true,
            id: page.pageId,
            name: page.pageName,
            webhookSubscribed: page.webhookSubscribed,
            webhookError: page.webhookError
          }
        : { connected: false },
      messenger: {
        isEnabled: Boolean(messenger?.isEnabled),
        rulesCount: messenger?.rules?.length || 0
      },
      commentCount,
      scheduledCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
