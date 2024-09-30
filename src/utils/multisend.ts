import { ethers, BigNumberish } from "ethers";
import { buildContractCall, MetaTransaction, SafeTransaction } from "./execution";
import { MultiSend } from "../../typechain-types";

const encodeMetaTransaction = (tx: MetaTransaction): string => {
    const data = ethers.getBytes(tx.data);
    const encoded = ethers.solidityPacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [tx.operation, tx.to, tx.value, data.length, data],
    );
    return encoded.slice(2);
};

export const encodeMultiSend = (txs: MetaTransaction[]): string => {
    return "0x" + txs.map((tx) => encodeMetaTransaction(tx)).join("");
};

export const buildMultiSendSafeTx = async (
    multiSend: MultiSend,
    txs: MetaTransaction[],
    nonce: BigNumberish,
    overrides?: Partial<SafeTransaction>,
): Promise<SafeTransaction> => {
    return buildContractCall(multiSend, "multiSend", [encodeMultiSend(txs)], nonce, true, overrides);
};
