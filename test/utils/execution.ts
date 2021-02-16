import { Contract, Wallet } from "ethers"
import { AddressZero } from "@ethersproject/constants";

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