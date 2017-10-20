const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const WhitelistException = artifacts.require("./WhitelistException.sol");
const WhitelistExceptionFactory = artifacts.require("./WhitelistExceptionFactory.sol");

contract('WhitelistException', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let whitelistException

    const CALL = 0
    const DELEGATECALL = 1

    it('should create a new Safe with whitelist exception and execute a withdraw transaction to a whitelisted account', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        whitelistExceptionFactory = await WhitelistExceptionFactory.new()
        // Add exception to wallet
        data = await whitelistExceptionFactory.contract.create.getData([accounts[3]])
        transactionHash = await gnosisSafe.getTransactionHash(whitelistExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(whitelistExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        whitelistException = WhitelistException.at(exceptions[0])
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

    it('should create a new Safe with whitelist exception and add and remove an account from the whitelist', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        whitelistExceptionFactory = await WhitelistExceptionFactory.new()
        // Add exception to wallet
        data = await whitelistExceptionFactory.contract.create.getData([])
        transactionHash = await gnosisSafe.getTransactionHash(whitelistExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(whitelistExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        whitelistException = WhitelistException.at(exceptions[0])
        assert.equal(await whitelistException.isWhitelisted(accounts[3]), false)
        // Add account 3 to whitelist
        data = await whitelistException.contract.addToWhitelist.getData(accounts[3])
        transactionHash = await gnosisSafe.getTransactionHash(whitelistException.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(whitelistException.address, 0, data, CALL, 0, {from: accounts[1]})
        assert.equal(await whitelistException.isWhitelisted(accounts[3]), true)
        // Remove account 3 from whitelist
        data = await whitelistException.contract.removeFromWhitelist.getData(accounts[3])
        transactionHash = await gnosisSafe.getTransactionHash(whitelistException.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(whitelistException.address, 0, data, CALL, 0, {from: accounts[1]})
        assert.equal(await whitelistException.isWhitelisted(accounts[3]), false)
    })
});
