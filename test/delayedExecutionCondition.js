const utils = require('./utils')
const { wait } = require('@digix/tempo')(web3)

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const DelayedExecutionCondition = artifacts.require("./DelayedExecutionCondition.sol");
const DelayedExecutionConditionFactory = artifacts.require("./DelayedExecutionConditionFactory.sol");

contract('DelayedExecutionCondition', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let delayedExecutionCondition

    const CALL = 0
    const DELEGATECALL = 1

    it.only('should create a new Safe with delayed execution condition and depoist and withdraw 1 ETH', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create whitelist exception
        delayedExecutionConditionFactory = await DelayedExecutionConditionFactory.new()
        let delay = 100
        data = await delayedExecutionConditionFactory.contract.create.getData(delay)
        transactionHash = await gnosisSafe.getTransactionHash(delayedExecutionConditionFactory.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        await gnosisSafe.confirmAndExecuteTransaction(delayedExecutionConditionFactory.address, 0, data, DELEGATECALL, 0, {from: accounts[1]})
        delayedExecutionCondition = DelayedExecutionCondition.at(await gnosisSafe.condition())
        assert.equal(gnosisSafe.address, await delayedExecutionCondition.gnosisSafe())
        // Change delay
        delay_2 = 200
        data = await delayedExecutionCondition.contract.changeDelay.getData(delay_2)
        transactionHash = await gnosisSafe.getTransactionHash(delayedExecutionCondition.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[1]})
        // Confirm and execute transaction with account 1
        await utils.assertRejects(
            gnosisSafe.executeTransaction(delayedExecutionCondition.address, 0, data, CALL, 0, {from: accounts[1]}),
            "Waiting time is not over"
        )
        await delayedExecutionCondition.submitTransaction(transactionHash)
        await wait(delay + 1)
        await gnosisSafe.executeTransaction(delayedExecutionCondition.address, 0, data, CALL, 0, {from: accounts[1]})
        assert.equal(await delayedExecutionCondition.delay(), delay_2)
    })
});
