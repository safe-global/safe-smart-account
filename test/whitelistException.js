const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const DailyLimitException = artifacts.require("./DailyLimitException.sol");
const WhitelistException = artifacts.require("./WhitelistException.sol");

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let dailyLimitException
    let whitelistException

    beforeEach(async () => {
        
    })

    it('should create a new multisig contract with daily limit exception and withdraw daily limit', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create daily limit exception
        dailyLimitException = await DailyLimitException.new(gnosisSafe.address, 200)
        // Add exception to wallet
        data = await gnosisSafe.contract.addException.getData(dailyLimitException.address)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction add exception',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, 0, 0, {from: accounts[1]}
            )
        )
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        utils.logGasUsage(
            'executeException withdraw daily limit',
            await gnosisSafe.executeException(
                accounts[0], 100, 0, 0, dailyLimitException.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 100);
        utils.logGasUsage(
            'executeException 2nd withdraw daily limit',
            await gnosisSafe.executeException(
                accounts[0], 100, 0, 0, dailyLimitException.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 200);
    })

    it('should create a new multisig contract with whitelist exception and whitelisted withdraw', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        whitelistException = await WhitelistException.new(gnosisSafe.address, [accounts[3]])
        // Add exception to wallet
        data = await gnosisSafe.contract.addException.getData(whitelistException.address)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction add exception',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, 0, 0, {from: accounts[1]}
            )
        )
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw to whitelisted account
        utils.logGasUsage(
            'executeException withdraw to whitelisted account',
            await gnosisSafe.executeException(
                accounts[3], 300, 0, 0, whitelistException.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 300);
    })
});
