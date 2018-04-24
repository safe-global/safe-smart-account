const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const PersonalEditionExtension = artifacts.require("./extensions/PersonalEditionExtension.sol");


contract('PersonalEditionExtension', function(accounts) {

    let gnosisSafe
    let extension
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddExtension = await CreateAndAddExtension.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        let extensionMasterCopy = await PersonalEditionExtension.new()
        // Initialize master copies
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, 0)
        extensionMasterCopy.setup()
        // Create Gnosis Safe and Daily Limit Extension in one transactions
        let extensionData = await extensionMasterCopy.contract.setup.getData()
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(extensionMasterCopy.address, extensionData)
        let createAndAddExtensionData = createAndAddExtension.contract.createAndAddExtension.getData(proxyFactory.address, proxyFactoryData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, createAndAddExtension.address, createAndAddExtensionData)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Personal Edition Extension',
        )
        let extensions = await gnosisSafe.getExtensions()
        extension = PersonalEditionExtension.at(extensions[0])
        assert.equal(await extension.getGnosisSafe.call(), gnosisSafe.address)
    })

    it('execute transaction via personal edition extension', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw daily limit
        // Withdraw 1 ETH
        let nonce = await extension.nonce()
        let transactionHash = await extension.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH',
            await extension.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        nonce = await extension.nonce()
        transactionHash = await extension.getTransactionHash(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH 2nd time',
            await extension.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        // Third withdrawal will fail
        await utils.assertRejects(
            extension.executeTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS
            ),
            "Cannot reuse signatures"
        )
    })

    it('execute transaction via personal edition extension and pay executor', async () => {
        // Deposit 1.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'));

        // First transaction
        let nonce = await extension.nonce()
        let transactionHash = await extension.getTransactionHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        // Generate price signature
        let estimate = await extension.executeTransaction.estimateGas(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
        let price = (estimate + 30000) * 100000000000
        let priceHash = await extension.getPriceHash(accounts[9], price, nonce)
        let priceSigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], priceHash)
        let firstTx = await extension.payAndExecuteTransaction(
            accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS, price, priceSigs.sigV[0], priceSigs.sigR[0], priceSigs.sigS[0], {from: accounts[9]}
        )
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH',
            firstTx
        )

        // Second transaction
        nonce = await extension.nonce()
        transactionHash = await extension.getTransactionHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], transactionHash)

        await utils.assertRejects(
            extension.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS, estimate, priceSigs.sigV[0], priceSigs.sigR[0], priceSigs.sigS[0], {from: accounts[9]}
            ),
            "Cannot reuse signatures"
        )

        // Generate price signature
        estimate = await extension.executeTransaction.estimateGas(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
        price = (estimate + 30000) * 100000000000
        priceHash = await extension.getPriceHash(accounts[9], price, nonce)
        priceSigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], priceHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH 2nd time',
            await extension.payAndExecuteTransaction(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS, price, priceSigs.sigV[0], priceSigs.sigR[0], priceSigs.sigS[0], {from: accounts[9]}
            )
        )
        assert.ok(await web3.eth.getBalance(gnosisSafe.address).toNumber() < web3.toWei(0.1, 'ether'));
    })

    it('execute transaction via personal edition extension and pay executor with combined signature', async () => {
        // Deposit 1.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'));

        // First transaction
        let nonce = await extension.nonce.call()
        let transactionHash = await extension.getTransactionHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
        // Generate price signature
        let estimate = await extension.executeTransaction.estimateGas(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
        let price = (estimate + 30000) * 100000000000

        let combinedHash = await extension.getCombinedHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce, price)
        let combinedSigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], combinedHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH',
            await extension.payAndExecuteTransactionCombined(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, price, combinedSigs.sigV, combinedSigs.sigR, combinedSigs.sigS, {from: accounts[9]}
            )
        )

        // Second transaction
        nonce = await extension.nonce.call()
        transactionHash = await extension.getTransactionHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce)
        // Confirm transaction with signed messages
        sigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], transactionHash)

        // Generate price signature
        estimate = await extension.executeTransaction.estimateGas(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
        price = (estimate + 30000) * 100000000000

        combinedHash = await extension.getCombinedHash.call(accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, nonce, price)
        combinedSigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], combinedHash)
        utils.logGasUsage(
            'executeTransaction withdraw 0.5 ETH 2nd time',
            await extension.payAndExecuteTransactionCombined(
                accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, price, combinedSigs.sigV, combinedSigs.sigR, combinedSigs.sigS, {from: accounts[9]}
            )
        )
        assert.ok(await web3.eth.getBalance(gnosisSafe.address).toNumber() < web3.toWei(0.1, 'ether'));
    })
});
