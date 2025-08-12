import { Router } from 'express';
import { Account } from '../models/accounts';

const router = Router();

// Create account
router.post('/', async (req, res) => {
  try {
    const { id, proxyWallet, privateKey } = req.body;
    
    const newAccount = new Account({
      id,
      proxyWallet,
      privateKey,
      isActive: false
    });

    const savedAccount = await newAccount.save();
    res.status(201).json(savedAccount);
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
    console.log(accounts);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account by proxyWallet and privateKey as parameters
router.delete('/:proxyWallet/:privateKey', async (req, res) => {
    try {
      const { proxyWallet, privateKey } = req.params;
  
      if (!proxyWallet || !privateKey) {
        return res.status(400).json({ 
          error: 'Both proxyWallet and privateKey are required as URL parameters' 
        });
      }
  
      // Decode URL components
      const decodedProxyWallet = decodeURIComponent(proxyWallet);
      const decodedPrivateKey = decodeURIComponent(privateKey);
  
      // Find and delete the account
      const result = await Account.deleteOne({ 
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

export default router;