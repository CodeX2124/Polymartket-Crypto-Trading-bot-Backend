import moment from 'moment';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel, getUserPositionModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import { Settings } from '../models/settings';
import tradeExcutor from './tradeExecutor-controller';
import { Account } from '../models/accounts';

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

const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL || '1', 10);

let slaves: string[] = [];

const init = async (settings: any): Promise<{
  address: string;
  activity: any; 
  temp: UserActivityInterface[];
}> => {
  try {
    let USER_ADDRESS = "";
    let account = await Account.findOne({proxyWallet: settings.proxyAddress});
    if(account){
      USER_ADDRESS = account.targetWallet;
    }
    let UserActivity = getUserActivityModel(USER_ADDRESS);
    let tempTrades: UserActivityInterface[] = (await UserActivity.find().exec()).map((trade) => trade as UserActivityInterface);
    
    return {
      address: USER_ADDRESS,
      activity: UserActivity,
      temp: tempTrades
    };
        
  } catch (error) {
    console.error('Error initializing trades:', error);
    throw error;
  }
};

const fetchTradeData = async (filterData: any, USER_ADDRESS: string, activity: any, tempTrades: UserActivityInterface[]): Promise<void> => {
  try {
    
    let userActivities: UserActivityInterface[] = await fetchData(
      `https://data-api.polymarket.com/activity?user=${USER_ADDRESS}&limit=500&offset=0`
    );
    
    if (filterData.buy.Filter.byOrderSize || filterData.buy.Filter.bySports || filterData.buy.Filter.byMinMaxAmount || filterData.buy.Filter.byDaysTillEvent || filterData.buy.Filter.byPrice ) {
      await filterAndSaveTrades(userActivities, filterData, 'buy', activity, tempTrades, USER_ADDRESS);
    }

    if (filterData.sell.Filter.byOrderSize || filterData.sell.Filter.bySports || filterData.sell.Filter.byMinMaxAmount || filterData.sell.Filter.byDaysTillEvent || filterData.sell.Filter.byPrice ) {
      await filterAndSaveTrades(userActivities, filterData, 'sell', activity, tempTrades, USER_ADDRESS);
    }
    
  } catch (error) {
    console.error('Error fetching trade data:', error);
    throw error;
  }
};

const filterByDaysTillEvent = async (activities: UserActivityInterface[]): Promise<UserActivityInterface[]> => {
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

const filterByCategory = async (activities: UserActivityInterface[]): Promise<UserActivityInterface[]> => {
  const sportsKeywords = [
    'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'mma', 'ufc', 'ucl', 'epl', 'boxing', 'cricket', 'rugby',
    'olympics', 'formula1', 'f1', 'nascar', 'esports', 'cycling', 'wrestling', 'skateboarding', 'snowboarding', 'surfing', 'badminton', 'table-tennis',
    'handball', 'volleyball', 'lacrosse', 'auto-racing', 'horse-racing', 'darts', 'snooker', 'bowling', 'water-polo', 'swimming', 'track-and-field',
    'athletics', 'triathlon', 'sailing', 'sports', 'chess', 'uefa', 'league',
    // Additional specific slugs
    'aaron-rodgers', 'ufc-fight-night', 'nba-finals', 'nba-champion', 'nba-draft', 'college-football', 'heisman', 'cfb', 'ncaa-football', 'nfl-draft', 'premier-league',
    'fifa-world-cup', 'world-cup', 'wnba', 'pll', 'premier-lacrosse-league', 'leagues-cup',
    // Variations and common compound tag styles
    'formula-1', 'table-tennis', 'water-polo', 'track-and-field', 'auto-racing', 'horse-racing', 'premier-lacrosse-league'];

  const filteredResults = await Promise.all(
    activities.map(async (activity) => {
      try {     
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
      } catch {
        return false;
      }
    })
  );

  return activities.filter((_, index) => filteredResults[index]);
};

const filterAndSaveTrades = async (
  userActivities: UserActivityInterface[], 
  filterData: any, 
  tradeStyle: 'buy' | 'sell', 
  UserActivity: any, 
  tempTrades: UserActivityInterface[],
  USER_ADDRESS: string
): Promise<void> => {
  try {
    const settings = filterData[tradeStyle];
    
    // Filter new trades
    let newTrades = userActivities.filter(activity => 
      !tempTrades.some(existing => existing.transactionHash === activity.transactionHash) && activity.side.toLowerCase() === tradeStyle
    );    

    console.log("length:", newTrades.length);
    if(newTrades.length > 0){
      // Apply filters
      if (settings.Filter.byOrderSize.isActive) {
          const min = parseFloat(settings.Filter.byOrderSize.size.min) || 0;
          const max = parseFloat(settings.Filter.byOrderSize.size.max) || Infinity;        
          newTrades = newTrades.filter(activity => 
              activity.size >= min && activity.size <= max 
          );
      }
      
      if (settings.Filter.byPrice.isActive) {
          const min = parseFloat(settings.Filter.byPrice.size.min) || 0;
          const max = parseFloat(settings.Filter.byPrice.size.max) || Infinity;
          newTrades = newTrades.filter(activity => 
              activity.price >= min && activity.price <= max 
          );
      }   
      
      if (settings.Filter.byDaysTillEvent) {
        newTrades = await filterByDaysTillEvent(newTrades);
      }
  
      if (settings.Filter.bySports) {
          newTrades = await filterByCategory(newTrades);
      }
      
      if (settings.Filter.byMinMaxAmount.isActive) {
        const min = parseFloat(settings.Filter.byMinMaxAmount.size.min) || 0;
        const max = parseFloat(settings.Filter.byMinMaxAmount.size.max) || Infinity;
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
        await UserActivity.bulkWrite(processedTrades.map(pt => ({
          updateOne: {
            filter: { transactionHash: pt.transactionHash },
            update: pt,
            upsert: true
          }
        })));
        newTrades = [...new Set(processedTrades)];
        // await UserActivity.insertMany(newTrades);
        await tradeExcutor(filterData, newTrades, tradeStyle, USER_ADDRESS);
        newTrades = [];
      }
    }
  } catch (error) {
    console.error(`Error filtering ${tradeStyle} trades:`, error);
    throw error;
  }
};

const tradeMonitor = async (filterData: any): Promise<void> => {
  
  try {
    
    const slave = filterData.proxyAddress;
    if (!slaves.includes(slave)) {
      slaves.push(slave);
    }

    try {
      
      if (intervalPtr[slave]) {
        clearInterval(intervalPtr[slave]);
        delete intervalPtr[slave];
      }

      intervalPtr[slave] = setInterval(async () => {
        console.log(`Trade Monitor is running every ${FETCH_INTERVAL} seconds`);
        const settings = await Settings.findOne({proxyAddress: slave});
        if(settings){
            const { address, activity, temp } = await init(settings);
            fetchTradeData(settings, address, activity, temp);
          } 
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


const stopMonitor = async (proxyAddress: string) => {
  try {
    
    console.log(proxyAddress)
    console.log(slaves)
    const index = slaves.findIndex((wallet: string) => wallet === proxyAddress);
    if (index !== -1) {
      slaves.splice(index, 1);
      
      // Clear and remove the interval
      if (intervalPtr[proxyAddress]) {
        clearInterval(intervalPtr[proxyAddress]);
        delete intervalPtr[proxyAddress];
      }
      
      console.log("Successfully stopped monitoring for", proxyAddress);
    } else {
      console.log("No active monitor found for", proxyAddress);
    }
  } catch (error) {
    console.error('Stop initialization error:', error);
  }
  
}

export {
  tradeMonitor,
  stopMonitor
};