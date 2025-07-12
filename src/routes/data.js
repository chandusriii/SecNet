const express = require('express');
const router = express.Router();
const { authenticateWallet } = require('../middleware/auth');
const { emitToUser } = require('../socket/emitters');

// Mock IPFS client for demonstration
const mockIPFS = {
  add: async (data) => {
    // Simulate IPFS upload
    const hash = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    return { path: hash, size: JSON.stringify(data).length };
  },
  cat: async (hash) => {
    // Simulate IPFS retrieval
    return { data: 'Mock IPFS data' };
  }
};

// Log data access event
router.post('/access', authenticateWallet, async (req, res) => {
  try {
    const {
      requestId,
      dataType,
      accessType,
      zkProofHash,
      metadata
    } = req.body;

    const requesterAddress = req.user.address;

    // Validate required fields
    if (!requestId || !dataType || !accessType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['requestId', 'dataType', 'accessType']
      });
    }

    // Create access log entry
    const accessLog = {
      requestId,
      requester: requesterAddress,
      dataType,
      accessType,
      zkProofHash: zkProofHash || null,
      timestamp: new Date(),
      metadata: metadata || {}
    };

    // Store in database (simplified for demo)
    console.log('📝 Data access logged:', accessLog);

    // Emit real-time notification
    emitToUser(requesterAddress, 'data_access_log', {
      requester: requesterAddress,
      dataType,
      accessType,
      zkProofHash,
      timestamp: new Date()
    });

    res.status(201).json({
      message: 'Data access logged successfully',
      accessLog
    });

  } catch (error) {
    console.error('Error logging data access:', error);
    res.status(500).json({
      error: 'Failed to log data access',
      message: error.message
    });
  }
});

// Get data access logs
router.get('/logs', authenticateWallet, async (req, res) => {
  try {
    const { page = 1, limit = 10, dataType, accessType } = req.query;
    const userAddress = req.user.address;

    // Mock access logs (in real app, fetch from database)
    const mockLogs = [
      {
        id: '1',
        requestId: 'req_1',
        requester: userAddress,
        dataType: 'Medical Records',
        accessType: 'read',
        zkProofHash: '0x1234567890abcdef',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        gasUsed: 45000,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      },
      {
        id: '2',
        requestId: 'req_2',
        requester: userAddress,
        dataType: 'Financial Data',
        accessType: 'read',
        zkProofHash: null,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        gasUsed: 38000,
        transactionHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456'
      }
    ];

    // Filter logs based on query parameters
    let filteredLogs = mockLogs;
    
    if (dataType) {
      filteredLogs = filteredLogs.filter(log => log.dataType === dataType);
    }
    
    if (accessType) {
      filteredLogs = filteredLogs.filter(log => log.accessType === accessType);
    }

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedLogs = filteredLogs.slice(skip, skip + parseInt(limit));

    res.json({
      logs: paginatedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredLogs.length,
        pages: Math.ceil(filteredLogs.length / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching data access logs:', error);
    res.status(500).json({
      error: 'Failed to fetch data access logs',
      message: error.message
    });
  }
});

// Upload data to IPFS
router.post('/upload', authenticateWallet, async (req, res) => {
  try {
    const { data, metadata } = req.body;
    const userAddress = req.user.address;

    if (!data) {
      return res.status(400).json({
        error: 'Data is required',
        message: 'Please provide data to upload'
      });
    }

    // Upload to IPFS
    const ipfsResult = await mockIPFS.add({
      data,
      metadata,
      uploadedBy: userAddress,
      timestamp: new Date()
    });

    res.json({
      message: 'Data uploaded successfully',
      ipfsHash: ipfsResult.path,
      size: ipfsResult.size
    });

  } catch (error) {
    console.error('Error uploading data:', error);
    res.status(500).json({
      error: 'Failed to upload data',
      message: error.message
    });
  }
});

// Retrieve data from IPFS
router.get('/retrieve/:ipfsHash', authenticateWallet, async (req, res) => {
  try {
    const { ipfsHash } = req.params;
    const userAddress = req.user.address;

    // Retrieve from IPFS
    const ipfsData = await mockIPFS.cat(ipfsHash);

    res.json({
      message: 'Data retrieved successfully',
      data: ipfsData.data,
      ipfsHash
    });

  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({
      error: 'Failed to retrieve data',
      message: error.message
    });
  }
});

// Get data access statistics
router.get('/stats', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;

    // Mock statistics
    const stats = {
      totalAccesses: 24,
      thisMonth: 8,
      thisWeek: 3,
      byDataType: {
        'Medical Records': 12,
        'Financial Data': 8,
        'Identity Data': 4
      },
      byAccessType: {
        'read': 20,
        'write': 3,
        'delete': 1
      },
      averageGasUsed: 42000,
      totalGasUsed: 1008000
    };

    res.json({
      stats
    });

  } catch (error) {
    console.error('Error fetching data access statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch data access statistics',
      message: error.message
    });
  }
});

// Verify ZK proof for data access
router.post('/verify-zk', authenticateWallet, async (req, res) => {
  try {
    const { proofHash, circuitType, publicInputs } = req.body;
    const userAddress = req.user.address;

    if (!proofHash || !circuitType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['proofHash', 'circuitType']
      });
    }

    // Simulate ZK proof verification
    const isValid = Math.random() > 0.1; // 90% success rate
    const verificationTime = Math.random() * 0.1; // 0-100ms

    const verificationResult = {
      proofHash,
      circuitType,
      isValid,
      verificationTime,
      verifiedAt: new Date(),
      verifiedBy: userAddress
    };

    // Emit verification result
    emitToUser(userAddress, 'zk_proof_result', verificationResult);

    res.json({
      message: 'ZK proof verification completed',
      result: verificationResult
    });

  } catch (error) {
    console.error('Error verifying ZK proof:', error);
    res.status(500).json({
      error: 'Failed to verify ZK proof',
      message: error.message
    });
  }
});

module.exports = router; 