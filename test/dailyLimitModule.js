const utils = require('./utils/general')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const DailyLimitModule = artifacts.require("./modules/DailyLimitModule.sol");
const MockContract = artifacts.require('./MockContract.sol');
const MockToken = artifacts.require('./Token.sol');


contract('DailyLimitModule', function(accounts) {

    let gnosisSafe
    let dailyLimitModule
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        let dailyLimitModuleMasterCopy = await DailyLimitModule.new()
        // Initialize module master copy
        dailyLimitModuleMasterCopy.setup([], [])
        // Create Gnosis Safe and Daily Limit Module in one transactions
        let moduleData = await dailyLimitModuleMasterCopy.contract.setup.getData([0], [100])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(dailyLimitModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[0]], 2, createAndAddModules.address, createAndAddModulesData, 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Module',
        )
        let modules = await gnosisSafe.getModules()
        dailyLimitModule = DailyLimitModule.at(modules[0])
        assert.equal(await dailyLimitModule.manager.call(), gnosisSafe.address)
    })

    it('should withdraw daily limit', async () => {
        // Withdrawal should fail as there is no ETH in the Safe
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(
                0, accounts[0], 50, {from: accounts[0]}
            ),
            "Not enough funds"
        )
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        utils.logGasUsage(
            'execTransactionFromModule withdraw daily limit',
            await dailyLimitModule.executeDailyLimit(
                0, accounts[0], 50, {from: accounts[0]}
            )
        )
        utils.logGasUsage(
            'execTransactionFromModule withdraw daily limit 2nd time',
            await dailyLimitModule.executeDailyLimit(
                0, accounts[0], 50, {from: accounts[0]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 100);
        // Third withdrawal will fail
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(
                accounts[0], 50, "0x", {from: accounts[0]}
            ),
            "Daily limit exceeded"
        )
    })

    it('should change daily limit', async () => {
        // Funds for paying execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        // Change daily limit
        let dailyLimit = await dailyLimitModule.dailyLimits(0)
        assert.equal(dailyLimit[0], 100);
        let data = await dailyLimitModule.contract.changeDailyLimit.getData(0, 200)

        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(dailyLimitModule.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)

        utils.logGasUsage(
            'execTransaction change daily limit',
            await gnosisSafe.execTransaction(
                dailyLimitModule.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, sigs
            )
        )
        dailyLimit = await dailyLimitModule.dailyLimits(0)
        assert.equal(dailyLimit[0], 200);
    })

    it('should withdraw daily limit for an ERC20 token', async () => {
        // deposit money for execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        // Create fake token
        let source = `
        contract TestToken {
            mapping (address => uint) public balances;
            constructor() public {
                balances[msg.sender] = 100;
            }
            function transfer(address to, uint value) public returns (bool) {
                require(balances[msg.sender] >= value);
                balances[msg.sender] -= value;
                balances[to] += value;
            }
        }`
        let output = await utils.compile(source);
        // Create test token contract
        let contractInterface = output.interface
        let contractBytecode = output.data
        let transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestToken = web3.eth.contract(contractInterface)
        let testToken = TestToken.at(receipt.contractAddress)
        // Add test token to daily limit module
        let data = await dailyLimitModule.contract.changeDailyLimit.getData(testToken.address, 20)
        let nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(dailyLimitModule.address, 0, data, CALL, 100000, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        await gnosisSafe.execTransaction(dailyLimitModule.address, 0, data, CALL, 100000, 0, 0, 0, 0, sigs)

        // Withdrawal should fail as there are no tokens
        assert.equal(await testToken.balances(gnosisSafe.address), 0);
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(testToken.address, accounts[0], 10, {from: accounts[0]}),
            "Not enough funds"
        )

        // Transfer 100 tokens to Safe
        await testToken.transfer(gnosisSafe.address, 100, {from: accounts[0]})
        assert.equal(await testToken.balances(gnosisSafe.address), 100);

        // Withdraw daily limit
        utils.logGasUsage(
            'execTransactionFromModule withdraw daily limit for ERC20 token',
            await dailyLimitModule.executeDailyLimit(
                testToken.address, accounts[0], 10, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 90);
        assert.equal(await testToken.balances(accounts[0]), 10);
        utils.logGasUsage(
            'execTransactionFromModule withdraw daily limit for ERC20 token 2nd time',
            await dailyLimitModule.executeDailyLimit(
                testToken.address, accounts[0], 10, {from: accounts[0]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);


        // Third withdrawal will fail
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(testToken.address, accounts[0], 10, {from: accounts[0]}),
            "Daily limit exceeded for ERC20 token"
        )

        // Balances didn't change
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);

        // Withdrawal should  fail because of ERC20 transfer revert
        let mockContract = await MockContract.new();
        let mockToken = MockToken.at(mockContract.address);
        await mockContract.givenAnyRevert()
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(mockContract.address, accounts[0], 10, {from: accounts[0]}),
            "Transaction should fail if the ERC20 token transfer method reverts"
        );


        // Withdrawal should fail because of ERC20 transfer out of gas
        await mockContract.givenAnyRunOutOfGas();
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(mockContract.address, accounts[0], 10, {from: accounts[0]}),
            "Transaction should fail if the ERC20 token transfer method is out of gas"
        );

        // Withdrawal should fail because of ERC20 transfer returns false
        await mockContract.givenAnyReturnBool(false);
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimit(mockContract.address, accounts[0], 10, {from: accounts[0]}),
            "Transaction should fail if the ERC20 token transfer method returns false"
        );
    });
});
