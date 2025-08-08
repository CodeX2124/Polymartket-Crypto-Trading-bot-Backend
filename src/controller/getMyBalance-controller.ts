import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL;
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || '';

const USDC_ABI = ['function balanceOf(address owner) view returns (uint256)'];

const getMyBalance = async (address: string): Promise<number> => {
    console.log("Balance");
    const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
    const balance_usdc = await usdcContract.balanceOf(address);
    const balance_usdc_real = ethers.utils.formatUnits(balance_usdc, 6);
    return parseFloat(balance_usdc_real);
};

export {getMyBalance};
