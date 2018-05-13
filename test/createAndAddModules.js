const utils = require('./utils')
const safeUtils = require('./utilsPersonalSafe')
const solc = require('solc')

const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");
const DailyLimitModuleWithSignature = artifacts.require("./modules/DailyLimitModuleWithSignature.sol");
const ModuleDataWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"data","type":"bytes"}],"name":"setup","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
    

contract('CreateAndAddModules', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const CALL = 0
    const CREATE = 2

    it('should create safe with multiple modules', async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create libraries
        let createAndAddModules = await CreateAndAddModules.new()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)
        let dailyLimitModuleMasterCopy = await DailyLimitModuleWithSignature.new()
        dailyLimitModuleMasterCopy.setup([], [])
        let socialRecoveryModuleMasterCopy = await SocialRecoveryModule.new()
        socialRecoveryModuleMasterCopy.setup([accounts[0], accounts[1]], 2)

        // Create module data
        let recoverySetupData = await socialRecoveryModuleMasterCopy.contract.setup.getData([accounts[2], accounts[3]], 2)
        let recoveryCreationData = await proxyFactory.contract.createProxy.getData(socialRecoveryModuleMasterCopy.address, recoverySetupData)
        let dailyLimitSetupData = await dailyLimitModuleMasterCopy.contract.setup.getData([0], [100])
        let dailyLimitCreationData = await proxyFactory.contract.createProxy.getData(dailyLimitModuleMasterCopy.address, dailyLimitSetupData)

        // Create library data
        let mw = ModuleDataWrapper.at(1)
        let modulesCreationData = '0x' +
            mw.setup.getData(recoveryCreationData).substr(74) + // Remove method id (10) and position of data in payload (64)
            mw.setup.getData(dailyLimitCreationData).substr(74)
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1], accounts[2]], 2, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )

        let modules = await gnosisSafe.getModules()
        assert.equal(2, modules.length)
    })
})
