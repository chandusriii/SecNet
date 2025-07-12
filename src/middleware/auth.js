const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');

const authenticateWallet = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid wallet signature'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const user = await User.findByAddress(decoded.address);
    
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Please authenticate with your wallet first'
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please authenticate with your wallet'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please re-authenticate with your wallet'
      });
    }

    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
};

const verifyWalletSignature = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['address', 'signature', 'message']
      });
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Signature verification failed'
      });
    }

    // Add verified address to request
    req.verifiedAddress = address.toLowerCase();
    next();

  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(401).json({
      error: 'Signature verification failed',
      message: 'Invalid signature provided'
    });
  }
};

const generateAuthToken = (address) => {
  return jwt.sign(
    { address },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

module.exports = {
  authenticateWallet,
  verifyWalletSignature,
  generateAuthToken
}; 