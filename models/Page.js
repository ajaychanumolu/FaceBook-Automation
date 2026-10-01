const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
  pageId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pageName: {
    type: String,
    required: true,
    trim: true
  },
  pageAccessToken: {
    type: String,
    required: true,
    trim: true
  },
  userAccessToken: {
    type: String,
    trim: true
  },
  category: {
    type: String
  },
  tasks: [{
    type: String
  }],
  isConnected: {
    type: Boolean,
    default: true
  },
  webhookSubscribed: {
    type: Boolean,
    default: false
  },
  webhookError: {
    type: String
  },
  connectedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

PageSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Page', PageSchema);
