const utils = require('./utils')

const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const WhitelistExtension = artifacts.require("./WhitelistExtension.sol");


contract('WhitelistExtension', function(accounts) {

    let gnosisSafe
    let whitelistExtension
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddExtension = await CreateAndAddExtension.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0], accounts[1]], 2, 0, 0)
        let whitelistExtensionMasterCopy = await WhitelistExtension.new([])
        // Create Gnosis Safe and Whitelist Extension in one transactions
        let extensionData = await whitelistExtensionMasterCopy.contract.setup.getData([accounts[3]])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(whitelistExtensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[1]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Whitelist Extension',
        )
        let extensions = await gnosisSafe.getExtensions()
        whitelistExtension = WhitelistExtension.at(extensions[0])
        assert.equal(await whitelistExtension.gnosisSafe(), gnosisSafe.address)
    })

    it('should execute a withdraw transaction to a whitelisted account', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw to whitelisted account
        utils.logGasUsage(
            'executeExtension withdraw to whitelisted account',
            await whitelistExtension.executeWhitelisted(
                accounts[3], 300, 0, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 300);
    })

    it('should add and remove an account from the whitelist', async () => {
        assert.equal(await whitelistExtension.isWhitelisted(accounts[1]), false)
        // Add account 3 to whitelist
        let data = await whitelistExtension.contract.addToWhitelist.getData(accounts[1])
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction add account to whitelist',
            await gnosisSafe.executeTransaction(
                whitelistExtension.address, 0, data, CALL,  sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await whitelistExtension.isWhitelisted(accounts[1]), true)
        // Remove account 3 from whitelist
        data = await whitelistExtension.contract.removeFromWhitelist.getData(accounts[1])
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction remove account from whitelist',
            await gnosisSafe.executeTransaction(
                whitelistExtension.address, 0, data, CALL,  sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await whitelistExtension.isWhitelisted(accounts[1]), false)
    })
});
