const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyWalletSignature, generateAuthToken } = require('../middleware/auth');

// Wallet authentication
router.post('/wallet', verifyWalletSignature, async (req, res) => {
  try {
    const { address, ensName, profile } = req.body;
    const verifiedAddress = req.verifiedAddress;

    // Find or create user
    let user = await User.findByAddress(verifiedAddress);
    
    if (!user) {
      // Create new user
      user = new User({
        address: verifiedAddress,
        ensName: ensName || null,
        profile: profile || {},
        lastSeen: new Date()
      });
      
      await user.save();
      console.log(`✅ New user created: ${verifiedAddress}`);
    } else {
      // Update existing user
      user.lastSeen = new Date();
      if (ensName) user.ensName = ensName;
      if (profile) user.profile = { ...user.profile, ...profile };
      
      await user.save();
      console.log(`✅ User authenticated: ${verifiedAddress}`);
    }

    // Generate JWT token
    const token = generateAuthToken(verifiedAddress);

    res.json({
      message: 'Authentication successful',
      token,
      user: {
        address: user.address,
        ensName: user.ensName,
        profile: user.profile,
        tokenBalance: user.tokenBalance,
        totalEarned: user.totalEarned
      }
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address is required',
        message: 'Please provide a wallet address'
      });
    }

    const user = await User.findByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.json({
      user: {
        address: user.address,
        ensName: user.ensName,
        profile: user.profile,
        tokenBalance: user.tokenBalance,
        totalEarned: user.totalEarned,
        ssiCredentials: user.ssiCredentials,
        preferences: user.preferences,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { address, profile, preferences } = req.body;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address is required',
        message: 'Please provide a wallet address'
      });
    }

    const user = await User.findByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Update profile if provided
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    // Update preferences if provided
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        address: user.address,
        ensName: user.ensName,
        profile: user.profile,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update user profile',
      message: error.message
    });
  }
});

// Add SSI credential
router.post('/credentials', async (req, res) => {
  try {
    const { address, credential } = req.body;
    
    if (!address || !credential) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['address', 'credential']
      });
    }

    const user = await User.findByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Add credential
    await user.addCredential(credential);

    res.json({
      message: 'Credential added successfully',
      credentials: user.ssiCredentials
    });

  } catch (error) {
    console.error('Error adding credential:', error);
    res.status(500).json({
      error: 'Failed to add credential',
      message: error.message
    });
  }
});

// Revoke SSI credential
router.delete('/credentials/:credentialHash', async (req, res) => {
  try {
    const { address } = req.query;
    const { credentialHash } = req.params;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address is required',
        message: 'Please provide a wallet address'
      });
    }

    const user = await User.findByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Revoke credential
    await user.revokeCredential(credentialHash);

    res.json({
      message: 'Credential revoked successfully',
      credentials: user.ssiCredentials
    });

  } catch (error) {
    console.error('Error revoking credential:', error);
    res.status(500).json({
      error: 'Failed to revoke credential',
      message: error.message
    });
  }
});

// Get user statistics
router.get('/stats/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const user = await User.findByAddress(address);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Get user statistics
    const stats = {
      totalCredentials: user.ssiCredentials.length,
      activeCredentials: user.ssiCredentials.filter(c => !c.isRevoked).length,
      tokenBalance: user.tokenBalance,
      totalEarned: user.totalEarned,
      daysSinceRegistration: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      lastSeen: user.lastSeen
    };

    res.json({
      stats
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
});

module.exports = router; 