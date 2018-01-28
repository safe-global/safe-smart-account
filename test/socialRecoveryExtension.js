const utils = require('./utils')

const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const SocialRecoveryExtension = artifacts.require("./SocialRecoveryExtension.sol");


contract('SocialRecoveryExtension', function(accounts) {

    let gnosisSafe
    let socialRecoveryExtension

    const CALL = 0

    beforeEach(async function () {
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddExtension = await CreateAndAddExtension.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new([accounts[0], accounts[1]], 2, 0, 0)
        let socialRecoveryExtensionMasterCopy = await SocialRecoveryExtension.new([accounts[0], accounts[1]], 2)
        // Create Gnosis Safe and Social Recovery Extension in one transactions
        let extensionData = await socialRecoveryExtensionMasterCopy.contract.setup.getData([accounts[2], accounts[3]], 2)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(socialRecoveryExtensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Social Recovery Extension', 
        )
        let extensions = await gnosisSafe.getExtensions()
        socialRecoveryExtension = SocialRecoveryExtension.at(extensions[0])
        assert.equal(await socialRecoveryExtension.gnosisSafe(), gnosisSafe.address)
    })

    it('should allow to replace an owner apporved by friends', async () => {
        // Replace owner
        let data = await gnosisSafe.contract.replaceOwner.getData(1, accounts[1], accounts[9])
        // Confirm transaction to be executed without confirmations
        let dataHash = await socialRecoveryExtension.getDataHash(data)
        await socialRecoveryExtension.confirmTransaction(dataHash, {from: accounts[3]})
        // Execution fails, because challenge period is not yet over
        await utils.assertRejects(
            gnosisSafe.executeExtension(gnosisSafe.address, 0, data, CALL, socialRecoveryExtension.address, {from: accounts[0]}),
            "It was not confirmed by the required number of friends"
        )
        // Confirm with 2nd friend
        await socialRecoveryExtension.confirmTransaction(dataHash, {from: accounts[2]})
        await gnosisSafe.executeExtension(gnosisSafe.address, 0, data, CALL, socialRecoveryExtension.address, {from: accounts[3]})
        assert.equal(await gnosisSafe.isOwner(accounts[9]), true);
    })
});
