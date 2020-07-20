const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")
const CreateCall = artifacts.require("./CreateCall.sol")

contract('CreateCall', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]
    let createCall

    const DELEGATECALL = 1

    // Create test contract
    let compileContract
    let testContractFactory

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
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        // Test contract
        compileContract = await utils.compile(CONTRACT_SOURCE);
        testContractFactory = utils.web3ContactFactory(new web3.eth.Contract(compileContract.interface));
    })

    it('should deploy a contract with create and no value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        let expectedAddress = "0x" + ethUtil.generateAddress(gnosisSafe.address, await web3.eth.getTransactionCount(gnosisSafe.address)).toString("hex")

        let creationData = createCall.contract.methods.performCreate(0, compileContract.data).encodeABI()
        let testContract = await utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, testContractFactory, 'executeTransaction CREATE with value'
        )

        assert.equal(testContract.options.address.toLowerCase(), expectedAddress)
        assert.equal(await testContract.methods.x().call(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create and value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        let expectedAddress = "0x" + ethUtil.generateAddress(gnosisSafe.address, await web3.eth.getTransactionCount(gnosisSafe.address)).toString("hex")

        let creationData = createCall.contract.methods.performCreate(web3.utils.toWei("1", 'ether'), compileContract.data).encodeABI()
        let testContract = await utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, testContractFactory, 'executeTransaction CREATE'
        )

        assert.equal(testContract.options.address.toLowerCase(), expectedAddress)
        assert.equal(await testContract.methods.x().call(), 21)
        assert.equal(await web3.eth.getBalance(testContract.options.address), web3.utils.toWei("1", 'ether'))

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create2 and no value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("0.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        let salt = "0x" + abi.rawEncode(['uint256'], [new Date().getTime()]).toString("hex")
        let expectedAddress = "0x" + ethUtil.generateAddress2(gnosisSafe.address, salt, compileContract.data).toString("hex")

        let creationData = createCall.contract.methods.performCreate2(0, compileContract.data, salt).encodeABI()
        let testContract = await utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, testContractFactory, 'executeTransaction CREATE2'
        )

        assert.equal(testContract.options.address.toLowerCase(), expectedAddress)
        assert.equal(await testContract.methods.x().call(), 21)

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })

    it('should deploy a contract with create2 and value', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        let salt = "0x" + abi.rawEncode(['uint256'], [new Date().getTime()]).toString("hex")
        let expectedAddress = "0x" + ethUtil.generateAddress2(gnosisSafe.address, salt, compileContract.data).toString("hex")

        let creationData = createCall.contract.methods.performCreate2(web3.utils.toWei("1", 'ether'), compileContract.data, salt).encodeABI()
        let testContract = await utils.getParamFromTxEventWithAdditionalDefinitions(
            CreateCall.events,
            await safeUtils.executeTransaction(lw, gnosisSafe, 'create test contract', [lw.accounts[0], lw.accounts[1]], createCall.address, 0, creationData, DELEGATECALL, executor, { extraGas: 15000 }),
            'ContractCreation', 'newContract', gnosisSafe.address, testContractFactory, 'executeTransaction CREATE2 with value'
        )

        assert.equal(testContract.options.address.toLowerCase(), expectedAddress)
        assert.equal(await testContract.methods.x().call(), 21)
        assert.equal(await web3.eth.getBalance(testContract.options.address), web3.utils.toWei("1", 'ether'))

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
