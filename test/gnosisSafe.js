const util = require('util');
const utils = require('./utils')
const lightwallet = require('eth-lightwallet')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const GnosisSafeWithDescriptions = artifacts.require("./GnosisSafeWithDescriptions.sol")

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash

    beforeEach(async () => {
        
    })

    it('should create a new safe and deposit and withdraw 1 ETH', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))
        // Withdraw 1 ETH
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, 0, 0)
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction send 1 eth',
            await gnosisSafe.confirmAndExecuteTransaction(
                accounts[0], web3.toWei(1, 'ether'), 0, 0, 0, {from: accounts[1]}
            )
        )
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.isExecuted(transactionHash), true)
    })

    it('should create a new safe with descriptions and deposit and withdraw 1 ETH', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafeWithDescriptions.new([accounts[0], accounts[1]], 2)
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw 1 ETH
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, 0, 0)
        let descriptionHash = 'YwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, descriptionHash, {from: accounts[0]})
        )
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction send 1 eth',
            await gnosisSafe.confirmAndExecuteTransaction(
                accounts[0], web3.toWei(1, 'ether'), 0, 0, 0, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.getDescriptionCount(), 1)
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        assert.equal(await gnosisSafe.isExecuted(transactionHash), true)
    })

    it('should create a new safe and add a new owner', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Add owner transaction
        data = await gnosisSafe.contract.addOwner.getData(accounts[3], 2)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        // Owner count is still 2
        let owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction add owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, 0, 0, {from: accounts[1]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 3)
    })

    it('should create a new safe and add a new owner using signed messages', async () => {
        // Create lightwallet accounts
        const createVault = util.promisify(lightwallet.keystore.createVault).bind(lightwallet.keystore)
        const keystore = await createVault({
            hdPathString: "m/44'/60'/0'/0",
            seedPhrase: "pull rent tower word science patrol economy legal yellow kit frequent fat",
            password: "test",
            salt: "testsalt"
        })
        const keyFromPassword = await util.promisify(keystore.keyFromPassword).bind(keystore)("test")
        keystore.generateNewAddress(keyFromPassword, 20)
        let accountsWithout0x = keystore.getAddresses()
        let lightwalletAccounts = accountsWithout0x.map((a) => { return '0x' + a })
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], lightwalletAccounts[0], lightwalletAccounts[1]], 2)
        // Add owner transaction
        data = await gnosisSafe.contract.addOwner.getData(lightwalletAccounts[2], 2)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with signed messages
        let sigV = []
        let sigR = []
        let sigS = []
        let signers = [lightwalletAccounts[0], lightwalletAccounts[1]]
        for (var i=0; i<signers.length; i++) {
            let sig = lightwallet.signing.signMsgHash(keystore, keyFromPassword, transactionHash, signers[i])
            sigV.push(sig.v)
            sigR.push('0x' + sig.r.toString('hex'))
            sigS.push('0x' + sig.s.toString('hex'))
        }
        utils.logGasUsage(
            'confirmAndExecuteTransaction add owner using signed messages',
            await gnosisSafe.confirmAndExecuteTransactionWithSignatures(
                gnosisSafe.address, 0, data, 0, 0, sigV, sigR, sigS, {from: accounts[0]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 4)
    })
})
