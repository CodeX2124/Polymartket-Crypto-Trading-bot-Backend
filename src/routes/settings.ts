import { Router } from 'express';
import { Settings } from '../models/settings';

const router = Router();

// Create account
router.post('/', async (req, res) => {
    try {
        const { proxyAddress, ...settingsData } = req.body;
    
        // Validate required fields
        if (!proxyAddress) {
          return res.status(400).json({ success: false, message: 'proxyAddress is required' });
        }
    
        // Upsert the settings
        const updatedSettings = await Settings.findOneAndUpdate(
          { proxyAddress },
          { $set: settingsData },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
          }
        );
    
        return res.status(200).json({ 
          success: true, 
          data: updatedSettings 
        });
      } catch (error) {
        console.error('Error saving settings:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Error saving settings',
          error: error
        });
      }
});

router.get('/:proxyAddress', async (req, res) => {
    try {
        const {proxyAddress} = req.params;
      const settings = await Settings.findOne({proxyAddress: proxyAddress});    
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
});

export default router;