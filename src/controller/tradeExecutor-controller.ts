import {createClobClient} from './createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import {spinner} from './spinner-controller';
import {getMyBalance} from './getMyBalance-controller';
import {postOrder} from './postOrder-controller';
import { ClobClient } from '@polymarket/clob-client';
import { approveTrading } from './polymarket/approveTrading';


const RETRY_LIMIT = parseInt(process.env.RETRY_LIMIT || '3');

let temp_trades: UserActivityInterface[] = [];


// const readTempTrade = async () => {
//     temp_trades = (
//         await UserActivity.find({
//             $and: [{ type: 'TRADE' }, { bot: false }, { botExecutedTime: { $lt: RETRY_LIMIT } }],
//         }).exec()
//     ).map((trade) => trade as UserActivityInterface);

// };

const startTrading = async (
    clobClient: ClobClient, 
    filterData: any, 
    newTrades: any, 
    tradeStyle: string, 
    USER_ADDRESS: string
) => {

    await approveTrading(filterData.proxyAddress);
    for (let trade of newTrades) {
        console.log('Trade to copy:', trade);
        if(trade.bot){
            continue;
        }
        
        // const market = await clobClient.getMarket(trade.conditionId);
        const my_positions: UserPositionInterface[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${filterData.proxyAddress}`
        );
        const user_positions: UserPositionInterface[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${USER_ADDRESS}`
        );
        const my_position = my_positions.find(
            (position: UserPositionInterface) => position.conditionId === trade.conditionId
        );
        const user_position = user_positions.find(
            (position: UserPositionInterface) => position.conditionId === trade.conditionId
        );
        // const my_balance = await getMyBalance(filterData.proxyAddress);
        // const user_balance = await getMyBalance(USER_ADDRESS);

        // console.log('My current balance:', my_balance);
        // console.log('User current balance:', user_balance);
        // const UserActivity = getUserActivityModel(USER_ADDRESS);        

        // if (filterData[tradeStyle].Limitation.size && filterData[tradeStyle].Limitation.type){
        const filterPrice = parseFloat(filterData[tradeStyle].Limitation.size) || Infinity;
        const LimitationType = filterData[tradeStyle].Limitation.type;
        let tradeAmount = trade.usdcSize > 1 ? trade.usdcSize.tofixed(2) : 1;

        if(filterData[tradeStyle].OrderSize.type === 'amount') {
            let amount = parseFloat(filterData[tradeStyle].OrderSize.size) || tradeAmount;
            await postOrder(clobClient, trade.side, my_position, trade, amount, LimitationType, filterPrice, USER_ADDRESS, filterData);
        } 

        if(filterData[tradeStyle].OrderSize.type === 'percentage') {
            let amount = parseFloat(filterData[tradeStyle].OrderSize.size) * trade.size * trade.price / 100 || tradeAmount;
            await postOrder(clobClient, trade.side, my_position, trade, amount, LimitationType, filterPrice, USER_ADDRESS, filterData);
        }   
 
    }

    newTrades = [];
};

const tradeExcutor = async (filterData: any, newTrades: any, tradeStyle: string, USER_ADDRESS: string) => {
    
    const clobClient = await createClobClient(filterData.proxyAddress);
    console.log(`Executing Copy Trading`);
    try{
        // await readTempTrade();
        if (newTrades.length > 0) {
            console.log('💥 New transactions found 💥');
            spinner.stop();
            await startTrading(clobClient, filterData, newTrades, tradeStyle, USER_ADDRESS);
        } else {
            spinner.start('Waiting for new transactions');
        }
    } catch {
        console.log("Error");
    }
    
};

export default tradeExcutor;
