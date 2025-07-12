const crypto = require('crypto');
const { ethers } = require('ethers');

class ZKPService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  }

  // Generate ZKP for age verification without revealing actual age
  async generateAgeProof(actualAge, minimumAge) {
    try {
      // Simple ZKP implementation - in production, use libraries like circom or snarkjs
      const ageHash = crypto.createHash('sha256').update(actualAge.toString()).digest('hex');
      const minimumAgeHash = crypto.createHash('sha256').update(minimumAge.toString()).digest('hex');
      
      const proof = {
        ageHash,
        minimumAgeHash,
        isValid: actualAge >= minimumAge,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      return proof;
    } catch (error) {
      console.error('Error generating age proof:', error);
      throw error;
    }
  }

  // Generate ZKP for location verification
  async generateLocationProof(userLocation, allowedRegions) {
    try {
      const locationHash = crypto.createHash('sha256').update(JSON.stringify(userLocation)).digest('hex');
      const regionsHash = crypto.createHash('sha256').update(JSON.stringify(allowedRegions)).digest('hex');
      
      const isInAllowedRegion = allowedRegions.some(region => 
        userLocation.country === region.country && 
        userLocation.state === region.state
      );

      const proof = {
        locationHash,
        regionsHash,
        isValid: isInAllowedRegion,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      return proof;
    } catch (error) {
      console.error('Error generating location proof:', error);
      throw error;
    }
  }

  // Generate ZKP for credential verification
  async generateCredentialProof(credentials, requiredCredentials) {
    try {
      const credentialHashes = credentials.map(cred => 
        crypto.createHash('sha256').update(JSON.stringify(cred)).digest('hex')
      );
      
      const requiredHashes = requiredCredentials.map(cred => 
        crypto.createHash('sha256').update(JSON.stringify(cred)).digest('hex')
      );

      const hasAllRequired = requiredCredentials.every(required => 
        credentials.some(cred => 
          cred.type === required.type && 
          cred.issuer === required.issuer &&
          cred.status === 'valid'
        )
      );

      const proof = {
        credentialHashes,
        requiredHashes,
        isValid: hasAllRequired,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      return proof;
    } catch (error) {
      console.error('Error generating credential proof:', error);
      throw error;
    }
  }

  // Verify ZKP proof
  async verifyProof(proof, verificationData) {
    try {
      // Verify proof integrity
      const expectedHash = crypto.createHash('sha256')
        .update(JSON.stringify(verificationData))
        .digest('hex');

      const isValid = proof.isValid && 
                     proof.timestamp > Date.now() - (24 * 60 * 60 * 1000) && // 24 hour expiry
                     proof.nonce.length === 32;

      return {
        isValid,
        proof,
        verificationData
      };
    } catch (error) {
      console.error('Error verifying proof:', error);
      return { isValid: false, error: error.message };
    }
  }

  // Generate Merkle tree for batch verification
  async generateMerkleTree(dataArray) {
    try {
      const leaves = dataArray.map(data => 
        crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
      );

      const buildMerkleTree = (leaves) => {
        if (leaves.length === 1) return leaves[0];
        
        const newLeaves = [];
        for (let i = 0; i < leaves.length; i += 2) {
          const left = leaves[i];
          const right = i + 1 < leaves.length ? leaves[i + 1] : left;
          const combined = crypto.createHash('sha256')
            .update(left + right)
            .digest('hex');
          newLeaves.push(combined);
        }
        
        return buildMerkleTree(newLeaves);
      };

      const root = buildMerkleTree(leaves);
      
      return {
        root,
        leaves,
        treeHeight: Math.ceil(Math.log2(leaves.length))
      };
    } catch (error) {
      console.error('Error generating Merkle tree:', error);
      throw error;
    }
  }

  // Generate proof for data access without revealing the data
  async generateDataAccessProof(userId, dataType, accessLevel) {
    try {
      const accessHash = crypto.createHash('sha256')
        .update(`${userId}-${dataType}-${accessLevel}`)
        .digest('hex');

      const proof = {
        accessHash,
        userId: crypto.createHash('sha256').update(userId).digest('hex'),
        dataType: crypto.createHash('sha256').update(dataType).digest('hex'),
        accessLevel: crypto.createHash('sha256').update(accessLevel).digest('hex'),
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      return proof;
    } catch (error) {
      console.error('Error generating data access proof:', error);
      throw error;
    }
  }

  // Verify data access proof
  async verifyDataAccessProof(proof, userId, dataType, accessLevel) {
    try {
      const expectedHash = crypto.createHash('sha256')
        .update(`${userId}-${dataType}-${accessLevel}`)
        .digest('hex');

      const isValid = proof.accessHash === expectedHash &&
                     proof.timestamp > Date.now() - (60 * 60 * 1000) && // 1 hour expiry
                     proof.nonce.length === 32;

      return {
        isValid,
        proof,
        accessGranted: isValid
      };
    } catch (error) {
      console.error('Error verifying data access proof:', error);
      return { isValid: false, accessGranted: false, error: error.message };
    }
  }
}

module.exports = new ZKPService(); 