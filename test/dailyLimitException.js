const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const DailyLimitException = artifacts.require("./DailyLimitException.sol");

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let dailyLimitException

    const CALL = 0

    it('should create a new Safe with daily limit exception and withdraw daily limit in Ether', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create daily limit exception
        dailyLimitException = await DailyLimitException.new(gnosisSafe.address, [0], [200])
        // Add exception to wallet
        data = await gnosisSafe.contract.addException.getData(dailyLimitException.address)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]})
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        utils.logGasUsage(
            'executeException withdraw daily limit',
            await gnosisSafe.executeException(
                accounts[0], 100, 0, CALL, dailyLimitException.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 100);
        utils.logGasUsage(
            'executeException 2nd withdraw daily limit',
            await gnosisSafe.executeException(
                accounts[0], 100, 0, CALL, dailyLimitException.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 200);
        // Third withdrawal will fail
        await utils.assertRejects(
            gnosisSafe.executeException(accounts[0], 200, 0, CALL, dailyLimitException.address, {from: accounts[1]}),
            "Daily limit exceeded"
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 200);
    })

    it('should create a new Safe with daily limit exception and withdraw daily limit for an ERC20 token', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
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
        // Transfer 100 tokens to Safe
        assert.equal(await testToken.balances(gnosisSafe.address), 0);
        await testToken.transfer(gnosisSafe.address, 100, {from: accounts[0]})
        assert.equal(await testToken.balances(gnosisSafe.address), 100);
        // Create daily limit exception
        dailyLimitException = await DailyLimitException.new(gnosisSafe.address, [testToken.address], [20])
        // Add exception to wallet
        data = await gnosisSafe.contract.addException.getData(dailyLimitException.address)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]})
        // Withdraw daily limit
        data = await testToken.transfer.getData(accounts[0], 10)
        utils.logGasUsage(
            'executeException withdraw daily limit for ERC20 token',
            await gnosisSafe.executeException(
                testToken.address, 0, data, CALL, dailyLimitException.address, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 90);
        assert.equal(await testToken.balances(accounts[0]), 10);
        utils.logGasUsage(
            'executeException withdraw daily limit for ERC20 token',
            await gnosisSafe.executeException(
                testToken.address, 0, data, CALL, dailyLimitException.address, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);
        // Third withdrawal will fail
        await utils.assertRejects(
            gnosisSafe.executeException(testToken.address, 0, data, CALL, dailyLimitException.address, {from: accounts[0]}),
            "Daily limit exceeded for ERC20 token"
        )
        // Balances didn't change
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);
    })

    it('should create a new Safe with daily limit exception and change the daily limit', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create daily limit exception
        dailyLimitException = await DailyLimitException.new(gnosisSafe.address, [0], [200])
        // Add exception to wallet
        data = await gnosisSafe.contract.addException.getData(dailyLimitException.address)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]})
        let dailyLimit = await dailyLimitException.dailyLimits(0)
        assert.equal(dailyLimit[0], 200);
        // Change daily limit
        data = await dailyLimitException.contract.changeDailyLimit.getData(0, 100)
        transactionHash = await gnosisSafe.getTransactionHash(dailyLimitException.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(dailyLimitException.address, 0, data, CALL, 0, {from: accounts[1]})
        dailyLimit = await dailyLimitException.dailyLimits(0)
        assert.equal(dailyLimit[0], 100);
    })
});
