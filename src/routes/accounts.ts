import { Router } from 'express';
import { Account } from '../models/accounts';
import { verifyAddress, validatePrivateKey } from '../controller/verifyAddress';

const router = Router();

// Create account
router.post('/', async (req, res) => {
  try {
    const { id, proxyWallet, privateKey } = req.body;
    
    const newAccount = new Account({
      id,
      proxyWallet,
      privateKey,
      isActive: false,
    });

    if(verifyAddress(proxyWallet) && validatePrivateKey(privateKey)){
      const savedAccount = await newAccount.save();
      res.status(201).json(savedAccount);
    } else {
      if(!verifyAddress(proxyWallet)){
        res.status(400).json({ error: 'Incorrect wallet address' });
      }
      if(!validatePrivateKey(privateKey)){
        res.status(400).json({ error: 'Incorrect private key' });
      }
    }
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Account already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find(); 
    console.log(accounts)   
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account by proxyWallet and privateKey as parameters
router.delete('/:id/:proxyWallet/:privateKey', async (req, res) => {
    try {
      const { id, proxyWallet, privateKey } = req.params;
  
      if (!id || !proxyWallet || !privateKey) {
        return res.status(400).json({ 
          error: 'Both proxyWallet and privateKey are required as URL parameters' 
        });
      }
  
      // Decode URL components
      const decodedProxyWallet = decodeURIComponent(proxyWallet);
      const decodedPrivateKey = decodeURIComponent(privateKey);
      const decodedID = decodeURIComponent(id);
  
      // Find and delete the account
      const result = await Account.deleteOne({
        id: decodedID, 
        proxyWallet: decodedProxyWallet, 
        privateKey: decodedPrivateKey 
      });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ 
          error: 'Account not found with these credentials' 
        });
      }
  
      res.status(200).json({ 
        success: true,
        message: 'Account deleted successfully' 
      });
  
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message || 'Failed to delete account' 
      });
    }
});

router.put('/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    // Add validation
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const updatedAccount = await Account.findOneAndUpdate(
      {id: id},
      { isActive: isActive },
      { new: true }
    ); 
    console.log(updatedAccount)
    
    if (!updatedAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(updatedAccount);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
    console.log(error);
  }
});

export default router;