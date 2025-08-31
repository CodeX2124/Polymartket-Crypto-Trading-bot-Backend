import { ethers } from "ethers";
import { safeAbi } from "../../config/abi/safeAbi";
import { encodeErc1155Approve, encodeErc20Approve } from "./encode";
import { aggregateTransaction, signAndExecuteSafeTransaction } from "./safe-helper";
import { OperationType, SafeTransaction } from "../../Interface/Polymarket";
import { Account } from '../../models/accounts';
import { getGasPrice } from "./getGasPrice";

let PRIVATE_KEY = "";

const approveTrading = async (proxyAddress: any) => {
    console.log(`Starting approveTrading...`);
    const accounts = await Account.find();
    const account = accounts.find((account) => account.proxyWallet.toLowerCase() == proxyAddress.toLowerCase()) 
    if (account) {
        PRIVATE_KEY = account.privateKey;
    }
    const provider = new ethers.providers.JsonRpcProvider(`${process.env.RPC_URL}`);
    const pk = new ethers.Wallet(`${PRIVATE_KEY}`);
    const wallet = pk.connect(provider);
    const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || "";
    const CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS = process.env.CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS || "";

    console.log(`Address: ${wallet.address}`)

    // Safe
    const safeAddress = proxyAddress; // Replace with your safe address
    const safe = new ethers.Contract(safeAddress, safeAbi, wallet);
    
    const usdcSpenders = [
        "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", // Conditional Tokens Framework
        "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange
        "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk CTF Exchange
    ];

    const outcomeTokenSpenders = [
        "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange
        "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk Exchange
    ];

    const safeTxns: SafeTransaction[] = [];
    
    for(const spender of usdcSpenders) {
        safeTxns.push(
            {
                to: USDC_ADDRESS,
                data: encodeErc20Approve(spender, ethers.constants.MaxUint256),
                operation: OperationType.Call,
                value: "0",
            }
        );
    }

    for(const spender of outcomeTokenSpenders) {
        safeTxns.push(
            {
                to: CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS,
                data: encodeErc1155Approve(spender, true),
                operation: OperationType.Call,
                value: "0",
            }
        );
    }

    const safeTxn = aggregateTransaction(safeTxns);
    const gasPrice = await getGasPrice();
    const txn = await signAndExecuteSafeTransaction(wallet, safe, safeTxn, {gasPrice: gasPrice.maxFee});
    // safe.approve()
    console.log(`Txn hash: ${txn.hash}`);
    await txn.wait();

    console.log(`Done!`)
}

export {approveTrading};