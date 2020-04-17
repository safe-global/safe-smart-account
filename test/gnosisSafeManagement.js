const utils = require('./utils/general')
const safeUtils = require('./utils/execution')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")

contract('GnosisSafe owner and module management', function(accounts) {

    let gnosisSafe
    let gnosisSafeMasterCopy
    let lw
    let executor = accounts[8]

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    const formatAddress = (address) => web3.utils.toChecksumAddress(address)

    const formatAddresses = (addressArray) => addressArray.map((o) => web3.utils.toChecksumAddress(o))

    it('should add, remove and replace an owner and update the threshold and emit events', async () => {
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let data = await gnosisSafe.contract.methods.addOwnerWithThreshold(accounts[1], 3).encodeABI()
        let addTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'add owner and set threshold to 3', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(addTx, 'AddedOwner', gnosisSafe.address, true).args.owner, formatAddress(accounts[1]))
        assert.equal(utils.checkTxEvent(addTx, 'ChangedThreshold', gnosisSafe.address, true).args.threshold.toNumber(), 3)
        assert.deepEqual(await gnosisSafe.getOwners(), formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[2]]))
        assert.equal(await gnosisSafe.getThreshold(), 3)

        // Replace owner and keep threshold
        data = await gnosisSafe.contract.methods.swapOwner(lw.accounts[1], lw.accounts[2], lw.accounts[3]).encodeABI()
        let swapTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'replace owner', [lw.accounts[0], lw.accounts[1], lw.accounts[2]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(swapTx, 'RemovedOwner', gnosisSafe.address, true).args.owner, formatAddress(lw.accounts[2]))
        assert.equal(utils.checkTxEvent(swapTx, 'AddedOwner', gnosisSafe.address, true).args.owner, formatAddress(lw.accounts[3]))
        assert.deepEqual(await gnosisSafe.getOwners(), formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[3]]))

        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.methods.removeOwner(lw.accounts[1], lw.accounts[3], 2).encodeABI()
        let removeTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'remove owner and reduce threshold to 2', [lw.accounts[0], lw.accounts[1], lw.accounts[3]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(removeTx, 'RemovedOwner', gnosisSafe.address, true).args.owner, formatAddress(lw.accounts[3]))
        assert.equal(utils.checkTxEvent(removeTx, 'ChangedThreshold', gnosisSafe.address, true).args.threshold.toNumber(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1]]))
        assert.equal(await gnosisSafe.getThreshold(), 2)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should update the master copy and emit events', async () => {
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

	    // Check that the current address is pointing to the master copy
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, 0), gnosisSafeMasterCopy.address.toLowerCase())

        // We deploy a new master copy
        let newMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)

        let data = await gnosisSafe.contract.methods.changeMasterCopy(newMasterCopy.address).encodeABI()
        let updateTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'update master copy', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(updateTx, 'ChangedMasterCopy', gnosisSafe.address, true).args.masterCopy, newMasterCopy.address)
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, 0), newMasterCopy.address.toLowerCase())
    })


    it('should not be able to add/remove/replace invalid owners', async () => {
        let zeroAcc = "0x0000000000000000000000000000000000000000"
        let sentinel = "0x0000000000000000000000000000000000000001"
        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)
        // Check initial state
        assert.equal(await gnosisSafe.getThreshold(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), formatAddresses([lw.accounts[0], lw.accounts[1], lw.accounts[2]]))

        // Invalid owner additions
        let data = await gnosisSafe.contract.methods.addOwnerWithThreshold(zeroAcc, 3).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.addOwnerWithThreshold(sentinel, 3).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid owner replacements
        data = await gnosisSafe.contract.methods.swapOwner(sentinel, accounts[0], accounts[1]).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace non-owner', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.swapOwner(lw.accounts[2], sentinel, accounts[1]).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.swapOwner(accounts[1], zeroAcc, accounts[2]).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'replace with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid owner removals
        data = await gnosisSafe.contract.methods.removeOwner(sentinel, accounts[0], 1).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove non-owner', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.removeOwner(lw.accounts[2], sentinel, 1).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.removeOwner(accounts[1], zeroAcc, 1).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check that initial state still applies
        assert.equal(await gnosisSafe.getThreshold(), 2)
        assert.deepEqual(await gnosisSafe.getOwners(), formatAddresses([lw.accounts[0], lw.accounts[1], lw.accounts[2]]))
    })

    it('should not be able to add/remove invalid modules', async () => {
        let zeroAcc = "0x0000000000000000000000000000000000000000"
        let sentinel = "0x0000000000000000000000000000000000000001"

        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        // Add random account as module
        let randomModule = accounts[6]
        let data = await gnosisSafe.contract.methods.enableModule(randomModule).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)

        // Check initial state
        assert.deepEqual(await gnosisSafe.getModules(), formatAddresses([randomModule]))

        // Invalid module additions
        data = await gnosisSafe.contract.methods.enableModule(zeroAcc).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.enableModule(sentinel).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'add sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        // Invalid module removals
        data = await gnosisSafe.contract.methods.disableModule(sentinel, accounts[0]).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove non-module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.disableModule(randomModule, sentinel).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove sentinel', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        data = await gnosisSafe.contract.methods.disableModule(accounts[1], zeroAcc).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'remove with zero account', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor, { fails: true})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check that initial state still applies
        assert.deepEqual(await gnosisSafe.getModules(), formatAddresses([accounts[6]]))
    })

    it('should emit events for modules', async () => {
        let sentinel = "0x0000000000000000000000000000000000000001"

        // Fund account for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        // Add random account as module
        let randomModule = accounts[6]
        let data = await gnosisSafe.contract.methods.enableModule(randomModule).encodeABI()
        let enableTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'enable random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(enableTx, 'EnabledModule', gnosisSafe.address, true).args.module, formatAddress(randomModule))

        // Check state
        assert.deepEqual(await gnosisSafe.getModules(), formatAddresses([randomModule]))

        data = await gnosisSafe.contract.methods.disableModule(sentinel, randomModule).encodeABI()
        let disableTx = await safeUtils.executeTransaction(lw, gnosisSafe, 'disable random module', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL, executor)
        assert.equal(utils.checkTxEvent(disableTx, 'DisabledModule', gnosisSafe.address, true).args.module, formatAddress(randomModule))

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)

        // Check final state
        assert.deepEqual(await gnosisSafe.getModules(), [])
    })

    it('sentinels should not be owners or modules', async () => {
        let sentinel = "0x0000000000000000000000000000000000000001"

        assert.equal(await gnosisSafe.isOwner(sentinel), false)

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
