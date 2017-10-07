const utils = require('./utils')
const { wait } = require('@digix/tempo')(web3)

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const LastResortException = artifacts.require("./LastResortException.sol");
const LastResortExceptionFactory = artifacts.require("./LastResortExceptionFactory.sol");

contract('LastResortException', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let lastResortException

    const CALL = 0
    const DELEGATECALL = 1

    it('should create a new Safe with last resort exception and submit and execute a transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        lastResortExceptionFactory = await LastResortExceptionFactory.new()
        let requiredDeposit = 100
        let challengePeriod = 6000
        data = await lastResortExceptionFactory.contract.create.getData(requiredDeposit, challengePeriod)
        transactionHash = await gnosisSafe.getTransactionHash(lastResortExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(lastResortExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        lastResortException = LastResortException.at(exceptions[0])
        assert.equal(await gnosisSafe.isOwner(lastResortException.address), true)
        // Deposit 0.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0.1, 'ether'));
        // Submit transaction to be executed without confirmations
        transactionHash = await lastResortException.getTransactionHash(accounts[3], web3.toWei(0.1, 'ether'), 0, CALL)
        await lastResortException.submitTransaction(transactionHash, {from: accounts[3], value: 100})
        assert.equal(await lastResortException.submittedTransactionHash(), transactionHash)
        // Execution fails, because challenge period is not yet over
        await utils.assertRejects(
            lastResortException.executeException(accounts[3], web3.toWei(0.1, 'ether'), 0, {from: accounts[3]}),
            "Challenge period is not over yet"
        )
        await wait(challengePeriod + 1)
        await lastResortException.executeException(accounts[3], web3.toWei(0.1, 'ether'), 0, {from: accounts[3]})
        // Transaction was executed successfully and money was transferred
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
    })

    it('should create a new Safe with last resort exception and submit and cancel a transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        lastResortExceptionFactory = await LastResortExceptionFactory.new()
        let requiredDeposit = 100
        let challengePeriod = 6000
        data = await lastResortExceptionFactory.contract.create.getData(requiredDeposit, challengePeriod)
        transactionHash = await gnosisSafe.getTransactionHash(lastResortExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(lastResortExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        lastResortException = LastResortException.at(exceptions[0])
        assert.equal(await gnosisSafe.isOwner(lastResortException.address), true)
        // Deposit 0.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0.1, 'ether'));
        // Submit transaction to be executed without confirmations
        transactionHash = await lastResortException.getTransactionHash(accounts[3], web3.toWei(0.1, 'ether'), 0, CALL)
        await lastResortException.submitTransaction(transactionHash, {from: accounts[3], value: requiredDeposit})
        assert.equal(await lastResortException.submittedTransactionHash(), transactionHash)
        // Execution fails, because challenge period is not yet over
        await utils.assertRejects(
            lastResortException.executeException(accounts[3], web3.toWei(0.1, 'ether'), 0, {from: accounts[3]}),
            "Challenge period is not over yet"
        )
        // Owner cancels transaction
        assert.equal(await web3.eth.getBalance(lastResortException.address).toNumber(), requiredDeposit);
        await lastResortException.cancelTransaction({from: accounts[0]})
        assert.equal(await web3.eth.getBalance(lastResortException.address).toNumber(), 0);
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), parseInt(web3.toWei(0.1, 'ether')) + requiredDeposit);
    })
});
