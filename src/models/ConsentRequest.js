const mongoose = require('mongoose');

const consentRequestSchema = new mongoose.Schema({
  requester: {
    address: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    ensName: String,
    displayName: String
  },
  dataOwner: {
    address: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    ensName: String
  },
  dataType: {
    type: String,
    required: true,
    enum: ['medical', 'financial', 'identity', 'education', 'location', 'biometric', 'custom']
  },
  purpose: {
    type: String,
    required: true,
    maxlength: 500
  },
  scope: {
    fields: [String],
    timeRange: {
      start: Date,
      end: Date
    },
    accessLevel: {
      type: String,
      enum: ['read', 'write', 'delete'],
      default: 'read'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired', 'revoked'],
    default: 'pending'
  },
  blockchainData: {
    transactionHash: String,
    blockNumber: Number,
    gasUsed: Number,
    timestamp: Date
  },
  zkProof: {
    proofHash: String,
    circuitType: String,
    verificationTime: Number,
    isValid: Boolean
  },
  metadata: {
    ipfsHash: String,
    encryptionKey: String,
    tags: [String]
  },
  expiresAt: {
    type: Date,
    required: true
  },
  respondedAt: Date,
  responseReason: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
consentRequestSchema.index({ 'requester.address': 1 });
consentRequestSchema.index({ 'dataOwner.address': 1 });
consentRequestSchema.index({ status: 1 });
consentRequestSchema.index({ dataType: 1 });
consentRequestSchema.index({ createdAt: -1 });
consentRequestSchema.index({ expiresAt: 1 });

// Virtual for time until expiry
consentRequestSchema.virtual('timeUntilExpiry').get(function() {
  if (!this.expiresAt) return null;
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  return Math.max(0, expiry.getTime() - now.getTime());
});

// Virtual for is expired
consentRequestSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Pre-save middleware to update status if expired
consentRequestSchema.pre('save', function(next) {
  if (this.isExpired && this.status === 'pending') {
    this.status = 'expired';
  }
  next();
});

// Methods
consentRequestSchema.methods.approve = function(reason = '') {
  this.status = 'approved';
  this.respondedAt = new Date();
  this.responseReason = reason;
  return this.save();
};

consentRequestSchema.methods.deny = function(reason = '') {
  this.status = 'denied';
  this.respondedAt = new Date();
  this.responseReason = reason;
  return this.save();
};

consentRequestSchema.methods.revoke = function(reason = '') {
  this.status = 'revoked';
  this.respondedAt = new Date();
  this.responseReason = reason;
  return this.save();
};

consentRequestSchema.methods.setBlockchainData = function(blockchainData) {
  this.blockchainData = blockchainData;
  return this.save();
};

consentRequestSchema.methods.setZKProof = function(zkProof) {
  this.zkProof = zkProof;
  return this.save();
};

// Static methods
consentRequestSchema.statics.findPendingByOwner = function(ownerAddress) {
  return this.find({
    'dataOwner.address': ownerAddress.toLowerCase(),
    status: 'pending',
    isActive: true
  }).sort({ createdAt: -1 });
};

consentRequestSchema.statics.findByRequester = function(requesterAddress) {
  return this.find({
    'requester.address': requesterAddress.toLowerCase()
  }).sort({ createdAt: -1 });
};

consentRequestSchema.statics.findActiveByOwner = function(ownerAddress) {
  return this.find({
    'dataOwner.address': ownerAddress.toLowerCase(),
    status: 'approved',
    isActive: true
  }).sort({ createdAt: -1 });
};

consentRequestSchema.statics.findExpiredRequests = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

module.exports = mongoose.model('ConsentRequest', consentRequestSchema); 