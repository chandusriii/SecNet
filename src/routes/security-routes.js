const express = require('express');
const router = express.Router();
const ensService = require('../services/ens-service');
const zkpService = require('../services/zkp-service');
const ssiService = require('../services/ssi-service');
const ipfsService = require('../services/ipfs-service');
const SecurityMiddleware = require('../middleware/security-middleware');

// ENS Identity Management Routes
router.post('/ens/verify', SecurityMiddleware.verifyENSIdentity, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'ENS identity verified successfully',
      profile: req.ensProfile,
      verifiedIdentity: req.verifiedIdentity
    });
  } catch (error) {
    res.status(500).json({ error: 'ENS verification failed' });
  }
});

router.post('/ens/resolve', async (req, res) => {
  try {
    const { ensName } = req.body;
    const address = await ensService.resolveENSName(ensName);
    
    if (!address) {
      return res.status(404).json({ error: 'ENS name not found' });
    }
    
    res.json({ address, ensName });
  } catch (error) {
    res.status(500).json({ error: 'ENS resolution failed' });
  }
});

router.post('/ens/profile', async (req, res) => {
  try {
    const { ensName } = req.body;
    const profile = await ensService.getUserENSProfile(ensName);
    
    if (!profile) {
      return res.status(404).json({ error: 'ENS profile not found' });
    }
    
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ENS profile' });
  }
});

// ZKP Proof Generation and Verification Routes
router.post('/zkp/generate-age-proof', async (req, res) => {
  try {
    const { actualAge, minimumAge } = req.body;
    const proof = await zkpService.generateAgeProof(actualAge, minimumAge);
    
    res.json({ proof });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate age proof' });
  }
});

router.post('/zkp/generate-location-proof', async (req, res) => {
  try {
    const { userLocation, allowedRegions } = req.body;
    const proof = await zkpService.generateLocationProof(userLocation, allowedRegions);
    
    res.json({ proof });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate location proof' });
  }
});

router.post('/zkp/generate-credential-proof', async (req, res) => {
  try {
    const { credentials, requiredCredentials } = req.body;
    const proof = await zkpService.generateCredentialProof(credentials, requiredCredentials);
    
    res.json({ proof });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate credential proof' });
  }
});

router.post('/zkp/verify', SecurityMiddleware.verifyZKPProof, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'ZKP verification successful',
      verification: req.zkpVerification
    });
  } catch (error) {
    res.status(500).json({ error: 'ZKP verification failed' });
  }
});

router.post('/zkp/merkle-tree', async (req, res) => {
  try {
    const { dataArray } = req.body;
    const merkleTree = await zkpService.generateMerkleTree(dataArray);
    
    res.json({ merkleTree });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate Merkle tree' });
  }
});

// SSI Credential Management Routes
router.post('/ssi/create-did', async (req, res) => {
  try {
    const { userAddress, didDocument } = req.body;
    const didData = await ssiService.createDID(userAddress, didDocument);
    
    res.json({ didData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create DID' });
  }
});

router.post('/ssi/resolve-did', async (req, res) => {
  try {
    const { did } = req.body;
    const didData = await ssiService.resolveDID(did);
    
    if (!didData) {
      return res.status(404).json({ error: 'DID not found' });
    }
    
    res.json({ didData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve DID' });
  }
});

router.post('/ssi/create-credential', async (req, res) => {
  try {
    const { issuerDID, subjectDID, credentialData, expirationDate } = req.body;
    const credential = await ssiService.createVerifiableCredential(
      issuerDID, 
      subjectDID, 
      credentialData, 
      new Date(expirationDate)
    );
    
    res.json({ credential });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create verifiable credential' });
  }
});

router.post('/ssi/verify-credential', async (req, res) => {
  try {
    const { credentialJWT } = req.body;
    const verification = await ssiService.verifyCredential(credentialJWT);
    
    res.json({ verification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify credential' });
  }
});

router.post('/ssi/create-presentation', async (req, res) => {
  try {
    const { holderDID, credentials, challenge } = req.body;
    const presentation = await ssiService.createVerifiablePresentation(
      holderDID, 
      credentials, 
      challenge
    );
    
    res.json({ presentation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create verifiable presentation' });
  }
});

router.post('/ssi/verify-presentation', SecurityMiddleware.verifySSICredentials, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'SSI presentation verified successfully',
      verification: req.ssiVerification
    });
  } catch (error) {
    res.status(500).json({ error: 'SSI verification failed' });
  }
});

// IPFS Data Storage and Retrieval Routes
router.post('/ipfs/store-consent', SecurityMiddleware.encryptSensitiveData, async (req, res) => {
  try {
    const { consentData, userAddress } = req.body;
    const storageResult = await ipfsService.storeConsentData(consentData, userAddress);
    
    res.json({ storageResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store consent data' });
  }
});

router.post('/ipfs/store-medical-data', SecurityMiddleware.encryptSensitiveData, async (req, res) => {
  try {
    const { medicalData, userAddress, dataType } = req.body;
    const storageResult = await ipfsService.storeMedicalData(medicalData, userAddress, dataType);
    
    res.json({ storageResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store medical data' });
  }
});

router.post('/ipfs/retrieve-data', SecurityMiddleware.verifyDataAccess, async (req, res) => {
  try {
    const { dataCID, metadataCID, encryptionKey } = req.body;
    const data = await ipfsService.retrieveEncryptedData(dataCID, metadataCID, encryptionKey);
    
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

router.post('/ipfs/store-audit-log', async (req, res) => {
  try {
    const { auditLog, userAddress } = req.body;
    const storageResult = await ipfsService.storeAuditLog(auditLog, userAddress);
    
    res.json({ storageResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store audit log' });
  }
});

router.post('/ipfs/store-zkp-proof', async (req, res) => {
  try {
    const { proof, userAddress, proofType } = req.body;
    const storageResult = await ipfsService.storeZKPProof(proof, userAddress, proofType);
    
    res.json({ storageResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store ZKP proof' });
  }
});

router.post('/ipfs/store-ssi-credential', async (req, res) => {
  try {
    const { credential, userAddress } = req.body;
    const storageResult = await ipfsService.storeSSICredential(credential, userAddress);
    
    res.json({ storageResult });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store SSI credential' });
  }
});

// Multi-Factor Security Routes
router.post('/security/multi-factor', 
  SecurityMiddleware.rateLimitSecurity,
  SecurityMiddleware.multiFactorSecurity,
  SecurityMiddleware.auditSecurityEvent,
  async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Multi-factor security verification successful',
        verification: req.securityVerification,
        auditLog: req.auditLog
      });
    } catch (error) {
      res.status(500).json({ error: 'Multi-factor security verification failed' });
    }
  }
);

router.post('/security/consent-verification', 
  SecurityMiddleware.verifyBlockchainConsent,
  SecurityMiddleware.auditSecurityEvent,
  async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Consent verification successful',
        verification: req.consentVerification,
        auditLog: req.auditLog
      });
    } catch (error) {
      res.status(500).json({ error: 'Consent verification failed' });
    }
  }
);

// Data Access Control Routes
router.post('/security/data-access', 
  SecurityMiddleware.rateLimitSecurity,
  SecurityMiddleware.verifyDataAccess,
  SecurityMiddleware.auditSecurityEvent,
  async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Data access granted',
        access: req.dataAccess,
        auditLog: req.auditLog
      });
    } catch (error) {
      res.status(500).json({ error: 'Data access verification failed' });
    }
  }
);

// Health Check and Status Routes
router.get('/security/status', async (req, res) => {
  try {
    const status = {
      ens: {
        available: true,
        endpoint: process.env.ETHEREUM_RPC_URL ? 'configured' : 'not configured'
      },
      zkp: {
        available: true,
        algorithms: ['age', 'location', 'credential', 'dataAccess']
      },
      ssi: {
        available: true,
        didRegistry: process.env.DID_REGISTRY_ADDRESS ? 'configured' : 'not configured'
      },
      ipfs: {
        available: true,
        host: process.env.IPFS_HOST || 'ipfs.infura.io'
      },
      timestamp: Date.now()
    };
    
    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get security status' });
  }
});

module.exports = router; 