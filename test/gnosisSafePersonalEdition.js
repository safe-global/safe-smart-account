const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const Battery = artifacts.require("./libraries/Battery.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")
const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}])


contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let multiSend
    let battery
    let lw
    let tw = TransactionWrapper.at(1)

    const CALL = 0
    const CREATE = 2

    let buildMultiSend = async function(target, value) {
      let nonce = await gnosisSafe.nonce()
      let transactionHash = await gnosisSafe.getExecuteHash.call(target, value, 0, CALL, nonce)
      // Confirm transaction with signed messages
      let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
      let executeData = gnosisSafe.contract.executeTransaction.getData(target, value, 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)

      let estimate = await gnosisSafe.executeTransaction.estimateGas(target, value, 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
      let batteryData = battery.contract.discharge.getData(estimate / 15000)

      let payAndExecuteTransactionData = '0x' +
        tw.send.getData(battery.address, 0, batteryData).substr(10) +
        tw.send.getData(gnosisSafe.address, 0, executeData).substr(10)

      utils.logGasUsage(
          'executeTransaction withdraw ' + value + ' ETH to ' + target,
          await multiSend.multiSend(payAndExecuteTransactionData)
      )
    }

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
        multiSend = await MultiSend.new()
        battery = await Battery.new()
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getExecuteHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH',
            await gnosisSafe.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getExecuteHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH 2nd time',
            await gnosisSafe.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
    })

    it('should deposit and withdraw 1 ETH with Battery', async () => {
        utils.logGasUsage(
          'charge battery',
          await battery.charge(100)
        )
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        await buildMultiSend(accounts[0], web3.toWei(0.5, 'ether'))
        await buildMultiSend(accounts[0], web3.toWei(0.5, 'ether'))
    })

    it('should deposit and withdraw 1 ETH paying the executor', async () => {
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        let price = 7515400000000000 // Hardcoded for now

        // Withdraw 0.5 ETH
        let executorBalance = await web3.eth.getBalance(accounts[9]).toNumber()
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getPayAndExecuteHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        let success = utils.getParamFromTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, sigs.sigV, sigs.sigR, sigs.sigS
            ),
            'ExecutedTransaction', 'success', gnosisSafe.address, null, 'executed transaction',
        )
        assert.ok(success)
        assert.equal(await web3.eth.getBalance(accounts[9]).toNumber(), executorBalance + price)

        // Withdraw 0.5 ETH
        executorBalance = await web3.eth.getBalance(accounts[9]).toNumber()
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getPayAndExecuteHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        success = utils.getParamFromTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, sigs.sigV, sigs.sigR, sigs.sigS
            ),
            'ExecutedTransaction', 'success', gnosisSafe.address, null, 'executed transaction',
        )
        assert.ok(success)
        //assert.equal(await web3.eth.getBalance(accounts[9]).toNumber(), executorBalance + price)

        // Withdraw 0.5 ETH -> transaction should fail, but fees should be paid
        executorBalance = await web3.eth.getBalance(accounts[9]).toNumber()
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getPayAndExecuteHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        success = utils.getParamFromTxEvent(
            await gnosisSafe.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[9], price, sigs.sigV, sigs.sigR, sigs.sigS
            ),
            'ExecutedTransaction', 'success', gnosisSafe.address, null, 'executed transaction',
        )
        assert.ok(!success)
        //assert.equal(await web3.eth.getBalance(accounts[9]).toNumber(), executorBalance + price)
    })

    it('should add, remove and replace an owner and update the threshold', async () => {
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.threshold(), 2)
        let data = await gnosisSafe.contract.addOwner.getData(accounts[1], 3)
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getExecuteHash(gnosisSafe.address, 0, data, CALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction add owner and update threshold',
            await gnosisSafe.executeTransaction(
                gnosisSafe.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[1]])
        assert.equal(await gnosisSafe.threshold(), 3)
        // Replace owner and keep threshold
        data = await gnosisSafe.contract.replaceOwner.getData(2, lw.accounts[2], lw.accounts[3])
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getExecuteHash(gnosisSafe.address, 0, data, CALL, nonce)
        // Confirm transaction with signed message from lw account 0
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[2]], transactionHash)
        utils.logGasUsage(
            'executeTransaction replace owner',
            await gnosisSafe.executeTransaction(
                gnosisSafe.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[3], accounts[1]])
        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.removeOwner.getData(2, lw.accounts[3], 2)
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getExecuteHash(gnosisSafe.address, 0, data, CALL, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[3]], transactionHash)
        utils.logGasUsage(
            'executeTransaction remove owner and update threshold',
            await gnosisSafe.executeTransaction(
                gnosisSafe.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], accounts[1]])
    })

    it('should do a CREATE transaction', async () => {
        // Create test contract
        let source = `
        contract Test {
            function x() pure returns (uint) {
                return 21;
            }
        }`
        let output = await solc.compile(source, 0);
        let interface = JSON.parse(output.contracts[':Test']['interface'])
        let bytecode = '0x' + output.contracts[':Test']['bytecode']
        let data = bytecode
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getExecuteHash(0, 0, data, CREATE, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        const TestContract = web3.eth.contract(interface);
        let testContract = utils.getParamFromTxEvent(
            await gnosisSafe.executeTransaction(
                0, 0, data, CREATE, sigs.sigV, sigs.sigR, sigs.sigS
            ),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE'
        )
        assert.equal(await testContract.x(), 21)
    })
})
