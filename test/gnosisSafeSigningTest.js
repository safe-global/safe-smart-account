const util = require('util');
const lightwallet = require('eth-lightwallet')
const fs = require('fs')
const randomBuffer = require("random-buffer")
const ethUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

async function createLightwallet() {
    // Create lightwallet accounts
    const createVault = util.promisify(lightwallet.keystore.createVault).bind(lightwallet.keystore)
    const keystore = await createVault({
        hdPathString: "m/44'/60'/0'/0",
        seedPhrase: "angle tackle horror tomato pizza stool abandon light photo can seek cash",
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

contract('GnosisSafePersonalEdition', function(accounts) {

    it('Generate signed transaction request', async () => {
        let lw = await createLightwallet()
        assert.equal(lw.accounts[0], "0x05c85Ab5B09Eb8A55020d72daf6091E04e264af9".toLowerCase())
        let transactionHash = "0x255ed2f7cbd18dfdccbd729cf78297c1bd2943cd62c16bcacefb4c792d082322"
        let sig = lightwallet.signing.signMsgHash(lw.keystore, lw.passwords, transactionHash, lw.accounts[0])
        console.log("r: " + sig.r.toString("hex"))
        console.log("s: " + sig.s.toString("hex"))
        console.log("v: " + sig.v)
    })
})
