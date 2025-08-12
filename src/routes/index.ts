import { Router } from 'express';
import { startMonitoring } from '../controller/monitoring-controller'
import { stopMonitoring } from '../controller/monitoring-controller';
import { redeemPositions } from '../controller/polymarket/redeem';
import accountRouter from './accounts'

const router = Router();

router.get('/', (req, res, next) => {
    res.send("server is running")
});

router.post('/api/trade-monitor', startMonitoring);
router.post('/api/trade-stop', stopMonitoring);
router.post('/api/trade-redeem', redeemPositions);
router.use('/api/accounts', accountRouter);

export default router;