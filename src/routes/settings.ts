import { Router } from 'express';
import { Settings } from '../models/settings';

const router = Router();

// Create account
router.post('/', async (req, res) => {
    try {
        const settings = req.body;

        if (!settings.proxyAddress) {
            return res.status(400).json({ error: 'proxyAddress is required' });
        }

        const savedSettings = await Settings.findOneAndUpdate(
            { proxyAddress: settings.proxyAddress }, 
            settings, 
            {upsert: true}
        );    

        res.status(200).json({
            success: true,
            data: savedSettings
        });
    
    } catch (error: any) {
        console.log(error)
        if (error.code === 11000) {
        res.status(400).json({ error: 'Setting already saved' });
        } else {
        res.status(500).json({ error: error.message });      
        }
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