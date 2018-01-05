const utils = require('./utils')

const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const SocialRecoveryExtension = artifacts.require("./SocialRecoveryExtension.sol");

contract('SocialRecoveryException', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash
    let socialRecoveryException

    const CALL = 0
    const DELEGATECALL = 1

    it('should create a new Safe with social recovery exception and allow to send a transaction apporved by friends', async () => {
        // Create Master Copies
        proxyFactory = await ProxyFactory.new()
        createAndAddExtension = await CreateAndAddExtension.new()
        gnosisSafeMasterCopy = await GnosisSafe.new([accounts[0], accounts[1]], 2, 0, 0)
        socialRecoveryExtensionMasterCopy = await SocialRecoveryExtension.new([accounts[0], accounts[1]], 2)
        // Create Gnosis Safe and Daily Limit Extension in one transactions
        let extensionData = await socialRecoveryExtensionMasterCopy.contract.setup.getData([accounts[2], accounts[3]], 2)
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(socialRecoveryExtensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Extension', 
        )
        extensions = await gnosisSafe.getExtensions()
        socialRecoveryExtension = SocialRecoveryExtension.at(extensions[0])
        assert.equal(await socialRecoveryExtension.gnosisSafe(), gnosisSafe.address)
        // Replace owner
        data = await gnosisSafe.contract.replaceOwner.getData(1, accounts[9])
        // Confirm transaction to be executed without confirmations
        dataHash = await socialRecoveryExtension.getDataHash(data)
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
