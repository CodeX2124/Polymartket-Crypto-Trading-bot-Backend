import { Document, model, Schema } from 'mongoose';

export interface IAccount extends Document {
  id: string;
  proxyWallet: string;
  targetWallet: string;
  privateKey: string;
  isActive: boolean;
}

const accountSchema = new Schema<IAccount>({
  id: { type: String, required: true, unique: true },
  proxyWallet: { type: String, required: true },
  targetWallet: { type: String, required: true },
  privateKey: { type: String, required: true },
  isActive: { type: Boolean, default: false },
});

export const Account = model<IAccount>('Account', accountSchema);