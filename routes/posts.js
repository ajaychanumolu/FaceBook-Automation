const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const ScheduledPost = require('../models/ScheduledPost');
const WebhookEvent = require('../models/WebhookEvent');
const metaService = require('../services/meta');

/**
 * GET /api/posts - Fetch posts from the connected Page
 */
router.get('/', async (req, res) => {
  try {
    const page = await Page.findOne({ isConnected: true });
    if (!page) {
      return res.status(400).json({ error: 'No active Page is connected.' });
    }

    const posts = await metaService.getPagePosts(page.pageId, page.pageAccessToken);
    res.json({
      success: true,
      pageName: page.pageName,
      pageId: page.pageId,
      posts
    });
  } catch (err) {
    console.error('[Posts] Error fetching posts:', err.metaError || err.message);
    res.status(400).json({
      success: false,
      error: err.metaError || { message: err.message }
    });
  }
});

/**
 * POST /api/posts/publish - Publish a post immediately (Text, Link, or Photo)
 */
router.post('/publish', async (req, res) => {
  try {
    const { message, photoUrl, link } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Post message content is required.' });
    }

    const page = await Page.findOne({ isConnected: true });
    if (!page) {
      return res.status(400).json({ error: 'No active Page is connected. Please connect a Page first.' });
    }

    let result;
    if (photoUrl && photoUrl.trim()) {
      console.log(`[Posts] Publishing photo post to Page ${page.pageId}...`);
      result = await metaService.publishPagePhoto(page.pageId, page.pageAccessToken, photoUrl.trim(), message.trim());
    } else {
      console.log(`[Posts] Publishing feed post to Page ${page.pageId}: "${message.substring(0, 40)}..."`);
      result = await metaService.publishPagePost(page.pageId, page.pageAccessToken, message.trim(), link);
    }

    // Log the post creation event
    await WebhookEvent.create({
      eventType: 'post',
      postId: result.id || result.post_id,
      messageText: message.trim(),
      status: 'processed',
      actionsTaken: [`Published post to Facebook Page: ID ${result.id || result.post_id}`],
      rawPayload: result
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Post published successfully to Facebook Page!',
      postId: result.id || result.post_id
    });
  } catch (err) {
    const errorDetails = err.metaError || { message: err.message };
    console.error('[Posts] Error publishing post:', errorDetails);

    await WebhookEvent.create({
      eventType: 'error',
      messageText: req.body?.message,
      status: 'failed',
      error: errorDetails,
      actionsTaken: ['Failed to publish post to Facebook Page']
    }).catch(() => {});

    res.status(400).json({
      success: false,
      error: errorDetails
    });
  }
});

/**
 * POST /api/posts/schedule - Schedule a post for future publishing
 */
router.post('/schedule', async (req, res) => {
  try {
    const { message, photoUrl, link, scheduledTime, timezoneOffset } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!scheduledTime) {
      return res.status(400).json({ error: 'Scheduled time is required' });
    }

    let targetDate;
    if (typeof scheduledTime === 'string') {
      const isIsoWithZone = scheduledTime.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(scheduledTime);
      if (isIsoWithZone) {
        targetDate = new Date(scheduledTime);
      } else if (timezoneOffset !== undefined && timezoneOffset !== null) {
        // Fallback: If sent without timezone offset/Z, use client's timezoneOffset in minutes
        const offsetMinutes = parseInt(timezoneOffset, 10) || 0;
        const localTimestamp = new Date(scheduledTime + 'Z').getTime();
        targetDate = new Date(localTimestamp + (offsetMinutes * 60000));
      } else {
        // Fallback for cached browsers sending raw YYYY-MM-DDTHH:mm: default to IST offset (-330 minutes / +5:30)
        const defaultOffsetMinutes = process.env.TIMEZONE_OFFSET_MINUTES ? parseInt(process.env.TIMEZONE_OFFSET_MINUTES, 10) : -330;
        const localTimestamp = new Date(scheduledTime + 'Z').getTime();
        targetDate = new Date(localTimestamp + (defaultOffsetMinutes * 60000));
      }
    } else {
      targetDate = new Date(scheduledTime);
    }

    if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Scheduled time must be a valid future date and time' });
    }

    const post = await ScheduledPost.create({
      message: message.trim(),
      photoUrl: photoUrl?.trim() || undefined,
      link: link?.trim() || undefined,
      scheduledTime: targetDate,
      status: 'scheduled'
    });

    res.json({
      success: true,
      message: `Post scheduled successfully for ${targetDate.toISOString()}`,
      post
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/posts/scheduled - Get list of scheduled posts
 */
router.get('/scheduled', async (req, res) => {
  try {
    const posts = await ScheduledPost.find().sort({ scheduledTime: -1 }).limit(50);
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/posts/scheduled/:id - Delete a scheduled post
 */
router.delete('/scheduled/:id', async (req, res) => {
  try {
    await ScheduledPost.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Scheduled post removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
