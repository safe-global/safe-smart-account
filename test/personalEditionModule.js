const utils = require('./utils')
const solc = require('solc')

const ModuleManager = artifacts.require("./ModuleManager.sol");
const CreateAndAddModule = artifacts.require("./libraries/CreateAndAddModule.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const PersonalEditionModule = artifacts.require("./modules/PersonalEditionModule.sol");


contract('PersonalEditionModule', function(accounts) {

    let moduleManager
    let testModule
    let lw

    const CALL = 0
    const CREATE = 2

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModule = await CreateAndAddModule.new()
        let moduleManagerMasterCopy = await ModuleManager.new()
        let moduleMasterCopy = await PersonalEditionModule.new()
        // Initialize master copies
        moduleMasterCopy.setup([accounts[0]], 1)
        // Create Gnosis Safe and Daily Limit Module in one transactions
        let moduleData = await moduleMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(moduleMasterCopy.address, moduleData)
        let createAndAddModuleData = createAndAddModule.contract.createAndAddModule.getData(proxyFactory.address, proxyFactoryData)
        let moduleManagerData = await moduleManagerMasterCopy.contract.setupModules.getData(createAndAddModule.address, createAndAddModuleData)
        let tx = await proxyFactory.createProxy(moduleManagerMasterCopy.address, moduleManagerData)
        moduleManager = utils.getParamFromTxEvent(
            tx,
            'ProxyCreation', 'proxy', proxyFactory.address, ModuleManager, 'create Gnosis Safe and Personal Edition Module',
        )
        let modules = await moduleManager.getModules()
        testModule = PersonalEditionModule.at(modules[0])
        assert.equal(await testModule.manager.call(), moduleManager.address)
        assert.equal(await testModule.threshold(), 2)
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(moduleManager.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: moduleManager.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(moduleManager.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        let nonce = await testModule.nonce()
        let transactionHash = await testModule.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH',
            await testModule.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH 2nd time',
            await testModule.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await web3.eth.getBalance(moduleManager.address).toNumber(), 0)
    })

    it('should deposit and withdraw 1 ETH and remove an owner, paying the executor', async () => {
        let executor = accounts[8]
        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(moduleManager.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: moduleManager.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(moduleManager.address).toNumber(), web3.toWei(1.1, 'ether'))

        // Withdraw 0.5 ETH
        let nonce = await testModule.nonce()
        let transactionHash = await testModule.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        // Estimating twice will allow us to get the correct gas price (we could probably also just increase the passed estimate)
        // With the double stimate the balance of the executor after all transactions will be the same as before all transactions
        let estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await testModule.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', testModule.address, false, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        // Withdraw 0.5 ETH
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await testModule.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', testModule.address, false, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        // Withdraw 0.5 ETH -> transaction should fail, but fees should be paid
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await testModule.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', testModule.address, true, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        let data = await testModule.contract.removeOwner.getData(2, lw.accounts[2], 2)
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(testModule.address, 0, data, CALL, 0, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            testModule.address, 0, data, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await testModule.payAndExecuteTransaction.estimateGas(
            testModule.address, 0, data, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await testModule.payAndExecuteTransaction(
                testModule.address, 0, data, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', testModule.address, false, 'remove owner transaction'
        )
        assert.deepEqual(await testModule.getOwners(), [lw.accounts[0], lw.accounts[1]])
        assert.equal(await testModule.threshold(), 2)
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)
    })

    it('should add, remove and replace an owner and update the threshold', async () => {
        await web3.eth.sendTransaction({from: accounts[0], to: moduleManager.address, value: web3.toWei(1.1, 'ether')})
        // Add owner and set threshold to 3
        assert.equal(await testModule.threshold(), 2)
        let data = await testModule.contract.addOwner.getData(accounts[1], 3)
        let nonce = await testModule.nonce()
        let transactionHash = await testModule.getTransactionHash(testModule.address, 0, data, CALL, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction add owner and update threshold',
            await testModule.executeTransaction(
                testModule.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await testModule.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[1]])
        assert.equal(await testModule.threshold(), 3)
        // Replace owner and keep threshold
        data = await testModule.contract.replaceOwner.getData(2, lw.accounts[2], lw.accounts[3])
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(testModule.address, 0, data, CALL, 0, nonce)
        // Confirm transaction with signed message from lw account 0
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[2]], transactionHash)
        utils.logGasUsage(
            'executeTransaction replace owner',
            await testModule.executeTransaction(
                testModule.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await testModule.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[3], accounts[1]])
        // Remove owner and reduce threshold to 2
        data = await testModule.contract.removeOwner.getData(2, lw.accounts[3], 2)
        nonce = await testModule.nonce()
        transactionHash = await testModule.getTransactionHash(testModule.address, 0, data, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[3]], transactionHash)
        utils.logGasUsage(
            'executeTransaction remove owner and update threshold',
            await testModule.executeTransaction(
                testModule.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await testModule.getOwners(), [lw.accounts[0], lw.accounts[1], accounts[1]])
    })

    it('should do a CREATE transaction', async () => {
        // We gonna hack the decoding of events here for now
        testModule.contract.allEvents = moduleManager.contract.allEvents
        // Create test contract
        let source = `
        contract Test {
            function x() pure returns (uint) {
                return 21;
            }
        }`
        let output = await solc.compile(source, 0);
        let interface = JSON.parse(output.contracts[':Test']['interface'])
        let bytecode = '0x' + output.contracts[':Test']['bytecode']
        let data = bytecode
        let nonce = await testModule.nonce()
        let transactionHash = await testModule.getTransactionHash(0, 0, data, CREATE, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        const TestContract = web3.eth.contract(interface);
        let tx = await testModule.executeTransaction(
            0, 0, data, CREATE, sigs.sigV, sigs.sigR, sigs.sigS
        )
        let testContract = utils.getParamFromTxEventWithAdditionalDefinitions(
            // We need to tell web3 how to parse the ContractCreation event from the module manager
            moduleManager.contract.allEvents(),
            tx,
            'ContractCreation', 'newContract', moduleManager.address, TestContract, 'executeTransaction CREATE'
        )
        assert.equal(await testContract.x(), 21)
    })
});
