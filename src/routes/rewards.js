const express = require('express');
const router = express.Router();
const { authenticateWallet } = require('../middleware/auth');
const { emitToUser } = require('../socket/emitters');

// Mock token contract interaction
const mockTokenContract = {
  balanceOf: async (address) => {
    // Simulate token balance
    return Math.floor(Math.random() * 1000) + 100;
  },
  transfer: async (from, to, amount) => {
    // Simulate token transfer
    return { success: true, hash: `0x${Math.random().toString(16).slice(2, 66)}` };
  },
  rewardTokens: async (user, amount, reason) => {
    // Simulate token reward
    return { success: true, hash: `0x${Math.random().toString(16).slice(2, 66)}` };
  }
};

// Get user token balance
router.get('/balance', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;

    // Get token balance from contract
    const balance = await mockTokenContract.balanceOf(userAddress);

    res.json({
      address: userAddress,
      balance,
      symbol: 'SNT',
      decimals: 18
    });

  } catch (error) {
    console.error('Error fetching token balance:', error);
    res.status(500).json({
      error: 'Failed to fetch token balance',
      message: error.message
    });
  }
});

// Get user reward history
router.get('/history', authenticateWallet, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userAddress = req.user.address;

    // Mock reward history
    const mockRewards = [
      {
        id: '1',
        amount: 50,
        reason: 'Data sharing consent',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        status: 'confirmed'
      },
      {
        id: '2',
        amount: 25,
        reason: 'Consent grant',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        status: 'confirmed'
      },
      {
        id: '3',
        amount: 100,
        reason: 'Referral bonus',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        transactionHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
        status: 'confirmed'
      }
    ];

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedRewards = mockRewards.slice(skip, skip + parseInt(limit));

    res.json({
      rewards: paginatedRewards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mockRewards.length,
        pages: Math.ceil(mockRewards.length / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reward history:', error);
    res.status(500).json({
      error: 'Failed to fetch reward history',
      message: error.message
    });
  }
});

// Award tokens to user
router.post('/award', authenticateWallet, async (req, res) => {
  try {
    const { userAddress, amount, reason } = req.body;
    const adminAddress = req.user.address;

    if (!userAddress || !amount || !reason) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userAddress', 'amount', 'reason']
      });
    }

    // Validate amount
    if (amount <= 0 || amount > 1000) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be between 1 and 1000'
      });
    }

    // Award tokens (simulate contract call)
    const result = await mockTokenContract.rewardTokens(userAddress, amount, reason);

    if (result.success) {
      // Emit real-time notification
      emitToUser(userAddress, 'token_reward', {
        amount,
        reason,
        timestamp: new Date()
      });

      res.json({
        message: 'Tokens awarded successfully',
        transactionHash: result.hash,
        amount,
        reason
      });
    } else {
      res.status(500).json({
        error: 'Failed to award tokens',
        message: 'Token transfer failed'
      });
    }

  } catch (error) {
    console.error('Error awarding tokens:', error);
    res.status(500).json({
      error: 'Failed to award tokens',
      message: error.message
    });
  }
});

// Get reward statistics
router.get('/stats', authenticateWallet, async (req, res) => {
  try {
    const userAddress = req.user.address;

    // Mock statistics
    const stats = {
      totalEarned: 1250,
      totalSpent: 300,
      currentBalance: 950,
      rewardsThisMonth: 150,
      rewardsThisWeek: 50,
      averageReward: 62.5,
      totalTransactions: 20,
      byReason: {
        'Data sharing consent': 600,
        'Consent grant': 300,
        'Referral bonus': 200,
        'Participation': 150
      }
    };

    res.json({
      stats
    });

  } catch (error) {
    console.error('Error fetching reward statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch reward statistics',
      message: error.message
    });
  }
});

// Get reward pool information
router.get('/pool', async (req, res) => {
  try {
    // Mock pool information
    const poolInfo = {
      totalSupply: 1000000,
      rewardPool: 100000,
      distributed: 900000,
      available: 100000,
      lastRefill: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextRefill: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    res.json({
      poolInfo
    });

  } catch (error) {
    console.error('Error fetching pool information:', error);
    res.status(500).json({
      error: 'Failed to fetch pool information',
      message: error.message
    });
  }
});

// Transfer tokens
router.post('/transfer', authenticateWallet, async (req, res) => {
  try {
    const { to, amount } = req.body;
    const fromAddress = req.user.address;

    if (!to || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'amount']
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    // Check balance
    const balance = await mockTokenContract.balanceOf(fromAddress);
    if (balance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `You have ${balance} SNT, but trying to transfer ${amount} SNT`
      });
    }

    // Transfer tokens
    const result = await mockTokenContract.transfer(fromAddress, to, amount);

    if (result.success) {
      res.json({
        message: 'Tokens transferred successfully',
        transactionHash: result.hash,
        from: fromAddress,
        to,
        amount
      });
    } else {
      res.status(500).json({
        error: 'Transfer failed',
        message: 'Token transfer failed'
      });
    }

  } catch (error) {
    console.error('Error transferring tokens:', error);
    res.status(500).json({
      error: 'Failed to transfer tokens',
      message: error.message
    });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Mock leaderboard data
    const leaderboard = [
      { address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', ensName: 'alice.eth', balance: 2500, totalEarned: 3000 },
      { address: '0x1234567890123456789012345678901234567890', ensName: 'bob.eth', balance: 1800, totalEarned: 2200 },
      { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', ensName: 'doctor.eth', balance: 1200, totalEarned: 1500 },
      { address: '0x7890123456789012345678901234567890123456', ensName: 'hospital.eth', balance: 900, totalEarned: 1100 },
      { address: '0x4567890123456789012345678901234567890123', ensName: 'research.eth', balance: 750, totalEarned: 900 }
    ];

    const limitedLeaderboard = leaderboard.slice(0, parseInt(limit));

    res.json({
      leaderboard: limitedLeaderboard,
      total: leaderboard.length
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

module.exports = router; 