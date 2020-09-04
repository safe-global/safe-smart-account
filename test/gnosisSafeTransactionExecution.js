const utils = require('./utils/general')
const safeUtils = require('./utils/execution')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')

contract('GnosisSafe with refunds', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1.1", 'ether'))

        let executorBalance = await web3.eth.getBalance(executor)

        // Withdraw 1 ETH
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        // We check executor balance here, since we should not execute failing transactions
        assert.ok(executorDiff > 0)

        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor)

        executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        // We check executor balance here, since we should not execute failing transactions
        assert.ok(executorDiff > 0)

        // Should fail as it is over the balance (payment should still happen)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, { fails: true})

        // Should work if we send eth along with it
        let receiverBalance = await web3.eth.getBalance(accounts[4])
        let value = web3.utils.toWei("0.5", 'ether')
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction send from executor 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[4], value, "0x", CALL, executor, { value })
        assert.equal(await web3.eth.getBalance(accounts[4]) - receiverBalance, value)

    })

    it('should deposit and withdraw 1 ETH paying with token', async () => {
        let token = await safeUtils.deployToken(accounts[0])
        let executorBalance = await token.methods.balances(executor).call()
        await token.methods.transfer(gnosisSafe.address, 10000000).send({from: accounts[0]})
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether'))
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, {
          gasToken: token.options.address
        })
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, {
          gasToken: token.options.address
        })

        // Should fail as it is over the balance (payment should still happen)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, {
          gasToken: token.options.address, fails: true
        })

        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        let executorDiff = await token.methods.balances(executor).call() - executorBalance
        console.log("    Executor earned " + executorDiff + " Tokens")
        assert.ok(executorDiff > 0)
    })

    it('should only pay for gasprice used, up to specified for ETH', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1.1", 'ether'))

        // Perform transaction to increase nonce before benchmarking fees
        await safeUtils.executeTransaction(lw, gnosisSafe, 'increase nonce', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, executor)

        // Benchmark fees
        let benchmarkExecutor = accounts[7]
        let executorBalance = await web3.eth.getBalance(benchmarkExecutor)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'benchmark fee', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, benchmarkExecutor, {
            gasPrice: 10, // Signed gas price
        })
        let benchmarkedFee = await web3.eth.getBalance(benchmarkExecutor) - executorBalance
        console.log("    Benchmarked transaction fee " + web3.utils.fromWei(benchmarkedFee.toString(), 'ether') + " ETH")

        // Perform with higher signed gas price
        let testExecutor = accounts[6]
        executorBalance = await web3.eth.getBalance(testExecutor)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'execute with lower gas price', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, testExecutor, {
            gasPrice: 100, // Signed gas price
            txGasPrice: 10, // Ethereum tx gas price
        })

        let expectedFee = await web3.eth.getBalance(testExecutor) - executorBalance
        console.log("    Final fee with higher signed price " + web3.utils.fromWei(expectedFee.toString(), 'ether') + " ETH")
        assert.equal(benchmarkedFee, expectedFee)
    })

    it('tx.gasprice should not influence token gas price', async () => {
        let token = await safeUtils.deployToken(accounts[0])
        await token.methods.mint(gnosisSafe.address, 1000000000000).send({from: accounts[0]})

        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1.1", 'ether'))

        // Perform transaction to increase nonce before benchmarking fees
        await safeUtils.executeTransaction(lw, gnosisSafe, 'increase nonce', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, executor, {
            gasToken: token.options.address
        })

        // Benchmark fees
        let executorBalance = await token.methods.balances(executor).call()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'benchmark fee', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, executor, {
            gasToken: token.options.address,
            gasPrice: 10 // Signed gas price
        })
        let benchmarkedFee = await token.methods.balances(executor).call() - executorBalance
        console.log("    Benchmarked transaction fee " + benchmarkedFee + " Tokens")

        // Perform with higher signed gas price
        executorBalance = await token.methods.balances(executor).call()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'execute with lower gas price', [lw.accounts[0], lw.accounts[2]], accounts[0], 0, "0x", CALL, executor, {
            gasToken: token.options.address,
            gasPrice: 10, // Signed gas price
            txGasPrice: 1, // Ethereum tx gas price
        })

        let expectedFee = await token.methods.balances(executor).call() - executorBalance
        console.log("    Final fee with higher signed price " + expectedFee + " Tokens")
        assert.equal(benchmarkedFee, expectedFee)
    })

    it('should fail if overflow in payment', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.6", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("0.6", 'ether'))

        let executorBalance = await web3.eth.getBalance(executor)

        let gasPrice = web3.utils.toBN('2').pow(web3.utils.toBN(256)).div(web3.utils.toBN(65536)).toString(10)

        // Should revert as we have an overflow (no message, as SafeMath doesn't support messages yet)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, { revertMessage: "", gasPrice: gasPrice})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff == 0)
    })

    it('should fail when depositing 0.5 ETH paying with token due to token transfer fail', async () => {
        let mockContract = await MockContract.new()
        let mockToken = await MockToken.at(mockContract.address)
        await mockContract.givenAnyRevert()
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.5", 'ether')})
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer is reverted"
        )

        await mockContract.givenAnyRunOutOfGas()
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer is out of gas"
        )

        await mockContract.givenAnyReturnBool(false)
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer returns false"
        )
        //check if the safe's balance is still 0.5 ETH
        assert.equal(web3.utils.fromWei(await web3.eth.getBalance(gnosisSafe.address), 'ether').toString(), '0.5')

    })
})
