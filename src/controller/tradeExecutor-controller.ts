import {createClobClient} from './createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import {spinner} from './spinner-controller';
import {getMyBalance} from './getMyBalance-controller';
import {postOrder} from './postOrder-controller';
import { ClobClient } from '@polymarket/clob-client';


const USER_ADDRESS = process.env.USER_ADDRESS || '0x4cfD99a5636418c9c7589bD9f28860d9829BB4A3';
const RETRY_LIMIT = parseInt(process.env.RETRY_LIMIT || '3');
const PROXY_WALLET = process.env.PROXY_WALLET || '0x4cfD99a5636418c9c7589bD9f28860d9829BB4A3';

let temp_trades: UserActivityInterface[] = [];
const UserActivity = getUserActivityModel(USER_ADDRESS);

const readTempTrade = async () => {
    temp_trades = (
        await UserActivity.find({
            $and: [{ type: 'TRADE' }, { bot: false }, { botExecutedTime: { $lt: RETRY_LIMIT } }],
        }).exec()
    ).map((trade) => trade as UserActivityInterface);

};

const startTrading = async (clobClient: ClobClient, filterData: any, newTrades: any, tradeStyle: string) => {
    console.log(newTrades.length)
    for (let trade of newTrades) {
        console.log('Trade to copy:', trade);
        if(trade.bot){
            continue;
        }
        
        const market = await clobClient.getMarket(trade.conditionId);
        const my_positions: UserPositionInterface[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`
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
        const my_balance = await getMyBalance(PROXY_WALLET);
        const user_balance = await getMyBalance(USER_ADDRESS);
        console.log('My current balance:', my_balance);
        console.log('User current balance:', user_balance);  
        if (filterData.byMaxAmount){
            if(my_position?.avgPrice && my_position?.totalBought){
                if (my_position?.avgPrice * my_position?.totalBought > parseFloat(filterData.maxAmount)){
                    console.log('The amount is over Max Amount');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    continue;
                }
            }
        }
        if (filterData[tradeStyle].limitOrderSize.size && filterData[tradeStyle].limitOrderSize.type){
            const filterPrice = parseFloat(filterData[tradeStyle].limitOrderSize.size);
            if (filterData[tradeStyle].limitOrderSize.type === "specific") {
                
                if (filterData[tradeStyle].copyOrderSize.size && filterData[tradeStyle].copyOrderSize.type){
                    if(filterData[tradeStyle].copyOrderSize.type === 'amount') {
                        let amount = parseFloat(filterData[tradeStyle].copyOrderSize.size);
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'specific', filterPrice);
                    } 
        
                    if(filterData[tradeStyle].copyOrderSize.type === 'percentage') {
                        let amount = parseFloat(filterData[tradeStyle].copyOrderSize.size) * trade.size * trade.price;
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'specific', filterPrice);
                    }
                }
                
            }

            if (filterData[tradeStyle].limitOrderSize.type === "original") {
                
                if (filterData[tradeStyle].copyOrderSize.size && filterData[tradeStyle].copyOrderSize.type){
                    if(filterData[tradeStyle].copyOrderSize.type === 'amount') {
                        let amount = parseFloat(filterData[tradeStyle].copyOrderSize.size);
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'original', filterPrice);
                    } 
        
                    if(filterData[tradeStyle].copyOrderSize.type === 'percentage') {
                        let amount = parseFloat(filterData[tradeStyle].copyOrderSize.size) * trade.size * trade.price;
                        await postOrder(clobClient, trade.side, my_position, trade, amount, 'original', filterPrice);
                    }
                }
                
            }
            
        }
    }

    newTrades = [];
};

const tradeExcutor = async (filterData: any, newTrades: any, tradeStyle: string) => {
    
    const clobClient = await createClobClient();
    console.log(`Executing Copy Trading`);
    console.log("newTrades==>", newTrades);
    try{
        // await readTempTrade();
        if (newTrades.length > 0) {
            console.log('💥 New transactions found 💥');
            spinner.stop();
            await startTrading(clobClient, filterData, newTrades, tradeStyle);
        } else {
            spinner.start('Waiting for new transactions');
        }
    } catch {
        console.log("Error");
    }
    
};

export default tradeExcutor;
