import { createClobClient } from './createClobClient-controller';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import { spinner } from './spinner-controller';
import { getMyBalance } from './getMyBalance-controller';
import { postOrder } from './postOrder-controller';
import { ClobClient } from '@polymarket/clob-client';
import { approveTrading } from './polymarket/approveTrading';
import { approveTradingFactory } from './polymarket/approveTradingFactory';
import { TradeSettingsState } from "../Interface/Setting";

type ApproveCheckedType = {
    [key: string]: boolean;
}

const approveChecked: ApproveCheckedType = {};
const RETRY_LIMIT = parseInt(process.env.RETRY_LIMIT || '3', 10);

interface TradeExecutorParams {
    filterData: TradeSettingsState;
    newTrades: UserActivityInterface[];
    tradeStyle: 'buy' | 'sell';
    userAddress: string;
}

interface PositionData {
    myPositions: UserPositionInterface[];
    userPositions: UserPositionInterface[];
}

/**
 * Ensures trading is approved for the proxy address
 */
const ensureTradingApproved = async (proxyAddress: string): Promise<void> => {
    if (approveChecked[proxyAddress] === undefined || approveChecked[proxyAddress] === false) {
        try {
            await approveTrading(proxyAddress);
            console.log(`✅ Trading approved for ${proxyAddress}`);
        } catch (error) {
            console.error(`❌ Approve trading failed for ${proxyAddress}:`, error);
            throw new Error(`Trading approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        try {
            await approveTradingFactory(proxyAddress);
            console.log(`✅ Factory trading approved for ${proxyAddress}`);
        } catch (error) {
            console.error(`❌ Factory approve failed for ${proxyAddress}:`, error);
            throw new Error(`Factory approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        approveChecked[proxyAddress] = true;
    }
};

/**
 * Fetches positions for both proxy and target wallets
 */
const fetchPositions = async (proxyAddress: string, userAddress: string): Promise<PositionData> => {
    const [myPositions, userPositions] = await Promise.all([
        fetchData(`https://data-api.polymarket.com/positions?user=${proxyAddress}`),
        fetchData(`https://data-api.polymarket.com/positions?user=${userAddress}`)
    ]);

    return {
        myPositions: myPositions || [],
        userPositions: userPositions || []
    };
};

/**
 * Calculates the appropriate trade amount based on order size type
 */
const calculateTradeAmount = (
    trade: UserActivityInterface,
    orderSize: string,
    orderType: string,
    myPosition?: UserPositionInterface
): number => {
    const baseAmount = trade.side === "BUY" 
        ? (trade.usdcSize > 1 ? trade.usdcSize : 1)
        : (trade.size > 1 ? trade.size : 1);

    if (orderType === 'amount') {
        const specifiedAmount = parseFloat(orderSize) || baseAmount;
        
        // For sell orders, ensure we don't exceed available position
        if (trade.side === "SELL" && myPosition) {
            if (specifiedAmount > myPosition.initialValue) {
                return myPosition.size;
            } else {
                return Number((specifiedAmount / myPosition.initialValue * myPosition.size).toFixed(2));
            }
        }
        return specifiedAmount;
    }

    if (orderType === 'percentage') {
        const percentage = parseFloat(orderSize) || 100;
        const calculatedAmount = percentage * trade.size * trade.price / 100;
        
        // For sell orders, ensure we don't exceed available position
        if (trade.side === "SELL" && myPosition) {
            if (calculatedAmount > myPosition.size) {
                return myPosition.size;
            } else {
                return Number(calculatedAmount.toFixed(2));
            }
        }
        return calculatedAmount > baseAmount ? calculatedAmount : baseAmount;
    }

    return baseAmount;
};

/**
 * Processes a single trade with proper error handling
 */
const processSingleTrade = async (
    clobClient: ClobClient,
    trade: UserActivityInterface,
    tradeStyle: 'buy' | 'sell', // Explicitly type as 'buy' | 'sell'
    filterData: TradeSettingsState,
    userAddress: string,
    positions: PositionData
): Promise<void> => {
    try {
        if (trade.bot) {
            console.log(`⏭️ Skipping bot-executed trade: ${trade.transactionHash}`);
            return;
        }

        const myPosition = positions.myPositions.find(
            position => position.conditionId === trade.conditionId
        );

        const userPosition = positions.userPositions.find(
            position => position.conditionId === trade.conditionId
        );

        // Safely access the tradeStyle property
        const tradeSettings = filterData[tradeStyle];
        const filterPrice = parseFloat(tradeSettings.Limitation.size) || Infinity;
        const limitationType = tradeSettings.Limitation.type;

        const amount = calculateTradeAmount(
            trade,
            tradeSettings.OrderSize.size,
            tradeSettings.OrderSize.type,
            myPosition
        );

        await postOrder(
            clobClient,
            trade.side,
            myPosition,
            trade,
            amount,
            limitationType,
            filterPrice,
            userAddress,
            filterData
        );

        console.log(`✅ Successfully processed ${trade.side} trade for condition: ${trade.conditionId}`);

    } catch (error) {
        console.error(`❌ Failed to process trade ${trade.transactionHash}:`, error);
        // Continue with next trade instead of failing completely
    }
};

/**
 * Main trading execution function
 */
const startTrading = async (
    clobClient: ClobClient,
    filterData: TradeSettingsState,
    newTrades: UserActivityInterface[],
    tradeStyle: 'buy' | 'sell', // Explicitly type as 'buy' | 'sell'
    userAddress: string
): Promise<void> => {
    try {
        // Ensure trading is approved
        await ensureTradingApproved(filterData.proxyAddress);

        console.log(`🔄 Starting ${tradeStyle} trading for ${newTrades.length} trades`);

        // Fetch positions once for all trades
        const positions = await fetchPositions(filterData.proxyAddress, userAddress);

        // Process trades sequentially to avoid rate limiting
        for (const trade of newTrades) {
            await processSingleTrade(clobClient, trade, tradeStyle, filterData, userAddress, positions);
        }

        console.log(`🎯 Completed processing ${newTrades.length} ${tradeStyle} trades`);

    } catch (error) {
        console.error(`❌ Failed to start trading:`, error);
        throw error;
    }
};

/**
 * Trade executor main function
 */
const tradeExcutor = async ({
    filterData,
    newTrades,
    tradeStyle,
    userAddress
}: TradeExecutorParams): Promise<void> => {
    console.log(`🚀 Executing Copy Trading for ${tradeStyle}`);

    try {
        // Validate input parameters
        if (!filterData?.proxyAddress) {
            throw new Error('Invalid filter data: proxyAddress is required');
        }

        if (!newTrades || newTrades.length === 0) {
            console.log('⏭️ No trades to execute');
            spinner.start('Waiting for new transactions');
            return;
        }

        // Type guard to ensure tradeStyle is valid
        if (tradeStyle !== 'buy' && tradeStyle !== 'sell') {
            throw new Error(`Invalid trade style: ${tradeStyle}. Must be 'buy' or 'sell'`);
        }

        // Initialize CLOB client
        const clobClient = await createClobClient(filterData.proxyAddress);
        if (!clobClient) {
            throw new Error('Failed to initialize CLOB client');
        }

        console.log(`✅ CLOB client initialized for proxy: ${filterData.proxyAddress}`);
        console.log(`📊 Processing ${newTrades.length} ${tradeStyle} trades`);
        console.log('💥 New transactions found 💥');

        // Execute trading
        await startTrading(clobClient, filterData, newTrades, tradeStyle, userAddress);

        console.log(`✅ Successfully executed ${newTrades.length} ${tradeStyle} trades`);

    } catch (error) {
        console.error(`❌ Trade execution failed:`, error);
        throw error;
    }
};

export default tradeExcutor;