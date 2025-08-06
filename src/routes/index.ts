import { Router } from 'express';
import { startMonitoring } from '../controller/monitoring-controller'
import { stopMonitoring } from '../controller/monitoring-controller';

const router = Router();

router.get('/', (req, res, next) => {
    res.send("server is running")
});

router.post('/api/trade-settings', startMonitoring);
router.post('/api/trade-stop', stopMonitoring);

export default router;