const util = require('util');
const lightwallet = require('eth-lightwallet')
const ModuleDataWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"data","type":"bytes"}],"name":"setup","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
   
function createAndAddModulesData(dataArray) {
    let mw = ModuleDataWrapper.at(1)
    // Remove method id (10) and position of data in payload (64)
    return dataArray.reduce((acc, data) => acc + mw.setup.getData(data).substr(74), "0x")
}

function currentTimeNs() {
    const hrTime=process.hrtime();
    return hrTime[0] * 1000000000 + hrTime[1]
}

function dataGasValue(hexValue) {
   switch(hexValue) {
    case "0x": return 0
    case "00": return 4
    default: return 68
  };
}

function estimateDataGasCosts(dataString) {
  const reducer = (accumulator, currentValue) => accumulator += dataGasValue(currentValue)

  return dataString.match(/.{2}/g).reduce(reducer, 0)
}

function getParamFromTxEventWithAdditionalDefinitions(definitions, transaction, eventName, paramName, contract, contractFactory, subject) {
    transaction.logs = transaction.logs.concat(transaction.receipt.logs.map(event => definitions.formatter(event)))
    return getParamFromTxEvent(transaction, eventName, paramName, contract, contractFactory, subject)
}

function getParamFromTxEvent(transaction, eventName, paramName, contract, contractFactory, subject) {
    assert.isObject(transaction)
    if (subject != null) {
        logGasUsage(subject, transaction)
    }
    let logs = transaction.logs
    if(eventName != null) {
        logs = logs.filter((l) => l.event === eventName && l.address === contract)
    }
    assert.equal(logs.length, 1, 'too many logs found!')
    let param = logs[0].args[paramName]
    if(contractFactory != null) {
        let contract = contractFactory.at(param)
        assert.isObject(contract, `getting ${paramName} failed for ${param}`)
        return contract
    } else {
        return param
    }
}

function checkTxEvent(transaction, eventName, contract, exists, subject) {
  assert.isObject(transaction)
  if (subject != null) {
      logGasUsage(subject, transaction)
  }
  let logs = transaction.logs
  if(eventName != null) {
      logs = logs.filter((l) => l.event === eventName && l.address === contract)
  }
  assert.equal(logs.length, exists ? 1 : 0, exists ? 'event was not present' : 'event should not be present')
}

function logGasUsage(subject, transactionOrReceipt) {
    let receipt = transactionOrReceipt.receipt || transactionOrReceipt
    console.log("    Gas costs for " + subject + ": " + receipt.gasUsed)
}

async function createLightwallet() {
    // Create lightwallet accounts
    const createVault = util.promisify(lightwallet.keystore.createVault).bind(lightwallet.keystore)
    const keystore = await createVault({
        hdPathString: "m/44'/60'/0'/0",
        seedPhrase: "pull rent tower word science patrol economy legal yellow kit frequent fat",
        password: "test",
        salt: "testsalt"
    })
    const keyFromPassword = await util.promisify(keystore.keyFromPassword).bind(keystore)("test")
    keystore.generateNewAddress(keyFromPassword, 20)
    return {
        keystore: keystore,
        accounts: keystore.getAddresses(),
        passwords: keyFromPassword
    }
}

function signTransaction(lw, signers, transactionHash) {
    let sigV = []
    let sigR = []
    let sigS = []
    signers.sort()
    for (var i=0; i<signers.length; i++) {
        let sig = lightwallet.signing.signMsgHash(lw.keystore, lw.passwords, transactionHash, signers[i])
        sigV.push(sig.v)
        sigR.push('0x' + sig.r.toString('hex'))
        sigS.push('0x' + sig.s.toString('hex'))
    }
    return {
        sigV: sigV,
        sigR: sigR,
        sigS: sigS
    }
}

async function assertRejects(q, msg) {
    let res, catchFlag = false
    try {
        res = await q
    } catch(e) {
        catchFlag = true
    } finally {
        if(!catchFlag)
            assert.fail(res, null, msg)
    }
}

Object.assign(exports, {
    createAndAddModulesData,
    currentTimeNs,
    getParamFromTxEvent,
    getParamFromTxEventWithAdditionalDefinitions,
    checkTxEvent,
    logGasUsage,
    createLightwallet,
    signTransaction,
    assertRejects,
    estimateDataGasCosts
})
