const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const RevokeConfirmationException = artifacts.require("./RevokeConfirmationException.sol");
const RevokeConfirmationExceptionFactory = artifacts.require("./RevokeConfirmationExceptionFactory.sol");

contract('RevokeConfirmationException', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let revokeConfirmationException

    const CALL = 0
    const DELEGATECALL = 1

    it.only('should create a new Safe and add revoke confirmation exception in one transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create daily limit exception
        revokeConfirmationExceptionFactory = await RevokeConfirmationExceptionFactory.new()
        // Add exception to wallet
        data = await revokeConfirmationExceptionFactory.contract.create.getData()
        transactionHash = await gnosisSafe.getTransactionHash(revokeConfirmationExceptionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(revokeConfirmationExceptionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        exceptions = await gnosisSafe.getExceptions()
        assert.equal(exceptions.length, 1)
        revokeConfirmationException = RevokeConfirmationException.at(exceptions[0])
        // Confirm transaction
        transactionHash = '0xf886dc769ec7d83a00b8647920917cf4b932fbb8c6fd59bf6da7d18ee84d2447'
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 1)
        // Revoke confirmation
        data = await revokeConfirmationException.contract.revokeConfirmation.getData(transactionHash)
        utils.logGasUsage(
            'executeException revoke confirmation',
            await gnosisSafe.executeException(
                revokeConfirmationException.address, 0, data, DELEGATECALL, revokeConfirmationException.address, {from: accounts[0]}
            )
        )
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 0)
    })
});
