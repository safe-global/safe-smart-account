const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let lw

    const CALL = 0
    const CREATE = 2

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, 0)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0]], 1, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe (Single Owner)',
        )
        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )
    })

    it('should deposit and withdraw 1 ETH and remove an owner, paying the executor', async () => {
        let executor = accounts[8]
        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        // Withdraw 0.5 ETH
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        // Estimating twice will allow us to get the correct gas price (we could probably also just increase the passed estimate)
        // With the double stimate the balance of the executor after all transactions will be the same as before all transactions
        let estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )

        utils.checkTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', gnosisSafe.address, false, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        // Withdraw 0.5 ETH
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', gnosisSafe.address, false, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        // Withdraw 0.5 ETH -> transaction should fail, but fees should be paid
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)

        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        utils.checkTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, 0, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
            ),
            'ExecutionFailed', gnosisSafe.address, true, 'executed transaction'
        )
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)

        let data = await gnosisSafe.contract.removeOwner.getData(2, lw.accounts[2], 2)
        nonce = await gnosisSafe.nonce()
        let executeDataCosts = utils.estimateDataGasCosts(gnosisSafe.contract.estimate.getData(
            gnosisSafe.address, 0, data, CALL, {from: gnosisSafe.address}
        ))
        let executeEstimate = await gnosisSafe.estimate.estimateGas(
            gnosisSafe.address, 0, data, CALL, {from: gnosisSafe.address}
        ) - 21000 - executeDataCosts
        let executeCall = await gnosisSafe.estimate.call(
            gnosisSafe.address, 0, data, CALL, {from: gnosisSafe.address}
        )

        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, executeCall, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        let checkDataCosts = utils.estimateDataGasCosts(gnosisSafe.contract.checkHash.getData(
            transactionHash, sigs.sigV, sigs.sigR, sigs.sigS, {from: executor}
        ))
        let checkEstimate = await gnosisSafe.checkHash.estimateGas(
            transactionHash, sigs.sigV, sigs.sigR, sigs.sigS, {from: executor}
        ) - 21000 - checkDataCosts
        let dataCosts = utils.estimateDataGasCosts(gnosisSafe.contract.payAndExecuteTransaction.getData(
            gnosisSafe.address, 0, data, CALL, executeEstimate, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        ))
        console.log((executeEstimate) + " vs " + executeCall)
        console.log("We calculated: " + (dataCosts + executeEstimate + checkEstimate + 6700 + 3000 + 21000 ))

        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            gnosisSafe.address, 0, data, CALL, executeCall, sigs.sigV, sigs.sigR, sigs.sigS, 1, {from: executor}
        )
        estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            gnosisSafe.address, 0, data, CALL, executeCall, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor}
        )
        let gasLimit = estimate + 50000
        console.log(gasLimit)

        utils.checkTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, executeCall, sigs.sigV, sigs.sigR, sigs.sigS, estimate, {from: executor, gas:gasLimit}
            ),
            'ExecutionFailed', gnosisSafe.address, false, 'remove owner transaction'
        )
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1]])
        assert.equal(await gnosisSafe.threshold(), 2)
        assert.equal(await web3.eth.getBalance(executor).toNumber(), executorBalance)
    })
})
