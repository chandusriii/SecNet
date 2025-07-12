const mongoose = require('mongoose');

const aiAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  dataType: {
    type: String,
    required: true,
    enum: ['medical', 'financial', 'identity', 'biometric', 'genetic']
  },
  accessPattern: {
    requester: String,
    frequency: Number,
    timeOfDay: [Number], // Hour of day
    dayOfWeek: [Number], // 0-6 (Sunday-Saturday)
    dataVolume: Number,
    accessDuration: Number
  },
  anomalyScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  alerts: [{
    type: {
      type: String,
      enum: ['unusual_access', 'data_breach', 'privacy_violation', 'consent_violation', 'anomaly_detected'],
      required: true
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isResolved: {
      type: Boolean,
      default: false
    }
  }],
  aiInsights: [{
    insightType: {
      type: String,
      enum: ['pattern_detected', 'risk_assessment', 'recommendation', 'trend_analysis'],
      required: true
    },
    title: String,
    description: String,
    confidence: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  privacyMetrics: {
    dataExposureScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    consentComplianceRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    encryptionLevel: {
      type: String,
      enum: ['basic', 'standard', 'high', 'military'],
      default: 'high'
    },
    lastPrivacyAudit: Date
  },
  monitoringConfig: {
    isActive: {
      type: Boolean,
      default: true
    },
    alertThresholds: {
      anomalyScore: {
        type: Number,
        default: 75
      },
      unusualAccessFrequency: {
        type: Number,
        default: 5 // per hour
      },
      dataVolumeThreshold: {
        type: Number,
        default: 1000 // MB
      }
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
aiAnalyticsSchema.index({ userId: 1, dataType: 1 });
aiAnalyticsSchema.index({ anomalyScore: -1 });
aiAnalyticsSchema.index({ 'alerts.timestamp': -1 });
aiAnalyticsSchema.index({ riskLevel: 1 });

// Methods
aiAnalyticsSchema.methods.addAlert = function(alert) {
  this.alerts.push(alert);
  return this.save();
};

aiAnalyticsSchema.methods.addInsight = function(insight) {
  this.aiInsights.push(insight);
  return this.save();
};

aiAnalyticsSchema.methods.updateAnomalyScore = function(score) {
  this.anomalyScore = score;
  
  // Update risk level based on anomaly score
  if (score >= 90) this.riskLevel = 'critical';
  else if (score >= 75) this.riskLevel = 'high';
  else if (score >= 50) this.riskLevel = 'medium';
  else this.riskLevel = 'low';
  
  return this.save();
};

aiAnalyticsSchema.methods.markAlertAsRead = function(alertId) {
  const alert = this.alerts.id(alertId);
  if (alert) {
    alert.isRead = true;
    return this.save();
  }
  throw new Error('Alert not found');
};

aiAnalyticsSchema.methods.resolveAlert = function(alertId) {
  const alert = this.alerts.id(alertId);
  if (alert) {
    alert.isResolved = true;
    return this.save();
  }
  throw new Error('Alert not found');
};

// Static methods
aiAnalyticsSchema.statics.findByUser = function(userId) {
  return this.find({ userId: userId.toLowerCase() });
};

aiAnalyticsSchema.statics.findHighRiskUsers = function() {
  return this.find({ 
    $or: [
      { riskLevel: 'high' },
      { riskLevel: 'critical' },
      { anomalyScore: { $gte: 75 } }
    ]
  });
};

aiAnalyticsSchema.statics.findUnreadAlerts = function(userId) {
  return this.find({ 
    userId: userId.toLowerCase(),
    'alerts.isRead': false
  });
};

module.exports = mongoose.model('AIAnalytics', aiAnalyticsSchema); 