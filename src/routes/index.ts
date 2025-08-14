import { Router } from 'express';
import { startMonitoring } from '../controller/monitoring-controller'
import { stopMonitoring } from '../controller/monitoring-controller';
import { redeemPositions } from '../controller/polymarket/redeem';
import { sellPositions } from '../controller/polymarket/sell';
import accountRouter from './accounts'
import settingsRouter from './settings'

const router = Router();

router.get('/', (req, res, next) => {
    res.send("server is running")
});

router.post('/api/trade-monitor', startMonitoring);
router.post('/api/trade-stop', stopMonitoring);
router.post('/api/trade-redeem', redeemPositions);
router.post('/api/trade-sell', sellPositions);
router.use('/api/accounts', accountRouter);
router.use('/api/accounts/settings', settingsRouter);

export default router;