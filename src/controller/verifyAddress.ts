import Web3 from 'web3';

const verifyAddress = (address: string) => {
    return Web3.utils.isAddress(address);
}

const validatePrivateKey = (privateKey: string) => { 
    try {
      // Initialize Web3 (you can use any Polygon RPC provider)
      const web3 = new Web3('https://polygon-rpc.com/');
      
      // Check if private key starts with 0x, add if missing
      const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      
      // Validate private key format
      if (!/^0x[0-9a-fA-F]{64}$/.test(formattedPrivateKey)) {
        return false;
      }
      
      // Get the account from private key
      const account = web3.eth.accounts.privateKeyToAccount(formattedPrivateKey);
  
      return true;
      
    } catch (error) {
      return false;
    }
  }

export {
    verifyAddress,
    validatePrivateKey
}