const util = require('util');
const solc = require('solc')
const lightwallet = require('eth-lightwallet')
const abi = require("ethereumjs-abi")
const Web3 = require('web3')
const SolidityEvent = require("web3/lib/web3/event.js");
const ModuleDataWrapper = (new Web3()).eth.contract([{"constant":false,"inputs":[{"name":"data","type":"bytes"}],"name":"setup","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
   
function createAndAddModulesData(dataArray) {
    let mw = ModuleDataWrapper.at(1)
    // Remove method id (10) and position of data in payload (64)
    return dataArray.reduce((acc, data) => acc + mw.setup.getData(data).substr(74), "0x")
}

function currentTimeNs() {
    const hrTime=process.hrtime();
    return hrTime[0] * 1000000000 + hrTime[1]
}

function getParamFromTxEventWithAdditionalDefinitions(definitions, transaction, eventName, paramName, contract, contractFactory, subject) {
    transaction.receipt.logs.forEach(event => {
        const definition = definitions[event.topics[0]]
        if (definition) {
            const eventDef = new SolidityEvent(null, definition, null)
            transaction.logs.push(eventDef.decode(event))
        }
    });
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
  if (subject && subject != null) {
      logGasUsage(subject, transaction)
  }
  let logs = transaction.logs
  if(eventName != null) {
      logs = logs.filter((l) => l.event === eventName && l.address === contract)
  }
  assert.equal(logs.length, exists ? 1 : 0, exists ? 'event was not present' : 'event should not be present')
  return exists ? logs[0] : null
}

function logGasUsage(subject, transactionOrReceipt) {
    let receipt = transactionOrReceipt.receipt || transactionOrReceipt
    console.log("    Gas costs for " + subject + ": " + receipt.gasUsed)
}

async function deployContract(subject, contract) {
    let deployed = await contract.new()
    let receipt = await web3.eth.getTransactionReceipt(deployed.transactionHash)
    logGasUsage(subject, receipt)
    return deployed
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
    let signatureBytes = "0x"
    signers.sort()
    for (var i=0; i<signers.length; i++) {
        let sig = lightwallet.signing.signMsgHash(lw.keystore, lw.passwords, transactionHash, signers[i])
        signatureBytes += sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16)
    }
    return signatureBytes
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
    return res
}

async function getErrorMessage(to, value, data, from) {
    let returnData = await web3.eth.call({to: to, from: from, value: value, data: data})
    let returnBuffer = Buffer.from(returnData.slice(2), "hex")
    return abi.rawDecode(["string"], returnBuffer.slice(4))[0];
}

async function compile(source) {
    var input = JSON.stringify({
        'language': 'Solidity',
        'settings': {
            'outputSelection': {
            '*': {
                '*': [ 'abi', 'evm.bytecode' ]
            }
            }
        },
        'sources': {
            'tmp.sol': {
                'content': source
            }
        }
    });
    let solcData = await solc.compile(input)
    let output = JSON.parse(solcData);
    let fileOutput = output['contracts']['tmp.sol']
    let contractOutput = fileOutput[Object.keys(fileOutput)[0]]
    let interface = contractOutput['abi']
    let data = '0x' + contractOutput['evm']['bytecode']['object']
    return {
        "data": data,
        "interface": interface
    }
}

Object.assign(exports, {
    createAndAddModulesData,
    currentTimeNs,
    compile,
    deployContract,
    getParamFromTxEvent,
    getParamFromTxEventWithAdditionalDefinitions,
    checkTxEvent,
    logGasUsage,
    createLightwallet,
    signTransaction,
    assertRejects,
    getErrorMessage
})
