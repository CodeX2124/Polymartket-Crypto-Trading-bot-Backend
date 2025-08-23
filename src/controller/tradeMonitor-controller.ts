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
let ExecutedTrades: UserActivityInterface[] = [];

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
    let tempTrades: UserActivityInterface[] = await fetchData(
      `https://data-api.polymarket.com/activity?user=${USER_ADDRESS}&limit=500&offset=0`
    );
    // let tempTrades: UserActivityInterface[] = (await UserActivity.find().exec()).map((trade) => trade as UserActivityInterface);
    
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
    
    if (filterData.buy.Filter.byOrderSize.isActive || filterData.buy.Filter.bySports.isActive || filterData.buy.Filter.byMinMaxAmount.isActive || filterData.buy.Filter.byDaysTillEvent.isActive || filterData.buy.Filter.byPrice.isActive ) {
      await filterAndSaveTrades(userActivities, filterData, 'buy', activity, tempTrades, USER_ADDRESS);
    }

    if (filterData.sell.Filter.byOrderSize.isActive || filterData.sell.Filter.bySports.isActive || filterData.sell.Filter.byMinMaxAmount.isActive || filterData.sell.Filter.byDaysTillEvent.isActive || filterData.sell.Filter.byPrice.isActive ) {
      await filterAndSaveTrades(userActivities, filterData, 'sell', activity, tempTrades, USER_ADDRESS);
    }
    
  } catch (error) {
    console.error('Error fetching trade data:', error);
    throw error;
  }
};

const filterByDaysTillEvent = async (
  activities: UserActivityInterface[], 
  min: number, 
  max: number
): Promise<UserActivityInterface[]> => {
  
  // Map each activity to a Promise<boolean> showing if it passes filter
  const results = await Promise.all(
    activities.map(async (activity) => {
      try {
        const markets = await fetchData(
          `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
        );
        if (!markets?.length) return false;

        const current = new Date();
        const end = new Date(markets[0].endDate);
        const diffInDays = (end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24);

        return (diffInDays >= min && diffInDays <= max);
      } catch {
        return false;
      }
    })
  );

  // Filter original activities based on computed results
  return activities.filter((_, i) => results[i]);
};

const filterByCategory = async (activities: UserActivityInterface[], list: string[]): Promise<UserActivityInterface[]> => {
  const sportsKeywords = [
    'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'mma', 'ufc', 'ucl', 'epl', 'boxing', 'cricket', 'rugby',
    'olympics', 'formula1', 'f1', 'nascar', 'esports', 'cycling', 'wrestling', 'skateboarding', 'snowboarding', 'surfing', 'badminton', 'table-tennis',
    'handball', 'volleyball', 'lacrosse', 'auto-racing', 'horse-racing', 'darts', 'snooker', 'bowling', 'water-polo', 'swimming', 'track-and-field',
    'athletics', 'triathlon', 'sailing', 'sports', 'chess', 'uefa', 'league',
    'aaron-rodgers', 'ufc-fight-night', 'nba-finals', 'nba-champion', 'nba-draft', 'college-football', 'heisman', 'cfb', 'ncaa-football', 'nfl-draft', 'premier-league',
    'fifa-world-cup', 'world-cup', 'wnba', 'pll', 'premier-lacrosse-league', 'leagues-cup',
    'formula-1', 'table-tennis', 'water-polo', 'track-and-field', 'auto-racing', 'horse-racing', 'premier-lacrosse-league'
  ];

  let checkList = list.length === 0 ? sportsKeywords : list;

  // Map each activity to a Promise<boolean> to filter asynchronously
  const results = await Promise.all(
    activities.map(async (activity) => {
      try {
        const markets = await fetchData(
          `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
        );
        if (!markets?.length) return false;
        const market = markets[0];

        if (market.events?.tags?.some((tag: any) =>
          checkList.includes(tag.slug?.toLowerCase())
        )) return true;

        if (market.events?.series?.some((s: any) =>
          checkList.includes(s.slug?.toLowerCase())
        )) return true;

        const text = `${market.title || ''} ${market.description || ''}`.toLowerCase();

        if (checkList.some(keyword => text.includes(keyword))) return true;

        return false;
      } catch {
        return false;
      }
    })
  );

  // Filter activities based on results
  return activities.filter((_, i) => results[i]);
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
              activity.size * activity.price >= min && activity.size * activity.price <= max 
          );
      }
      
      if (settings.Filter.byPrice.isActive) {
          const min = parseFloat(settings.Filter.byPrice.size.min) || 0;
          const max = parseFloat(settings.Filter.byPrice.size.max) || Infinity;
          newTrades = newTrades.filter(activity => 
              activity.price >= min && activity.price <= max 
          );
      }   
      
      if (settings.Filter.byDaysTillEvent.isActive) {
        const min = parseInt(settings.Filter.byDaysTillEvent.size.min) || 0;
        const max = parseInt(settings.Filter.byDaysTillEvent.size.max) || Infinity;
        newTrades = await filterByDaysTillEvent(newTrades, min, max);
      }
  
      if (settings.Filter.bySports.isActive) {
          
          newTrades = await filterByCategory(newTrades, settings.Filter.bySports.sportsList);
          console.log("bySports", newTrades.length);
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
        ExecutedTrades.push(...newTrades);
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

      const settings = await Settings.findOne({proxyAddress: slave});
      let address = "";
      let activity: any = null;
      let temp: UserActivityInterface[] = [];
      
      if(settings){
        const initResult = await init(settings);
        address = initResult.address;
        activity = initResult.activity;
        temp = initResult.temp;
      } 
      
      ExecutedTrades = temp;
      intervalPtr[slave] = setInterval(async () => {
        console.log(`Trade Monitor is running every ${FETCH_INTERVAL} seconds`);
        fetchTradeData(settings, address, activity, ExecutedTrades);
      }, FETCH_INTERVAL * 1000);
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