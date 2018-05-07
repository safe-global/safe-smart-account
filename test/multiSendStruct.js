const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafeStateChannelEdition.sol")
const MultiSendStruct = artifacts.require("./libraries/MultiSendStruct.sol")


contract('MultiSendStruct', function(accounts) {

    let gnosisSafe
    let multiSend
    let lw

    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        gnosisSafe = await GnosisSafe.new()
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0)
        multiSend = await MultiSendStruct.new()
    })

    it('should deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        // Threshold is 1 after deployment
        assert.equal(await gnosisSafe.threshold(), 1)
        // Deposit 2 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        // TODO: use web3js parsing when they support tuples
        let nonce = utils.currentTimeNs()
        let data = '0x2f6fda4a' +
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
          "0000000200000000000000000000000000000000000000000000000000000000"+

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
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'executeTransaction send multiple transactions',
            await gnosisSafe.executeTransaction(
                multiSend.address, 0, data, DELEGATECALL, nonce, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.threshold(), 2)
    })
})
