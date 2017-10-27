const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const SocialRecoveryException = artifacts.require("./SocialRecoveryException.sol");
const SocialRecoveryExceptionFactory = artifacts.require("./SocialRecoveryExceptionFactory.sol");

contract('SocialRecoveryException', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let socialRecoveryException

    const CALL = 0
    const DELEGATECALL = 1

    it('should create a new Safe with social recovery exception and allow to send a transaction apporved by friends', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        socialRecoveryExceptionFactory = await SocialRecoveryExceptionFactory.new()
        friends = [accounts[2], accounts[3]]
        data = await socialRecoveryExceptionFactory.contract.create.getData(friends, 2)
        transactionHash = await gnosisSafe.getTransactionHash(socialRecoveryExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(socialRecoveryExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        socialRecoveryException = SocialRecoveryException.at(exceptions[0])
        // Deposit 0.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0.1, 'ether'));
        // Confirm transaction to be executed without confirmations
        transactionHash = await socialRecoveryException.getTransactionHash(accounts[0], web3.toWei(0.1, 'ether'), 0, CALL)
        await socialRecoveryException.confirmTransaction(transactionHash, {from: accounts[3]})
        // Execution fails, because challenge period is not yet over
        await utils.assertRejects(
            gnosisSafe.executeException(accounts[0], web3.toWei(0.1, 'ether'), 0, CALL, socialRecoveryException.address, {from: accounts[0]}),
            "It was not confirmed by the required number of friends"
        )
        // Confirm with 2nd friend
        await socialRecoveryException.confirmTransaction(transactionHash, {from: accounts[2]})
        await gnosisSafe.executeException(accounts[0], web3.toWei(0.1, 'ether'), 0, CALL, socialRecoveryException.address, {from: accounts[3]})
        // Transaction was executed successfully and money was transferred
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
    })
});
