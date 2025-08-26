import { ethers } from "ethers";
import { resolve } from "path";

import { proxyFactoryAbi } from "../../config/abi/proxyFactoryAbi";

import { encodeErc1155Approve, encodeErc20Approve } from "./encode";
import { ProxyTransaction, CallType } from "../../Interface/Polymarket";
import { Account } from '../../models/accounts';

const PROXY_WALLET_FACTORY_ADDRESS = "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052";
let PRIVATE_KEY = "";

const approveTradingFactory = async (proxyAddress: any) => {
    console.log(`Starting approveFactoryTrading...`);
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

    // Proxy factory
    const factory = new ethers.Contract(PROXY_WALLET_FACTORY_ADDRESS, proxyFactoryAbi, wallet);

    const txns: ProxyTransaction[]  = [];
    const usdcSpenders = [
        "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", // Conditional Tokens Framework
        "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange
        "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296", // Neg Risk Adapter
        "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk CTF Exchange
    ];

    const outcomeTokenSpenders = [
        "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange
        "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296", // Neg Risk Adapter
        "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk Exchange
    ];

    for(const spender of usdcSpenders) {
        // Approves a spender for an ERC20 token on the Proxy Wallet
        txns.push({
            to: USDC_ADDRESS,
            typeCode: CallType.Call,
            data: encodeErc20Approve(spender, ethers.constants.MaxUint256),
            value: "0",
        });
    }

    for(const spender of outcomeTokenSpenders) {
        // Approves a spender for an ERC1155 token on the Proxy Wallet
        txns.push({
            to: CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS,
            typeCode: CallType.Call,
            data: encodeErc1155Approve(spender, true),
            value: "0",
        });
    }

    const txn = await factory.proxy(txns, { gasPrice: 100000000000 });

    console.log(`Txn hash: ${txn.hash}`);
    await txn.wait();

    console.log(`Done!`)
}

export {approveTradingFactory}