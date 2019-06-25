const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const BigNumber = require('bignumber.js');

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol');
const MockToken = artifacts.require('./Token.sol');

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const CALL = 0
    const CREATE = 2

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        gnosisSafeMasterCopy.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        // Withdraw 1 ETH
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        // We check executor balance here, since we should not execute failing transactions 
        assert.ok(executorDiff > 0)

        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor)

        executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        // We check executor balance here, since we should not execute failing transactions 
        assert.ok(executorDiff > 0)

        // Should fail as it is over the balance (payment should still happen)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { fails: true})

    });

    it('should deposit and withdraw 1 ETH paying with token', async () => {
        let token = await safeUtils.deployToken(accounts[0]);
        let executorBalance = (await token.balances(executor)).toNumber();
        await token.transfer(gnosisSafe.address, 10000000, {from: accounts[0]});
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, {
          gasToken: token.address
        })
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, {
          gasToken: token.address
        })

        // Should fail as it is over the balance (payment should still happen)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, {
          gasToken: token.address, fails: true
        })

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        let executorDiff = (await token.balances(executor)).toNumber() - executorBalance;
        console.log("    Executor earned " + executorDiff + " Tokens")
        assert.ok(executorDiff > 0);
    });

    it('should fail if overflow in payment', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.6, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0.6, 'ether'))

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        
        let gasPrice = (new BigNumber('2')).pow(256).div(80000)

        // Should revert as we have an overflow (no message, as SafeMath doesn't support messages yet)
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { revertMessage: "", gasPrice: gasPrice})

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff == 0)
    });

    it('should fail when depositing 0.5 ETH paying with token due to token transfer fail', async () => {
        let mockContract = await MockContract.new();
        let mockToken = MockToken.at(mockContract.address);
        await mockContract.givenAnyRevert();
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.5, 'ether')})
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer is reverted"
        );

        await mockContract.givenAnyRunOutOfGas();
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer is out of gas"
        );

        await mockContract.givenAnyReturnBool(false);
        await utils.assertRejects(
            safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { gasToken: mockToken.address }),
            "Transaction should fail if the ERC20 token transfer returns false"
        );
        //check if the safe's balance is still 0.5 ETH
        assert.equal(web3.fromWei(await web3.eth.getBalance(gnosisSafe.address), 'ether').toString(), '0.5');

    });

    it('should do a CREATE transaction', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()
        // Create test contract
        let source = `
        contract Test {
            function x() public pure returns (uint) {
                return 21;
            }
        }`
        let output = await utils.compile(source);
        const TestContract = web3.eth.contract(output.interface);
        let testContract = utils.getParamFromTxEvent(
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], 0, 0, output.data, CREATE, executor),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE'
        )
        assert.equal(await testContract.x(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
