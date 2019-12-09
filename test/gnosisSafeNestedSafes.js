const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const abi = require('ethereumjs-abi')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafe using nested safes', function(accounts) {

    let lw
    let owner1Safe
    let owner2Safe
    let gnosisSafe
    let executor = accounts[8]

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let owner1SafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 2, 0, "0x", 0, 0, 0, 0)
        owner1Safe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, owner1SafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
        let owner2SafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[2], lw.accounts[3]], 2, 0, "0x", 0, 0, 0, 0)
        owner2Safe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, owner2SafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([owner1Safe.address,owner2Safe.address], 2, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should use EIP-1271 (contract signatures)', async () => {
        // Deposit some spare money for execution to owner safes
        assert.equal(await web3.eth.getBalance(owner1Safe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: owner1Safe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal(await web3.eth.getBalance(owner1Safe.address).toNumber(), web3.toWei(0.1, 'ether'))

        assert.equal(await web3.eth.getBalance(owner2Safe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: owner2Safe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal(await web3.eth.getBalance(owner2Safe.address).toNumber(), web3.toWei(0.1, 'ether'))
        
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        let to = accounts[9]
        let value = web3.toWei(1, 'ether')
        let data = "0x"
        let operation = CALL
        
        let sigs = "0x"
        let nonce = await gnosisSafe.nonce()
        let messageData = await gnosisSafe.encodeTransactionData(to, value, data, operation, 0, 0, 0, 0, 0, nonce)

        let signMessageData = owner1Safe.contract.signMessage.getData(messageData)
        // Use on-chain Safe signature
        await safeUtils.executeTransaction(lw, owner1Safe, 'approve transaction signature on contract', [lw.accounts[0], lw.accounts[1]], owner1Safe.address, 0, signMessageData, CALL, executor)

        // Use off-chain Safe signature
        let messageHash = await owner2Safe.getMessageHash(messageData)
        let owner2Sigs = utils.signTransaction(lw, [lw.accounts[2], lw.accounts[3]], messageHash).slice(2)
        let encodedOwner2Signs = abi.rawEncode(['bytes'], [ new Buffer(owner2Sigs, 'hex') ]).toString('hex').slice(64)

        // Pack signatures in correct order
        if (owner1Safe.address < owner2Safe.address) {
            sigs += "000000000000000000000000" + owner1Safe.address.replace('0x', '') + "0000000000000000000000000000000000000000000000000000000000000082" + "00" // r, s, v
            sigs += "000000000000000000000000" + owner2Safe.address.replace('0x', '') + "00000000000000000000000000000000000000000000000000000000000000a2" + "00" // r, s, v
        } else {
            sigs += "000000000000000000000000" + owner2Safe.address.replace('0x', '') + "00000000000000000000000000000000000000000000000000000000000000a2" + "00" // r, s, v
            sigs += "000000000000000000000000" + owner1Safe.address.replace('0x', '') + "0000000000000000000000000000000000000000000000000000000000000082" + "00" // r, s, v
        }

        // Append additional signature data
        sigs += "0000000000000000000000000000000000000000000000000000000000000000" + encodedOwner2Signs

        // Execute Transaction
        let tx = await gnosisSafe.execTransaction(
            to, value, data, operation, 0, 0, 0, 0, 0, sigs, {from: executor}
        )
        utils.checkTxEvent(tx, 'ExecutionFailed', gnosisSafe.address, false, "execute withdrawal")

        // Safe should be empty again
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
    })
})
