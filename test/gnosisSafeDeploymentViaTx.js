const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const fs = require('fs')
const randomBuffer = require("random-buffer")
const ethUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const MockContract = artifacts.require('./MockContract.sol');
const MockToken = artifacts.require('./Token.sol');

contract('GnosisSafe trustless deployment', function(accounts) {

    const CALL = 0

    const gasPrice = web3.utils.toWei('20', 'gwei')
    const payingProxyJson = JSON.parse(fs.readFileSync("./build/contracts/PayingProxy.json"))
    const PayingProxy = new web3.eth.Contract(payingProxyJson.abi)

    let funder
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

    let getCreationData = async function(gasToken, userCosts, gasLimit) {
        gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()

        let rawTx = {
            value: 0,
            data: PayingProxy.deploy({
                data: payingProxyJson.bytecode,
                arguments: [gnosisSafeMasterCopy.address, gnosisSafeData, funder, gasToken, userCosts.toString()]
            }).encodeABI(),
        }

        var tx = new EthereumTx(rawTx);
        tx.nonce = 0
        tx.gasPrice = web3.utils.toHex(gasPrice)
        tx.gasLimit = gasLimit || 500000
        setSignature(tx)

        let sender = tx.getSenderAddress().toString("hex")
        console.log("    Random sender: 0x" + sender)
        let target = "0x" + ethUtil.generateAddress(tx.getSenderAddress(), 0).toString("hex")
        console.log("    Predicted safe address: " + target)
        assert.equal(await web3.eth.getCode(target), "0x")
        return {
            sender: sender,
            safe: target,
            tx: tx,
            userCosts: userCosts,
            gasPrice: gasPrice
        }
    }

    let deployWithCreationData = async function(creationData) {
        // Gnosis funds sender
        await web3.eth.sendTransaction({from: funder, to: creationData.sender, value: creationData.tx.getUpfrontCost(), gasPrice: creationData.gasPrice})

        let raw = '0x' + creationData.tx.serialize().toString('hex')
        try {
            let tx = await web3.eth.sendSignedTransaction(raw)
            utils.logGasUsage("deploy safe", await web3.eth.getTransactionReceipt(tx.transactionHash))
        } catch(e) {
            console.log("    Deployment reverted")
        }
    }

    beforeEach(async function () {
        funder = accounts[5]
        // Create lightwallet
        lw = await utils.createLightwallet()
        gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
    })

    it('should create safe from random account and pay in ETH', async () => {

        // Estimate safe creation costs
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()

        let rawTx = {
            value: 0,
            data: PayingProxy.deploy({ 
                data: payingProxyJson.bytecode,
                arguments: [gnosisSafeMasterCopy.address, gnosisSafeData, funder, utils.Address0, 0]
            }).encodeABI(),
        }
        let estimate = await web3.eth.estimateGas(rawTx) + 80000

        let creationData = await getCreationData(utils.Address0, (estimate + 21000) * gasPrice, estimate)

        // User funds safe
        await web3.eth.sendTransaction({from: accounts[1], to: creationData.safe, value: creationData.userCosts})
        assert.equal(await web3.eth.getBalance(creationData.safe), creationData.userCosts)
        let funderBalance = await web3.eth.getBalance(funder)

        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), payingProxyJson.deployedBytecode)

        let gnosisSafe = await GnosisSafe.at(creationData.safe)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]].map((o) => web3.utils.toChecksumAddress(o)))
        assert.equal(await web3.eth.getBalance(funder), funderBalance)

        await web3.eth.sendTransaction({from: accounts[1], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, accounts[8])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, accounts[8])
    })

    it('should create safe from random account and pay with token', async () => {
        // Deploy token
        let token = await safeUtils.deployToken(accounts[0])

        // We just set an fix amount of tokens to pay
        let creationData = await getCreationData(token.options.address, 1337)

        // User funds safe
        await token.methods.transfer(creationData.safe, creationData.userCosts).send({from: accounts[0]})
        assert.equal(await token.methods.balances(creationData.safe).call(), creationData.userCosts);
        assert.equal(await token.methods.balances(funder).call(), 0)

        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), payingProxyJson.deployedBytecode)

        let gnosisSafe = await GnosisSafe.at(creationData.safe)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]].map((o) => web3.utils.toChecksumAddress(o)))
        assert.equal(await token.methods.balances(funder).call(), creationData.userCosts)
        assert.equal(await token.methods.balances(gnosisSafe.address).call(), 0)

        await token.methods.transfer(gnosisSafe.address, 3141596).send({from: accounts[0]})
        let data = await token.methods.transfer(accounts[1], 212121).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction token transfer', [lw.accounts[0], lw.accounts[2]], token.options.address, 0, data, CALL, accounts[8], { gasToken: token.options.address })
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction token transfer', [lw.accounts[0], lw.accounts[2]], token.options.address, 0, data, CALL, accounts[8], { gasToken: token.options.address })

        assert.equal(await token.methods.balances(accounts[1]).call(), 424242)
    })

    it('should fail if ether payment fails', async () => {
        // We just set an fix amount of eth to pay
        let creationData = await getCreationData(utils.Address0, 500000 * gasPrice)
        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')
    })

    it('should fail if token payment fails', async () => {
        // Deploy token
        let token = await safeUtils.deployToken(accounts[0])

        // We just set an fix amount of tokens to pay
        let creationData = await getCreationData(token.options.address, 1337)
        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')

        let mockContract = await MockContract.new();
        let mockToken = await MockToken.at(mockContract.address);

        await mockContract.givenAnyRunOutOfGas();
        creationData = await getCreationData(mockToken.address, 1337)
        await deployWithCreationData(creationData);
        assert.equal(await web3.eth.getCode(creationData.safe), '0x');


        await mockContract.givenAnyRevert();
        creationData = await getCreationData(mockToken.address, 1337);
        await deployWithCreationData(creationData);
        assert.equal(await web3.eth.getCode(creationData.safe), '0x');


        await mockContract.givenAnyReturnBool(false);
        creationData = await getCreationData(mockToken.address, 1337);
        await deployWithCreationData(creationData);
        assert.equal(await web3.eth.getCode(creationData.safe), '0x');

    });
})
