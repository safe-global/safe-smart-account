const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const BigNumber = require('bignumber.js')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')

contract('GnosisSafe owner and module management', function(accounts) {

    let gnosisSafe
    let gnosisSafeMasterCopy
    let lw
    let executor = accounts[8]

    const CALL = 0
    const CREATE = 2

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should add, remove and replace an owner and update the threshold and emit events', async () => {
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let data = await gnosisSafe.contract.addOwnerWithThreshold.getData(accounts[1], 3)
        let addTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'add owner and set threshold to 3', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(addTx, 'AddedOwner', gnosisSafe.address, true).args.owner, accounts[1])
        assert.equal(utils.checkTxEvent(addTx, 'ChangedThreshold', gnosisSafe.address, true).args.threshold.toNumber(), 3)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[2]])
        assert.equal(await gnosisSafe.getThreshold(), 3)

        // Replace owner and keep threshold
        data = await gnosisSafe.contract.swapOwner.getData(lw.accounts[1], lw.accounts[2], lw.accounts[3])
        let swapTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'replace owner', [lw.accounts[0], lw.accounts[1], lw.accounts[2]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(swapTx, 'RemovedOwner', gnosisSafe.address, true).args.owner, lw.accounts[2])
        assert.equal(utils.checkTxEvent(swapTx, 'AddedOwner', gnosisSafe.address, true).args.owner, lw.accounts[3])
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[3]])

        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.removeOwner.getData(lw.accounts[1], lw.accounts[3], 2)
        let removeTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'remove owner and reduce threshold to 2', [lw.accounts[0], lw.accounts[1], lw.accounts[3]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(removeTx, 'RemovedOwner', gnosisSafe.address, true).args.owner, lw.accounts[3])
        assert.equal(utils.checkTxEvent(removeTx, 'ChangedThreshold', gnosisSafe.address, true).args.threshold.toNumber(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[1], lw.accounts[0], lw.accounts[1]])
        assert.equal(await gnosisSafe.getThreshold(), 2)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should update the master copy and emit events', async () => {
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

	    // Check that the current address is pointing to the master copy
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, 0), gnosisSafeMasterCopy.address)

        // We deploy a new master copy
        let newMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)

        let data = await gnosisSafe.contract.changeMasterCopy.getData(newMasterCopy.address)
        let updateTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'update master copy', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(updateTx, 'ChangedMasterCopy', gnosisSafe.address, true).args.masterCopy, newMasterCopy.address)
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, 0), newMasterCopy.address)
    })


    it('should not be able to add/remove/replace invalid owners', async () => {
        let zeroAcc = "0x0000000000000000000000000000000000000000"
        let sentinel = "0x0000000000000000000000000000000000000001"
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Check initial state
        assert.equal(await gnosisSafe.getThreshold(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]])

        // Invalid owner additions
        let data = await gnosisSafe.contract.addOwnerWithThreshold.getData(zeroAcc, 3)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.addOwnerWithThreshold.getData(sentinel, 3)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid owner replacements
        data = await gnosisSafe.contract.swapOwner.getData(sentinel, accounts[0], accounts[1])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace non-owner', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.swapOwner.getData(lw.accounts[2], sentinel, accounts[1])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.swapOwner.getData(accounts[1], zeroAcc, accounts[2])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid owner removals
        data = await gnosisSafe.contract.removeOwner.getData(sentinel, accounts[0], 1)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove non-owner', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.removeOwner.getData(lw.accounts[2], sentinel, 1)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.removeOwner.getData(accounts[1], zeroAcc, 1)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check that initial state still applies
        assert.equal(await gnosisSafe.getThreshold(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]])
    })

    it('should not be able to add/remove invalid modules', async () => {
        let zeroAcc = "0x0000000000000000000000000000000000000000"
        let sentinel = "0x0000000000000000000000000000000000000001"

        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        // Add random account as module
        let randomModule = accounts[6]
        let data = await gnosisSafe.contract.enableModule.getData(randomModule)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)

        // Check initial state
        assert.deepEqual(await gnosisSafe.getModules(), [randomModule])

        // Invalid module additions
        data = await gnosisSafe.contract.enableModule.getData(zeroAcc)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.enableModule.getData(sentinel)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid module removals
        data = await gnosisSafe.contract.disableModule.getData(sentinel, accounts[0])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove non-module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.disableModule.getData(randomModule, sentinel)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.disableModule.getData(accounts[1], zeroAcc)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check that initial state still applies
        assert.deepEqual(await gnosisSafe.getModules(), [accounts[6]])
    })

    it('should emit events for modules', async () => {
        let sentinel = "0x0000000000000000000000000000000000000001"

        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        // Add random account as module
        let randomModule = accounts[6]
        let data = await gnosisSafe.contract.enableModule.getData(randomModule)
        let enableTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'enable random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(enableTx, 'EnabledModule', gnosisSafe.address, true).args.module, randomModule)

        // Check state
        assert.deepEqual(await gnosisSafe.getModules(), [randomModule])

        data = await gnosisSafe.contract.disableModule.getData(sentinel, randomModule)
        let disableTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'disable random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(disableTx, 'DisabledModule', gnosisSafe.address, true).args.module, randomModule)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check final state
        assert.deepEqual(await gnosisSafe.getModules(), [])
    })

    it('sentinels should not be owners or modules', async () => {

        assert.equal(await gnosisSafe.isOwner("0x1"), false)

        let sig = "0x" + "0000000000000000000000000000000000000000000000000000000000000001" + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
        await utils.assertRejects(
            gnosisSafe.execTransaction.estimateGas("0x1", 0, "0x", 0, 0, 0, 0, 0, 0, sig, { from: "0x0000000000000000000000000000000000000001"} ),
            "Should not be able to execute transaction from sentinel as owner"
        )

        await utils.assertRejects(
            gnosisSafe.execTransactionFromModule.estimateGas("0x1", 0, "0x", 0, { from: "0x0000000000000000000000000000000000000001"} ),
            "Should not be able to execute transaction from sentinel as module"
        )
    })
})
