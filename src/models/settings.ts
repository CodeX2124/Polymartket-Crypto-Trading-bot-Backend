import { Schema, model, Document } from 'mongoose';

interface IRange {
  min: string;
  max: string;
}

interface IFilterSetting {
  isActive: boolean;
  size: IRange;
}

interface ISportsSetting {
  isActive: boolean;
  sportsList: string[];
}

interface IOrderSize {
  type: string;
  size: string;
}

interface ILimitation {
  type: string;
  size: string;
}

interface IMaxAmount {
  isActive: boolean;
  amount: string;
}

interface ITradeTypeSettings {
  Filter: {
    byOrderSize: IFilterSetting;
    byPrice: IFilterSetting;
    bySports: ISportsSetting;
    byDaysTillEvent: IFilterSetting;
    byMinMaxAmount: IFilterSetting;
  };
  OrderSize: IOrderSize;
  Limitation: ILimitation;
}

export interface ISettings extends Document {
  proxyAddress: string;
  buy: ITradeTypeSettings;
  sell: ITradeTypeSettings;
  maxAmount: IMaxAmount;
}

const RangeSchema = new Schema<IRange>({
  min: { type: String, default: '' },
  max: { type: String, default: '' }
}, { _id: false });

const FilterSettingSchema = new Schema<IFilterSetting>({
  isActive: { type: Boolean, default: false },
  size: { type: RangeSchema, default: { min: '', max: '' } }
}, { _id: false });

const SportsSettingSchema = new Schema<ISportsSetting>({
  isActive: { type: Boolean, default: false },
  sportsList: { type: [String], default: [] }
}, { _id: false });

const OrderSizeSchema = new Schema<IOrderSize>({
  type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
  size: { type: String, default: '' }
}, { _id: false });

const LimitationSchema = new Schema<ILimitation>({
  type: { type: String, enum: ['specific', 'original'], default: 'specific' },
  size: { type: String, default: '' }
}, { _id: false });

const MaxAmountSchema = new Schema<IMaxAmount>({
  isActive: { type: Boolean, default: false },
  amount: { type: String, default: '' }
}, { _id: false });

const SettingsSchema = new Schema<ISettings>({
  proxyAddress: { type: String, required: true, unique: true },
  buy: {
    type: new Schema<ITradeTypeSettings>({
      Filter: {
        byOrderSize: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        byPrice: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        bySports: { type: SportsSettingSchema, default: { isActive: false, sportsList: [] } },
        byDaysTillEvent: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        byMinMaxAmount: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } }
      },
      OrderSize: { type: OrderSizeSchema, default: { type: 'percentage', size: '' } },
      Limitation: { type: LimitationSchema, default: { type: 'specific', size: '' } }
    }, { _id: false }),
    required: true
  },
  sell: {
    type: new Schema<ITradeTypeSettings>({
      Filter: {
        byOrderSize: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        byPrice: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        bySports: { type: SportsSettingSchema, default: { isActive: false, sportsList: [] } },
        byDaysTillEvent: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } },
        byMinMaxAmount: { type: FilterSettingSchema, default: { isActive: false, size: { min: '', max: '' } } }
      },
      OrderSize: { type: OrderSizeSchema, default: { type: 'percentage', size: '' } },
      Limitation: { type: LimitationSchema, default: { type: 'specific', size: '' } }
    }, { _id: false }),
    required: true
  },
  maxAmount: { type: MaxAmountSchema, default: { isActive: false, amount: '' } }
});

export const Settings = model<ISettings>('Settings', SettingsSchema);