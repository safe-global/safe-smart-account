const utils = require('./utils')
const solc = require('solc')
const BigNumber = require('bignumber.js');

const GAS_PRICE = web3.toWei(100, 'gwei')

let estimateDataGas = function(safe, to, value, data, operation, txGasEstimate, gasToken, refundReceiver, signatureCount) {
    // numbers < 256 are 192 -> 31 * 4 + 68
    // numbers < 65k are 256 -> 30 * 4 + 2 * 68
    // For signature array length and dataGasEstimate we already calculated the 0 bytes so we just add 64 for each non-zero byte
    let signatureCost = signatureCount * (68 + 2176 + 2176) // array count (3 -> r, s, v) * signature count
    let payload = safe.contract.execTransaction.getData(
        to, value, data, operation, txGasEstimate, 0, GAS_PRICE, gasToken, refundReceiver, "0x"
    )
    let dataGasEstimate = utils.estimateDataGasCosts(payload) + signatureCost
    if (dataGasEstimate > 65536) {
        dataGasEstimate += 64
    } else {
        dataGasEstimate += 128
    }
    return dataGasEstimate + 32000; // Add aditional gas costs (e.g. base tx costs, transfer costs)
}

let executeTransactionWithSigner = async function(signer, safe, subject, accounts, to, value, data, operation, executor, opts) {
    let options = opts || {}
    let txFailed = options.fails || false
    let txGasToken = options.gasToken || 0
    let refundReceiver = options.refundReceiver || 0

    // Estimate safe transaction (need to be called with from set to the safe address)
    let txGasEstimate = 0
    try {
        let estimateData = safe.contract.requiredTxGas.getData(to, value, data, operation)
        let estimateResponse = await web3.eth.call({to: safe.address, from: safe.address, data: estimateData})
        txGasEstimate = new BigNumber(estimateResponse.substring(138), 16)
        // Add 10k else we will fail in case of nested calls
        txGasEstimate = txGasEstimate.toNumber() + 10000
        console.log("    Tx Gas estimate: " + txGasEstimate)
    } catch(e) {
        console.log("    Could not estimate " + subject)
    }
    let nonce = await safe.nonce()

    let dataGasEstimate = estimateDataGas(safe, to, value, data, operation, txGasEstimate, txGasToken, refundReceiver, accounts.length)
    console.log("    Data Gas estimate: " + dataGasEstimate)

    let gasPrice = GAS_PRICE
    if (txGasToken != 0) {
        gasPrice = 1
    }
    gasPrice = options.gasPrice || gasPrice

    let sigs = await signer(to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
    
    let payload = safe.contract.execTransaction.getData(
        to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, sigs
    )
    console.log("    Data costs: " + utils.estimateDataGasCosts(payload))

    // Estimate gas of paying transaction
    let estimate = null
    try {
        estimate = await safe.execTransaction.estimateGas(
            to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, sigs
        )
    } catch (e) {
        if (options.revertMessage == undefined ||options.revertMessage == null) {
            throw e
        }
        assert.equal(("VM Exception while processing transaction: revert" + opts.revertMessage).trim(), e.message)
        return null
    }

    // Execute paying transaction
    // We add the txGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
    let tx = await safe.execTransaction(
        to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, sigs, {from: executor, gas: estimate + txGasEstimate + 10000}
    )
    let events = utils.checkTxEvent(tx, 'ExecutionFailed', safe.address, txFailed, subject)
    if (txFailed) {
        let transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
        assert.equal(transactionHash, events.args.txHash)
    }
    return tx
}

let executeTransaction = async function(lw, safe, subject, accounts, to, value, data, operation, executor, opts) {
    let signer = async function(to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, nonce) {
        let transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, dataGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
        // Confirm transaction with signed messages
        return utils.signTransaction(lw, accounts, transactionHash)
    }
    return executeTransactionWithSigner(signer, safe, subject, accounts, to, value, data, operation, executor, opts)
}

let deployToken = async function(deployer) {
    let tokenSource = `
    contract TestToken {
        mapping (address => uint) public balances;
        constructor() public {
            balances[msg.sender] = 10000000;
        }
        function transfer(address to, uint value) public returns (bool) {
            if (balances[msg.sender] < value) {
                return false;
            }
            balances[msg.sender] -= value;
            balances[to] += value;
            return true;
        }
    }`
    let output = await utils.compile(tokenSource);
    let tokenInterface = output.interface
    let tokenBytecode = output.data
    let transactionHash = await web3.eth.sendTransaction({from: deployer, data: tokenBytecode, gas: 4000000})
    let receipt = web3.eth.getTransactionReceipt(transactionHash);
    const TestToken = web3.eth.contract(tokenInterface)
    return TestToken.at(receipt.contractAddress)
}

Object.assign(exports, {
    estimateDataGas,
    executeTransaction,
    executeTransactionWithSigner,
    deployToken
})
