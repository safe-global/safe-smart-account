const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const util = require("ethereumjs-util")
const abi = require("ethereumjs-abi")

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const StateChannelModule = artifacts.require("./modules/StateChannelModule.sol")


contract('MultiSend', function(accounts) {

    let gnosisSafe
    let gnosisSafeMasterCopy
    let multiSend
    let createAndAddModules
    let proxyFactory
    let stateChannelModuleMasterCopy

    const DELEGATECALL = 1

    let encodeData = function(operation, to, value, data) {
        let dataBuffer = Buffer.from(util.stripHexPrefix(data), "hex")
        let encoded = abi.solidityPack(["uint8", "address", "uint256", "uint256", "bytes"], [operation, to, value, dataBuffer.length, dataBuffer])
        return encoded.toString("hex")
    }

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        proxyFactory = await ProxyFactory.new()
        gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 1, 0, 0, 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
        multiSend = await MultiSend.new()
        createAndAddModules = await CreateAndAddModules.new()

        stateChannelModuleMasterCopy = await StateChannelModule.new()
    })

    it('should deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        // Threshold is 1 after deployment
        assert.equal(await gnosisSafe.getThreshold(), 1)
        // No modules present after deployment
        assert.deepEqual(await gnosisSafe.getModules(), [])
        // Deposit 2 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        let nonce = await gnosisSafe.nonce()

        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        let nestedTransactionData = '0x' +
            encodeData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)) +
            encodeData(0, gnosisSafe.address, 0, changeData) +
            encodeData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x') +
            encodeData(1, createAndAddModules.address, 0, createAndAddModulesData) +
            encodeData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x') +
            encodeData(0, accounts[2], web3.toWei(1, 'ether'), '0x')
        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'execTransaction send multiple transactions',
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let modules = await gnosisSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await web3.eth.getStorageAt(modules[0], 0), stateChannelModuleMasterCopy.address)
    })

    it('Use multisend on deployment', async () => {
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        let newSafeAddress = "0x" + util.generateAddress(proxyFactory.address, await web3.eth.getTransactionCount(proxyFactory.address)).toString("hex")
        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: newSafeAddress, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(newSafeAddress), web3.toWei(2, 'ether'))
        let nestedTransactionData = '0x' +
            encodeData(0, newSafeAddress, 0, '0x' + '0'.repeat(64)) +
            encodeData(0, newSafeAddress, 0, changeData) +
            encodeData(0, accounts[0], web3.toWei(0.5, 'ether'), '0x') +
            encodeData(1, createAndAddModules.address, 0, createAndAddModulesData) +
            encodeData(0, accounts[1], web3.toWei(0.5, 'ether'), '0x') +
            encodeData(0, accounts[2], web3.toWei(1, 'ether'), '0x')
        let multiSendData = await multiSend.contract.multiSend.getData(nestedTransactionData)

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafe.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 1, multiSend.address, multiSendData, 0, 0, 0, 0)
        let newSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        assert.equal(newSafe.address, newSafeAddress)
        assert.equal(await web3.eth.getBalance(newSafeAddress), 0)
        assert.equal(await newSafe.getThreshold(), 2)
        let modules = await newSafe.getModules()
        assert.equal(modules.length, 1)
        assert.equal(await web3.eth.getStorageAt(modules[0], 0), stateChannelModuleMasterCopy.address)
        let scModule = StateChannelModule.at(modules[0])
        assert.equal(await scModule.manager(), newSafeAddress)
    })

    it('invalid operation should fail', async () => {

        let nonce = await gnosisSafe.nonce()

        let nestedTransactionData = '0x' +
            encodeData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64))

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        let event = utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailure', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
        assert.equal(0, event.args.payment)
    })

    it('single fail should fail all', async () => {
        assert.equal(await gnosisSafe.getThreshold(), 1)

        let nonce = await gnosisSafe.nonce()

        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)

        let nestedTransactionData = '0x' +
            encodeData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64)) +
            encodeData(0, gnosisSafe.address, 0, changeData) +
            encodeData(2, gnosisSafe.address, 0, '0x' + '0'.repeat(64)) + // Failing transaction
            encodeData(0, gnosisSafe.address, 0, '0x' + '0'.repeat(64))

        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        let event = utils.checkTxEvent(
            await gnosisSafe.execTransaction(
                multiSend.address, 0, data, DELEGATECALL, 0, 0, 0, 0, 0, sigs
            ),
            'ExecutionFailure', gnosisSafe.address, true, 'execTransaction send multiple transactions'
        )
        assert.equal(0, event.args.payment)
        assert.equal(await gnosisSafe.getThreshold(), 1)
    })

    it('should enforce delegatecall to MultiSend', async () => {
        let source = `
        contract Test {
            function killme() public {
                selfdestruct(msg.sender);
            }
        }`
        let killLib = await safeUtils.deployContract(accounts[0], source);

        let nestedTransactionData = '0x' + encodeData(1, killLib.address, 0, await killLib.killme.getData())
        
        let multiSendCode = await web3.eth.getCode(multiSend.address)
        await utils.assertRejects(
            multiSend.multiSend(nestedTransactionData),
            "Call to MultiSend should fail"
        )
        assert.equal(multiSendCode, await web3.eth.getCode(multiSend.address))
    })
})
