const utils = require('./utils')

const CreateAndAddModule = artifacts.require("./libraries/CreateAndAddModule.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafeStateChannelEdition.sol");
const WhitelistModule = artifacts.require("./WhitelistModule.sol");


contract('WhitelistModule', function(accounts) {

    let gnosisSafe
    let whitelistModule
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModule = await CreateAndAddModule.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[0], accounts[1]], 2, 0, 0)
        let whitelistModuleMasterCopy = await WhitelistModule.new([])
        // Create Gnosis Safe and Whitelist Module in one transactions
        let moduleData = await whitelistModuleMasterCopy.contract.setup.getData([accounts[3]])
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(whitelistModuleMasterCopy.address, moduleData)
        let createAndAddModuleData = createAndAddModule.contract.createAndAddModule.getData(proxyFactory.address, proxyFactoryData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[1]], 2, createAndAddModule.address, createAndAddModuleData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Whitelist Module',
        )
        let modules = await gnosisSafe.getModules()
        whitelistModule = WhitelistModule.at(modules[0])
        assert.equal(await whitelistModule.manager.call(), gnosisSafe.address)
    })

    it('should execute a withdraw transaction to a whitelisted account', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw to whitelisted account
        utils.logGasUsage(
            'execTransactionFromModule withdraw to whitelisted account',
            await whitelistModule.executeWhitelisted(
                accounts[3], 300, 0, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 300);
    })

    it('should add and remove an account from the whitelist', async () => {
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), false)
        // Add account 3 to whitelist
        let data = await whitelistModule.contract.addToWhitelist.getData(accounts[1])
        let nonce = utils.currentTimeNs()
        let transactionHash = await gnosisSafe.getTransactionHash(whitelistModule.address, 0, data, CALL, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction add account to whitelist',
            await gnosisSafe.execTransaction(
                whitelistModule.address, 0, data, CALL, nonce, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), true)
        // Remove account 3 from whitelist
        data = await whitelistModule.contract.removeFromWhitelist.getData(accounts[1])
        nonce = await utils.currentTimeNs()
        transactionHash = await gnosisSafe.getTransactionHash(whitelistModule.address, 0, data, CALL, nonce)
        sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'execTransaction remove account from whitelist',
            await gnosisSafe.execTransaction(
                whitelistModule.address, 0, data, CALL, nonce, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await whitelistModule.isWhitelisted(accounts[1]), false)
    })
});
