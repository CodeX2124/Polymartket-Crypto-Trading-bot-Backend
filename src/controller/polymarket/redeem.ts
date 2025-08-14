import { getGasPrice } from "./getGasPrice";
import { safeAbi } from "../../config/abi/safeAbi";
import { encodeRedeem, encodeRedeemNegRisk } from "./encode";
import { signAndExecuteSafeTransaction } from "./safe-helper";
import { SafeTransaction, OperationType, FeeTier } from "../../Interface/Polymarket";
import { ethers } from "ethers";
import { Account } from '../../models/accounts';

const NEG_RISK_ADAPTER_ADDRESS = process.env.NEG_RISK_ADAPTER_ADDRESS || "";
const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || "";
const CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS = process.env.CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS || "";
let PRIVATE_KEY = "";

export async function createRedeemTxn(redeemAssetPair: any, amount: string[]) {
    console.log(`Starting...`);

    const conditionId = redeemAssetPair.conditionId; // Replace with the market conditionId
    const negRisk = redeemAssetPair.negativeRisk;

    const redeemAmounts = amount;
    const data = negRisk ? encodeRedeemNegRisk(conditionId, redeemAmounts) : encodeRedeem(USDC_ADDRESS, conditionId);
    const to = negRisk ? NEG_RISK_ADAPTER_ADDRESS : CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS;
    console.log("to", to)

    const safeTxn: SafeTransaction = {
        to: to,
        data: data,
        operation: OperationType.Call,
        value: "0",
    };

    return safeTxn;
}

export async function redeemPositions(redeemAsset: any) {

    try {

        const maxGasInfo = await getGasPrice(FeeTier.High);
        const redeemAmount = [redeemAsset.body.size?.toString() ?? "0"];
        const txn = await createRedeemTxn(redeemAsset.body, redeemAmount);
        const safeAddress = redeemAsset.body.proxyWallet || "";
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        const accounts = await Account.find();
        const account = accounts.find((account) => account.proxyWallet.toLowerCase() == safeAddress.toLowerCase()) 
        if (account) {
            PRIVATE_KEY = account.privateKey;
        }
        const pk = new ethers.Wallet(PRIVATE_KEY || "");
        const wallet = pk.connect(provider);
        const safe = new ethers.Contract(safeAddress, safeAbi, wallet);
        const txnHash = await signAndExecuteSafeTransaction(wallet, safe, txn, {
            maxFeePerGas: maxGasInfo.maxFee,
            maxPriorityFeePerGas: maxGasInfo.maxPriorityFee
        });
        return {
            success: true,
            messssage: txnHash};
    } catch (error) {
        throw error;
    }
}