const mongoose = require('mongoose');

const WebhookEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['messenger', 'comment', 'feed', 'verification', 'post', 'postback', 'error', 'other'],
    default: 'other'
  },
  senderId: {
    type: String
  },
  recipientId: {
    type: String
  },
  messageMid: {
    type: String,
    index: true
  },
  postId: {
    type: String,
    index: true
  },
  commentId: {
    type: String,
    index: true
  },
  messageText: {
    type: String
  },
  status: {
    type: String,
    enum: ['received', 'processed', 'ignored', 'failed'],
    default: 'received'
  },
  actionsTaken: [{
    type: String
  }],
  error: {
    type: mongoose.Schema.Types.Mixed
  },
  rawPayload: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 7 // Keep events for 7 days
  }
});

module.exports = mongoose.model('WebhookEvent', WebhookEventSchema);
