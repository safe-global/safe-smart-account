const utils = require('./utils')

const GAS_PRICE = web3.toWei(100, 'gwei')

let estimateDataGas = function(safe, to, value, data, operation, txGasEstimate, nonce, signatureCount) {
    // numbers < 256 are 192 -> 31 * 4 + 68
    // numbers < 65k are 256 -> 30 * 4 + 2 * 68
    // For signature array length and dataGasEstimate we already calculated the 0 bytes so we just add 64 for each non-zero byte
    let signatureCost = 3 * (64 + 64) + signatureCount * (192 + 2176 + 2176) // array count (3 -> r, s, v) * (array pointer + array length) + signature count * (v, r, s)
    let payload = safe.contract.payAndExecuteTransaction.getData(
        to, value, data, operation, txGasEstimate, 0, GAS_PRICE, [], [], []
    )
    let dataGasEstimate = utils.estimateDataGasCosts(payload) + signatureCost
    if (dataGasEstimate > 65536) {
        dataGasEstimate += 64
    } else {
        dataGasEstimate += 128
    }
    return dataGasEstimate;
}

let executeTransaction = async function(lw, safe, subject, accounts, to, value, data, operation, executor, fails) {
    let txFailed = fails || false

    // Estimate safe transaction (need to be called with from set to the safe address)
    let txGasEstimate = 0
    try {
        txGasEstimate = await safe.estimate.call(to, value, data, operation, {from: safe.address, gasPrice: 0})
        // Add 10k else we will fail in case of nested calls
        txGasEstimate = txGasEstimate.toNumber() + 10000
        console.log("    Tx Gas estimate: " + txGasEstimate)
    } catch(e) {
        console.log("    Could not estimate " + subject)
    }
    let nonce = await safe.nonce()

    let dataGasEstimate = estimateDataGas(safe, to, value, data, operation, txGasEstimate, nonce, accounts.length)
    console.log("    Data Gas estimate: " + dataGasEstimate)

    let transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, dataGasEstimate, GAS_PRICE, nonce)
    console.log("    Tx Hash: " + transactionHash)


    // Confirm transaction with signed messages
    let sigs = utils.signTransaction(lw, accounts, transactionHash)

    // Estimate gas of paying transaction
    let estimate = await safe.payAndExecuteTransaction.estimateGas(
        to, value, data, operation, txGasEstimate, dataGasEstimate, GAS_PRICE, sigs.sigV, sigs.sigR, sigs.sigS
    )
    
    let payload = safe.contract.payAndExecuteTransaction.getData(
        to, value, data, operation, txGasEstimate, dataGasEstimate, GAS_PRICE, sigs.sigV, sigs.sigR, sigs.sigS, {from: executor, gas: estimate + txGasEstimate + 10000}
    )
    console.log("    Data costs: " + utils.estimateDataGasCosts(payload))

    // Execute paying transaction
    // We add the txGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
    let tx = await safe.payAndExecuteTransaction(
        to, value, data, operation, txGasEstimate, dataGasEstimate, GAS_PRICE, sigs.sigV, sigs.sigR, sigs.sigS, {from: executor, gas: estimate + txGasEstimate + 10000}
    )
    utils.checkTxEvent(tx, 'ExecutionFailed', safe.address, txFailed, subject)
    return tx
}

Object.assign(exports, {
    estimateDataGas,
    executeTransaction
})
