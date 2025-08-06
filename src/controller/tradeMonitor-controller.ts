import moment from 'moment';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel, getUserPositionModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import { Request, Response } from 'express';

type intervalPtrType = {
  [key: string]: NodeJS.Timeout
}

const intervalPtr: intervalPtrType = {}

interface FilterSettings {
  byPrice: boolean;
  price: {
    min: string;
    max: string;
  };
  byOrder: boolean;
  orderSize: {
    min: string;
    max: string;
  };
  byCategory: boolean;
  byTillDayEvent: boolean;
  byAmount: boolean;
  amount: {
    min: string;
    max: string;
  };
}

interface TradeFilterData {
  buy: FilterSettings;
  sell: FilterSettings;
}

const USER_ADDRESS = process.env.USER_ADDRESS;
const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL || '1', 10);

if (!USER_ADDRESS) {
  throw new Error('USER_ADDRESS is not defined');
}

const UserActivity = getUserActivityModel(USER_ADDRESS);
const UserPosition = getUserPositionModel(USER_ADDRESS);

let tempTrades: UserActivityInterface[] = []; 

const init = async (): Promise<void> => {
  try {
    tempTrades = (await UserActivity.find().exec()).map((trade) => trade as UserActivityInterface);
  } catch (error) {
    console.error('Error initializing trades:', error);
    throw error;
  }
};

const fetchTradeData = async (filterData: TradeFilterData): Promise<void> => {
  try {
    let userActivities: UserActivityInterface[] = await fetchData(
      `https://data-api.polymarket.com/activity?user=${USER_ADDRESS}&limit=500&offset=0`
    );
    
    if (filterData.buy.byAmount || filterData.buy.byCategory || filterData.buy.byOrder || filterData.buy.byPrice || filterData.buy.byTillDayEvent) {
      await filterAndSaveTrades(userActivities, filterData, 'buy');
    }

    if (filterData.sell.byAmount || filterData.sell.byCategory || filterData.sell.byOrder || filterData.sell.byPrice || filterData.sell.byTillDayEvent) {
      await filterAndSaveTrades(userActivities, filterData, 'sell');
    }
    
  } catch (error) {
    console.error('Error fetching trade data:', error);
    throw error;
  }
};

const filterByDaysTillEvent = async (activities: UserActivityInterface[], tradeStyle: 'buy' | 'sell'): Promise<UserActivityInterface[]> => {
  const filteredResults = await Promise.all(
    activities.map(async (activity) => {
      try {
        const markets = await fetchData(
          `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
        );

        if (!markets?.length) return false;

        const start = new Date(markets[0].startDate);
        const end = new Date(markets[0].endDate);
        const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return diffInDays <= 1;
      } catch {
        return false;
      }
    })
  );

  return activities.filter((_, index) => filteredResults[index]);
};

const filterByCategory = async (activities: UserActivityInterface[], tradeStyle: 'buy' | 'sell'): Promise<UserActivityInterface[]> => {
  const sportsKeywords = [
    'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'mma', 'ufc', 'ucl', 'epl', 'boxing', 'cricket', 'rugby',
    'olympics', 'formula1', 'f1', 'nascar', 'esports', 'cycling', 'wrestling', 'skateboarding', 'snowboarding', 'surfing', 'badminton', 'table-tennis',
    'handball', 'volleyball', 'lacrosse', 'auto-racing', 'horse-racing', 'darts', 'snooker', 'bowling', 'water-polo', 'swimming', 'track-and-field',
    'athletics', 'triathlon', 'sailing', 'sports', 'chess', 'uefa',    
    // Additional specific slugs
    'aaron-rodgers', 'ufc-fight-night', 'nba-finals', 'nba-champion', 'nba-draft', 'college-football', 'heisman', 'cfb', 'ncaa-football', 'nfl-draft', 'premier-league',
    'fifa-world-cup', 'world-cup', 'wnba', 'pll', 'premier-lacrosse-league', 'leagues-cup',
    // Variations and common compound tag styles
    'formula-1', 'table-tennis', 'water-polo', 'track-and-field', 'auto-racing', 'horse-racing', 'premier-lacrosse-league'];

  const filteredResults = await Promise.all(
    activities.map(async (activity) => {
      try {
        console.log(activity.side.toLowerCase(), "===", tradeStyle);
        if (activity.side.toLowerCase() === tradeStyle){
            const markets = await fetchData(
              `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
            );
    
            if (!markets?.length) return false;
    
            const market = markets[0];
            
            // Check tags
            if (market.events?.tags?.some((tag: any) => 
              sportsKeywords.includes(tag.slug?.toLowerCase()))) {
              return true;
            }
    
            // Check series
            if (market.events?.series?.some((s: any) => 
              sportsKeywords.includes(s.slug?.toLowerCase()))) {
              return true;
            }
    
            // Check title/description
            const text = `${market.title || ''} ${market.description || ''}`.toLowerCase();
            return sportsKeywords.some(keyword => text.includes(keyword));
            // return false;
        }
        
      } catch {
        return false;
      }
    })
  );

  return activities.filter((_, index) => filteredResults[index]);
};

const filterAndSaveTrades = async (userActivities: UserActivityInterface[], filterData: TradeFilterData, tradeStyle: 'buy' | 'sell'): Promise<void> => {
  try {
    const settings = filterData[tradeStyle];
    
    // Filter new trades
    let newTrades = userActivities.filter(activity => 
      !tempTrades.some(existing => existing.transactionHash === activity.transactionHash) && activity.side.toLowerCase() === tradeStyle
    );

    if(newTrades.length > 0){
      // Apply filters
      if (settings.byOrder) {
          const min = parseFloat(settings.orderSize.min) || 0;
          const max = parseFloat(settings.orderSize.max) || Infinity;        
          newTrades = newTrades.filter(activity => 
              activity.size >= min && activity.size <= max 
          );
      }
      
      if (settings.byPrice) {
          const min = parseFloat(settings.price.min) || 0;
          const max = parseFloat(settings.price.max) || Infinity;
          newTrades = newTrades.filter(activity => 
              activity.price >= min && activity.price <= max 
          );
      }   
      
      if (settings.byTillDayEvent) {
        newTrades = await filterByDaysTillEvent(newTrades, tradeStyle);
      }
  
      if (settings.byCategory) {
          newTrades = await filterByCategory(newTrades, tradeStyle);
      }
      
      if (settings.byAmount) {
        const min = parseFloat(settings.amount.min) || 0;
        const max = parseFloat(settings.amount.max) || Infinity;
        newTrades = newTrades.filter(activity => 
          activity.usdcSize >= min && activity.usdcSize <= max 
        );
      }
      // Process and save new trades
      const processedTrades = newTrades
        .map(activity => ({ 
          ...activity, 
          bot: false, 
          botExecutedTime: 0 
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
  
      if (processedTrades.length > 0) {
        await UserActivity.insertMany(processedTrades);
        tempTrades = [...tempTrades, ...processedTrades];
        newTrades = [];
        console.log(tempTrades);
      }
    }
  } catch (error) {
    console.error(`Error filtering ${tradeStyle} trades:`, error);
    throw error;
  }
};

const tradeMonitor = async (filterData: TradeFilterData): Promise<void> => {
  
  try {
    await init();
    console.log(`Trade Monitor is running every ${FETCH_INTERVAL} seconds`);
    
      try {
        clearInterval(intervalPtr[USER_ADDRESS]);
        intervalPtr[USER_ADDRESS] = setInterval(() => {
          fetchTradeData(filterData)
        }, FETCH_INTERVAL * 1000)
      } catch (error) {
        console.error('Error in monitoring loop:', error);
        // Add delay before retrying to prevent rapid failures
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
  } catch (error) {
    console.error('Trade monitor initialization failed:', error);
    throw error;
  }
};


const stopMonitor = async () => {
  try {
      clearInterval(intervalPtr[USER_ADDRESS]);
      console.log("Successfully stopped")
  } catch (error){
    console.error('Stop initialization error:', error);
  }
  
}

export {
  tradeMonitor,
  stopMonitor
};