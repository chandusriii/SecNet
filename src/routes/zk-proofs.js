const express = require('express');
const router = express.Router();
const { authenticateWallet } = require('../middleware/auth');
const { emitToUser } = require('../socket/emitters');

// Mock ZK proof generation and verification
const mockZKProof = {
  generate: async (circuitType, inputs) => {
    // Simulate ZK proof generation
    const proofHash = `0x${Math.random().toString(16).slice(2, 66)}`;
    const generationTime = Math.random() * 2 + 0.5; // 0.5-2.5 seconds
    
    return {
      proofHash,
      circuitType,
      inputs,
      generationTime,
      timestamp: new Date()
    };
  },
  
  verify: async (proofHash, circuitType, publicInputs) => {
    // Simulate ZK proof verification
    const isValid = Math.random() > 0.1; // 90% success rate
    const verificationTime = Math.random() * 0.1; // 0-100ms
    
    return {
      proofHash,
      circuitType,
      isValid,
      verificationTime,
      timestamp: new Date()
    };
  }
};

// Generate ZK proof
router.post('/generate', authenticateWallet, async (req, res) => {
  try {
    const { circuitType, inputs } = req.body;
    const userAddress = req.user.address;

    if (!circuitType || !inputs) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['circuitType', 'inputs']
      });
    }

    // Validate circuit type
    const validCircuitTypes = [
      'age_verification',
      'income_verification', 
      'citizenship_verification',
      'medical_access',
      'financial_access'
    ];

    if (!validCircuitTypes.includes(circuitType)) {
      return res.status(400).json({
        error: 'Invalid circuit type',
        validTypes: validCircuitTypes
      });
    }

    // Generate ZK proof
    const proof = await mockZKProof.generate(circuitType, inputs);

    // Store proof in database (simplified)
    console.log('🔐 ZK Proof generated:', proof);

    // Emit proof generation event
    emitToUser(userAddress, 'zk_proof_generated', {
      proofHash: proof.proofHash,
      circuitType: proof.circuitType,
      generationTime: proof.generationTime,
      timestamp: proof.timestamp
    });

    res.json({
      message: 'ZK proof generated successfully',
      proof
    });

  } catch (error) {
    console.error('Error generating ZK proof:', error);
    res.status(500).json({
      error: 'Failed to generate ZK proof',
      message: error.message
    });
  }
});

// Verify ZK proof
router.post('/verify', authenticateWallet, async (req, res) => {
  try {
    const { proofHash, circuitType, publicInputs } = req.body;
    const userAddress = req.user.address;

    if (!proofHash || !circuitType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['proofHash', 'circuitType']
      });
    }

    // Verify ZK proof
    const verificationResult = await mockZKProof.verify(proofHash, circuitType, publicInputs);

    // Emit verification result
    emitToUser(userAddress, 'zk_proof_verified', verificationResult);

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

// Get available circuit types
router.get('/circuits', async (req, res) => {
  try {
    const circuits = [
      {
        type: 'age_verification',
        name: 'Age Verification',
        description: 'Prove you are over 18 without revealing your exact age',
        complexity: 'Low',
        avgGenerationTime: '1.2s',
        avgVerificationTime: '0.05s'
      },
      {
        type: 'income_verification',
        name: 'Income Verification',
        description: 'Prove income range without revealing exact salary',
        complexity: 'Medium',
        avgGenerationTime: '1.8s',
        avgVerificationTime: '0.08s'
      },
      {
        type: 'citizenship_verification',
        name: 'Citizenship Verification',
        description: 'Prove citizenship without revealing personal details',
        complexity: 'High',
        avgGenerationTime: '2.5s',
        avgVerificationTime: '0.12s'
      },
      {
        type: 'medical_access',
        name: 'Medical Access',
        description: 'Prove medical data access rights without exposing data',
        complexity: 'Medium',
        avgGenerationTime: '1.6s',
        avgVerificationTime: '0.07s'
      },
      {
        type: 'financial_access',
        name: 'Financial Access',
        description: 'Prove financial data access rights without exposing data',
        complexity: 'Medium',
        avgGenerationTime: '1.7s',
        avgVerificationTime: '0.09s'
      }
    ];

    res.json({
      circuits
    });

  } catch (error) {
    console.error('Error fetching circuit types:', error);
    res.status(500).json({
      error: 'Failed to fetch circuit types',
      message: error.message
    });
  }
});

// Get user's ZK proof history
router.get('/history', authenticateWallet, async (req, res) => {
  try {
    const { page = 1, limit = 10, circuitType } = req.query;
    const userAddress = req.user.address;

    // Mock proof history
    const mockProofs = [
      {
        id: '1',
        proofHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        circuitType: 'age_verification',
        status: 'generated',
        generationTime: 1.2,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: '2',
        proofHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        circuitType: 'income_verification',
        status: 'verified',
        generationTime: 1.8,
        verificationTime: 0.08,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
      },
      {
        id: '3',
        proofHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
        circuitType: 'medical_access',
        status: 'verified',
        generationTime: 1.6,
        verificationTime: 0.07,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ];

    // Filter by circuit type if specified
    let filteredProofs = mockProofs;
    if (circuitType) {
      filteredProofs = mockProofs.filter(proof => proof.circuitType === circuitType);
    }

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedProofs = filteredProofs.slice(skip, skip + parseInt(limit));

    res.json({
      proofs: paginatedProofs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredProofs.length,
        pages: Math.ceil(filteredProofs.length / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching ZK proof history:', error);
    res.status(500).json({
      error: 'Failed to fetch ZK proof history',
      message: error.message
    });
  }
});

// Get ZK proof statistics
router.get('/stats', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;

    // Mock statistics
    const stats = {
      totalProofs: 15,
      generatedProofs: 12,
      verifiedProofs: 10,
      failedProofs: 2,
      averageGenerationTime: 1.5,
      averageVerificationTime: 0.08,
      byCircuitType: {
        'age_verification': 5,
        'income_verification': 4,
        'medical_access': 3,
        'citizenship_verification': 2,
        'financial_access': 1
      },
      successRate: 83.33
    };

    res.json({
      stats
    });

  } catch (error) {
    console.error('Error fetching ZK proof statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch ZK proof statistics',
      message: error.message
    });
  }
});

// Batch verify multiple proofs
router.post('/batch-verify', authenticateWallet, async (req, res) => {
  try {
    const { proofs } = req.body;
    const userAddress = req.user.address;

    if (!proofs || !Array.isArray(proofs)) {
      return res.status(400).json({
        error: 'Invalid proofs array',
        message: 'Please provide an array of proofs to verify'
      });
    }

    if (proofs.length > 10) {
      return res.status(400).json({
        error: 'Too many proofs',
        message: 'Maximum 10 proofs can be verified at once'
      });
    }

    // Verify all proofs
    const verificationResults = [];
    
    for (const proof of proofs) {
      const result = await mockZKProof.verify(
        proof.proofHash,
        proof.circuitType,
        proof.publicInputs
      );
      verificationResults.push(result);
    }

    const validProofs = verificationResults.filter(r => r.isValid).length;
    const totalProofs = verificationResults.length;

    res.json({
      message: 'Batch verification completed',
      results: verificationResults,
      summary: {
        total: totalProofs,
        valid: validProofs,
        invalid: totalProofs - validProofs,
        successRate: (validProofs / totalProofs) * 100
      }
    });

  } catch (error) {
    console.error('Error in batch verification:', error);
    res.status(500).json({
      error: 'Failed to verify proofs',
      message: error.message
    });
  }
});

module.exports = router; 