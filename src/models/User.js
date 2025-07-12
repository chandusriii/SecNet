const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  ensName: {
    type: String,
    trim: true,
    sparse: true
  },
  profile: {
    displayName: String,
    avatar: String,
    bio: String,
    website: String
  },
  ssiCredentials: [{
    type: {
      type: String,
      required: true,
      enum: ['medical', 'financial', 'identity', 'education', 'custom']
    },
    issuer: {
      type: String,
      required: true
    },
    credentialHash: {
      type: String,
      required: true
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    isRevoked: {
      type: Boolean,
      default: false
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      consentRequests: { type: Boolean, default: true },
      dataAccess: { type: Boolean, default: true },
      rewards: { type: Boolean, default: true }
    },
    privacy: {
      defaultConsent: { type: String, enum: ['allow', 'deny', 'ask'], default: 'ask' },
      dataRetention: { type: Number, default: 365 }, // days
      allowAnalytics: { type: Boolean, default: false }
    }
  },
  tokenBalance: {
    type: Number,
    default: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ address: 1 });
userSchema.index({ ensName: 1 });
userSchema.index({ 'ssiCredentials.type': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for formatted address
userSchema.virtual('formattedAddress').get(function() {
  if (this.ensName) {
    return this.ensName;
  }
  return `${this.address.slice(0, 6)}...${this.address.slice(-4)}`;
});

// Methods
userSchema.methods.addCredential = function(credential) {
  this.ssiCredentials.push(credential);
  return this.save();
};

userSchema.methods.revokeCredential = function(credentialHash) {
  const credential = this.ssiCredentials.find(c => c.credentialHash === credentialHash);
  if (credential) {
    credential.isRevoked = true;
    return this.save();
  }
  throw new Error('Credential not found');
};

userSchema.methods.addTokens = function(amount) {
  this.tokenBalance += amount;
  this.totalEarned += amount;
  return this.save();
};

userSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// Static methods
userSchema.statics.findByAddress = function(address) {
  return this.findOne({ address: address.toLowerCase() });
};

userSchema.statics.findByENS = function(ensName) {
  return this.findOne({ ensName });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

module.exports = mongoose.model('User', userSchema); 