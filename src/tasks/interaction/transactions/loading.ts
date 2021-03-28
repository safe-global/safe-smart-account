import { ethers } from 'ethers'
import { EventTx, ModuleTx, MultisigTx, MultisigUnknownTx, TransferDetails, TransferTx } from './types'

const provider = ethers.providers.getDefaultProvider(process.env.REACT_APP_ETHEREUM_NODE_URL)

const erc20InterfaceDefinition = [
    "event Transfer(address indexed from, address indexed to, uint256 amount)"
]
const erc20OldInterfaceDefinition = [
    "event Transfer(address indexed from, address to, uint256 amount)"
]
const erc721InterfaceDefinition = [
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
]
const erc20Interface = new ethers.utils.Interface(erc20InterfaceDefinition)
const erc20OldInterface = new ethers.utils.Interface(erc20OldInterfaceDefinition)
const erc721Interface = new ethers.utils.Interface(erc721InterfaceDefinition)
// The same for all interfaces as `indexed` has no impact on the topic
const transferTopic = erc20Interface.getEventTopic("Transfer")

const safeInterfaceDefinition = [
    "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)",
    "event ExecutionSuccess(bytes32 txHash, uint256 payment)",
    "event ExecutionFailure(bytes32 txHash, uint256 payment)",
    "event ExecutionFromModuleSuccess(address indexed module)",
    "event ExecutionFromModuleFailure(address indexed module)"
]
const safeInterface = new ethers.utils.Interface(safeInterfaceDefinition)
const successTopic = safeInterface.getEventTopic("ExecutionSuccess")
const failureTopic = safeInterface.getEventTopic("ExecutionFailure")
const moduleSuccessTopic = safeInterface.getEventTopic("ExecutionFromModuleSuccess")
const moduleFailureTopic = safeInterface.getEventTopic("ExecutionFromModuleFailure")
// Failure topics cannot generate sub events, we should remove them in the future
const parentTopics = [successTopic, moduleSuccessTopic, failureTopic, moduleFailureTopic]

const loadBlock = async (blockHash: string): Promise<ethers.providers.Block> => {
    return await provider.getBlock(blockHash)
}

const loadEthTx = async (txHash: string): Promise<ethers.providers.TransactionResponse> => {
    return await provider.getTransaction(txHash)
}

export interface DecodedMultisigTx {
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
}

const decodeTx = (account: string, tx: ethers.providers.TransactionResponse): DecodedMultisigTx | undefined => {
    try {
        const result = safeInterface.decodeFunctionData("execTransaction", tx.data)
        if (tx.to !== account) return undefined
        return {
            to: result.to,
            value: result.value.toString(),
            data: result.data,
            operation: result.operation,
            safeTxGas: result.safeTxGas.toString(),
            baseGas: result.baseGas.toString(),
            gasPrice: result.gasPrice.toString(),
            gasToken: result.gasToken,
            refundReceiver: result.refundReceiver,
            signatures: result.signatures,
        }
    } catch (e) {
        // TODO: try to decode other ways 
        console.log("Unknown function", tx.data.slice(0, 10))
    }
}

const mutlisigTxEntry = async (account: string, log: ethers.providers.Log, safeTxHash: string, success: boolean, subLogs: ethers.providers.Log[]): Promise<MultisigTx | MultisigUnknownTx> => {
    const ethTx = await loadEthTx(log.transactionHash)
    const decodedTx = decodeTx(account, ethTx)
    const block = await loadBlock(log.blockHash)
    if (!decodedTx) return {
        type: "MultisigUnknown",
        id: "multisig_" + safeTxHash,
        timestamp: block.timestamp,
        logs: subLogs,
        txHash: log.transactionHash,
        safeTxHash,
        success
    }
    return {
        type: "Multisig",
        id: "multisig_" + safeTxHash,
        timestamp: block.timestamp,
        logs: subLogs,
        txHash: log.transactionHash,
        safeTxHash,
        success,
        ...decodedTx,
        nonce: -1 // We don't know yet
    }
}

const moduleTxEntry = async (log: ethers.providers.Log, moduleAddress: string, success: boolean, subLogs: ethers.providers.Log[]): Promise<ModuleTx> => {
    const block = await loadBlock(log.blockHash)
    return {
        type: "Module",
        txHash: log.transactionHash,
        id: "module_" + log.blockNumber + " " + log.transactionIndex + " " + log.logIndex,
        timestamp: block.timestamp,
        module: moduleAddress,
        success,
        logs: subLogs
    }
}

const transferEntry = async (account: string, log: ethers.providers.Log): Promise<TransferTx | undefined> => {
    const block = await loadBlock(log.blockHash)
    let type: string = ""
    let eventInterface
    if (log.topics.length === 4) {
        eventInterface = erc721Interface
        type = "ERC721"
    } else if (log.topics.length === 3) {
        eventInterface = erc20Interface
        type = "ERC20"
    } else if (log.topics.length === 2) {
        eventInterface = erc20OldInterface
        type = "ERC20"
    } else {
        return undefined
    }
    const event = eventInterface.decodeEventLog("Transfer", log.data, log.topics)
    let details: TransferDetails
    if (type === "ERC20") {
        details = {
            type: "ERC20",
            tokenAddress: log.address,
            value: event.amount.toString()
        }
    } else {
        details = {
            type: "ERC721",
            tokenAddress: log.address,
            tokenId: event.tokenId.toString()
        }
    }
    return {
        type: "Transfer",
        id: `transfer_${log.blockNumber}_${log.transactionIndex}_${log.logIndex}`,
        timestamp: block.timestamp,
        sender: event.from,
        receipient: event.to,
        direction: (event.to.toLowerCase() === account.toLowerCase() ? "INCOMING" : "OUTGOING"),
        details
    }
}

const mapLog = async (account: string, log: ethers.providers.Log, subLogs: ethers.providers.Log[]): Promise<EventTx | undefined> => {
    switch (log.topics[0]) {
        case successTopic: {
            const event = safeInterface.decodeEventLog("ExecutionSuccess", log.data, log.topics)
            return await mutlisigTxEntry(account, log, event.txHash, true, subLogs)
        }
        case failureTopic: {
            const event = safeInterface.decodeEventLog("ExecutionFailure", log.data, log.topics)
            return await mutlisigTxEntry(account, log, event.txHash, false, subLogs)
        }
        case moduleSuccessTopic: {
            const event = safeInterface.decodeEventLog("ExecutionFromModuleSuccess", log.data, log.topics)
            return await moduleTxEntry(log, event.module, true, subLogs)
        }
        case moduleFailureTopic: {
            const event = safeInterface.decodeEventLog("ExecutionFromModuleFailure", log.data, log.topics)
            return await moduleTxEntry(log, event.module, false, subLogs)
        }
        case transferTopic: {
            if (subLogs.length > 0) console.error("Sub logs for transfer entry!", log, subLogs)
            return await transferEntry(account, log)
        }
        default:
            console.error("Received unknown event", log)
            return undefined
    }
}

const loadOutgoingTransfer = (account: string): Promise<ethers.providers.Log[]> => {
    const filter = {
        topics: [[transferTopic], [ethers.utils.defaultAbiCoder.encode(["address"], [account])]],
        fromBlock: "earliest"
    }
    return provider.getLogs(filter).then((e) => {
        console.log("OUT", e.length)
        return e
    })
}

const loadIncomingTransfer = (account: string): Promise<ethers.providers.Log[]> => {
    const filter = {
        topics: [[transferTopic], null as any, [ethers.utils.defaultAbiCoder.encode(["address"], [account])]],
        fromBlock: "earliest"
    }
    return provider.getLogs(filter).then((e) => {
        console.log("IN", e.length)
        return e
    })
}

const loadSafeTransactionTransfer = (account: string): Promise<ethers.providers.Log[]> => {
    const filter = {
        topics: [[successTopic, failureTopic, moduleSuccessTopic, moduleFailureTopic]],
        address: account,
        fromBlock: "earliest"
    }
    return provider.getLogs(filter).then((e) => {
        console.log("TXS", e.length)
        return e
    })
}

const isOlder = (compare: ethers.providers.Log | undefined, base: ethers.providers.Log | undefined) => {
    if (compare === undefined) return false
    if (base === undefined) return true
    if (compare.blockNumber != base.blockNumber) return compare.blockNumber < base.blockNumber
    if (compare.transactionIndex != base.transactionIndex) return compare.transactionIndex < base.transactionIndex
    if (compare.logIndex != base.logIndex) return compare.logIndex < base.logIndex
    return false // Equal defaults to false
}

/// Oldest first
const mergeLogs = async (...loaders: Promise<ethers.providers.Log[]>[]): Promise<ethers.providers.Log[]> => {
    const loaderCount = loaders.length
    if (loaderCount == 0) return []

    const logResults = await Promise.all(loaders)
    if (loaderCount == 1) return logResults[0]
    const currentLogIndex: number[] = new Array(loaderCount).fill(0)
    for (var i = 0; i < loaderCount; i++) currentLogIndex[i] = 0;
    const out: ethers.providers.Log[] = []
    var runs = 0
    // Panic check against endless loop (10k is max amount of events, per loader)
    while (runs < 10000 * loaderCount) {
        let resultIndex = 0
        let nextLog = logResults[0][currentLogIndex[0]]
        for (var i = 1; i < loaderCount; i++) {
            let candidate = logResults[i][currentLogIndex[i]]
            if (isOlder(candidate, nextLog)) {
                resultIndex = i
                nextLog = candidate
            }
        }
        currentLogIndex[resultIndex]++
        if (nextLog) out.push(nextLog)
        else break
        runs++
    }
    return out
}

interface GroupedLogs {
    parent: ethers.providers.Log,
    details?: ethers.providers.Log, // This is for the future (L2 Safe) and we expect the event order details -> children -> parent
    children: ethers.providers.Log[]
}

const groupIdFromLog = (log: ethers.providers.Log): string => `${log.blockNumber}_${log.transactionIndex}`

const updateGroupedLogs = (groups: GroupedLogs[], parentCandidate: ethers.providers.Log | undefined, currentChildren: ethers.providers.Log[]) => {
    if (parentCandidate) {
        groups.push({
            parent: parentCandidate,
            children: currentChildren
        })
    } else if (currentChildren.length > 0) {
        groups.push(...currentChildren.map((log) => { return { parent: log, children: [] } }))
    }
}

const groupLogs = (logs: ethers.providers.Log[]): GroupedLogs[] => {
    const out: GroupedLogs[] = []
    let currentChildren: ethers.providers.Log[] = []
    let parentCandidate: ethers.providers.Log | undefined
    let currentGroupId: string | undefined = undefined
    for (const log of logs) {
        const groupId = groupIdFromLog(log)
        const isParentCandidate = parentTopics.indexOf(log.topics[0]) >= 0
        if (currentGroupId !== groupId || (isParentCandidate && parentCandidate)) {
            updateGroupedLogs(out, parentCandidate, currentChildren)
            parentCandidate = undefined
            currentChildren = []
            currentGroupId = undefined
        }
        if (!currentGroupId) currentGroupId = groupId
        if (isParentCandidate) {
            parentCandidate = log
        } else {
            currentChildren.push(log)
        }
    }
    updateGroupedLogs(out, parentCandidate, currentChildren)
    return out
}

export const loadHistoryTxs = async (account: string, start: number): Promise<EventTx[]> => {
    const txLogs = await mergeLogs(loadSafeTransactionTransfer(account), loadOutgoingTransfer(account), loadIncomingTransfer(account))
    const groups = groupLogs(txLogs.reverse())
    const inter = groups.slice(start, start + 5).map(({ parent, children }) => mapLog(account, parent, children))
    return (await Promise.all(inter)).filter((e) => e !== undefined) as EventTx[]
}