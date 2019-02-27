const utils = require('./utils/general')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const Proxy = artifacts.require("./Proxy.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const StateChannelModule = artifacts.require("./modules/StateChannelModule.sol");
const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"operation","type":"uint8"},{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
        

contract('MultiSend', function(accounts) {

    let gnosisSafe
    let multiSend
    let createAndAddModules
    let proxyFactory
    let stateChannelModuleMasterCopy
    let lw
    let tw = TransactionWrapper.at(1)

    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        gnosisSafe = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0)
        multiSend = await MultiSend.new()
        createAndAddModules = await CreateAndAddModules.new()

        proxyFactory = await ProxyFactory.new()
        stateChannelModuleMasterCopy = await StateChannelModule.new()
    })

    it('should deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        // Threshold is 1 after deployment
        assert.equal(await gnosisSafe.getThreshold(), 1)
        // No modules present after deployment
        assert.deepEqual(await gnosisSafe.getModules(), [])
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        let nonce = await gnosisSafe.nonce()
        
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        let nestedTransactionData = '0x' +
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) +
            tw.send.getData(0, gnosisSafe.address, 0, changeData).substr(10) +
            tw.send.getData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(1, createAndAddModules.address, 0, createAndAddModulesData).substr(10) +
            tw.send.getData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x').substr(10) +
            tw.send.getData(0, accounts[2], web3.toWei(1, 'ether'), '0x').substr(10)
        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'execTransaction send multiple transactions',
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let modules = await gnosisSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await Proxy.at(modules[0]).implementation.call(), stateChannelModuleMasterCopy.address)
    })

    it('invalid operation should fail', async () => {
    
        let nonce = await gnosisSafe.nonce()
        
        let nestedTransactionData = '0x' +
            tw.send.getData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10)

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailed', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
    })

    it('single fail should fail all', async () => {
        assert.equal(await gnosisSafe.getThreshold(), 1)
    
        let nonce = await gnosisSafe.nonce()

        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)
        
        let nestedTransactionData = '0x' +
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) +
            tw.send.getData(0, gnosisSafe.address, 0, changeData).substr(10) +
            tw.send.getData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10) + // Failing transaction
            tw.send.getData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)).substr(10)

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailed', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
        assert.equal(await gnosisSafe.getThreshold(), 1)
    })
})
