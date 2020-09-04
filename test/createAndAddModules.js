const utils = require('./utils/general')

const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")
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
        let recoverySetupData = await socialRecoveryModuleMasterCopy.contract.methods.setup([accounts[2], accounts[3]], 2).encodeABI()
        let recoveryCreationData = await proxyFactory.contract.methods.createProxy(socialRecoveryModuleMasterCopy.address, recoverySetupData).encodeABI()
        let stateChannelSetupData = await stateChannelModuleMasterCopy.contract.methods.setup().encodeABI()
        let stateChannelCreationData = await proxyFactory.contract.methods.createProxy(stateChannelModuleMasterCopy.address, stateChannelSetupData).encodeABI()

        // Create library data
        let modulesCreationData = utils.createAndAddModulesData([recoveryCreationData,stateChannelCreationData])
        let createAndAddModulesData = createAndAddModules.contract.methods.createAndAddModules(proxyFactory.address, modulesCreationData).encodeABI()

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 
            createAndAddModules.address, createAndAddModulesData, 
            utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        let modules = await gnosisSafe.getModules()
        assert.equal(2, modules.length)

        let dailyLimitSetupData = await dailyLimitModuleMasterCopy.contract.methods.setup([utils.Address0], [100]).encodeABI()
        let dailyLimitCreationData = await proxyFactory.contract.methods.createProxy(dailyLimitModuleMasterCopy.address, dailyLimitSetupData).encodeABI()
        let enableModuleParameterData = utils.createAndAddModulesData([dailyLimitCreationData])
        let enableModuleData = createAndAddModules.contract.methods.createAndAddModules(proxyFactory.address, enableModuleParameterData).encodeABI()

        let to = createAndAddModules.address
        let data = enableModuleData
        let operation = DELEGATE_CALL
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, 0, data, operation, 0, 0, 0, utils.Address0, utils.Address0, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        let tx = await gnosisSafe.execTransaction(to, 0, data, operation, 0, 0, 0, utils.Address0, utils.Address0, sigs, {from: executor})
        utils.checkTxEvent(tx, 'ExecutionFailed', gnosisSafe.address, false, "create and enable daily limit module")

        modules = await gnosisSafe.getModules()
        assert.equal(3, modules.length)
    })
})
