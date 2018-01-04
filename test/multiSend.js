const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")


contract('MultiSend', function(accounts) {

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

    it('should create a new Safe and deposit and withdraw 1 ETH', async () => {
        multiSend = await MultiSend.new()
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 1 ETH
        nonce = await gnosisSafe.nonce()
        const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
        tw = TransactionWrapper.at(1)
        nestedTransactionData = '0x' + tw.send.getData(accounts[0], web3.toWei(0.5, 'ether'), 0).substr(10) + tw.send.getData(accounts[1], web3.toWei(0.5, 'ether'), 0).substr(10) + tw.send.getData(accounts[2], web3.toWei(1, 'ether'), 0).substr(10)
        data = await multiSend.contract.multiSend.getData(nestedTransactionData)
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
    })
})
