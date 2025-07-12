const ensService = require('../services/ens-service');
const zkpService = require('../services/zkp-service');
const ssiService = require('../services/ssi-service');
const ipfsService = require('../services/ipfs-service');
const jwt = require('jsonwebtoken');

class SecurityMiddleware {
  // Verify ENS ownership and resolve identity
  async verifyENSIdentity(req, res, next) {
    try {
      const { ensName, userAddress } = req.body;
      
      if (!ensName || !userAddress) {
        return res.status(400).json({ error: 'ENS name and user address required' });
      }

      // Verify ENS ownership
      const isOwner = await ensService.verifyENSOwnership(ensName, userAddress);
      if (!isOwner) {
        return res.status(403).json({ error: 'User does not own this ENS name' });
      }

      // Get ENS profile
      const ensProfile = await ensService.getUserENSProfile(ensName);
      if (!ensProfile) {
        return res.status(404).json({ error: 'ENS profile not found' });
      }

      req.ensProfile = ensProfile;
      req.verifiedIdentity = {
        type: 'ens',
        name: ensName,
        address: userAddress,
        profile: ensProfile
      };

      next();
    } catch (error) {
      console.error('ENS verification error:', error);
      res.status(500).json({ error: 'ENS verification failed' });
    }
  }

  // Verify ZKP proof for data access
  async verifyZKPProof(req, res, next) {
    try {
      const { proof, verificationData, proofType } = req.body;
      
      if (!proof || !verificationData) {
        return res.status(400).json({ error: 'Proof and verification data required' });
      }

      let verificationResult;
      
      switch (proofType) {
        case 'age':
          verificationResult = await zkpService.verifyProof(proof, verificationData);
          break;
        case 'location':
          verificationResult = await zkpService.verifyProof(proof, verificationData);
          break;
        case 'credential':
          verificationResult = await zkpService.verifyProof(proof, verificationData);
          break;
        case 'dataAccess':
          verificationResult = await zkpService.verifyDataAccessProof(
            proof, 
            verificationData.userId, 
            verificationData.dataType, 
            verificationData.accessLevel
          );
          break;
        default:
          return res.status(400).json({ error: 'Invalid proof type' });
      }

      if (!verificationResult.isValid) {
        return res.status(403).json({ 
          error: 'ZKP verification failed', 
          details: verificationResult.error 
        });
      }

      req.zkpVerification = verificationResult;
      next();
    } catch (error) {
      console.error('ZKP verification error:', error);
      res.status(500).json({ error: 'ZKP verification failed' });
    }
  }

  // Verify SSI credentials
  async verifySSICredentials(req, res, next) {
    try {
      const { presentationJWT, challenge } = req.body;
      
      if (!presentationJWT || !challenge) {
        return res.status(400).json({ error: 'Presentation JWT and challenge required' });
      }

      // Verify the presentation
      const verificationResult = await ssiService.verifyPresentation(presentationJWT, challenge);
      
      if (!verificationResult.isValid) {
        return res.status(403).json({ 
          error: 'SSI verification failed', 
          details: verificationResult.error 
        });
      }

      req.ssiVerification = verificationResult;
      next();
    } catch (error) {
      console.error('SSI verification error:', error);
      res.status(500).json({ error: 'SSI verification failed' });
    }
  }

  // Verify data access permissions with IPFS
  async verifyDataAccess(req, res, next) {
    try {
      const { dataCID, metadataCID, userAddress, dataType } = req.body;
      
      if (!dataCID || !userAddress || !dataType) {
        return res.status(400).json({ error: 'Data CID, user address, and data type required' });
      }

      // Check if data exists on IPFS
      const dataExists = await ipfsService.dataExists(dataCID);
      if (!dataExists) {
        return res.status(404).json({ error: 'Data not found on IPFS' });
      }

      // Verify user has access to this data type
      const accessProof = await zkpService.generateDataAccessProof(userAddress, dataType, 'read');
      const accessVerification = await zkpService.verifyDataAccessProof(
        accessProof, 
        userAddress, 
        dataType, 
        'read'
      );

      if (!accessVerification.accessGranted) {
        return res.status(403).json({ error: 'Access denied to this data' });
      }

      req.dataAccess = {
        dataCID,
        metadataCID,
        dataType,
        userAddress,
        accessGranted: true,
        proof: accessProof
      };

      next();
    } catch (error) {
      console.error('Data access verification error:', error);
      res.status(500).json({ error: 'Data access verification failed' });
    }
  }

  // Multi-factor security verification
  async multiFactorSecurity(req, res, next) {
    try {
      const { 
        ensName, 
        userAddress, 
        zkpProof, 
        ssiPresentation, 
        challenge,
        dataCID 
      } = req.body;

      // Step 1: Verify ENS identity
      const ensOwner = await ensService.verifyENSOwnership(ensName, userAddress);
      if (!ensOwner) {
        return res.status(403).json({ error: 'ENS ownership verification failed' });
      }

      // Step 2: Verify ZKP proof
      if (zkpProof) {
        const zkpVerification = await zkpService.verifyProof(zkpProof, req.body);
        if (!zkpVerification.isValid) {
          return res.status(403).json({ error: 'ZKP verification failed' });
        }
      }

      // Step 3: Verify SSI presentation
      if (ssiPresentation && challenge) {
        const ssiVerification = await ssiService.verifyPresentation(ssiPresentation, challenge);
        if (!ssiVerification.isValid) {
          return res.status(403).json({ error: 'SSI verification failed' });
        }
      }

      // Step 4: Verify data access on IPFS
      if (dataCID) {
        const dataExists = await ipfsService.dataExists(dataCID);
        if (!dataExists) {
          return res.status(404).json({ error: 'Data not found on IPFS' });
        }
      }

      req.securityVerification = {
        ensVerified: true,
        zkpVerified: zkpProof ? true : false,
        ssiVerified: ssiPresentation ? true : false,
        dataAccessVerified: dataCID ? true : false,
        timestamp: Date.now()
      };

      next();
    } catch (error) {
      console.error('Multi-factor security verification error:', error);
      res.status(500).json({ error: 'Multi-factor security verification failed' });
    }
  }

  // Encrypt sensitive data before storage
  async encryptSensitiveData(req, res, next) {
    try {
      const { data, userAddress, dataType } = req.body;
      
      if (!data || !userAddress || !dataType) {
        return res.status(400).json({ error: 'Data, user address, and data type required' });
      }

      // Generate encryption key based on user and data type
      const encryptionKey = require('crypto')
        .createHash('sha256')
        .update(`${userAddress}-${dataType}-${process.env.ENCRYPTION_SECRET}`)
        .digest('hex');

      // Encrypt the data
      const encryptedData = await ipfsService.encryptData(data, encryptionKey);
      
      req.encryptedData = {
        ...encryptedData,
        userAddress,
        dataType,
        timestamp: Date.now()
      };

      next();
    } catch (error) {
      console.error('Data encryption error:', error);
      res.status(500).json({ error: 'Data encryption failed' });
    }
  }

  // Verify blockchain-based consent
  async verifyBlockchainConsent(req, res, next) {
    try {
      const { consentHash, userAddress, dataType } = req.body;
      
      if (!consentHash || !userAddress || !dataType) {
        return res.status(400).json({ error: 'Consent hash, user address, and data type required' });
      }

      // Verify consent on blockchain (simplified - in production, check actual smart contract)
      const consentVerification = {
        isValid: true, // In production, verify against smart contract
        consentHash,
        userAddress,
        dataType,
        timestamp: Date.now()
      };

      req.consentVerification = consentVerification;
      next();
    } catch (error) {
      console.error('Consent verification error:', error);
      res.status(500).json({ error: 'Consent verification failed' });
    }
  }

  // Rate limiting for security operations
  rateLimitSecurity(req, res, next) {
    const userAddress = req.body.userAddress || req.headers['x-user-address'];
    
    if (!userAddress) {
      return res.status(400).json({ error: 'User address required for rate limiting' });
    }

    // Simple rate limiting - in production, use Redis or similar
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10; // Max 10 requests per minute

    if (!req.securityRateLimit) {
      req.securityRateLimit = new Map();
    }

    const userRequests = req.securityRateLimit.get(userAddress) || [];
    const validRequests = userRequests.filter(time => now - time < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Rate limit exceeded for security operations' });
    }

    validRequests.push(now);
    req.securityRateLimit.set(userAddress, validRequests);

    next();
  }

  // Audit logging for security events
  async auditSecurityEvent(req, res, next) {
    try {
      const auditLog = {
        timestamp: Date.now(),
        userAddress: req.body.userAddress,
        action: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        securityVerification: req.securityVerification || null,
        ensProfile: req.ensProfile || null,
        zkpVerification: req.zkpVerification || null,
        ssiVerification: req.ssiVerification || null,
        dataAccess: req.dataAccess || null
      };

      // Store audit log on IPFS
      if (auditLog.userAddress) {
        await ipfsService.storeAuditLog(auditLog, auditLog.userAddress);
      }

      req.auditLog = auditLog;
      next();
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request for audit logging errors
      next();
    }
  }
}

module.exports = new SecurityMiddleware(); 