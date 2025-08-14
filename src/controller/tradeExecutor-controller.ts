import {createClobClient} from './createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import {spinner} from './spinner-controller';
import {getMyBalance} from './getMyBalance-controller';
import {postOrder} from './postOrder-controller';
import { ClobClient } from '@polymarket/clob-client';


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
        const my_balance = await getMyBalance(filterData.proxyAddress);
        const user_balance = await getMyBalance(USER_ADDRESS);

        console.log('My current balance:', my_balance);
        console.log('User current balance:', user_balance);
        const UserActivity = getUserActivityModel(USER_ADDRESS);

        if (filterData.maxAmount.isActive){
            if(my_position?.avgPrice && my_position?.totalBought){
                if (my_position?.avgPrice * my_position?.totalBought > parseFloat(filterData.maxAmount.amount)){
                    console.log('The amount is over Max Amount');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    continue;
                }
            }
        }

        if (filterData[tradeStyle].Limitation.size && filterData[tradeStyle].Limitation.type){
            const filterPrice = parseFloat(filterData[tradeStyle].Limitation.size);
            if (filterData[tradeStyle].Limitation.type === "specific") {
                
                if (filterData[tradeStyle].OrderSize.size && filterData[tradeStyle].OrderSize.type){
                    if(filterData[tradeStyle].OrderSize.type === 'amount') {
                        let amount = parseFloat(filterData[tradeStyle].OrderSize.size);
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'specific', filterPrice, USER_ADDRESS);
                    } 
        
                    if(filterData[tradeStyle].OrderSize.type === 'percentage') {
                        let amount = parseFloat(filterData[tradeStyle].OrderSize.size) * trade.size * trade.price;
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'specific', filterPrice, USER_ADDRESS);
                    }
                }
                
            }

            if (filterData[tradeStyle].Limitation.type === "original") {
                
                if (filterData[tradeStyle].OrderSize.size && filterData[tradeStyle].OrderSize.type){
                    if(filterData[tradeStyle].OrderSize.type === 'amount') {
                        let amount = parseFloat(filterData[tradeStyle].OrderSize.size);
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'original', filterPrice, USER_ADDRESS);
                    } 
        
                    if(filterData[tradeStyle].OrderSize.type === 'percentage') {
                        let amount = parseFloat(filterData[tradeStyle].OrderSize.size) * trade.size * trade.price;
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'original', filterPrice, USER_ADDRESS);
                    }
                }
                
            }
            
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
