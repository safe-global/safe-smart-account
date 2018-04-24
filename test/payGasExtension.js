const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol");
const MultiSend = artifacts.require("./libraries/MultiSend.sol")
const Battery = artifacts.require("./libraries/Battery.sol")
const CreateAndAddExtension = artifacts.require("./libraries/CreateAndAddExtension.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const PayGasExtension = artifacts.require("./extensions/PayGasExtension.sol");
const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);

contract('PayGasExtension', function(accounts) {

    let gnosisSafe
    let extension
    let multiSend
    let battery
    let lw
    let tw = TransactionWrapper.at(1)

    const CALL = 0

    let payAndExecuteTransaction = async function(target, value, useBattery) {
      let nonce = await gnosisSafe.nonce()
      let transactionHash = await gnosisSafe.getTransactionHash.call(target, value, 0, CALL, nonce)
      // Confirm transaction with signed messages
      let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[2]], transactionHash)
      // Generate price signature
      let estimate = await gnosisSafe.executeTransaction.estimateGas(target, value, 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS) + 30000
      let price = estimate * 100000000000
      let priceNonce = await extension.nonce()
      let priceHash = await extension.getPriceHash(accounts[9], price, priceNonce)
      let priceSigs = utils.signTransaction(lw, [lw.accounts[1], lw.accounts[0]], priceHash)

      let payData = extension.contract.payGas.getData(accounts[9], price, priceSigs.sigV[0], priceSigs.sigR[0], priceSigs.sigS[0])
      let executeData = gnosisSafe.contract.executeTransaction.getData(target, value, 0, CALL, sigs.sigV, sigs.sigR, sigs.sigS)
      let payAndExecuteTransactionData = '0x'

      if (useBattery) {
        let batteryData = battery.contract.discharge.getData(estimate / 15000)
        payAndExecuteTransactionData +=
          tw.send.getData(battery.address, 0, batteryData).substr(10)
      }

      payAndExecuteTransactionData +=
        tw.send.getData(extension.address, 0, payData).substr(10) +
        tw.send.getData(gnosisSafe.address, 0, executeData).substr(10)

      utils.logGasUsage(
          'executeTransaction withdraw ' + value + ' ETH to ' + target,
          await multiSend.multiSend(payAndExecuteTransactionData)
      )
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddExtension = await CreateAndAddExtension.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        let extensionMasterCopy = await PayGasExtension.new()
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
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Pay Gas Extension',
        )
        let extensions = await gnosisSafe.getExtensions()
        extension = PayGasExtension.at(extensions[0])
        assert.equal(await extension.getGnosisSafe.call(), gnosisSafe.address)
        multiSend = await MultiSend.new()
        battery = await Battery.new()
    })

    it('pay gas to executor and execute transaction with MultiSend', async () => {
        // Deposit 1.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'));

        // First transaction
        await payAndExecuteTransaction(accounts[0], web3.toWei(0.5, 'ether'), false)

        // Second transaction
        await payAndExecuteTransaction(accounts[0], web3.toWei(0.5, 'ether'), false)

        assert.ok(await web3.eth.getBalance(gnosisSafe.address).toNumber() < web3.toWei(0.1, 'ether'));
    })

    it('pay gas to executor and execute transaction with MultiSend and Battery', async () => {
        utils.logGasUsage(
          'charge battery',
          await battery.charge(100)
        )
        // Deposit 1.1 eth
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'));

        // First transaction
        await payAndExecuteTransaction(accounts[0], web3.toWei(0.5, 'ether'), true)

        // Second transaction
        await payAndExecuteTransaction(accounts[0], web3.toWei(0.5, 'ether'), true)

        assert.ok(await web3.eth.getBalance(gnosisSafe.address).toNumber() < web3.toWei(0.1, 'ether'));
    })
});
