// import connectDB from '../config/db';
import {tradeMonitor} from './tradeMonitor-controller';
import { Request, Response } from 'express';
import { stopMonitor } from './tradeMonitor-controller';

const startMonitoring = async (req: Request, res: Response) => {
    try {

        // await connectDB();
        //Get data from frontend
        let monitoringWallet = req.body;
        console.log('Received monitoring settings:', monitoringWallet);

        // const clobClient = await createClobClient();

        tradeMonitor(monitoringWallet.proxyAddress);  //Monitor target user's transactions

        res.status(200).json({
            success: true,
            message: 'Monitoring started with settings',
            data: {
                userAddress: monitoringWallet.proxyAddress,
            }
        });

    } catch (error){
        console.error('Monitoring initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start monitoring',
            error: error
        });
    }
};

const stopMonitoring = async (req: Request, res: Response) => {
    try {

        const address = req.body.proxyAddress;
        console.log("address==>", address);
        await stopMonitor(address);

        res.status(200).json({
            success: true,
            message: 'Monitoring stopped'
        });

    } catch (error){
        console.error('Monitoring initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop monitoring',
            error: error
        });
    }
}

export {
    startMonitoring,
    stopMonitoring
}
