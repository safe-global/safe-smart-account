const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const MultiSendStruct = artifacts.require("./libraries/MultiSendStruct.sol")


contract('MultiSendStruct', function(accounts) {

    let gnosisSafe
    let lw
    let data
    let transactionHash

    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([lw.accounts[0], lw.accounts[1]], 2, 0, 0)
    })

    it('should create a new Safe and deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        assert.equal(await gnosisSafe.threshold(), 2)
        multiSend = await MultiSendStruct.new()
        // Deposit 2 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        // TODO: use web3js parsing when they support tuples
        nonce = await gnosisSafe.nonce()
        data = '0x2f6fda4a' +
          "0000000000000000000000000000000000000000000000000000000000000020"+
          "0000000000000000000000000000000000000000000000000000000000000004"+
          "0000000000000000000000000000000000000000000000000000000000000080"+
          "0000000000000000000000000000000000000000000000000000000000000140"+
          "00000000000000000000000000000000000000000000000000000000000001c0"+
          "0000000000000000000000000000000000000000000000000000000000000240"+

          "000000000000000000000000" + gnosisSafe.address.substr(2) +
          "0000000000000000000000000000000000000000000000000000000000000000"+
          "0000000000000000000000000000000000000000000000000000000000000060"+
          "0000000000000000000000000000000000000000000000000000000000000024"+
          "b7f3358d00000000000000000000000000000000000000000000000000000000"+
          "0000000100000000000000000000000000000000000000000000000000000000"+

          "000000000000000000000000" + accounts[0].substr(2) +
          "00000000000000000000000000000000000000000000000006f05b59d3b20000"+
          "0000000000000000000000000000000000000000000000000000000000000060"+
          "0000000000000000000000000000000000000000000000000000000000000000"+

          "000000000000000000000000" + accounts[1].substr(2) +
          "00000000000000000000000000000000000000000000000006f05b59d3b20000"+
          "0000000000000000000000000000000000000000000000000000000000000060"+
          "0000000000000000000000000000000000000000000000000000000000000000"+

          "000000000000000000000000" + accounts[2].substr(2) +
          "0000000000000000000000000000000000000000000000000de0b6b3a7640000"+
          "0000000000000000000000000000000000000000000000000000000000000060"+
          "0000000000000000000000000000000000000000000000000000000000000000"
        transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, nonce)
        // Confirm transaction with signed messages
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        utils.logGasUsage(
            'executeTransaction send multiple transactions',
            await gnosisSafe.executeTransaction(
                multiSend.address, 0, data, DELEGATECALL, sigs.sigV, sigs.sigR, sigs.sigS, [], []
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.threshold(), 1)
    })
})
