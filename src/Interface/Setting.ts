import { UserActivityInterface } from './User';

export interface RangeValues {
  min: string;
  max: string;
}

export interface OrderLimitationSettings {
  size: string;
  type: string;
}

export interface FilterSettings {
  byOrderSize: {
    isActive: boolean;
    size: RangeValues;
  };
  byPrice: {
    isActive: boolean;
    size: RangeValues;
  };
  bySports: {
    isActive: boolean;
    sportsList: string[];
  };
  byDaysTillEvent: {
    isActive: boolean;
    size: RangeValues;
  };
  byMinMaxAmount: {
    isActive: boolean;
    size: RangeValues;
  };
}

export interface TradeSettings {
  Filter: FilterSettings;
  OrderSize: OrderLimitationSettings;
  Limitation: OrderLimitationSettings;
}

export interface TradeSettingsState {
  proxyAddress: string;
  buy: TradeSettings;
  sell: TradeSettings;
  maxAmount: {
    isActive: boolean;
    amount: string;
  };
}

export interface MonitorContext {
  address: string;
  activity: any;
  tempTrades: UserActivityInterface[];
}