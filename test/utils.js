const util = require('util');
const lightwallet = require('eth-lightwallet')

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

function logGasUsage(subject, transaction) {
    console.log("    Gas costs for " + subject + ": " + transaction.receipt.gasUsed)
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
    let accountsWithout0x = keystore.getAddresses()
    let lightwalletAccounts = accountsWithout0x.map((a) => { return '0x' + a })
    return {
        keystore: keystore,
        accounts: lightwalletAccounts,
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
    getParamFromTxEvent,
    logGasUsage,
    createLightwallet,
    signTransaction,
    assertRejects
})
