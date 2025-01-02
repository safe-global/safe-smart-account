const utils = require('./general')
const BigNumber = require('bignumber.js')

const GAS_PRICE = web3.utils.toWei("100", 'gwei')

let byteGasCosts = function(hexValue) {
    // TODO: adjust for Istanbul hardfork (https://eips.ethereum.org/EIPS/eip-2028)
    // Note: this is only supported with the latest ganache versions
    switch(hexValue) {
        case "0x": return 0
        case "00": return 4
        default: return 68
    }
}

 let calcDataGasCosts = function(dataString) {
    const reducer = (accumulator, currentValue) => accumulator += byteGasCosts(currentValue)

   return dataString.match(/.{2}/g).reduce(reducer, 0)
 }

let estimateBaseGas = function(safe, to, value, data, operation, txGasEstimate, gasToken, refundReceiver, signatureCount, nonce) {
    // TODO: adjust for Istanbul hardfork (https://eips.ethereum.org/EIPS/eip-2028)
    // Note: this is only supported with the latest ganache versions
    // numbers < 256 are 192 -> 31 * 4 + 68
    // numbers < 65k are 256 -> 30 * 4 + 2 * 68
    // For signature array length and baseGasEstimate we already calculated the 0 bytes so we just add 64 for each non-zero byte
    let signatureCost = signatureCount * (68 + 2176 + 2176 + 6000) // (array count (3 -> r, s, v) + ecrecover costs) * signature count
    let payload = safe.contract.methods.execTransaction(
        to, value, data, operation, txGasEstimate, utils.Address0, GAS_PRICE, gasToken, refundReceiver, "0x"
    ).encodeABI()
    let baseGasEstimate = calcDataGasCosts(payload) + signatureCost + (nonce > 0 ? 5000 : 20000)
    baseGasEstimate += 1500 // 1500 -> hash generation costs
    baseGasEstimate += 1000 // 1000 -> Event emission
    return baseGasEstimate + 32000; // Add additional gas costs (e.g. base tx costs, transfer costs)
}

let executeTransactionWithSigner = async function(signer, safe, subject, accounts, to, value, data, operation, executor, opts) {
    let options = opts || {}
    let txFailed = options.fails || false
    let txGasToken = options.gasToken || utils.Address0
    let refundReceiver = options.refundReceiver || utils.Address0
    let extraGas = options.extraGas || 0
    let executorValue = options.value || 0

    // Estimate safe transaction (need to be called with from set to the safe address)
    let txGasEstimate = 0
    let estimateData = safe.contract.methods.requiredTxGas(to, value, data, operation).encodeABI()
    try {
        let estimateResponse = await web3.eth.call({
            to: safe.address, 
            from: safe.address, 
            data: estimateData,
            gasPrice: 0
        })
        txGasEstimate = new BigNumber(estimateResponse.substring(138), 16)
        // Add 10k else we will fail in case of nested calls
        txGasEstimate = txGasEstimate.toNumber() + 10000
        console.log("    Tx Gas estimate: " + txGasEstimate)
    } catch(e) {
        console.log("    Could not estimate " + subject + "; cause: " + e)
    }
    let nonce = await safe.nonce()

    let baseGasEstimate = estimateBaseGas(safe, to, value, data, operation, txGasEstimate, txGasToken, refundReceiver, accounts.length, nonce) + extraGas
    console.log("    Base Gas estimate: " + baseGasEstimate)

    if (txGasEstimate > 0) {
        let estimateDataGasCosts = calcDataGasCosts(estimateData)
        let additionalGas = 10000
        // To check if the transaction is successful with the given safeTxGas we try to set a gasLimit so that only safeTxGas is available,
        // when `execute` is triggered in `requiredTxGas`. If the response is `0x` then the inner transaction reverted and we need to increase the amount.
        for (let i = 0; i < 100; i++) {
            try {
                let estimateResponse = await web3.eth.call({
                    to: safe.address, 
                    from: safe.address, 
                    data: estimateData, 
                    gasPrice: 0, 
                    gasLimit: txGasEstimate + estimateDataGasCosts + 21000 // We add 21k for base tx costs
                })
                if (estimateResponse != "0x") break
            } catch(e) {
                console.log("    Could simulate " + subject + "; cause: " + e)
            }
            txGasEstimate += additionalGas
            additionalGas *= 2
        }    
    }
    let gasPrice = GAS_PRICE
    if (txGasToken != utils.Address0) {
        gasPrice = 1
    }
    gasPrice = options.gasPrice || gasPrice

    let sigs = await signer(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)

    let payload = safe.contract.methods.execTransaction(
        to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs
    ).encodeABI()

    console.log("    Data costs: " + calcDataGasCosts(payload))
    console.log("    Tx Gas estimate: " + txGasEstimate)
    // Estimate gas of paying transaction
    let estimate = null
    try {
        estimate = await safe.execTransaction.estimateGas(
            to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs, {
                from: executor,
                value: executorValue,
                gasPrice: options.txGasPrice || gasPrice
        })
    } catch (e) {
        console.log("    Estimation error")
        if (options.revertMessage == undefined ||options.revertMessage == null) {
            throw e
        }
        assert.equal(e.message, ("Returned error: VM Exception while processing transaction: revert " + options.revertMessage).trim())
        return null
    }

    if (estimate < txGasEstimate) {
        const block = await web3.eth.getBlock("latest")
        estimate = block.gasLimit - 10000
    }
    console.log("    GasLimit estimation:", (estimate + 10000))

    // Execute paying transaction
    // We add the txGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
    let tx = await safe.execTransaction(
        to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, sigs, {
            from: executor,
            value: executorValue,
            gas: estimate + 10000,
            gasPrice: options.txGasPrice || gasPrice
        }
    )
    let eventName = (txFailed) ? 'ExecutionFailure' : 'ExecutionSuccess'
    let event = utils.checkTxEvent(tx, eventName, safe.address, true, subject)
    let transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
    assert.equal(transactionHash, event.args.txHash)
    if (txGasEstimate > 0) {
        let maxPayment = (baseGasEstimate + txGasEstimate) * gasPrice
        console.log("    User paid", event.args.payment.toString(), "after signing a maximum of", maxPayment)
        assert.ok(maxPayment >= event.args.payment, "Should not pay more than signed")
    } else {
        console.log("    User paid", event.args.payment.toString())
    }
    return tx
}

let executeTransaction = async function(lw, safe, subject, accounts, to, value, data, operation, executor, opts) {
    let signer = async function(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce) {
        let transactionHash = await safe.getTransactionHash(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
        // Confirm transaction with signed messages
        return utils.signTransaction(lw, accounts, transactionHash)
    }
    return executeTransactionWithSigner(signer, safe, subject, accounts, to, value, data, operation, executor, opts)
}

let deployToken = async function(deployer) {
    return deployContract(deployer, `contract TestToken {
        mapping (address => uint) public balances;
        constructor() {
            balances[msg.sender] = 1000000000000;
        }

        function mint(address to, uint value) public returns (bool) {
            balances[to] += value;
            return true;
        }

        function transfer(address to, uint value) public returns (bool) {
            if (balances[msg.sender] < value) {
                return false;
            }
            balances[msg.sender] -= value;
            balances[to] += value;
            return true;
        }
    }`)
}

let deployContract = async function(deployer, source) {
    let output = await utils.compile(source)
    let contractInterface = output.interface
    let contractBytecode = output.data
    let transaction = await web3.eth.sendTransaction({from: deployer, data: contractBytecode, gas: 6000000})
    let receipt = await web3.eth.getTransactionReceipt(transaction.transactionHash)
    return new web3.eth.Contract(contractInterface, receipt.contractAddress)
}

Object.assign(exports, {
    estimateBaseGas,
    executeTransaction,
    executeTransactionWithSigner,
    deployToken,
    deployContract
})
