const util = require('util');
const solc = require('solc')
const lightwallet = require('eth-lightwallet')
const abi = require("ethereumjs-abi")

const Address0 = "0x".padEnd(42, '0')

const formatAddress = (address) => web3.utils.toChecksumAddress(address)

const formatAddresses = (addressArray) => addressArray.map((o) => web3.utils.toChecksumAddress(o))

function currentTimeNs() {
    const hrTime=process.hrtime();
    return hrTime[0] * 1000000000 + hrTime[1]
}

function web3ContactFactory(web3Contract) {
    return {
        at: async (address) => {
            assert.ok(address != null, "Address is required to create a contract instance")
            const instance = web3Contract.clone()
            instance.options.address = web3.utils.toChecksumAddress(address)
            return instance
        }
    }
}

function getParamFromTxEventWithAdditionalDefinitions(definitions, transaction, eventName, paramName, contract, contractFactory, subject) {
    transaction.receipt.rawLogs.forEach(event => {
        const definition = definitions[event.topics[0]]
        if (definition) {
            transaction.logs.push({
                ...event,
                event: definition.name,
                args: web3.eth.abi.decodeLog(definition.inputs, event.data, event.topics.slice(1))
            })
        }
    });
    return getParamFromTxEvent(transaction, eventName, paramName, contract, contractFactory, subject)
}

async function getParamFromTxEvent(transaction, eventName, paramName, contract, contractFactory, subject) {
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
        let contract = await contractFactory.at(param)
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
    if (!output['contracts']) {
        console.log(output)
        throw Error("Could not compile contract")
    }
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
    Address0,
    formatAddress,
    formatAddresses,
    web3ContactFactory,
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
