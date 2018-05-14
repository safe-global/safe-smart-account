const utils = require('./utils')

const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol");
const SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");


contract('SocialRecoveryModule', function(accounts) {

    let gnosisSafe
    let socialRecoveryModule

    const CALL = 0

    beforeEach(async function () {
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0], accounts[1]], 2, 0, 0)
        let socialRecoveryModuleMasterCopy = await SocialRecoveryModule.new()
        // Initialize module master copy
        socialRecoveryModuleMasterCopy.setup([accounts[0], accounts[1]], 2)
        // Create Gnosis Safe and Social Recovery Module in one transactions
        let moduleData = await socialRecoveryModuleMasterCopy.contract.setup.getData([accounts[2], accounts[3]], 2)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(socialRecoveryModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1]], 2, createAndAddModules.address, createAndAddModulesData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Social Recovery Module',
        )
        let modules = await gnosisSafe.getModules()
        socialRecoveryModule = SocialRecoveryModule.at(modules[0])
        assert.equal(await socialRecoveryModule.manager.call(), gnosisSafe.address)
    })

    it('should allow to replace an owner apporved by friends', async () => {
        // Replace owner
        let data = await gnosisSafe.contract.swapOwner.getData("0x1", accounts[0], accounts[9])
        // Confirm transaction to be executed without confirmations
        let dataHash = await socialRecoveryModule.getDataHash(data)
        await socialRecoveryModule.confirmTransaction(dataHash, {from: accounts[3]})
        // Execution fails, because challenge period is not yet over
        await utils.assertRejects(
            socialRecoveryModule.recoverAccess(data, {from: accounts[0]}),
            "It was not confirmed by the required number of friends"
        )
        // Confirm with 2nd friend
        await socialRecoveryModule.confirmTransaction(dataHash, {from: accounts[2]})
        await socialRecoveryModule.recoverAccess(data, {from: accounts[3]})
        assert.equal(await gnosisSafe.isOwner(accounts[9]), true);
    })
});
