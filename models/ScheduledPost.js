const mongoose = require('mongoose');

const ScheduledPostSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  photoUrl: {
    type: String,
    trim: true
  },
  link: {
    type: String,
    trim: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed'],
    default: 'scheduled'
  },
  metaPostId: {
    type: String
  },
  error: {
    type: mongoose.Schema.Types.Mixed
  },
  publishedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScheduledPost', ScheduledPostSchema);
