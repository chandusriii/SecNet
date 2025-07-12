const { ethers } = require('ethers');
const { getEnsAddress } = require('viem/ens');

class ENSService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID');
    this.ensContract = new ethers.Contract(
      '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', // ENS Registry
      [
        'function resolver(bytes32 node) external view returns (address)',
        'function owner(bytes32 node) external view returns (address)',
        'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external',
        'function setRecord(bytes32 node, address owner, address resolver, uint64 ttl) external'
      ],
      this.provider
    );
  }

  // Resolve ENS name to address
  async resolveENSName(ensName) {
    try {
      const address = await getEnsAddress(this.provider, { name: ensName });
      return address;
    } catch (error) {
      console.error('Error resolving ENS name:', error);
      return null;
    }
  }

  // Get ENS name from address
  async getENSName(address) {
    try {
      const name = await this.provider.lookupAddress(address);
      return name;
    } catch (error) {
      console.error('Error getting ENS name:', error);
      return null;
    }
  }

  // Verify ENS ownership
  async verifyENSOwnership(ensName, address) {
    try {
      const node = ethers.utils.namehash(ensName);
      const owner = await this.ensContract.owner(node);
      return owner.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying ENS ownership:', error);
      return false;
    }
  }

  // Create ENS subdomain for user
  async createUserSubdomain(userAddress, subdomain) {
    try {
      const parentNode = ethers.utils.namehash('secnet.eth');
      const label = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(subdomain));
      
      // This would require the user to sign a transaction
      const tx = await this.ensContract.setSubnodeRecord(
        parentNode,
        label,
        userAddress,
        '0x0000000000000000000000000000000000000000', // Default resolver
        0 // No TTL
      );
      
      return tx.hash;
    } catch (error) {
      console.error('Error creating ENS subdomain:', error);
      throw error;
    }
  }

  // Get user's ENS profile
  async getUserENSProfile(ensName) {
    try {
      const resolver = await this.ensContract.resolver(ethers.utils.namehash(ensName));
      if (resolver === ethers.constants.AddressZero) {
        return null;
      }

      const resolverContract = new ethers.Contract(
        resolver,
        [
          'function text(bytes32 node, string key) external view returns (string)',
          'function addr(bytes32 node) external view returns (address)'
        ],
        this.provider
      );

      const node = ethers.utils.namehash(ensName);
      const avatar = await resolverContract.text(node, 'avatar');
      const email = await resolverContract.text(node, 'email');
      const url = await resolverContract.text(node, 'url');

      return {
        name: ensName,
        avatar,
        email,
        url,
        address: await resolverContract.addr(node)
      };
    } catch (error) {
      console.error('Error getting ENS profile:', error);
      return null;
    }
  }
}

module.exports = new ENSService(); 