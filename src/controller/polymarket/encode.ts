import { ethers, BigNumber } from "ethers";
import { Interface } from "ethers/lib/utils";
import { ctfAbi } from "../../config/abi/ctfAbi"
import { erc1155Abi } from "../../config/abi/erc1155Abi";
import { erc20Abi } from "../../config/abi/erc20Abi";
import { negRiskAdapterAbi } from "../../config/abi/negRiskAdapterAbi";

const ERC20_INTERFACE = new Interface(erc20Abi);
const ERC1155_INTERFACE = new Interface(erc1155Abi);
const CTF_INTERFACE = new Interface(ctfAbi);
const NEG_RISK_INTERFACE = new Interface(negRiskAdapterAbi);

export const encodeRedeem = (collateralToken: string, conditionId: string) : string => {
    console.log("condition_id", conditionId )
    return CTF_INTERFACE.encodeFunctionData(
        "redeemPositions(address,bytes32,bytes32,uint256[])",
        [collateralToken, ethers.constants.HashZero, conditionId, [1, 2]],
    );
}

export const encodeRedeemNegRisk = (conditionId: string, amounts: string[]): string => {
    return NEG_RISK_INTERFACE.encodeFunctionData(
        "redeemPositions(bytes32,uint256[])",
        [conditionId, amounts],
    );
}

export const encodeErc20Approve = (spender: string, approvalAmount: BigNumber): string => {
    return ERC20_INTERFACE.encodeFunctionData(
        "approve(address,uint256)",
        [spender, approvalAmount]
    );
}

export const encodeErc1155Approve = (spender: string, approval: boolean): string => {
    return ERC1155_INTERFACE.encodeFunctionData(
        "setApprovalForAll(address,bool)",
        [spender, approval],
    );
}

