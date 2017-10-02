const util = require('util');
const utils = require('./utils')
const { getParamFromTxEvent, assertRejects } = utils
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
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 0)
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 1)
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction send 1 eth',
            await gnosisSafe.confirmAndExecuteTransaction(
                accounts[0], web3.toWei(1, 'ether'), 0, 0, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 2)
        assert.deepEqual(await gnosisSafe.getConfirmingOwners(transactionHash), [accounts[0], accounts[1]])
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
        let descriptionHash = '0xe886dc769ec7d83a00b8647920917cf4b932fbb8c6fd59bf6da7d18ee84d2447'
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
        assert.deepEqual(await gnosisSafe.getDescriptions(0, 1), [descriptionHash])
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        assert.equal(await gnosisSafe.isExecuted(transactionHash), true)
        let transactionHash2 = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, 0, 1)
        let descriptionHash2 = '0xf886dc769ec7d83a00b8647920917cf4b932fbb8c6fd59bf6da7d18ee84d2447'
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash2, descriptionHash2, {from: accounts[0]})
        )
        assert.equal(await gnosisSafe.getDescriptionCount(), 2)
        assert.deepEqual(await gnosisSafe.getDescriptions(0, 2), [descriptionHash, descriptionHash2])
    })

    it.only('should create a new safe and add a new owner and remove another owner and replace two owners and update required owners', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Add owner transaction and set required to 3
        data = await gnosisSafe.contract.addOwner.getData(accounts[2], 3)
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
        assert.equal(await gnosisSafe.isOwner(accounts[2]), true)
        assert.equal(await gnosisSafe.required(), 3)
        // Remove owner transaction and set required to 2
        data = await gnosisSafe.contract.removeOwner.getData(accounts[2], 2)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[1]})
        )
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction remove owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, 0, 0, {from: accounts[2]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        assert.equal(await gnosisSafe.isOwner(accounts[2]), false)
        assert.equal(await gnosisSafe.required(), 2)
        // Replace owner transaction
        data = await gnosisSafe.contract.replaceOwner.getData(accounts[0], accounts[2])
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, 0, 0)
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        // Owner count is still 2
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction replace owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, 0, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.isOwner(accounts[0]), false)
        assert.equal(await gnosisSafe.isOwner(accounts[2]), true)
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
            'confirmAndExecuteTransactionWithSignatures add owner',
            await gnosisSafe.confirmAndExecuteTransactionWithSignatures(
                gnosisSafe.address, 0, data, 0, 0, sigV, sigR, sigS, {from: accounts[0]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 4)
    })

    it('should create a new safe and create a new contract with a safe transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Add owner transaction
        const TestContract = web3.eth.contract([{
            "constant": true,
            "inputs": [],
            "name": "x",
            "outputs": [{"name": "", "type": "uint256"}],
            "payable": false,
            "stateMutability": "pure",
            "type": "function"
        }]);
        data = "0x60606040523415600e57600080fd5b60978061001c6000396000f30060606040526000357c01" + 
               "00000000000000000000000000000000000000000000000000000000900463ffffffff1680630c" +
               "55699c14603c57600080fd5b3415604657600080fd5b604c6062565b6040518082815260200191" +
               "505060405180910390f35b600060159050905600a165627a7a72305820f977aa5909c6d283de49" +
               "6e5db51c83425475de52bab19fd0675e5b893587ec830029"
        transactionHash = await gnosisSafe.getTransactionHash(0, 0, data, 2, 0)
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction',
            await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        )
        // Confirm and execute transaction with account 1
        let testContract = getParamFromTxEvent(
            await gnosisSafe.confirmAndExecuteTransaction(
                0, 0, data, 2, 0, {from: accounts[1]}
            ),
            'createdContract', TestContract, 'CreateExecution'
        )
        assert.equal(await testContract.x(), 21)
    })
})
