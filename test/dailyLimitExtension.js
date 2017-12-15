const utils = require('./utils')
const solc = require('solc')
const GnosisSafeFactory = artifacts.require("./GnosisSafeFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const DailyLimitExtension = artifacts.require("./DailyLimitExtension.sol");
const DailyLimitExtensionFactory = artifacts.require("./DailyLimitExtensionFactory.sol");


contract('DailyLimitExtension', function(accounts) {

    let gnosisSafe
    let gnosisSafeFactory
    let lw
    let data
    let transactionHash
    let dailyLimitExtension

    const CALL = 0
    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
    })

    it('should create Gnosis Safe and Daily Limit Extension in one transaction', async () => {
        // Gnosis Safe factory
        gnosisSafeFactory = await GnosisSafeFactory.new()
        // Create daily limit exception
        dailyLimitExtensionFactory = await DailyLimitExtensionFactory.new()
        // Create Gnosis Safe with Daily Limit Extension
        let extensionData = await dailyLimitExtensionFactory.contract.createDailyLimitExtension.getData(gnosisSafeFactory.address, [0], [100])
        gnosisSafe = utils.getParamFromTxEvent(
            await gnosisSafeFactory.createGnosisSafe([accounts[0]], 1, dailyLimitExtensionFactory.address, extensionData),
            'gnosisSafe', GnosisSafe, 'GnosisSafeCreation', 'Create Gnosis Safe and Daily Limit Extension'
        )
        extensions = await gnosisSafe.getExtensions()
        assert.equal(extensions.length, 1)
        dailyLimitExtension = DailyLimitExtension.at(extensions[0])
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        utils.logGasUsage(
            'executeExtension withdraw daily limit',
            await gnosisSafe.executeExtension(
                accounts[0], 50, 0, CALL, dailyLimitExtension.address, {from: accounts[0]}
            )
        )
        utils.logGasUsage(
            'executeExtension withdraw daily limit 2nd time',
            await gnosisSafe.executeExtension(
                accounts[0], 50, 0, CALL, dailyLimitExtension.address, {from: accounts[0]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 100);
        // Third withdrawal will fail
        await utils.assertRejects(
            gnosisSafe.executeExtension(
                accounts[0], 50, 0, CALL, dailyLimitExtension.address, {from: accounts[0]}
            ),
            "Daily limit exceeded"
        )
    })

    it('should change Daily limit', async () => {
        // Gnosis Safe factory
        gnosisSafeFactory = await GnosisSafeFactory.new()
        // Create daily limit exception
        dailyLimitExtensionFactory = await DailyLimitExtensionFactory.new()
        // Create Gnosis Safe with Daily Limit Extension
        let extensionData = await dailyLimitExtensionFactory.contract.createDailyLimitExtension.getData(gnosisSafeFactory.address, [0], [200])
        gnosisSafe = utils.getParamFromTxEvent(
            await gnosisSafeFactory.createGnosisSafe([lw.accounts[0], lw.accounts[1]], 2, dailyLimitExtensionFactory.address, extensionData),
            'gnosisSafe', GnosisSafe, 'GnosisSafeCreation', 'Create Gnosis Safe and Daily Limit Extension'
        )
        extensions = await gnosisSafe.getExtensions()
        assert.equal(extensions.length, 1)
        dailyLimitExtension = DailyLimitExtension.at(extensions[0])
        assert.equal(await dailyLimitExtension.gnosisSafe(), gnosisSafe.address)
        // Change daily limit
        let dailyLimit = await dailyLimitExtension.dailyLimits(0)
        assert.equal(dailyLimit[0], 200);
        data = await dailyLimitExtension.contract.changeDailyLimit.getData(0, 100)
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(dailyLimitExtension.address, 0, data, CALL, nonce)
        //Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction change daily limit',
            await gnosisSafe.executeTransaction(
                dailyLimitExtension.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        dailyLimit = await dailyLimitExtension.dailyLimits(0)
        assert.equal(dailyLimit[0], 100);
    })

    it('should withdraw daily limit for an ERC20 token', async () => {
        // Create fake token
        let source = `
        contract TestToken {
            mapping (address => uint) public balances;
            function TestToken() {
                balances[msg.sender] = 100;
            }
            function transfer(address to, uint value) public returns (bool) {
                balances[msg.sender] -= value;
                balances[to] += value;
            }
        }`
        let output = await solc.compile(source, 0);
        // Create test token contract
        let contractInterface = JSON.parse(output.contracts[':TestToken']['interface'])
        let contractBytecode = '0x' + output.contracts[':TestToken']['bytecode']
        transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestToken = web3.eth.contract(contractInterface)
        let testToken = TestToken.at(receipt.contractAddress)
        // Gnosis Safe factory
        gnosisSafeFactory = await GnosisSafeFactory.new()
        // Create daily limit exception
        dailyLimitExtensionFactory = await DailyLimitExtensionFactory.new()
        // Create Gnosis Safe with Daily Limit Extension
        let extensionData = await dailyLimitExtensionFactory.contract.createDailyLimitExtension.getData(gnosisSafeFactory.address, [testToken.address], [20])
        gnosisSafe = utils.getParamFromTxEvent(
            await gnosisSafeFactory.createGnosisSafe([accounts[0]], 1, dailyLimitExtensionFactory.address, extensionData),
            'gnosisSafe', GnosisSafe, 'GnosisSafeCreation', 'Create Gnosis Safe and Daily Limit Extension'
        )
        extensions = await gnosisSafe.getExtensions()
        assert.equal(extensions.length, 1)
        dailyLimitExtension = DailyLimitExtension.at(extensions[0])
        // Transfer 100 tokens to Safe
        assert.equal(await testToken.balances(gnosisSafe.address), 0);
        await testToken.transfer(gnosisSafe.address, 100, {from: accounts[0]})
        assert.equal(await testToken.balances(gnosisSafe.address), 100);
        // Withdraw daily limit
        data = await testToken.transfer.getData(accounts[0], 10)
        utils.logGasUsage(
            'executeExtension withdraw daily limit for ERC20 token',
            await gnosisSafe.executeExtension(
                testToken.address, 0, data, CALL, dailyLimitExtension.address, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 90);
        assert.equal(await testToken.balances(accounts[0]), 10);
        utils.logGasUsage(
            'executeExtension withdraw daily limit for ERC20 token',
            await gnosisSafe.executeExtension(
                testToken.address, 0, data, CALL, dailyLimitExtension.address, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);
        // Third withdrawal will fail
        await utils.assertRejects(
            gnosisSafe.executeExtension(testToken.address, 0, data, CALL, dailyLimitExtension.address, {from: accounts[0]}),
            "Daily limit exceeded for ERC20 token"
        )
        // Balances didn't change
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);
    })
});
