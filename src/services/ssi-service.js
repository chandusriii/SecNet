const crypto = require('crypto');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

class SSIService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    this.didRegistry = new ethers.Contract(
      process.env.DID_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
      [
        'function resolveDID(string did) external view returns (address, uint256, string)',
        'function registerDID(string did, address owner, uint256 timestamp, string document) external',
        'function updateDID(string did, string document) external',
        'function revokeDID(string did) external'
      ],
      this.provider
    );
  }

  // Create a new DID (Decentralized Identifier)
  async createDID(userAddress, didDocument) {
    try {
      const did = `did:ethr:${userAddress}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const documentHash = crypto.createHash('sha256')
        .update(JSON.stringify(didDocument))
        .digest('hex');

      const didData = {
        did,
        owner: userAddress,
        timestamp,
        document: documentHash,
        publicKey: didDocument.publicKey,
        services: didDocument.services || [],
        verificationMethods: didDocument.verificationMethod || []
      };

      return didData;
    } catch (error) {
      console.error('Error creating DID:', error);
      throw error;
    }
  }

  // Resolve a DID to get its document
  async resolveDID(did) {
    try {
      const [owner, timestamp, documentHash] = await this.didRegistry.resolveDID(did);
      
      if (owner === ethers.constants.AddressZero) {
        return null;
      }

      return {
        did,
        owner,
        timestamp: timestamp.toNumber(),
        documentHash,
        isActive: true
      };
    } catch (error) {
      console.error('Error resolving DID:', error);
      return null;
    }
  }

  // Create and sign a Verifiable Credential
  async createVerifiableCredential(issuerDID, subjectDID, credentialData, expirationDate) {
    try {
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiableCredential', credentialData.type],
        issuer: issuerDID,
        issuanceDate: new Date().toISOString(),
        expirationDate: expirationDate.toISOString(),
        credentialSubject: {
          id: subjectDID,
          ...credentialData.subject
        },
        credentialSchema: credentialData.schema || null,
        evidence: credentialData.evidence || null
      };

      // Create JWT for the credential
      const jwtPayload = {
        iss: issuerDID,
        sub: subjectDID,
        vc: credential,
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(expirationDate.getTime() / 1000)
      };

      const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { algorithm: 'HS256' });

      return {
        credential,
        jwt: jwtToken,
        proof: {
          type: 'JwtProof2020',
          jwt: jwtToken
        }
      };
    } catch (error) {
      console.error('Error creating verifiable credential:', error);
      throw error;
    }
  }

  // Verify a Verifiable Credential
  async verifyCredential(credentialJWT) {
    try {
      const decoded = jwt.verify(credentialJWT, process.env.JWT_SECRET);
      
      // Check if credential is expired
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, error: 'Credential expired' };
      }

      // Verify issuer DID
      const issuerDID = await this.resolveDID(decoded.iss);
      if (!issuerDID || !issuerDID.isActive) {
        return { isValid: false, error: 'Invalid issuer DID' };
      }

      // Verify subject DID
      const subjectDID = await this.resolveDID(decoded.sub);
      if (!subjectDID || !subjectDID.isActive) {
        return { isValid: false, error: 'Invalid subject DID' };
      }

      return {
        isValid: true,
        credential: decoded.vc,
        issuer: decoded.iss,
        subject: decoded.sub,
        issuedAt: new Date(decoded.nbf * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      console.error('Error verifying credential:', error);
      return { isValid: false, error: error.message };
    }
  }

  // Create a Verifiable Presentation
  async createVerifiablePresentation(holderDID, credentials, challenge) {
    try {
      const presentation = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1'
        ],
        id: `urn:uuid:${crypto.randomUUID()}`,
        type: ['VerifiablePresentation'],
        holder: holderDID,
        verifiableCredential: credentials,
        challenge: challenge,
        domain: process.env.DOMAIN || 'secnet.app'
      };

      // Create JWT for the presentation
      const jwtPayload = {
        iss: holderDID,
        aud: process.env.DOMAIN || 'secnet.app',
        vp: presentation,
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
        nonce: challenge
      };

      const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { algorithm: 'HS256' });

      return {
        presentation,
        jwt: jwtToken,
        proof: {
          type: 'JwtProof2020',
          jwt: jwtToken
        }
      };
    } catch (error) {
      console.error('Error creating verifiable presentation:', error);
      throw error;
    }
  }

  // Verify a Verifiable Presentation
  async verifyPresentation(presentationJWT, challenge) {
    try {
      const decoded = jwt.verify(presentationJWT, process.env.JWT_SECRET);
      
      // Check if presentation is expired
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, error: 'Presentation expired' };
      }

      // Verify challenge
      if (decoded.nonce !== challenge) {
        return { isValid: false, error: 'Invalid challenge' };
      }

      // Verify holder DID
      const holderDID = await this.resolveDID(decoded.iss);
      if (!holderDID || !holderDID.isActive) {
        return { isValid: false, error: 'Invalid holder DID' };
      }

      // Verify all credentials in the presentation
      const credentialVerifications = await Promise.all(
        decoded.vp.verifiableCredential.map(cred => this.verifyCredential(cred))
      );

      const allCredentialsValid = credentialVerifications.every(verification => verification.isValid);

      return {
        isValid: allCredentialsValid,
        presentation: decoded.vp,
        holder: decoded.iss,
        credentials: credentialVerifications,
        issuedAt: new Date(decoded.nbf * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      console.error('Error verifying presentation:', error);
      return { isValid: false, error: error.message };
    }
  }

  // Generate credential schema
  async generateCredentialSchema(schemaName, schemaVersion, properties) {
    try {
      const schema = {
        '@context': 'https://www.w3.org/2018/credentials/v1',
        '@type': 'JsonSchema',
        name: schemaName,
        version: schemaVersion,
        properties: properties,
        required: Object.keys(properties).filter(key => properties[key].required !== false),
        additionalProperties: false
      };

      const schemaHash = crypto.createHash('sha256')
        .update(JSON.stringify(schema))
        .digest('hex');

      return {
        schema,
        schemaHash,
        schemaId: `urn:uuid:${crypto.randomUUID()}`
      };
    } catch (error) {
      console.error('Error generating credential schema:', error);
      throw error;
    }
  }

  // Revoke a credential
  async revokeCredential(credentialId, issuerDID, reason) {
    try {
      const revocation = {
        credentialId,
        issuer: issuerDID,
        reason: reason || 'User requested revocation',
        timestamp: Date.now(),
        revocationHash: crypto.createHash('sha256')
          .update(`${credentialId}-${issuerDID}-${Date.now()}`)
          .digest('hex')
      };

      return revocation;
    } catch (error) {
      console.error('Error revoking credential:', error);
      throw error;
    }
  }
}

module.exports = new SSIService(); 