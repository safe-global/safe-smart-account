import { ethers } from "ethers"

export type EventTx = MultisigTx | ModuleTx | TransferTx | MultisigUnknownTx

interface Base {
    id: string,
    timestamp: number,
}

export interface MultisigUnknownTx extends Base {
    type: 'MultisigUnknown'
    txHash: string
    safeTxHash: string
    success: boolean
    logs: ethers.providers.Log[]
}

export interface MultisigTx extends Base {
    type: 'Multisig'
    txHash: string
    safeTxHash: string
    success: boolean
    to: string
    value: string
    data: string
    operation: number
    safeTxGas: string
    baseGas: string
    gasPrice: string
    gasToken: string
    refundReceiver: string
    signatures: string
    nonce: number
    logs: ethers.providers.Log[]
}

export interface ModuleTx extends Base {
    type: 'Module'
    txHash: string
    module: string
    success: boolean
    logs: ethers.providers.Log[]
}

export interface TransferTx extends Base {
    type: 'Transfer'
    sender: string
    receipient: string
    direction: 'INCOMING' | 'OUTGOING'
    details: TransferDetails
}

export type TransferDetails = Erc20Details | Erc721Details

export interface Erc20Details {
    type: "ERC20",
    tokenAddress: string,
    value: string
}

export interface Erc721Details {
    type: "ERC721",
    tokenAddress: string,
    tokenId: string
}