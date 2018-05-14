const utils = require('./utils')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol")
const MultiSend = artifacts.require("./libraries/MultiSend.sol")


contract('MultiSend', function(accounts) {

    let gnosisSafe
    let multiSend
    let lw

    const DELEGATECALL = 1

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        gnosisSafe = await GnosisSafe.new()
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0)
        multiSend = await MultiSend.new()
    })

    it('should deposit and withdraw 2 ETH and change threshold in 1 transaction', async () => {
        // Threshold is 1 after deployment
        assert.equal(await gnosisSafe.getThreshold(), 1)
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(2, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(2, 'ether'))
        // Withdraw 2 ETH and change threshold
        let nonce = await gnosisSafe.nonce()
        const TransactionWrapper = web3.eth.contract([{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"}],"name":"send","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]);
        let tw = TransactionWrapper.at(1)
        let changeData = await gnosisSafe.contract.changeThreshold.getData(2)
        let nestedTransactionData = '0x' +
          tw.send.getData(gnosisSafe.address, 0, changeData).substr(10) +
          tw.send.getData(accounts[0], web3.toWei(0.5, 'ether'), 0).substr(10) +
          tw.send.getData(accounts[1], web3.toWei(0.5, 'ether'), 0).substr(10) +
          tw.send.getData(accounts[2], web3.toWei(1, 'ether'), 0).substr(10)
        let data = await multiSend.contract.multiSend.getData(nestedTransactionData)
        let transactionHash = await gnosisSafe.getTransactionHash(multiSend.address, 0, data, DELEGATECALL, 1000000, 0, 0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        utils.logGasUsage(
            'execTransaction send multiple transactions',
            await gnosisSafe.execPayTransaction(
                multiSend.address, 0, data, DELEGATECALL, 1000000, 0, 0, sigs.sigV, sigs.sigR, sigs.sigS
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.getThreshold(), 2)
    })
})
