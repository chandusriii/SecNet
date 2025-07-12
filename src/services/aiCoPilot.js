const AIAnalytics = require('../models/AIAnalytics');
const ConsentRequest = require('../models/ConsentRequest');
const { emitToUser } = require('../socket/emitters');

class AICoPilot {
  constructor() {
    this.monitoringInterval = null;
    this.alertThresholds = {
      anomalyScore: 75,
      unusualAccessFrequency: 5,
      dataVolumeThreshold: 1000,
      consentViolationThreshold: 0.1
    };
  }

  // Start passive monitoring
  startMonitoring() {
    console.log('🤖 AI Co-Pilot started - monitoring encrypted medical data usage...');
    
    // Monitor every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.analyzeDataUsage();
      await this.detectAnomalies();
      await this.generateInsights();
    }, 5 * 60 * 1000);

    // Initial analysis
    this.analyzeDataUsage();
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('🤖 AI Co-Pilot stopped');
    }
  }

  // Analyze data usage patterns
  async analyzeDataUsage() {
    try {
      const users = await AIAnalytics.find({ 'monitoringConfig.isActive': true });
      
      for (const user of users) {
        await this.analyzeUserPatterns(user);
      }
    } catch (error) {
      console.error('AI Co-Pilot analysis error:', error);
    }
  }

  // Analyze individual user patterns
  async analyzeUserPatterns(userAnalytics) {
    const userId = userAnalytics.userId;
    
    // Get recent consent requests and data access
    const recentRequests = await ConsentRequest.find({
      'dataOwner.address': userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    // Calculate access patterns
    const accessPattern = this.calculateAccessPattern(recentRequests);
    
    // Update user analytics
    userAnalytics.accessPattern = accessPattern;
    await userAnalytics.save();

    // Check for unusual patterns
    await this.checkForAnomalies(userAnalytics, recentRequests);
  }

  // Calculate access patterns
  calculateAccessPattern(requests) {
    const now = new Date();
    const timeOfDay = [];
    const dayOfWeek = [];
    let totalDataVolume = 0;
    let totalDuration = 0;

    requests.forEach(request => {
      const requestTime = new Date(request.createdAt);
      
      // Time of day analysis
      const hour = requestTime.getHours();
      if (!timeOfDay.includes(hour)) {
        timeOfDay.push(hour);
      }

      // Day of week analysis
      const day = requestTime.getDay();
      if (!dayOfWeek.includes(day)) {
        dayOfWeek.push(day);
      }

      // Data volume estimation (mock)
      totalDataVolume += Math.random() * 100 + 50;
      totalDuration += Math.random() * 30 + 10;
    });

    return {
      requester: requests.length > 0 ? requests[0].requester.ensName : 'unknown',
      frequency: requests.length,
      timeOfDay,
      dayOfWeek,
      dataVolume: totalDataVolume,
      accessDuration: totalDuration
    };
  }

  // Detect anomalies in data usage
  async checkForAnomalies(userAnalytics, recentRequests) {
    const anomalies = [];

    // Check for unusual access frequency
    if (recentRequests.length > this.alertThresholds.unusualAccessFrequency) {
      anomalies.push({
        type: 'unusual_access',
        severity: 'warning',
        message: `Unusual access frequency detected: ${recentRequests.length} requests in 24 hours`,
        details: {
          normalRange: '0-5',
          detected: recentRequests.length,
          timeWindow: '24 hours'
        }
      });
    }

    // Check for large data volume
    if (userAnalytics.accessPattern.dataVolume > this.alertThresholds.dataVolumeThreshold) {
      anomalies.push({
        type: 'data_breach',
        severity: 'error',
        message: `Large data volume detected: ${userAnalytics.accessPattern.dataVolume.toFixed(2)} MB`,
        details: {
          threshold: this.alertThresholds.dataVolumeThreshold,
          detected: userAnalytics.accessPattern.dataVolume
        }
      });
    }

    // Check for unusual time patterns
    const unusualHours = userAnalytics.accessPattern.timeOfDay.filter(hour => hour < 6 || hour > 22);
    if (unusualHours.length > 0) {
      anomalies.push({
        type: 'unusual_access',
        severity: 'warning',
        message: `Data access detected during unusual hours: ${unusualHours.join(', ')}`,
        details: {
          unusualHours,
          normalHours: '6:00 AM - 10:00 PM'
        }
      });
    }

    // Check for consent violations
    const deniedRequests = recentRequests.filter(req => req.status === 'denied');
    const violationRate = deniedRequests.length / recentRequests.length;
    
    if (violationRate > this.alertThresholds.consentViolationThreshold) {
      anomalies.push({
        type: 'consent_violation',
        severity: 'error',
        message: `High consent violation rate: ${(violationRate * 100).toFixed(1)}%`,
        details: {
          totalRequests: recentRequests.length,
          deniedRequests: deniedRequests.length,
          violationRate
        }
      });
    }

    // Calculate anomaly score
    const anomalyScore = this.calculateAnomalyScore(anomalies, userAnalytics);
    await userAnalytics.updateAnomalyScore(anomalyScore);

    // Add alerts for detected anomalies
    for (const anomaly of anomalies) {
      await userAnalytics.addAlert(anomaly);
      
      // Send real-time notification
      emitToUser(userAnalytics.userId, 'ai_alert', {
        type: anomaly.type,
        severity: anomaly.severity,
        message: anomaly.message,
        timestamp: new Date()
      });
    }
  }

  // Calculate anomaly score based on detected issues
  calculateAnomalyScore(anomalies, userAnalytics) {
    let score = 0;
    
    anomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'critical':
          score += 30;
          break;
        case 'error':
          score += 20;
          break;
        case 'warning':
          score += 10;
          break;
        case 'info':
          score += 5;
          break;
      }
    });

    // Additional factors
    if (userAnalytics.accessPattern.frequency > 10) score += 15;
    if (userAnalytics.accessPattern.dataVolume > 2000) score += 20;
    
    return Math.min(score, 100);
  }

  // Generate AI insights
  async generateInsights() {
    try {
      const users = await AIAnalytics.find({ 'monitoringConfig.isActive': true });
      
      for (const user of users) {
        await this.generateUserInsights(user);
      }
    } catch (error) {
      console.error('AI insight generation error:', error);
    }
  }

  // Generate insights for individual user
  async generateUserInsights(userAnalytics) {
    const insights = [];

    // Pattern detection
    if (userAnalytics.accessPattern.frequency > 5) {
      insights.push({
        insightType: 'pattern_detected',
        title: 'High Data Access Pattern',
        description: 'Your medical data is being accessed frequently. Consider reviewing access permissions.',
        confidence: 85
      });
    }

    // Risk assessment
    if (userAnalytics.riskLevel === 'high' || userAnalytics.riskLevel === 'critical') {
      insights.push({
        insightType: 'risk_assessment',
        title: 'Elevated Privacy Risk',
        description: 'Your data privacy risk level is elevated. Consider reviewing recent access logs.',
        confidence: 90
      });
    }

    // Recommendations
    if (userAnalytics.privacyMetrics.consentComplianceRate < 80) {
      insights.push({
        insightType: 'recommendation',
        title: 'Improve Consent Management',
        description: 'Consider implementing stricter consent requirements for data access.',
        confidence: 75
      });
    }

    // Add insights to user analytics
    for (const insight of insights) {
      await userAnalytics.addInsight(insight);
    }

    // Send insights to user
    if (insights.length > 0) {
      emitToUser(userAnalytics.userId, 'ai_insight', {
        insights,
        timestamp: new Date()
      });
    }
  }

  // Proactive monitoring for specific user
  async monitorUser(userId, dataType = 'medical') {
    try {
      let userAnalytics = await AIAnalytics.findOne({ userId, dataType });
      
      if (!userAnalytics) {
        userAnalytics = new AIAnalytics({
          userId,
          dataType,
          monitoringConfig: {
            isActive: true,
            alertThresholds: this.alertThresholds
          }
        });
        await userAnalytics.save();
      }

      // Start monitoring this user
      await this.analyzeUserPatterns(userAnalytics);
      
      console.log(`🤖 AI Co-Pilot monitoring started for user: ${userId}`);
      
      return userAnalytics;
    } catch (error) {
      console.error('Error starting user monitoring:', error);
      throw error;
    }
  }

  // Get user analytics summary
  async getUserSummary(userId) {
    try {
      const analytics = await AIAnalytics.findByUser(userId);
      
      const summary = {
        totalAlerts: 0,
        unreadAlerts: 0,
        averageAnomalyScore: 0,
        riskLevel: 'low',
        recentInsights: []
      };

      analytics.forEach(analytic => {
        summary.totalAlerts += analytic.alerts.length;
        summary.unreadAlerts += analytic.alerts.filter(a => !a.isRead).length;
        summary.averageAnomalyScore += analytic.anomalyScore;
        
        if (analytic.riskLevel === 'critical' || analytic.riskLevel === 'high') {
          summary.riskLevel = analytic.riskLevel;
        }

        // Get recent insights
        const recentInsights = analytic.aiInsights
          .filter(insight => new Date(insight.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .slice(0, 5);
        
        summary.recentInsights.push(...recentInsights);
      });

      if (analytics.length > 0) {
        summary.averageAnomalyScore = summary.averageAnomalyScore / analytics.length;
      }

      return summary;
    } catch (error) {
      console.error('Error getting user summary:', error);
      throw error;
    }
  }
}

module.exports = new AICoPilot(); 