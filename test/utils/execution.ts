import { Contract, Wallet, utils } from "ethers"
import { AddressZero } from "@ethersproject/constants";

export const EIP_DOMAIN = {
    EIP712Domain: [
        { type: "address", name: "verifyingContract" }
    ]
}

export const EIP712_TYPE = {
    // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    SafeTx: [
        { type: "address", name: "to" },
        { type: "uint256", name: "value" },
        { type: "bytes", name: "data" },
        { type: "uint8", name: "operation" },
        { type: "uint256", name: "safeTxGas" },
        { type: "uint256", name: "baseGas" },
        { type: "uint256", name: "gasPrice" },
        { type: "address", name: "gasToken" },
        { type: "address", name: "refundReceiver" },
        { type: "uint256", name: "nonce" },
    ]
}

interface SafeTransaction {
    to: string,
    value: string | number,
    data: string,
    operation: number,
    safeTxGas: string | number,
    baseGas: string | number,
    gasPrice: string | number,
    gasToken: string,
    refundReceiver: string,
    nonce: string | number
}

interface SafeSignature {
    signer: string,
    data: string
}

export const calculateSafeTransactionHash = (safe: Contract, safeTx: SafeTransaction): string => {
    return utils._TypedDataEncoder.hash({ verifyingContract: safe.address }, EIP712_TYPE, safeTx)
}

export const safeApproveHash = async (signer: Wallet, safe: Contract, safeTx: SafeTransaction, skipOnChainApproval?: boolean): Promise<SafeSignature> => {
    const typedDataHash = utils.arrayify(calculateSafeTransactionHash(safe, safeTx))
    const signerSafe = safe.connect(signer)
    if (!skipOnChainApproval) {
        await signerSafe.approveHash(typedDataHash)
    }
    return {
        signer: signer.address,
        data: "0x000000000000000000000000" + signer.address.slice(2) + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
    }
}

export const safeSignTypedData = async (signer: Wallet, safe: Contract, safeTx: SafeTransaction): Promise<SafeSignature> => {
    return {
        signer: signer.address,
        data: await signer._signTypedData({ verifyingContract: safe.address }, EIP712_TYPE, safeTx)
    }
}

export const safeSignMessage = async (signer: Wallet, safe: Contract, safeTx: SafeTransaction): Promise<SafeSignature> => {
    const typedDataHash = utils.arrayify(calculateSafeTransactionHash(safe, safeTx))
    return {
        signer: signer.address,
        data: (await signer.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20")
    }
}

export const executeTx = async (safe: Contract, safeTx: SafeTransaction, signatures: SafeSignature[]): Promise<string> => {
    signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
    let signatureBytes = "0x"
    for (const sig of signatures) {
        signatureBytes += sig.data.slice(2)
    }
    return safe.execTransaction(safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, signatureBytes)
}

export const multiSignDigest = async (signers: Wallet[], safeTxHash: string) => {
    signers.sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()))
    let signatureBytes = "0x"
    for (const signer of signers) {
        let sig = signer._signingKey().signDigest(safeTxHash)
        signatureBytes += sig.r.slice(2) + sig.s.slice(2) + sig.v.toString(16)
    }
    return signatureBytes
}

export const executeContractCallWithSignatures = async (safe: Contract, contract: Contract, method: string, params: any[], signatures: string) => {
    const data = contract.interface.encodeFunctionData(method, params)
    return await safe.execTransaction(safe.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, signatures).then((tx: any) => tx.wait())
}

export const executeContractCallWithSigners = async (safe: Contract, contract: Contract, method: string, params: any[], signers: Wallet[]) => {
    const data = contract.interface.encodeFunctionData(method, params)
    const nonce = await safe.nonce()
    const safeTxHash = await safe.getTransactionHash(safe.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, nonce)
    let sigs = await multiSignDigest(signers, safeTxHash)
    return safe.execTransaction(safe.address, 0, data, 0, 0, 0, 0, AddressZero, AddressZero, sigs)
}