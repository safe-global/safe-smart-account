const utils = require('./utils')
const safeUtils = require('./utilsPersonalSafe')
const solc = require('solc')
const fs = require('fs')
const randomBuffer = require("random-buffer")
const ethUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafePersonalEdition', function(accounts) {

    const CALL = 0

    let gnosisSafeMasterCopy
    let lw

    let setSignature = function(tx) {
        while(true) {
            try {
              tx.s = randomBuffer(32) // Could be provided by client
              tx.r = randomBuffer(32) // Could be provided by server
              setV(tx)
              return // Success return
            } catch (e) {
            }
        }
        throw "No valid signature found"
    }

    let setV = function(tx) {
        for(v = 27; v <= 30; v++) {
            try {
              tx.v = ethUtil.intToBuffer(v)
              tx.getSenderAddress()
              return
            } catch (e) {
            }
        }
        throw "No valid v found"
    }

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, 0)
    })

    it('should create safe from random account', async () => {
        let funder = accounts[5]
        let gasPrice = web3.toWei('20', 'gwei')
        var payingProxyJson = JSON.parse(fs.readFileSync("./build/contracts/PayingProxy.json"));
        const PayingProxy = web3.eth.contract(payingProxyJson.abi);
        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)

        let rawTx = {
            value: 0,
            data: PayingProxy.new.getData(gnosisSafeMasterCopy.address, gnosisSafeData, funder, 0, {data: payingProxyJson.bytecode}),
        }
        let estimate = web3.eth.estimateGas(rawTx) + 80000
        let userCosts = (estimate + 21000) * gasPrice
        console.log("    User costs: " + userCosts)
        rawTx.data = PayingProxy.new.getData(gnosisSafeMasterCopy.address, gnosisSafeData, funder, userCosts, {data: payingProxyJson.bytecode})

        var tx = new EthereumTx(rawTx);
        tx.nonce = 0
        tx.gasPrice = web3.toHex(gasPrice)
        tx.gasLimit = estimate
        setSignature(tx)

        let sender = tx.getSenderAddress().toString("hex")
        console.log("    Random sender: 0x" + sender)
        let target = "0x" + ethUtil.generateAddress(tx.getSenderAddress(), 0).toString("hex")
        console.log("    Predicted safe address: " + target)
        assert.equal(await web3.eth.getCode(target), "0x0")

        let funderBalance = await web3.eth.getBalance(funder).toNumber()

        // User funds safe
        await web3.eth.sendTransaction({from: accounts[1], to: target, value: userCosts})
        assert.equal(await web3.eth.getBalance(target).toNumber(), userCosts)

        // Gnosis funds sender
        let fundSenderTx = await web3.eth.sendTransaction({from: funder, to: sender, value: tx.getUpfrontCost(), gasPrice: gasPrice})

        var raw = '0x' + tx.serialize().toString('hex')
        utils.logGasUsage("deploy safe", await web3.eth.getTransactionReceipt(await web3.eth.sendRawTransaction(raw)))
        assert.equal(await web3.eth.getCode(target), payingProxyJson.deployedBytecode)
        let gnosisSafe = GnosisSafe.at(target)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]])
        assert.equal(await web3.eth.getBalance(funder).toNumber(), funderBalance)

        await web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(1.1, 'ether')})
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[8])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), 0, CALL, accounts[8])
    })
})
