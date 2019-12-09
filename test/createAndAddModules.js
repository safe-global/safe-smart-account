const utils = require('./utils/general')

const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");
const DailyLimitModule = artifacts.require("./DailyLimitModule.sol");
const StateChannelModule = artifacts.require("./modules/StateChannelModule.sol");


contract('CreateAndAddModules', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const DELEGATE_CALL = 1

    it('should create safe with multiple modules', async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create libraries
        let createAndAddModules = await CreateAndAddModules.new()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        let stateChannelModuleMasterCopy = await StateChannelModule.new()
        stateChannelModuleMasterCopy.setup()
        let socialRecoveryModuleMasterCopy = await SocialRecoveryModule.new()
        socialRecoveryModuleMasterCopy.setup([accounts[0], accounts[1]], 2)
        let dailyLimitModuleMasterCopy = await DailyLimitModule.new()
        dailyLimitModuleMasterCopy.setup([], [])

        // Create module data
        let recoverySetupData = await socialRecoveryModuleMasterCopy.contract.setup.getData([accounts[2], accounts[3]], 2)
        let recoveryCreationData = await proxyFactory.contract.createProxy.getData(socialRecoveryModuleMasterCopy.address, recoverySetupData)
        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.setup.getData()
        let stateChannelCreationData = await proxyFactory.contract.createProxy.getData(stateChannelModuleMasterCopy.address, stateChannelSetupData)

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([recoveryCreationData,stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, createAndAddModules.address, createAndAddModulesData, 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        let modules = await gnosisSafe.getModules()
        assert.equal(2, modules.length)

        let dailyLimitSetupData = await dailyLimitModuleMasterCopy.contract.setup.getData([0], [100])
        let dailyLimitCreationData = await proxyFactory.contract.createProxy.getData(dailyLimitModuleMasterCopy.address, dailyLimitSetupData)
        let enableModuleParameterData = utils.createAndAddModulesData([dailyLimitCreationData])
        let enableModuleData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, enableModuleParameterData)

        let to = createAndAddModules.address
        let data = enableModuleData
        let operation = DELEGATE_CALL
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, 0, data, operation, 0, 0, 0, 0, 0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        let tx = await gnosisSafe.execTransaction(to, 0, data, operation, 0, 0, 0, 0, 0, sigs, {from: executor})
        utils.checkTxEvent(tx, 'ExecutionFailed', gnosisSafe.address, false, "create and enable daily limit module")

        modules = await gnosisSafe.getModules()
        assert.equal(3, modules.length)
    })
})
