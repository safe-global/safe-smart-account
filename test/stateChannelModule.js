const utils = require('./utils/general')

const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const StateChannelModule = artifacts.require("./modules/StateChannelModule.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol") 

contract('StateChannelModule', function(accounts) {

    let gnosisSafe
    let stateChannelModule
    let lw
    let executor = accounts[8]

    const CALL = 0

    let executeTransaction = async function(subject, accounts, to, value, data, operation, failing) {
        failing = failing || false
        let nonce = utils.currentTimeNs()
        let transactionHash = await stateChannelModule.getTransactionHash(to, value, data, operation, nonce)

        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, accounts, transactionHash)
        
        // Execute paying transaction
        // We add the minGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
        let tx = stateChannelModule.execTransaction(
            to, value, data, operation, nonce, sigs, {from: executor}
        )

        let res
        if (failing) {
            res = await utils.assertRejects(
                tx,
                subject
            )
        } else {
            res = await tx
            utils.logGasUsage(subject, res)
        }
        
        return res
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create libraries
        let createAndAddModules = await CreateAndAddModules.new()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        let stateChannelModuleMasterCopy = await StateChannelModule.new()

        // State channel module setup
        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.methods.setup().encodeABI()
        let stateChannelCreationData = await proxyFactory.contract.methods.createProxy(stateChannelModuleMasterCopy.address, stateChannelSetupData).encodeABI()

        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.methods.createAndAddModules(proxyFactory.address, modulesCreationData).encodeABI()

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, createAndAddModules.address, createAndAddModulesData, utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
        let modules = await gnosisSafe.getModules()
        stateChannelModule = await StateChannelModule.at(modules[0])
        assert.equal(await stateChannelModule.manager.call(), gnosisSafe.address)
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution 
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether'))
        // Should fail because there are not enough funds
        await executeTransaction('executeTransaction withdraw 2 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("2", 'ether'), "0x", CALL, true)

        // Withdraw 1 ETH
        await executeTransaction('executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL)

        await executeTransaction('executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL)

        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("0", 'ether'))
    })

    it('should add, remove and replace an owner and update the threshold', async () => {
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let data = await gnosisSafe.contract.methods.addOwnerWithThreshold(accounts[1], 3).encodeABI()
        await executeTransaction('add owner and set threshold to 3', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), utils.formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[2]]))
        assert.equal(await gnosisSafe.getThreshold(), 3)

        // Replace owner and keep threshold
        data = await gnosisSafe.contract.methods.swapOwner(lw.accounts[1], lw.accounts[2], lw.accounts[3]).encodeABI()
        await executeTransaction('replace owner', [lw.accounts[0], lw.accounts[1], lw.accounts[2]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), utils.formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1], lw.accounts[3]]))

        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.methods.removeOwner(lw.accounts[1], lw.accounts[3], 2).encodeABI()
        await executeTransaction('remove owner and reduce threshold to 2', [lw.accounts[0], lw.accounts[1], lw.accounts[3]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), utils.formatAddresses([accounts[1], lw.accounts[0], lw.accounts[1]]))
        assert.equal(await gnosisSafe.getThreshold(), 2)
    })
})
