const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const CreateCall = artifacts.require("./CreateCall.sol")

contract('CreateCall', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]
    let createCall

    const DELEGATECALL = 1

    // Create test contract
    let compileContract
    let TestContract

    const CONTRACT_SOURCE = `
    contract Test {
        constructor() public payable {}

        function x() public pure returns (uint) {
            return 21;
        }
    }`

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Deploy Libraries
        createCall = await CreateCall.new()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        // Test contract
        compileContract = await utils.compile(CONTRACT_SOURCE);
        TestContract = web3.eth.contract(compileContract.interface);
    })

    it('should deploy a contract with create and no value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        let expectedAddress = "0x" + ethUtil.generateAddress(gnosisSafe.address, await web3.eth.getTransactionCount(gnosisSafe.address)).toString("hex")

        let creationData = createCall.contract.performCreate.getData(0, compileContract.data)
        let testContract = utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE with value'
        )

        assert.equal(testContract.address, expectedAddress)
        assert.equal(await testContract.x(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create and value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        let expectedAddress = "0x" + ethUtil.generateAddress(gnosisSafe.address, await web3.eth.getTransactionCount(gnosisSafe.address)).toString("hex")

        let creationData = createCall.contract.performCreate.getData(web3.toWei(1, 'ether'), compileContract.data)
        let testContract = utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE'
        )

        assert.equal(testContract.address, expectedAddress)
        assert.equal(await testContract.x(), 21)
        assert.equal(await web3.eth.getBalance(testContract.address), web3.toWei(1, 'ether'))

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create2 and no value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        let salt = "0x" + abi.rawEncode(['uint256'], [new Date().getTime()]).toString("hex")
        let expectedAddress = "0x" + ethUtil.generateAddress2(gnosisSafe.address, salt, compileContract.data).toString("hex")

        let creationData = createCall.contract.performCreate2.getData(0, compileContract.data, salt)
        let testContract = utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE2'
        )

        assert.equal(testContract.address, expectedAddress)
        assert.equal(await testContract.x(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create2 and value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        let salt = "0x" + abi.rawEncode(['uint256'], [new Date().getTime()]).toString("hex")
        let expectedAddress = "0x" + ethUtil.generateAddress2(gnosisSafe.address, salt, compileContract.data).toString("hex")

        let creationData = createCall.contract.performCreate2.getData(web3.toWei(1, 'ether'), compileContract.data, salt)
        let testContract = utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE2 with value'
        )

        assert.equal(testContract.address, expectedAddress)
        assert.equal(await testContract.x(), 21)
        assert.equal(await web3.eth.getBalance(testContract.address), web3.toWei(1, 'ether'))

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
