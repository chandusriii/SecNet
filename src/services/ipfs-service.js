const { create } = require('ipfs-http-client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class IPFSService {
  constructor() {
    // Initialize IPFS client
    this.ipfs = create({
      host: process.env.IPFS_HOST || 'ipfs.infura.io',
      port: process.env.IPFS_PORT || 5001,
      protocol: process.env.IPFS_PROTOCOL || 'https',
      headers: {
        authorization: process.env.IPFS_AUTH_HEADER || ''
      }
    });
  }

  // Encrypt data before storing on IPFS
  async encryptData(data, encryptionKey) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm
      };
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  // Decrypt data retrieved from IPFS
  async decryptData(encryptedData, encryptionKey) {
    try {
      const algorithm = encryptedData.algorithm;
      const decipher = crypto.createDecipher(algorithm, encryptionKey);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw error;
    }
  }

  // Store encrypted data on IPFS
  async storeEncryptedData(data, encryptionKey, metadata = {}) {
    try {
      // Encrypt the data
      const encryptedData = await this.encryptData(data, encryptionKey);
      
      // Create metadata with encryption info
      const ipfsMetadata = {
        ...metadata,
        encryption: {
          algorithm: encryptedData.algorithm,
          iv: encryptedData.iv,
          authTag: encryptedData.authTag
        },
        timestamp: Date.now(),
        version: '1.0'
      };

      // Store encrypted data
      const encryptedResult = await this.ipfs.add(JSON.stringify(encryptedData));
      
      // Store metadata
      const metadataResult = await this.ipfs.add(JSON.stringify(ipfsMetadata));
      
      return {
        dataCID: encryptedResult.cid.toString(),
        metadataCID: metadataResult.cid.toString(),
        encryptionKey: encryptionKey, // In production, this should be handled securely
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error storing encrypted data on IPFS:', error);
      throw error;
    }
  }

  // Retrieve and decrypt data from IPFS
  async retrieveEncryptedData(dataCID, metadataCID, encryptionKey) {
    try {
      // Retrieve encrypted data
      const encryptedChunks = [];
      for await (const chunk of this.ipfs.cat(dataCID)) {
        encryptedChunks.push(chunk);
      }
      const encryptedData = JSON.parse(Buffer.concat(encryptedChunks).toString());

      // Retrieve metadata
      const metadataChunks = [];
      for await (const chunk of this.ipfs.cat(metadataCID)) {
        metadataChunks.push(chunk);
      }
      const metadata = JSON.parse(Buffer.concat(metadataChunks).toString());

      // Decrypt the data
      const decryptedData = await this.decryptData(encryptedData, encryptionKey);
      
      return {
        data: decryptedData,
        metadata,
        dataCID,
        metadataCID
      };
    } catch (error) {
      console.error('Error retrieving encrypted data from IPFS:', error);
      throw error;
    }
  }

  // Store user consent data
  async storeConsentData(consentData, userAddress) {
    try {
      const encryptionKey = crypto.createHash('sha256')
        .update(`${userAddress}-${process.env.CONSENT_SECRET}`)
        .digest('hex');

      const metadata = {
        type: 'consent',
        userAddress,
        dataTypes: consentData.dataTypes,
        permissions: consentData.permissions,
        expiryDate: consentData.expiryDate
      };

      return await this.storeEncryptedData(consentData, encryptionKey, metadata);
    } catch (error) {
      console.error('Error storing consent data:', error);
      throw error;
    }
  }

  // Store medical data
  async storeMedicalData(medicalData, userAddress, dataType) {
    try {
      const encryptionKey = crypto.createHash('sha256')
        .update(`${userAddress}-${dataType}-${process.env.MEDICAL_SECRET}`)
        .digest('hex');

      const metadata = {
        type: 'medical',
        userAddress,
        dataType,
        category: medicalData.category,
        provider: medicalData.provider,
        dateCreated: medicalData.dateCreated
      };

      return await this.storeEncryptedData(medicalData, encryptionKey, metadata);
    } catch (error) {
      console.error('Error storing medical data:', error);
      throw error;
    }
  }

  // Store audit logs
  async storeAuditLog(auditLog, userAddress) {
    try {
      const encryptionKey = crypto.createHash('sha256')
        .update(`${userAddress}-${process.env.AUDIT_SECRET}`)
        .digest('hex');

      const metadata = {
        type: 'audit',
        userAddress,
        action: auditLog.action,
        timestamp: auditLog.timestamp,
        requester: auditLog.requester
      };

      return await this.storeEncryptedData(auditLog, encryptionKey, metadata);
    } catch (error) {
      console.error('Error storing audit log:', error);
      throw error;
    }
  }

  // Store ZKP proofs
  async storeZKPProof(proof, userAddress, proofType) {
    try {
      const encryptionKey = crypto.createHash('sha256')
        .update(`${userAddress}-${proofType}-${process.env.ZKP_SECRET}`)
        .digest('hex');

      const metadata = {
        type: 'zkp-proof',
        userAddress,
        proofType,
        timestamp: proof.timestamp,
        isValid: proof.isValid
      };

      return await this.storeEncryptedData(proof, encryptionKey, metadata);
    } catch (error) {
      console.error('Error storing ZKP proof:', error);
      throw error;
    }
  }

  // Store SSI credentials
  async storeSSICredential(credential, userAddress) {
    try {
      const encryptionKey = crypto.createHash('sha256')
        .update(`${userAddress}-${process.env.SSI_SECRET}`)
        .digest('hex');

      const metadata = {
        type: 'ssi-credential',
        userAddress,
        credentialType: credential.type,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate
      };

      return await this.storeEncryptedData(credential, encryptionKey, metadata);
    } catch (error) {
      console.error('Error storing SSI credential:', error);
      throw error;
    }
  }

  // Pin important data to ensure availability
  async pinData(cid) {
    try {
      await this.ipfs.pin.add(cid);
      return { success: true, cid };
    } catch (error) {
      console.error('Error pinning data:', error);
      throw error;
    }
  }

  // Unpin data when no longer needed
  async unpinData(cid) {
    try {
      await this.ipfs.pin.rm(cid);
      return { success: true, cid };
    } catch (error) {
      console.error('Error unpinning data:', error);
      throw error;
    }
  }

  // Get file info from IPFS
  async getFileInfo(cid) {
    try {
      const stats = await this.ipfs.files.stat(`/ipfs/${cid}`);
      return {
        cid: cid.toString(),
        size: stats.size,
        type: stats.type,
        blocks: stats.blocks
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  // Check if data exists on IPFS
  async dataExists(cid) {
    try {
      await this.ipfs.files.stat(`/ipfs/${cid}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate IPFS gateway URL
  generateGatewayURL(cid, gateway = 'https://ipfs.io/ipfs/') {
    return `${gateway}${cid}`;
  }

  // Store file with metadata
  async storeFile(fileBuffer, metadata = {}) {
    try {
      const fileResult = await this.ipfs.add(fileBuffer);
      
      if (Object.keys(metadata).length > 0) {
        const metadataResult = await this.ipfs.add(JSON.stringify(metadata));
        return {
          fileCID: fileResult.cid.toString(),
          metadataCID: metadataResult.cid.toString(),
          size: fileResult.size
        };
      }
      
      return {
        fileCID: fileResult.cid.toString(),
        size: fileResult.size
      };
    } catch (error) {
      console.error('Error storing file on IPFS:', error);
      throw error;
    }
  }
}

module.exports = new IPFSService(); 