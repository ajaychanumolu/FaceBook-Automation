const mongoose = require('mongoose');

const KeywordRuleSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  matchType: {
    type: String,
    enum: ['contains', 'exact'],
    default: 'contains'
  },
  replyText: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: true });

const AutomationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['messenger', 'comment'],
    required: true
  },
  // Common status
  isEnabled: {
    type: Boolean,
    default: true
  },
  // Messenger Automation specific fields
  replyText: {
    type: String,
    trim: true,
    default: 'Hello! Thanks for messaging us.'
  },
  rules: [KeywordRuleSchema], // Keyword rules for Messenger
  // Comment Automation specific fields
  isGlobal: {
    type: Boolean,
    default: false // If true, acts as global fallback for all posts
  },
  autoLike: {
    type: Boolean,
    default: false // Automatically like the user comment
  },
  keywords: [{
    type: String,
    trim: true
  }], // If non-empty, only triggers if comment contains any of these keywords
  postId: {
    type: String,
    trim: true
  },
  postMessage: {
    type: String,
    trim: true
  },
  trigger: {
    type: String,
    default: 'any_comment'
  },
  publicReply: {
    type: String,
    trim: true,
    default: 'Thanks for your comment!'
  },
  messengerReply: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

AutomationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Automation', AutomationSchema);
