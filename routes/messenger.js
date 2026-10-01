const express = require('express');
const router = express.Router();
const Automation = require('../models/Automation');

/**
 * GET /api/messenger - Get current Messenger auto-reply settings
 */
router.get('/', async (req, res) => {
  try {
    let auto = await Automation.findOne({ type: 'messenger' });
    if (!auto) {
      auto = {
        isEnabled: false,
        replyText: 'Hello! Thanks for messaging us.',
        rules: []
      };
    }
    res.json({
      success: true,
      automation: {
        isEnabled: Boolean(auto.isEnabled),
        replyText: auto.replyText || 'Hello! Thanks for messaging us.',
        rules: auto.rules || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/messenger - Update Messenger auto-reply settings (fallback & keyword rules)
 */
router.post('/', async (req, res) => {
  try {
    const { isEnabled, replyText, rules } = req.body;

    const cleanRules = Array.isArray(rules)
      ? rules.filter(r => r.keyword && r.keyword.trim() && r.replyText && r.replyText.trim()).map(r => ({
          keyword: r.keyword.trim(),
          matchType: r.matchType === 'exact' ? 'exact' : 'contains',
          replyText: r.replyText.trim()
        }))
      : [];

    const auto = await Automation.findOneAndUpdate(
      { type: 'messenger' },
      {
        type: 'messenger',
        isEnabled: Boolean(isEnabled),
        replyText: replyText || 'Hello! Thanks for messaging us.',
        rules: cleanRules
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Messenger auto-reply settings saved successfully',
      automation: {
        isEnabled: auto.isEnabled,
        replyText: auto.replyText,
        rules: auto.rules
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/messenger/simulate - Test a simulated incoming message to see which rule matches
 */
router.post('/simulate', async (req, res) => {
  try {
    const { message } = req.body;
    const testText = (message || '').toLowerCase().trim();

    const auto = await Automation.findOne({ type: 'messenger' });
    if (!auto || !auto.isEnabled) {
      return res.json({
        success: true,
        matched: false,
        reason: 'Messenger automation is currently disabled'
      });
    }

    if (Array.isArray(auto.rules) && auto.rules.length > 0) {
      for (const rule of auto.rules) {
        const kw = (rule.keyword || '').toLowerCase().trim();
        if (!kw) continue;

        if (rule.matchType === 'exact' && testText === kw) {
          return res.json({
            success: true,
            matched: true,
            ruleType: 'keyword (exact)',
            keyword: rule.keyword,
            replyText: rule.replyText
          });
        }
        if (rule.matchType === 'contains' && testText.includes(kw)) {
          return res.json({
            success: true,
            matched: true,
            ruleType: 'keyword (contains)',
            keyword: rule.keyword,
            replyText: rule.replyText
          });
        }
      }
    }

    return res.json({
      success: true,
      matched: true,
      ruleType: 'default fallback',
      replyText: auto.replyText || 'Hello! Thanks for messaging us.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
