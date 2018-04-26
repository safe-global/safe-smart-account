const utils = require('./utils')
const solc = require('solc')
const fs = require('fs')
const randomBuffer = require("random-buffer")
const ethUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafe', function(accounts) {

    let gnosisSafeMasterCopy
    let lw

    let setSignature = function(tx) {
        for(i = 0; i < 10; i++) {
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
              console.log(tx.getSenderAddress().toString("hex"))
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

        const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"mastercopy","type":"address"}, {"name":"data","type":"bytes"}],"name":"setup","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
        let tw = TransactionWrapper.at(1)

        let constructorData = "0x608060405234801561001057600080fd5b506040516102e83803806102e8833981018060405281019080805190602001909291908051820192919050505060008273ffffffffffffffffffffffffffffffffffffffff161415151561006357600080fd5b816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000815111156100c8576100c78160006100cf640100000000026401000000009004565b5b505061011e565b73ffffffffffffffffffffffffffffffffffffffff60005416600080845160208601846127105a03f46040513d6000823e600082141561010d573d81fd5b8315610117573d81f35b5050505050565b6101bb8061012d6000396000f30060806040526004361061004c576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680634555d5c91461008c5780635c60da1b146100b7575b61008a6000368080601f016020809104026020016040519081016040528093929190818152602001838380828437820191505050505050600161010e565b005b34801561009857600080fd5b506100a161015d565b6040518082815260200191505060405180910390f35b3480156100c357600080fd5b506100cc610166565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b73ffffffffffffffffffffffffffffffffffffffff60005416600080845160208601846127105a03f46040513d6000823e600082141561014c573d81fd5b8315610156573d81f35b5050505050565b60006002905090565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050905600a165627a7a723058207e7707ac3cece26072e069005163727d28ef76302d9c6a7b22e8ab14c3fc18b50029"

        gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, 0)
        constructorData +=
          tw.setup.getData(gnosisSafeMasterCopy.address, gnosisSafeData).substr(10)
        console.log(constructorData)

        let rawTx = {
            value: 0,
            data: constructorData,
        }
        console.log(web3.eth.estimateGas(rawTx))

        var tx = new EthereumTx(rawTx);
        tx.nonce = 0
        tx.gasPrice = web3.toHex(web3.toWei('20', 'gwei'))
        tx.gasLimit = 500000
        setSignature(tx)

        let sender = tx.getSenderAddress().toString("hex")
        await web3.eth.sendTransaction({from: accounts[0], to: sender, value: tx.getUpfrontCost()})

        let target = "0x" + ethUtil.generateAddress(tx.getSenderAddress(), 0).toString("hex")
        console.log(target)
        assert.equal(await web3.eth.getCode(target), "0x0")
        let v = 27
        var raw = '0x' + tx.serialize().toString('hex')
        console.log(await web3.eth.sendRawTransaction(raw))
        console.log(await web3.eth.getCode(target))
        assert.ok(await web3.eth.getCode(target) != "0x0")
        let gnosisSafe = GnosisSafe.at(target)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]])
    })
})
