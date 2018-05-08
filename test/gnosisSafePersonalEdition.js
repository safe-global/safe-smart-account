const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")


contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const MAX_GAS_PRICE = web3.toWei(100, 'gwei')

    const CALL = 0
    const CREATE = 2

    let executeTransaction = async function(subject, accounts, to, value, data, operation, fails) {
        let txFailed = fails || false

        // Estimate safe transaction (need to be called with from set to the safe address)
        let minGasEstimate = 0
        try {
            minGasEstimate = await gnosisSafe.estimate.call(to, value, data, operation, {from: gnosisSafe.address, gasPrice: 0})
            // Add 10k else we will fail in case of delegate calls
            minGasEstimate = minGasEstimate.toNumber() + 10000
            console.log("    Min gas estimate: " + minGasEstimate)
        } catch(e) {
            console.log("    Could not estimate " + subject)
        }

        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, minGasEstimate, MAX_GAS_PRICE, nonce)

        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, accounts, transactionHash)

        // Estimate gas of paying transaction
        let estimate = await gnosisSafe.payAndExecuteTransaction.estimateGas(
            to, value, data, operation, minGasEstimate, MAX_GAS_PRICE, sigs.sigV, sigs.sigR, sigs.sigS
        )
        
        // Execute paying transaction
        // We add the minGasEstimate and an additional 10k to the estimate to ensure that there is enough gas for the safe transaction
        let tx = await gnosisSafe.payAndExecuteTransaction(
            to, value, data, operation, minGasEstimate, MAX_GAS_PRICE, sigs.sigV, sigs.sigR, sigs.sigS, {from: executor, gas: estimate + minGasEstimate + 10000}
        )
        utils.checkTxEvent(tx, 'ExecutionFailed', gnosisSafe.address, txFailed, subject)
        return tx
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution 
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        // Withdraw 1 ETH
        await executeTransaction('executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), 0, CALL)

        await executeTransaction('executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), 0, CALL)

        // Should fail as it is over the balance (payment should still happen)
        await executeTransaction('executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, true)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should add, remove and replace an owner and update the threshold', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.threshold(), 2)
        let data = await gnosisSafe.contract.addOwner.getData(accounts[1], 3)
        await executeTransaction('add owner and set threshold to 3', [lw.accounts[0], lw.accounts[1]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[1]])
        assert.equal(await gnosisSafe.threshold(), 3)

        // Replace owner and keep threshold
        data = await gnosisSafe.contract.replaceOwner.getData(2, lw.accounts[2], lw.accounts[3])
        await executeTransaction('replace owner', [lw.accounts[0], lw.accounts[1], lw.accounts[2]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[3], accounts[1]])

        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.removeOwner.getData(2, lw.accounts[3], 2)
        await executeTransaction('remove owner and reduce threshold to 2', [lw.accounts[0], lw.accounts[1], lw.accounts[3]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], accounts[1]])

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should do a CREATE transaction', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Create test contract
        let source = `
        contract Test {
            function x() pure returns (uint) {
                return 21;
            }
        }`
        let output = await solc.compile(source, 0);
        let interface = JSON.parse(output.contracts[':Test']['interface'])
        let data = '0x' + output.contracts[':Test']['bytecode']
        const TestContract = web3.eth.contract(interface);
        let testContract = utils.getParamFromTxEvent(
            await executeTransaction('create test contract', [lw.accounts[0], lw.accounts[1]], 0, 0, data, CREATE),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE'
        )
        assert.equal(await testContract.x(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
