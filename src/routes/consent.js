const express = require('express');
const router = express.Router();
const ConsentRequest = require('../models/ConsentRequest');
const User = require('../models/User');
const { authenticateWallet } = require('../middleware/auth');
const { emitToUser } = require('../socket/emitters');

// Create a new consent request
router.post('/request', authenticateWallet, async (req, res) => {
  try {
    const {
      dataOwnerAddress,
      dataType,
      purpose,
      scope,
      expiresAt
    } = req.body;

    const requesterAddress = req.user.address;

    // Validate required fields
    if (!dataOwnerAddress || !dataType || !purpose || !expiresAt) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['dataOwnerAddress', 'dataType', 'purpose', 'expiresAt']
      });
    }

    // Check if data owner exists
    const dataOwner = await User.findByAddress(dataOwnerAddress);
    if (!dataOwner) {
      return res.status(404).json({
        error: 'Data owner not found'
      });
    }

    // Check if requester exists
    const requester = await User.findByAddress(requesterAddress);
    if (!requester) {
      return res.status(404).json({
        error: 'Requester not found'
      });
    }

    // Create consent request
    const consentRequest = new ConsentRequest({
      requester: {
        address: requesterAddress,
        ensName: requester.ensName,
        displayName: requester.profile?.displayName
      },
      dataOwner: {
        address: dataOwnerAddress,
        ensName: dataOwner.ensName
      },
      dataType,
      purpose,
      scope: scope || {},
      expiresAt: new Date(expiresAt)
    });

    await consentRequest.save();

    // Emit real-time notification to data owner
    emitToUser(dataOwnerAddress, 'consent_request', {
      requester: requester.ensName || requesterAddress,
      dataType,
      requestId: consentRequest._id
    });

    res.status(201).json({
      message: 'Consent request created successfully',
      request: consentRequest
    });

  } catch (error) {
    console.error('Error creating consent request:', error);
    res.status(500).json({
      error: 'Failed to create consent request',
      message: error.message
    });
  }
});

// Get pending consent requests for a user
router.get('/pending', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;
    
    const pendingRequests = await ConsentRequest.findPendingByOwner(userAddress);
    
    res.json({
      requests: pendingRequests,
      count: pendingRequests.length
    });

  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      error: 'Failed to fetch pending requests',
      message: error.message
    });
  }
});

// Get all consent requests for a user (as owner or requester)
router.get('/all', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;
    const { role = 'owner', status, page = 1, limit = 10 } = req.query;

    let query = {};
    if (role === 'owner') {
      query['dataOwner.address'] = userAddress;
    } else if (role === 'requester') {
      query['requester.address'] = userAddress;
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    
    const requests = await ConsentRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ConsentRequest.countDocuments(query);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching consent requests:', error);
    res.status(500).json({
      error: 'Failed to fetch consent requests',
      message: error.message
    });
  }
});

// Approve a consent request
router.post('/:requestId/approve', authenticateWallet, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const userAddress = req.user.address;

    const consentRequest = await ConsentRequest.findById(requestId);
    
    if (!consentRequest) {
      return res.status(404).json({
        error: 'Consent request not found'
      });
    }

    // Verify user is the data owner
    if (consentRequest.dataOwner.address !== userAddress) {
      return res.status(403).json({
        error: 'Only the data owner can approve this request'
      });
    }

    if (consentRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'Request is not pending approval'
      });
    }

    // Approve the request
    await consentRequest.approve(reason);

    // Update blockchain data (simulated)
    const blockchainData = {
      transactionHash: `0x${Math.random().toString(16).slice(2, 66)}`,
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: Math.floor(Math.random() * 50000) + 20000,
      timestamp: new Date()
    };
    
    await consentRequest.setBlockchainData(blockchainData);

    // Emit real-time notification to requester
    emitToUser(consentRequest.requester.address, 'access_granted', {
      dataOwner: consentRequest.dataOwner.ensName || consentRequest.dataOwner.address,
      dataType: consentRequest.dataType,
      requestId: consentRequest._id
    });

    res.json({
      message: 'Consent request approved successfully',
      request: consentRequest
    });

  } catch (error) {
    console.error('Error approving consent request:', error);
    res.status(500).json({
      error: 'Failed to approve consent request',
      message: error.message
    });
  }
});

// Deny a consent request
router.post('/:requestId/deny', authenticateWallet, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const userAddress = req.user.address;

    const consentRequest = await ConsentRequest.findById(requestId);
    
    if (!consentRequest) {
      return res.status(404).json({
        error: 'Consent request not found'
      });
    }

    // Verify user is the data owner
    if (consentRequest.dataOwner.address !== userAddress) {
      return res.status(403).json({
        error: 'Only the data owner can deny this request'
      });
    }

    if (consentRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'Request is not pending approval'
      });
    }

    // Deny the request
    await consentRequest.deny(reason);

    // Emit real-time notification to requester
    emitToUser(consentRequest.requester.address, 'access_denied', {
      dataOwner: consentRequest.dataOwner.ensName || consentRequest.dataOwner.address,
      dataType: consentRequest.dataType,
      requestId: consentRequest._id
    });

    res.json({
      message: 'Consent request denied successfully',
      request: consentRequest
    });

  } catch (error) {
    console.error('Error denying consent request:', error);
    res.status(500).json({
      error: 'Failed to deny consent request',
      message: error.message
    });
  }
});

// Revoke an approved consent request
router.post('/:requestId/revoke', authenticateWallet, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const userAddress = req.user.address;

    const consentRequest = await ConsentRequest.findById(requestId);
    
    if (!consentRequest) {
      return res.status(404).json({
        error: 'Consent request not found'
      });
    }

    // Verify user is the data owner
    if (consentRequest.dataOwner.address !== userAddress) {
      return res.status(403).json({
        error: 'Only the data owner can revoke this request'
      });
    }

    if (consentRequest.status !== 'approved') {
      return res.status(400).json({
        error: 'Request is not approved'
      });
    }

    // Revoke the request
    await consentRequest.revoke(reason);

    // Emit real-time notification to requester
    emitToUser(consentRequest.requester.address, 'access_revoked', {
      dataOwner: consentRequest.dataOwner.ensName || consentRequest.dataOwner.address,
      dataType: consentRequest.dataType,
      requestId: consentRequest._id
    });

    res.json({
      message: 'Consent request revoked successfully',
      request: consentRequest
    });

  } catch (error) {
    console.error('Error revoking consent request:', error);
    res.status(500).json({
      error: 'Failed to revoke consent request',
      message: error.message
    });
  }
});

// Get consent request by ID
router.get('/:requestId', authenticateWallet, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userAddress = req.user.address;

    const consentRequest = await ConsentRequest.findById(requestId);
    
    if (!consentRequest) {
      return res.status(404).json({
        error: 'Consent request not found'
      });
    }

    // Verify user is involved in this request
    if (consentRequest.dataOwner.address !== userAddress && 
        consentRequest.requester.address !== userAddress) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      request: consentRequest
    });

  } catch (error) {
    console.error('Error fetching consent request:', error);
    res.status(500).json({
      error: 'Failed to fetch consent request',
      message: error.message
    });
  }
});

module.exports = router; 