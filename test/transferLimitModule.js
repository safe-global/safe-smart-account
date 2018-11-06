const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const TransferLimitModule = artifacts.require("./modules/TransferLimitModule.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')


contract('TransferLimitModule without global cap or delegate', (accounts) => {

    let safe
    let module
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, "0x")
        let transferLimitModuleMasterCopy = await TransferLimitModule.new()
        // Initialize module master copy
        //transferLimitModuleMasterCopy.setup([], [], 0, 0, 0, 0, 0, 0)
        // TODO: Instantiate DutchExchange
        let dutchxAddr = accounts[1]
        let moduleData = await transferLimitModuleMasterCopy.contract.setup.getData([0], [100], 60 * 60 * 24, 0, 0, 2, 0, dutchxAddr)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(transferLimitModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]], 3, createAndAddModules.address, createAndAddModulesData)
        safe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Transfer Limit Module',
        )
        let modules = await safe.getModules()
        module = TransferLimitModule.at(modules[0])
        assert.equal(await module.manager.call(), safe.address)
    })

    it('should withdraw transfer limit', async () => {
        let nonce = await module.nonce()
        let txHash = await module.getTransactionHash(0, accounts[0], 50, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], txHash)

        // Withdrawal should fail as there is no ETH in the Safe
        await utils.assertRejects(
            module.executeTransferLimit(
              0, accounts[0], 50,
              0, 0, 0, 0, 0,
              sigs,
              { from: accounts[0] }
            ),
            'Not enough funds'
        )

        // Deposit 1 eth
        await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))

        nonce = await module.nonce()
        txHash = await module.getTransactionHash(0, accounts[0], 50, 0, 0, 0, 0, 0, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], txHash)

        // Withdraw transfer limit
        utils.logGasUsage(
            'executeTransferLimit withdraw transfer limit',
            await module.executeTransferLimit(
              0, accounts[0], 50,
              0, 0, 0, 0, 0,
              sigs,
              { from: accounts[0] }
            )
        )
    })

    it('should withdraw only when authorized', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))

        let nonce = await module.nonce()
        let txHash = await module.getTransactionHash(0, accounts[0], 50, 0, 0, 0, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], txHash)

        // Withdrawal should fail for only one signature
        await utils.assertRejects(
            module.executeTransferLimit(
              0, accounts[0], 50,
              0, 0, 0, 0, 0,
              sigs,
              { from: accounts[0] }
            ),
            'signature threshold not met'
        )

        nonce = await module.nonce()
        txHash = await module.getTransactionHash(0, accounts[0], 50, 0, 0, 0, 0, 0, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], txHash)

        // Withdraw transfer limit
        utils.logGasUsage(
            'executeTransferLimit withdraw transfer limit',
            await module.executeTransferLimit(
              0, accounts[0], 50,
              0, 0, 0, 0, 0,
              sigs,
              { from: accounts[0] }
            )
        )
    })
})
