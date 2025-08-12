import { getGasPrice } from "./getGasPrice";
import { safeAbi } from "../../config/abi/safeAbi";
import { encodeRedeem, encodeRedeemNegRisk } from "./encode";
import { signAndExecuteSafeTransaction } from "./safe-helper";
import { SafeTransaction, OperationType, FeeTier } from "../../Interface/Polymarket";
import { ethers } from "ethers";


const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const pk = new ethers.Wallet(process.env.NEXT_PUBLIC_PRIVATE_KEY || "0x7ba2ced5a1b451751a47a2209190473d9c08fe943940ce24286b222c3de2e8cc");
const wallet = pk.connect(provider);
const NEG_RISK_ADAPTER_ADDRESS = process.env.NEXT_PUBLIC_NEG_RISK_ADAPTER_ADDRESS || "";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "";
const safeAddress = process.env.NEXT_PUBLIC_PROXY_WALLET || "";
const safe = new ethers.Contract(safeAddress, safeAbi, wallet);
const CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS = process.env.NEXT_PUBLIC_CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS || "";

export async function createRedeemTxn(redeemAssetPair: any, amount: string[]) {
    console.log(`Starting...`);

    console.log("safe address:", safeAddress);

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
        const redeemAmount = [redeemAsset.size?.toString() ?? "0"];
        const txn = await createRedeemTxn(redeemAsset, redeemAmount);
        const txnHash = await signAndExecuteSafeTransaction(wallet, safe, txn, {
            maxFeePerGas: maxGasInfo.maxFee,
            maxPriorityFeePerGas: maxGasInfo.maxPriorityFee
        });
        return txnHash;
    } catch (error) {
        throw error;
    }
}