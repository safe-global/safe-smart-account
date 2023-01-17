import { Contract, Wallet, utils, BigNumber, BigNumberish, Signer, PopulatedTransaction, ethers } from "ethers"
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { AddressZero } from "@ethersproject/constants";

export const EIP_DOMAIN = {
    EIP712Domain: [
        { type: "uint256", name: "chainId" },
        { type: "address", name: "verifyingContract" }
    ]
}

export const EIP712_SAFE_TX_TYPE = {
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

export const EIP712_SAFE_MESSAGE_TYPE = {
    // "SafeMessage(bytes message)"
    SafeMessage: [
        { type: "bytes", name: "message" },
    ]
}

export interface MetaTransaction {
    to: string,
    value: string | number | BigNumber,
    data: string,
    operation: number,
}

export interface SafeTransaction extends MetaTransaction {
    safeTxGas: string | number,
    baseGas: string | number,
    gasPrice: string | number,
    gasToken: string,
    refundReceiver: string,
    nonce: string | number
}

export interface SafeSignature {
    signer: string,
    data: string,
    dynamic?: boolean
}

export const calculateSafeDomainSeparator = (safe: Contract, chainId: BigNumberish): string => {
    return utils._TypedDataEncoder.hashDomain({ verifyingContract: safe.address, chainId })
}

export const preimageSafeTransactionHash = (safe: Contract, safeTx: SafeTransaction, chainId: BigNumberish): string => {
    return utils._TypedDataEncoder.encode({ verifyingContract: safe.address, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}

export const calculateSafeTransactionHash = (safe: Contract, safeTx: SafeTransaction, chainId: BigNumberish): string => {
    return utils._TypedDataEncoder.hash({ verifyingContract: safe.address, chainId }, EIP712_SAFE_TX_TYPE, safeTx)
}

export const calculateSafeMessageHash = (safe: Contract, message: string, chainId: BigNumberish): string => {
    return utils._TypedDataEncoder.hash({ verifyingContract: safe.address, chainId }, EIP712_SAFE_MESSAGE_TYPE, { message })
}

export const safeApproveHash = async (signer: Signer, safe: Contract, safeTx: SafeTransaction, skipOnChainApproval?: boolean): Promise<SafeSignature> => {
    if (!skipOnChainApproval) {
        if (!signer.provider) throw Error("Provider required for on-chain approval")
        const chainId = (await signer.provider.getNetwork()).chainId
        const typedDataHash = utils.arrayify(calculateSafeTransactionHash(safe, safeTx, chainId))
        const signerSafe = safe.connect(signer)
        await signerSafe.approveHash(typedDataHash)
    }
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: "0x000000000000000000000000" + signerAddress.slice(2) + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
    }
}

export const buildContractSignature = async (signer: string, signature: string): Promise<SafeSignature> => {
    const signerAddress = ethers.utils.getAddress(signer)
    return {
        signer: signerAddress,
        data: signature,
        dynamic: true
    }
}

export const safeSignTypedData = async (signer: Signer & TypedDataSigner, safe: Contract, safeTx: SafeTransaction, chainId?: BigNumberish): Promise<SafeSignature> => {
    if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId")
    const cid = chainId || (await signer.provider!!.getNetwork()).chainId
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: await signer._signTypedData({ verifyingContract: safe.address, chainId: cid }, EIP712_SAFE_TX_TYPE, safeTx)
    }
}

export const signHash = async (signer: Signer, hash: string): Promise<SafeSignature> => {
    const typedDataHash = utils.arrayify(hash)
    const signerAddress = await signer.getAddress()
    return {
        signer: signerAddress,
        data: (await signer.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20")
    }
}

export const safeSignMessage = async (signer: Signer, safe: Contract, safeTx: SafeTransaction, chainId?: BigNumberish): Promise<SafeSignature> => {
    const cid = chainId || (await signer.provider!!.getNetwork()).chainId
    return signHash(signer, calculateSafeTransactionHash(safe, safeTx, cid))
}

export const buildSignatureBytes = (signatures: SafeSignature[]): string => {
    signatures.sort((left, right) => left.signer.toLowerCase().localeCompare(right.signer.toLowerCase()))
    let signatureBytes = "0x"
    let dynamicBytes = ""
    for (const sig of signatures) {
        if (sig.dynamic === true) {
            // Each signature has a static part of 65 bytes and then the dynamic parts of the signatures before need to be added.
            const position = ethers.utils.defaultAbiCoder.encode(["uint256"], [signatures.length * 65 + dynamicBytes.length / 2]) 
            signatureBytes += "000000000000000000000000" + sig.signer.slice(2) + position.slice(2) + "00"
            console.log(sig)
            dynamicBytes += ethers.utils.defaultAbiCoder.encode(["bytes"], [sig.data]).slice(66)
        } else {
            signatureBytes += sig.data.slice(2)
        }
    }
    return signatureBytes + dynamicBytes
}

export const logGas = async (message: string, tx: Promise<any>, skip?: boolean): Promise<any> => {
    return tx.then(async (result) => {
        const receipt = await result.wait()
        if (!skip) console.log("           Used", receipt.gasUsed.toNumber(), `gas for >${message}<`)
        return result
    })
}

export const executeTx = async (safe: Contract, safeTx: SafeTransaction, signatures: SafeSignature[], overrides?: any): Promise<any> => {
    const signatureBytes = buildSignatureBytes(signatures)
    return safe.execTransaction(safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, signatureBytes, overrides || {})
}

export const populateExecuteTx = async (safe: Contract, safeTx: SafeTransaction, signatures: SafeSignature[], overrides?: any): Promise<PopulatedTransaction> => {
    const signatureBytes = buildSignatureBytes(signatures)
    return safe.populateTransaction.execTransaction(
        safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver,
        signatureBytes,
        overrides || {}
    )
}

export const buildContractCall = (contract: Contract, method: string, params: any[], nonce: number, delegateCall?: boolean, overrides?: Partial<SafeTransaction>): SafeTransaction => {
    const data = contract.interface.encodeFunctionData(method, params)
    return buildSafeTransaction(Object.assign({
        to: contract.address,
        data,
        operation: delegateCall ? 1 : 0,
        nonce
    }, overrides))
}

export const executeTxWithSigners = async (safe: Contract, tx: SafeTransaction, signers: Wallet[], overrides?: any) => {
    const sigs = await Promise.all(signers.map((signer) => safeSignTypedData(signer, safe, tx)))
    return executeTx(safe, tx, sigs, overrides)
}

export const executeContractCallWithSigners = async (safe: Contract, contract: Contract, method: string, params: any[], signers: Wallet[], delegateCall?: boolean, overrides?: Partial<SafeTransaction>) => {
    const tx = buildContractCall(contract, method, params, await safe.nonce(), delegateCall, overrides)
    return executeTxWithSigners(safe, tx, signers)
}

export const buildSafeTransaction = (template: {
    to: string, value?: BigNumber | number | string, data?: string, operation?: number, safeTxGas?: number | string,
    baseGas?: number | string, gasPrice?: number | string, gasToken?: string, refundReceiver?: string, nonce: number
}): SafeTransaction => {
    return {
        to: template.to,
        value: template.value || 0,
        data: template.data || "0x",
        operation: template.operation || 0,
        safeTxGas: template.safeTxGas || 0,
        baseGas: template.baseGas || 0,
        gasPrice: template.gasPrice || 0,
        gasToken: template.gasToken || AddressZero,
        refundReceiver: template.refundReceiver || AddressZero,
        nonce: template.nonce
    }
}