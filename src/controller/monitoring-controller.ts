// import connectDB from '../config/db';
import {tradeMonitor} from './tradeMonitor-controller';
import { Request, Response } from 'express';
import { stopMonitor } from './tradeMonitor-controller';

let monitoringSettings: any = null;

const USER_ADDRESS = process.env.USER_ADDRESS;
const PROXY_WALLET = process.env.PROXY_WALLET;

const startMonitoring = async (req: Request, res: Response) => {
    try {

        // await connectDB();
        //Get data from frontend
        monitoringSettings = req.body;
        console.log(`Target User Wallet addresss is: ${USER_ADDRESS}`);
        console.log(`My Wallet addresss is: ${PROXY_WALLET}`);
        console.log('Received monitoring settings:', monitoringSettings);

        // const clobClient = await createClobClient();

        tradeMonitor(monitoringSettings);  //Monitor target user's transactions

        res.status(200).json({
            success: true,
            message: 'Monitoring started with settings',
            data: {
                userAddress: process.env.USER_ADDRESS,
                proxyWallet: process.env.PROXY_WALLET,
                settings: monitoringSettings
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

        await stopMonitor();

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
