import { ClobClient } from '@polymarket/clob-client';
import { createClobClient } from '../createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../../Interface/User';
import fetchData from '../fetchdata-controlller';
import { postOrder } from '../postOrder-controller';
import { Request, Response } from 'express';

export async function sellPositions(req: Request, res: Response) {
    try {
        const { position, amount, USER_ADDRESS, filterData } = req.body;

        if (!position || amount === undefined) {
            return res.status(400).json({ error: 'Missing position or amount in request body' });
        }

        const clobClient = await createClobClient(position.proxyWallet);
        const user_activities: UserActivityInterface[] = await fetchData(
            `https://data-api.polymarket.com/activity?user=${position.proxyWallet}`
        );
        
        const user_activity = user_activities.find(
            (activity: UserActivityInterface) => activity.conditionId === position.conditionId
        );

        console.log(user_activity);

        if (!user_activity) {
            return res.status(404).json({ error: `No activity found for conditionId: ${position.conditionId}` });
        }

        await postOrder(clobClient, "SELL", position, user_activity, amount, '', 0, USER_ADDRESS, filterData);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error in sellPositions:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}