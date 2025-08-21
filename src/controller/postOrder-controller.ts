import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';

const RETRY_LIMIT = process.env.RETRY_LIMIT || '0';



const postOrder = async (
    clobClient: ClobClient,
    condition: string,
    my_position: UserPositionInterface | undefined,
    // user_position: UserPositionInterface | undefined,
    trade: UserActivityInterface,
    orderSize: number,
    limitSettingType: string,
    filterPrice: number,
    USER_ADDRESS: string,
    filterData: any
    // my_balance: number,
    // user_balance: number
) => {
    const UserActivity = getUserActivityModel(USER_ADDRESS);
    //Merge strategy
    if (condition === 'merge') {
        console.log('Merging Strategy...');
        if (!my_position) {
            console.log('my_position is undefined');
            await UserActivity.updateOne({ _id: trade._id }, { bot: true });
            return;
        }
        let remaining = my_position.size;
        let retry = 0;
        while (remaining > 0 && retry < parseInt(RETRY_LIMIT)) {
            const orderBook = await clobClient.getOrderBook(trade.asset);
            if (!orderBook.bids || orderBook.bids.length === 0) {
                console.log('No bids found');
                await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                break;
            }

            const maxPriceBid = orderBook.bids.reduce((max, bid) => {
                return parseFloat(bid.price) > parseFloat(max.price) ? bid : max;
            }, orderBook.bids[0]);

            console.log('Max price bid:', maxPriceBid);
            let order_arges;
            if (remaining <= parseFloat(maxPriceBid.size)) {
                order_arges = {
                    side: Side.SELL,
                    tokenID: my_position.asset,
                    amount: remaining,
                    price: parseFloat(maxPriceBid.price),
                };
            } else {
                order_arges = {
                    side: Side.SELL,
                    tokenID: my_position.asset,
                    amount: parseFloat(maxPriceBid.size),
                    price: parseFloat(maxPriceBid.price),
                };
            }
            console.log('Order args:', order_arges);
            const signedOrder = await clobClient.createMarketOrder(order_arges);
            const resp = await clobClient.postOrder(signedOrder, OrderType.FOK);
            if (resp.success === true) {
                retry = 0;
                console.log('Successfully posted order:', resp);
                remaining -= order_arges.amount;
            } else {
                retry += 1;
                console.log('Error posting order: retrying...', resp);
            }
        }
        if (retry >= parseInt(RETRY_LIMIT)) {
            await UserActivity.updateOne({ _id: trade._id }, { bot: true, botExcutedTime: retry });
        } else {
            await UserActivity.updateOne({ _id: trade._id }, { bot: true });
        }
    } else if (condition === 'BUY') {       //Buy strategy
        
        console.log('Buy Strategy...');
        
        let retry = 0;
        while (orderSize > 0 && retry < parseInt(RETRY_LIMIT)) {
            const orderBook = await clobClient.getOrderBook(trade.asset);
            if (!orderBook.asks || orderBook.asks.length === 0) {
                console.log('No asks found');
                await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                break;
            }

            const minPriceAsk = orderBook.asks.reduce((min, ask) => {
                return parseFloat(ask.price) < parseFloat(min.price) ? ask : min;
            }, orderBook.asks[0]);

            console.log('Min price ask:', minPriceAsk);
            // if (parseFloat(minPriceAsk.price) - 0.05 > trade.price) {
            //     console.log('Too big different price - do not copy');
            //     await UserActivity.updateOne({ _id: trade._id }, { bot: true });
            //     break;
            // }

            if (limitSettingType == 'original') {
                if (parseFloat(minPriceAsk.price) > 103 * trade.price / 100){
                    console.log('Too big different price - do not copy');
                    // await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    break;
                }
            }

            if (limitSettingType == 'specific'){
                if (parseFloat(minPriceAsk.price) > filterPrice){
                    console.log('Too big different price - do not copy');
                    // await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    break;
                }
            }

            if (filterData.maxAmount.isActive){
                const my_positions: UserPositionInterface[] = await fetchData(
                    `https://data-api.polymarket.com/positions?user=${filterData.proxyAddress}`
                );
                let totalBuyAmount = 0;
                my_positions.map((position) => {
                    totalBuyAmount += position.initialValue;
                });
                if(parseFloat(filterData.maxAmount.amount) - totalBuyAmount < orderSize){
                    break;
                }
            }
            let order_arges;
            order_arges = {
                side: Side.BUY,
                tokenID: trade.asset,
                amount: orderSize,
                price: parseFloat(minPriceAsk.price),
            };
            // if (orderSize <= parseFloat(minPriceAsk.size) * parseFloat(minPriceAsk.price)) {
            //     order_arges = {
            //         side: Side.BUY,
            //         tokenID: trade.asset,
            //         amount: orderSize,
            //         price: parseFloat(minPriceAsk.price),
            //     };
            // } else {
            //     order_arges = {
            //         side: Side.BUY,
            //         tokenID: trade.asset,
            //         amount: parseFloat(minPriceAsk.size) * parseFloat(minPriceAsk.price),
            //         price: parseFloat(minPriceAsk.price),
            //     };
            // }
            console.log('Order args:', order_arges);
            const signedOrder = await clobClient.createMarketOrder(order_arges);
            const resp = await clobClient.postOrder(signedOrder, OrderType.FOK);
            if (resp.success === true) {
                retry = parseInt(RETRY_LIMIT) + 1;
                console.log('Successfully posted order:', resp);
            } else {
                retry += 1;
                console.log('Error posting order: retrying...', resp);
            }
        }
        // if (retry >= parseInt(RETRY_LIMIT)) {
        //     await UserActivity.updateOne({ _id: trade._id }, { bot: true, botExcutedTime: retry });
        // } else {
        //     await UserActivity.updateOne({ _id: trade._id }, { bot: true });
        // }
    } else if (condition === 'SELL') {          //Sell strategy
        console.log('Sell Strategy...');
        
        if (!my_position) {
            console.log('No position to sell');
            // await UserActivity.updateOne({ _id: trade._id }, { bot: true });
        } 
        let retry = 0;
        while (orderSize > 0 && retry < parseInt(RETRY_LIMIT)) {
            const orderBook = await clobClient.getOrderBook(trade.asset);
            if (!orderBook.bids || orderBook.bids.length === 0) {
                await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                console.log('No bids found');
                break;
            }

            const maxPriceBid = orderBook.bids.reduce((max, bid) => {
                return parseFloat(bid.price) > parseFloat(max.price) ? bid : max;
            }, orderBook.bids[0]);

            console.log('Max price bid:', maxPriceBid);

            if (limitSettingType == 'original') {
                if (parseFloat(maxPriceBid.price) > 103 * trade.price / 100){
                    console.log('Too big different price - do not copy');
                    // await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    break;
                }
            }

            if (limitSettingType == 'specific'){
                if (parseFloat(maxPriceBid.price) > filterPrice){
                    console.log('Too big different price - do not copy');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    break;
                }
            }

            let order_arges;
            // order_arges = {
            //     side: Side.SELL,
            //     tokenID: trade.asset,
            //     amount: orderSize,
            //     price: parseFloat(maxPriceBid.price),
            // };
            if (orderSize <= parseFloat(maxPriceBid.size)) {
                order_arges = {
                    side: Side.SELL,
                    tokenID: trade.asset,
                    amount: orderSize,
                    price: parseFloat(maxPriceBid.price),
                };
            } else {
                order_arges = {
                    side: Side.SELL,
                    tokenID: trade.asset,
                    amount: parseFloat(maxPriceBid.size),
                    price: parseFloat(maxPriceBid.price),
                };
            }
            console.log('Order args:', order_arges);
            const signedOrder = await clobClient.createMarketOrder(order_arges);
            const resp = await clobClient.postOrder(signedOrder, OrderType.FOK);
            if (resp.success === true) {
                retry = parseInt(RETRY_LIMIT) + 1;
                console.log('Successfully posted order:', resp);
            } else {
                retry += 1;
                console.log('Error posting order: retrying...', resp);
            }
        }
        // if (retry >= parseInt(RETRY_LIMIT)) {
        //     await UserActivity.updateOne({ _id: trade._id }, { bot: true, botExcutedTime: retry });
        // } else {
        //     await UserActivity.updateOne({ _id: trade._id }, { bot: true });
        // }
    } else {
        console.log('Condition not supported');
    }
};

export {postOrder};
