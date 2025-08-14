import { Document, model, Schema } from 'mongoose';

// Interface for Range values (matches frontend)
interface IRange {
  min: string;
  max: string;
}

// Interface for Filter settings with range
interface IFilterSetting {
  isActive: boolean;
  size: IRange;
}

// Interface for Order Size settings (enhanced with frontend types)
interface IOrderSize {
  type: 'percentage' | 'amount'; // Matches radio options
  size: string;
}

// Interface for Limitation settings (enhanced with frontend types)
interface ILimitation {
  type: 'specific' | 'original'; // Matches radio options
  size: string;
}

// Interface for Max Amount setting (matches frontend)
interface IMaxAmount {
  isActive: boolean;
  amount: string;
}

// Interface for Buy/Sell settings (matches frontend structure)
interface ITradeTypeSettings {
  Filter: {
    byOrderSize: IFilterSetting;
    byPrice: IFilterSetting;
    bySports: boolean;
    byDaysTillEvent: boolean;
    byMinMaxAmount: IFilterSetting;
  };
  OrderSize: IOrderSize;
  Limitation: ILimitation;
}

// Main Settings interface (aligned with frontend state)
export interface ISettings extends Document {
  proxyAddress: string; 
  buy: ITradeTypeSettings;
  sell: ITradeTypeSettings;
  maxAmount: IMaxAmount;
}

// Sub-schemas
const RangeSchema = new Schema<IRange>({
  min: { type: String, required: false, default: '' }, // Match frontend defaults
  max: { type: String, required: false, default: '' }
}, { _id: false });

const FilterSettingSchema = new Schema<IFilterSetting>({
  isActive: { type: Boolean, required: false, default: false },
  size: { type: RangeSchema, required: false }
}, { _id: false });

const OrderSizeSchema = new Schema<IOrderSize>({
  type: { 
    type: String, 
    enum: ['percentage', 'amount'], 
    required: false,
    default: 'percentage' // Sensible default
  },
  size: { 
    type: String, 
    required: false,
    default: '' // Match frontend
  }
}, { _id: false });

const LimitationSchema = new Schema<ILimitation>({
  type: { 
    type: String, 
    enum: ['specific', 'original'], 
    required: false,
    default: 'specific' // Sensible default
  },
  size: { 
    type: String, 
    required: false,
    default: '' // Match frontend
  }
}, { _id: false });

const MaxAmountSchema = new Schema<IMaxAmount>({
  isActive: { 
    type: Boolean, 
    required: false,
    default: false // Match frontend
  },
  amount: { 
    type: String, 
    required: false,
    default: '' // Match frontend
  }
}, { _id: false });

// Main schema with defaults matching frontend
const SettingsSchema = new Schema<ISettings>({
  proxyAddress: { 
    type: String, 
    required: true,
    default: '' // Match frontend
  },
  buy: {
    type: new Schema<ITradeTypeSettings>({
      Filter: {
        byOrderSize: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        },
        byPrice: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        },
        bySports: { 
          type: Boolean, 
          required: false,
          default: false 
        },
        byDaysTillEvent: { 
          type: Boolean, 
          required: false,
          default: false 
        },
        byMinMaxAmount: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        }
      },
      OrderSize: { 
        type: OrderSizeSchema, 
        required: true,
        default: { type: 'percentage', size: '' }
      },
      Limitation: { 
        type: LimitationSchema, 
        required: true,
        default: { type: 'specific', size: '' }
      }
    }, { _id: false }),
    required: true
  },
  sell: {
    type: new Schema<ITradeTypeSettings>({
      Filter: {
        byOrderSize: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        },
        byPrice: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        },
        bySports: { 
          type: Boolean, 
          required: false,
          default: false 
        },
        byDaysTillEvent: { 
          type: Boolean, 
          required: false,
          default: false 
        },
        byMinMaxAmount: { 
          type: FilterSettingSchema, 
          required: false,
          default: { isActive: false, size: { min: '', max: '' } }
        }
      },
      OrderSize: { 
        type: OrderSizeSchema, 
        required: true,
        default: { type: 'percentage', size: '' }
      },
      Limitation: { 
        type: LimitationSchema, 
        required: true,
        default: { type: 'specific', size: '' }
      }
    }, { _id: false }),
    required: true
  },
  maxAmount: { 
    type: MaxAmountSchema, 
    required: false,
    default: { isActive: false, amount: '' }
  }
});

// Create and export model
export const Settings = model<ISettings>('Settings', SettingsSchema);