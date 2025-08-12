import { BigNumber, ethers } from 'ethers';
import { FeeTier } from '../../Interface/Polymarket';

interface GasPriceResult {
    maxFee: BigNumber;
    maxPriorityFee: BigNumber;
}

interface GasPriceEstimation {
    safeLow: { maxPriorityFee: BigNumber, maxFee: BigNumber },
    standard: { maxPriorityFee: BigNumber, maxFee: BigNumber },
    fast: { maxPriorityFee: BigNumber, maxFee: BigNumber },
    estimatedBaseFee: BigNumber,
    blockTime: number,
    blockNumber: number
}

export const fetchGasPrice = async (): Promise<GasPriceEstimation> => {
    try {
        const response = await fetch('https://gasstation.polygon.technology/v2');
        if (!response.ok) {
            throw new Error(`Gas station API error: ${response.status} ${response.statusText}`);
        }
        return await response.json() as GasPriceEstimation;
    } catch (error) {
        console.error('Error fetching gas price:', error);
        throw error;
    }
};

export function parseGasPrice(
    gasPriceData: GasPriceEstimation,
    speed: FeeTier.Slow | FeeTier.Medium | FeeTier.High = FeeTier.Medium
): GasPriceResult {
    if (!gasPriceData || !gasPriceData[speed]) {
        throw new Error(`Invalid gas price data or speed level: ${speed}`);
    }

    const feeData = gasPriceData[speed];
    const maxFee = ethers.BigNumber.from(ethers.utils.parseUnits(feeData.maxFee.toString(), 'gwei'));
    const maxPriorityFee = ethers.BigNumber.from(ethers.utils.parseUnits(feeData.maxPriorityFee.toString(), 'gwei'));

    return {
        maxFee,
        maxPriorityFee,
    };
}

export async function getGasPrice(
    speed: FeeTier.Slow | FeeTier.Medium | FeeTier.High = FeeTier.Medium
): Promise<GasPriceResult> {
    const gasPriceData = await fetchGasPrice();
    return parseGasPrice(gasPriceData, speed);
}
