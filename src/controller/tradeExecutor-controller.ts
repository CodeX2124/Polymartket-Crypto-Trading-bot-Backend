import {createClobClient} from './createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import {spinner} from './spinner-controller';
import {getMyBalance} from './getMyBalance-controller';
import {postOrder} from './postOrder-controller';
import { BookParams, ClobClient } from '@polymarket/clob-client';
import { Side, OrderType } from "@polymarket/clob-client";

const USER_ADDRESS = process.env.USER_ADDRESS || '0x4cfD99a5636418c9c7589bD9f28860d9829BB4A3';
const RETRY_LIMIT = process.env.RETRY_LIMIT || 3;
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

const doTrading = async (clobClient: ClobClient, filterData: any, newTrades: any, tradeStyle: string) => {
    console.log(newTrades.length)
    for (let trade of newTrades) {
        console.log('Trade to copy:', trade);
        // const market = await clobClient.getMarket(trade.conditionId);
        // const my_positions: UserPositionInterface[] = await fetchData(
        //     `https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`
        // );
        // const user_positions: UserPositionInterface[] = await fetchData(
        //     `https://data-api.polymarket.com/positions?user=${USER_ADDRESS}`
        // );
        // const my_position = my_positions.find(
        //     (position: UserPositionInterface) => position.conditionId === trade.conditionId
        // );
        // const user_position = user_positions.find(
        //     (position: UserPositionInterface) => position.conditionId === trade.conditionId
        // );
        const my_balance = await getMyBalance(PROXY_WALLET);
        const user_balance = await getMyBalance(USER_ADDRESS);
        console.log('My current balance:', my_balance);
        console.log('User current balance:', user_balance);
        
        const orderBook = await clobClient.getOrderBook(trade.asset);
        console.log("orderBook===>", orderBook);

        const asks_length = orderBook.asks.length;
        const bids_length = orderBook.bids.length

        if (filterData[tradeStyle].copyOrderSize.size && filterData[tradeStyle].copyOrderSize.type){
            if(filterData[tradeStyle].copyOrderSize.type === 'amount') {
                const orderSize = parseFloat(filterData[tradeStyle].copyOrderSize.size);
                if (trade.side === 'BUY') {
                    if(orderBook){

                        console.log("Before market creat");
                        const marketOrder = await clobClient.createMarketOrder({
                            side: Side.BUY,
                            tokenID: trade.asset,
                            amount: orderSize,
                            feeRateBps: 0,
                            nonce: 0,
                            price: parseFloat(orderBook.asks[asks_length].price)
                        });

                        console.log("marketOrder created");
                        const resp = await clobClient.postOrder(marketOrder, OrderType.FAK);
                        console.log("buy amount resp: ", resp);
                    } else {
                        continue
                    }
                } else {
                    if(orderBook){

                        console.log("Before market creat");
                        const marketOrder = await clobClient.createMarketOrder({
                            side: Side.SELL,
                            tokenID: trade.asset,
                            amount: orderSize,
                            feeRateBps: 0,
                            nonce: 0,
                            price: parseFloat(orderBook.bids[bids_length].price)
                        });

                        console.log("marketOrder created");
                        const resp = await clobClient.postOrder(marketOrder, OrderType.FAK);
                        console.log("sell amount resp: ", resp);
                    } else {
                        continue
                    }
                }

            } 

            if(filterData[tradeStyle].copyOrderSize.type === 'percentage') {
                const orderSize = parseFloat(filterData[tradeStyle].copyOrderSize.size);
                if (trade.side === 'BUY') {
                    if(orderBook){
                        const marketOrder = await clobClient.createMarketOrder({
                            side: Side.BUY,
                            tokenID: trade.asset,
                            amount: (orderSize * trade.size / 100),
                            feeRateBps: 0,
                            nonce: 0,
                            price: parseFloat(orderBook.asks[asks_length].price)
                        });

                        console.log("marketOrder created");
                        const resp = await clobClient.postOrder(marketOrder, OrderType.FAK);
                        console.log("bid percentage resp: ", resp);
                    } else {
                        continue
                    }               
                } else {
                    if(orderBook){
                        const marketOrder = await clobClient.createMarketOrder({
                            side: Side.SELL,
                            tokenID: trade.asset,
                            amount: (orderSize * trade.size / 100),
                            feeRateBps: 0,
                            nonce: 0,
                            price: parseFloat(orderBook.bids[bids_length].price)
                        });

                        console.log("marketOrder created");
                        const resp = await clobClient.postOrder(marketOrder, OrderType.FAK);
                        console.log("sell percentage resp: ", resp);
                    } else {
                        continue
                    }
                }
            }
        }

        // if (settings.limitOrderSize.size && settings.limitOrderSize.type){
        //     const orderSize = parseFloat(settings.limitOrderSize.size);
        //     if (settings.limitOrderSize.type === "specific") {

        //         if (trade.side == "BUY") {
        //             const limitOrder = await clobClient.createOrder({
        //                 side: Side.BUY,
        //                 tokenID: trade.asset,
        //                 size: orderSize,
        //                 feeRateBps: 0,
        //                 nonce: 0,
        //                 price: trade.price
        //             });

        //             const resp = await clobClient.postOrder(limitOrder, OrderType.GTC);
        //             console.log(resp);
        //         } else {
        //             const limitOrder = await clobClient.createOrder({
        //                 side: Side.SELL,
        //                 tokenID: trade.asset,
        //                 size: orderSize,
        //                 feeRateBps: 0,
        //                 nonce: 0,
        //                 price: trade.price
        //             });

        //             const resp = await clobClient.postOrder(limitOrder, OrderType.GTC);
        //             console.log(resp);
        //         }
        //     }

        //     if (settings.limitOrderSize.type === "original") {

        //     }
            
        // }
    }
};

const tradeExcutor = async (filterData: any, newTrades: any, tradeStyle: string) => {
    
    const clobClient = await createClobClient();
    console.log(`Executing Copy Trading`);

    try{
        // await readTempTrade();
        if (newTrades.length > 0) {
            console.log('💥 New transactions found 💥');
            spinner.stop();
            await doTrading(clobClient, filterData, newTrades, tradeStyle);
        } else {
            spinner.start('Waiting for new transactions');
        }
    } catch {
        console.log("Error");
    }
    
};

export default tradeExcutor;
