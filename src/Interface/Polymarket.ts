import { BigNumberish } from "ethers";

export enum CallType {
    Invalid = "0",
    Call = "1",
    DelegateCall = "2",
  }
  
  export interface Transaction {
    to: string;
    typeCode: CallType;
    data: string;
    value: string;
  }
  export interface RedeemResult {
    transactionHash: string;
    payout?: BigNumberish;
    conditionId?: string;
  }
  
  export enum OperationType {
      Call, // 0
      DelegateCall, // 1
  }  
  
  export interface SafeTransaction {
      to: string;
      operation: OperationType
      data: string;
      value: string;
  }
  
  export enum FeeTier {
      Slow = "safeLow",
      Medium = "standard",
      High = "fast"
  }