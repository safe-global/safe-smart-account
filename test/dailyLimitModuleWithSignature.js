const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol");
const CreateAndAddModule = artifacts.require("./libraries/CreateAndAddModule.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const DailyLimitModuleWithSignature = artifacts.require("./modules/DailyLimitModuleWithSignature.sol");


contract('DailyLimitModuleWithSignature', function(accounts) {

    let gnosisSafe
    let dailyLimitModule
    let lw

    const CALL = 0

    let generateSignature = async function(to, value, data) {
      let nonce = await dailyLimitModule.nonce()
      let transactionHash = await dailyLimitModule.getTransactionHash(to, value, data, nonce)
      return utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModule = await CreateAndAddModule.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, 0)
        let dailyLimitModuleMasterCopy = await DailyLimitModuleWithSignature.new()
        // Initialize module master copy
        dailyLimitModuleMasterCopy.setup([], [])
        // Create Gnosis Safe and Daily Limit Module in one transactions
        let moduleData = await dailyLimitModuleMasterCopy.contract.setup.getData([0], [100])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(dailyLimitModuleMasterCopy.address, moduleData)
        let createAndAddModuleData = createAndAddModule.contract.createAndAddModule.getData(proxyFactory.address, proxyFactoryData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[0]], 2, createAndAddModule.address, createAndAddModuleData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Module',
        )
        let modules = await gnosisSafe.getModules()
        dailyLimitModule = DailyLimitModuleWithSignature.at(modules[0])
        assert.equal(await dailyLimitModule.manager.call(), gnosisSafe.address)
    })

    it('should withdraw daily limit', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        let sigs = await generateSignature(accounts[0], 50, 0)
        utils.logGasUsage(
            'executeModule withdraw daily limit',
            await dailyLimitModule.executeDailyLimitWithSignature(
                accounts[0], 50, 0, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            )
        )

        // Cannot reuse same signature
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimitWithSignature(
                accounts[0], 50, 0, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            ),
            "Invalid signature"
        )

        sigs = await generateSignature(accounts[0], 50, 0)
        utils.logGasUsage(
            'executeModule withdraw daily limit 2nd time',
            await dailyLimitModule.executeDailyLimitWithSignature(
                accounts[0], 50, 0, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 100);

        sigs = await generateSignature(accounts[0], 50, 0)
        // Third withdrawal will fail
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimitWithSignature(
                accounts[0], 50, 0, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
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
        let transactionHash = await gnosisSafe.getTransactionHash(dailyLimitModule.address, 0, data, CALL, 100000, web3.toWei(100, 'gwei'), nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)

        utils.logGasUsage(
            'executeTransaction change daily limit',
            await gnosisSafe.payAndExecuteTransaction(
                dailyLimitModule.address, 0, data, CALL, 100000, web3.toWei(100, 'gwei'), sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        dailyLimit = await dailyLimitModule.dailyLimits(0)
        assert.equal(dailyLimit[0], 200);
    })

    it('should withdraw daily limit for an ERC20 token', async () => {
        // Funds for paying execution
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        // Create fake token
        let source = `
        contract TestToken {
            mapping (address => uint) public balances;
            function TestToken() {
                balances[msg.sender] = 100;
            }
            function transfer(address to, uint value) public returns (bool) {
                balances[msg.sender] -= value;
                balances[to] += value;
            }
        }`
        let output = await solc.compile(source, 0);
        // Create test token contract
        let contractInterface = JSON.parse(output.contracts[':TestToken']['interface'])
        let contractBytecode = '0x' + output.contracts[':TestToken']['bytecode']
        let transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestToken = web3.eth.contract(contractInterface)
        let testToken = TestToken.at(receipt.contractAddress)
        // Add test token to daily limit module
        let data = await dailyLimitModule.contract.changeDailyLimit.getData(testToken.address, 20)
        let nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(dailyLimitModule.address, 0, data, CALL, 100000, web3.toWei(100, 'gwei'), nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        await gnosisSafe.payAndExecuteTransaction(dailyLimitModule.address, 0, data, CALL, 100000, web3.toWei(100, 'gwei'), sigs.sigV, sigs.sigR, sigs.sigS)
        // Transfer 100 tokens to Safe
        assert.equal(await testToken.balances(gnosisSafe.address), 0);
        await testToken.transfer(gnosisSafe.address, 100, {from: accounts[0]})
        assert.equal(await testToken.balances(gnosisSafe.address), 100);
        // Withdraw daily limit
        data = await testToken.transfer.getData(accounts[0], 10)

        // First withdrawal
        sigs = await generateSignature(testToken.address, 0, data)
        utils.logGasUsage(
            'executeModule withdraw daily limit for ERC20 token',
            await dailyLimitModule.executeDailyLimitWithSignature(
                testToken.address, 0, data, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 90);
        assert.equal(await testToken.balances(accounts[0]), 10);

        // Cannot reuse same signature
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimitWithSignature(
                testToken.address, 0, data, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            ),
            "Invalid signature"
        )

        // Second withdrawal
        sigs = await generateSignature(testToken.address, 0, data)
        utils.logGasUsage(
            'executeModule withdraw daily limit for ERC20 token 2nd time',
            await dailyLimitModule.executeDailyLimitWithSignature(
                testToken.address, 0, data, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}
            )
        )
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);

        // Third withdrawal will fail
        sigs = await generateSignature(testToken.address, 0, data)
        await utils.assertRejects(
            dailyLimitModule.executeDailyLimitWithSignature(testToken.address, 0, data, sigs.sigV[0], sigs.sigR[0], sigs.sigS[0], {from: accounts[9]}),
            "Daily limit exceeded for ERC20 token"
        )
        // Balances didn't change
        assert.equal(await testToken.balances(gnosisSafe.address), 80);
        assert.equal(await testToken.balances(accounts[0]), 20);
    })
});
