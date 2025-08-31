import moment from 'moment';
import { UserActivityInterface, UserPositionInterface } from '../Interface/User';
import { getUserActivityModel, getUserPositionModel } from '../models/userHistory';
import fetchData from './fetchdata-controlller';
import { Settings } from '../models/settings';
import tradeExcutor from './tradeExecutor-controller';
import { Account } from '../models/accounts';
import { TradeSettingsState, MonitorContext } from "../Interface/Setting";

type intervalPtrType = {
  [key: string]: NodeJS.Timeout
}

const intervalPtr: intervalPtrType = {}

const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL || '1', 10);
const executedTrades: UserActivityInterface[] = [];
const activeMonitors: string[] = [];

const init = async (settings: TradeSettingsState): Promise<MonitorContext> => {
  try {
    let TARGET_ADDRESS = "";
    const account = await Account.findOne({ proxyWallet: settings.proxyAddress });
    if (account) {
      TARGET_ADDRESS = account.targetWallet;
    }

    const UserActivity = getUserActivityModel(TARGET_ADDRESS);
    const tempTrades: UserActivityInterface[] = await fetchData(
      `https://data-api.polymarket.com/activity?user=${TARGET_ADDRESS}&limit=500&offset=0`
    );

    return {
      address: TARGET_ADDRESS,
      activity: UserActivity,
      tempTrades: tempTrades || []
    };
  } catch (error) {
    console.error('Error initializing trades:', error);
    throw error;
  }
};

const hasActiveFilters = (filterType: any): boolean => {
  if (!filterType?.Filter) return false;
  
  const { Filter } = filterType;
  return Filter.byOrderSize?.isActive || 
         Filter.bySports?.isActive || 
         Filter.byMinMaxAmount?.isActive || 
         Filter.byDaysTillEvent?.isActive || 
         Filter.byPrice?.isActive;
};

const fetchTradeData = async (
  filterData: TradeSettingsState,
  context: MonitorContext
): Promise<void> => {
  try {
    // Validate filterData
    if (!filterData) {
      console.warn('No filter data provided or invalid format');
      return;
    }

    const hasBuyFilters = hasActiveFilters(filterData.buy);
    const hasSellFilters = hasActiveFilters(filterData.sell);

    // Only fetch data if filters are active
    if (!hasBuyFilters && !hasSellFilters) {
      console.log('No active filters, skipping data fetch');
      return;
    }

    let userActivities: UserActivityInterface[] = await fetchData(
      `https://data-api.polymarket.com/activity?user=${context.address}&limit=500&offset=0`
    );
    
    if (!userActivities) throw 'fetchData error';
    
    if (hasBuyFilters) {
      await filterAndSaveTrades(userActivities, filterData, 'buy', context);
    }

    if (hasSellFilters) {
      await filterAndSaveTrades(userActivities, filterData, 'sell', context);
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
  const filteredActivities: UserActivityInterface[] = [];

  for (const activity of activities) {
    try {
      const markets = await fetchData(
        `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
      );
      
      if (!markets || !markets.length) continue;

      const current = new Date();
      const end = new Date(markets[0].endDate);
      const diffInDays = (end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24);

      if (diffInDays >= min && diffInDays <= max) {
        filteredActivities.push(activity);
      }
    } catch (error) {
      console.warn(`Error filtering activity ${activity.transactionHash} by days till event:`, error);
    }
  }

  return filteredActivities;
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

  const checkList = list.length === 0 ? sportsKeywords : list;
  const filteredActivities: UserActivityInterface[] = [];

  for (const activity of activities) {
    try {
      const markets = await fetchData(
        `https://gamma-api.polymarket.com/markets?condition_ids=${activity.conditionId}`
      );
      
      if (!markets || !markets.length) continue;
      
      const market = markets[0];

      // Check tags
      const hasMatchingTag = market.events?.tags?.some((tag: any) =>
        checkList.includes(tag.slug?.toLowerCase())
      );

      // Check series
      const hasMatchingSeries = market.events?.series?.some((s: any) =>
        checkList.includes(s.slug?.toLowerCase())
      );

      // Check text content
      const text = `${market.title || ''} ${market.description || ''}`.toLowerCase();
      const hasMatchingText = checkList.some(keyword => text.includes(keyword));

      if (hasMatchingTag || hasMatchingSeries || hasMatchingText) {
        filteredActivities.push(activity);
      }
    } catch (error) {
      console.warn(`Error filtering activity ${activity.transactionHash} by category:`, error);
    }
  }

  return filteredActivities;
};

const parseNumericValue = (value: string | undefined, defaultValue: number): number => {
  const parsed = parseFloat(value || '');
  return isNaN(parsed) ? defaultValue : parsed;
};

const filterAndSaveTrades = async (
  userActivities: UserActivityInterface[], 
  filterData: TradeSettingsState, 
  tradeStyle: 'buy' | 'sell', 
  context: MonitorContext
): Promise<void> => {
  try {
    const settings = filterData[tradeStyle];
    const { activity, tempTrades, address } = context;
    
    // Filter new trades
    let newTrades = userActivities.filter(activity => 
      !tempTrades.some(existing => existing.transactionHash === activity.transactionHash) && 
      activity.side.toLowerCase() === tradeStyle
    );    

    if (newTrades.length === 0) return;

    newTrades = newTrades.filter(activity => activity.type === "TRADE");
    
    if (tradeStyle === 'sell') {
      try {
        const myActivities: UserActivityInterface[] = await fetchData(
          `https://data-api.polymarket.com/activity?user=${filterData.proxyAddress}&limit=500&offset=0`
        );
        
        if (!myActivities) {
          console.warn('Failed to fetch my activities');
          return;
        }

        // Only consider BUY activities for matching conditionIds
        const myBuyConditionIds = new Set(
          myActivities
            .filter(activity => 
              activity.conditionId && 
              activity.side.toLowerCase() === 'buy' // Only match against your buy positions
            )
            .map(activity => activity.conditionId)
        );

        // Filter newTrades to only include sell trades for conditionIds you've bought
        newTrades = newTrades.filter(trade => 
          trade.conditionId && 
          trade.side.toLowerCase() === 'sell' &&
          myBuyConditionIds.has(trade.conditionId)
        );

        console.log(`Found ${newTrades.length} sell trades for conditions you own`);

      } catch (error) {
        console.error('Error in sell condition filtering:', error);
        newTrades = [];
      }
    }

    // Apply filters
    if (settings.Filter.byOrderSize.isActive) {
      const min = parseNumericValue(settings.Filter.byOrderSize.size.min, 0);
      const max = parseNumericValue(settings.Filter.byOrderSize.size.max, Infinity);
      
      newTrades = newTrades.filter(activity => {
        const orderValue = activity.size * activity.price;
        return orderValue >= min && orderValue <= max;
      });
    }
      
    if (settings.Filter.byPrice.isActive) {
      const min = parseNumericValue(settings.Filter.byPrice.size.min, 0);
      const max = parseNumericValue(settings.Filter.byPrice.size.max, Infinity);
      
      newTrades = newTrades.filter(activity => 
        activity.price >= min && activity.price <= max
      );
    }  
      
    if (settings.Filter.byDaysTillEvent.isActive) {
      const min = parseNumericValue(settings.Filter.byDaysTillEvent.size.min, 0);
      const max = parseNumericValue(settings.Filter.byDaysTillEvent.size.max, Infinity);
      
      newTrades = await filterByDaysTillEvent(newTrades, min, max);
    }
  
    if (settings.Filter.bySports.isActive) {
      newTrades = await filterByCategory(newTrades, settings.Filter.bySports.sportsList || []);
    }
    
    if (settings.Filter.byMinMaxAmount.isActive) {
      const min = parseNumericValue(settings.Filter.byMinMaxAmount.size.min, 0);
      const max = parseNumericValue(settings.Filter.byMinMaxAmount.size.max, Infinity);
      
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
  
      // Process and save new trades
      if (newTrades.length > 0) {
        const processedTrades = newTrades
          .map(activity => ({ 
            ...activity, 
            bot: false, 
            botExecutedTime: 0 
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // await activity.bulkWrite(processedTrades.map(pt => ({
        //   updateOne: {
        //     filter: { transactionHash: pt.transactionHash },
        //     update: pt,
        //     upsert: true
        //   }
        // })));

        // Update context with new trades
        context.tempTrades = [...tempTrades, ...processedTrades].slice(-500);
        await tradeExcutor({
            filterData: filterData,
            newTrades: processedTrades,
            tradeStyle: tradeStyle,
            userAddress: context.address
        });        
      }
    } catch (error) {
    console.error(`Error filtering ${tradeStyle} trades:`, error);
    throw error;
  }
};

const tradeMonitor = async (proxyAddress: string): Promise<void> => {
  
  try {

    if (activeMonitors.includes(proxyAddress)) {
      console.log(`Monitor already running for proxy address: ${proxyAddress}`);
      return;
    }

    try {
      if (intervalPtr[proxyAddress]) {
        clearInterval(intervalPtr[proxyAddress]);
        delete intervalPtr[proxyAddress];
      }

      const settings = await Settings.findOne({ proxyAddress });
      if (!settings) {
        throw new Error(`No settings found for proxy address: ${proxyAddress}`);
      }

      const context = await init(settings);
      activeMonitors.push(proxyAddress);
      intervalPtr[proxyAddress] = setInterval(async () => {
        try {
          const currentSettings = await Settings.findOne({ proxyAddress });
          if (currentSettings) {
            await fetchTradeData(currentSettings, context);
          }
        } catch (error) {
          console.error('Error in monitoring interval:', error);
        }
      }, FETCH_INTERVAL * 1000);

      console.log(`Started trade monitoring for proxy address: ${proxyAddress}`);
    } catch (error) {
      console.error('Failed to initialize trade monitor:', error);
      // Add delay before retrying to prevent rapid failures
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error('Trade monitor initialization failed:', error);
    throw error;
  }
};


const stopMonitor = async (proxyAddress: string): Promise<void> => {
  try {
    const index = activeMonitors.indexOf(proxyAddress);
    if (index !== -1) {
      activeMonitors.splice(index, 1);
    }

    if (intervalPtr[proxyAddress]) {
      clearInterval(intervalPtr[proxyAddress]);
      delete intervalPtr[proxyAddress];
      console.log(`Successfully stopped monitoring for ${proxyAddress}`);
    } else {
      console.log(`No active monitor found for ${proxyAddress}`);
    }
  } catch (error) {
    console.error('Error stopping monitor:', error);
    throw error;
  }
};

export {
  tradeMonitor,
  stopMonitor
};