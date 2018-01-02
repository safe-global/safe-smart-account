const utils = require('./utils')

const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const WhitelistExtension = artifacts.require("./WhitelistExtension.sol");


contract('WhitelistExtension', function(accounts) {

    let gnosisSafe
    let lw
    let data
    let transactionHash
    let whitelistExtension

    const CALL = 0
    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
    })

    it('should create a new Safe with whitelist extension and execute a withdraw transaction to a whitelisted account', async () => {
        // Create Master Copies
        proxyFactory = await ProxyFactory.new()
        createAndAddExtension = await CreateAndAddExtension.new()
        gnosisSafeMasterCopy = await GnosisSafe.new([accounts[0]], 1, 0, 0)
        whitelistExtensionMasterCopy = await WhitelistExtension.new([])
        // Create Gnosis Safe and Daily Limit Extension in one transactions
        let extensionData = await whitelistExtensionMasterCopy.contract.setup.getData([accounts[3]])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(whitelistExtensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Extension', 
        )
        extensions = await gnosisSafe.getExtensions()
        whitelistExtension = WhitelistExtension.at(extensions[0])
        assert.equal(await whitelistExtension.gnosisSafe(), gnosisSafe.address)
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw to whitelisted account
        utils.logGasUsage(
            'executeException withdraw to whitelisted account',
            await gnosisSafe.executeExtension(
                accounts[3], 300, 0, 0, whitelistExtension.address, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 300);
    })

    it('should create a new Safe with whitelist extension and add and remove an account from the whitelist', async () => {
        // Create Master Copies
        proxyFactory = await ProxyFactory.new()
        createAndAddExtension = await CreateAndAddExtension.new()
        gnosisSafeMasterCopy = await GnosisSafe.new([lw.accounts[0], lw.accounts[1]], 2, 0, 0)
        whitelistExtensionMasterCopy = await WhitelistExtension.new([])
        // Create Gnosis Safe and Daily Limit Extension in one transactions
        let extensionData = await whitelistExtensionMasterCopy.contract.setup.getData([])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(whitelistExtensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Extension', 
        )
        extensions = await gnosisSafe.getExtensions()
        whitelistExtension = WhitelistExtension.at(extensions[0])
        assert.equal(await whitelistExtension.gnosisSafe(), gnosisSafe.address)
        assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), false)
        // Add account 3 to whitelist
        data = await whitelistExtension.contract.addToWhitelist.getData(accounts[3])
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
        //Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction add account to whitelist',
            await gnosisSafe.executeTransaction(
                whitelistExtension.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS, []
            )
        )
        assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), true)
        // Remove account 3 from whitelist
        data = await whitelistExtension.contract.removeFromWhitelist.getData(accounts[3])
        nonce = await gnosisSafe.nonce()
        transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
        //Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction add account to whitelist',
            await gnosisSafe.executeTransaction(
                whitelistExtension.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS, []
            )
        )
        assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), false)
    })
});
