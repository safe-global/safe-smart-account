const util = require('util');
const utils = require('./utils')
const { getParamFromTxEvent, assertRejects } = utils
const lightwallet = require('eth-lightwallet')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const GnosisSafeWithDescriptions = artifacts.require("./GnosisSafeWithDescriptions.sol")

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let data
    let transactionHash

    const CALL = 0
    const DELEGATECALL = 1
    const CREATE = 2

    it('should create a new Safe and deposit and withdraw 1 ETH', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))
        // Withdraw 1 ETH
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, CALL, 0)
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
                accounts[0], web3.toWei(1, 'ether'), 0, CALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.getConfirmationCount(transactionHash), 2)
        assert.deepEqual(await gnosisSafe.getConfirmingOwners(transactionHash), [accounts[0], accounts[1]])
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0)
        assert.equal(await gnosisSafe.isExecuted(transactionHash), true)
    })

    it('should create a new Safe with descriptions and deposit and withdraw 1 ETH', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafeWithDescriptions.new([accounts[0], accounts[1]], 2)
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
        // Withdraw 1 ETH
        transactionHash = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, CALL, 0)
        let descriptionHash = '0xe886dc769ec7d83a00b8647920917cf4b932fbb8c6fd59bf6da7d18ee84d2447'
        // Confirm transaction with account 0
        utils.logGasUsage(
            'confirmTransaction and add description',
            await gnosisSafe.confirmTransaction(transactionHash, descriptionHash, {from: accounts[0]})
        )
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction send 1 eth',
            await gnosisSafe.confirmAndExecuteTransaction(
                accounts[0], web3.toWei(1, 'ether'), 0, CALL, 0, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.getDescriptionCount(), 1)
        assert.deepEqual(await gnosisSafe.getDescriptions(0, 1), [descriptionHash])
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), 0);
        assert.equal(await gnosisSafe.isExecuted(transactionHash), true)
        let transactionHash2 = await gnosisSafe.getTransactionHash(accounts[0], web3.toWei(1, 'ether'), 0, CALL, 1)
        let descriptionHash2 = '0xf886dc769ec7d83a00b8647920917cf4b932fbb8c6fd59bf6da7d18ee84d2447'
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash2, descriptionHash2, {from: accounts[0]})
        assert.equal(await gnosisSafe.getDescriptionCount(), 2)
        assert.deepEqual(await gnosisSafe.getDescriptions(0, 2), [descriptionHash, descriptionHash2])
    })

    it('should create a new Safe and add, remove and replace an owner and update required confirmations', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Add owner and set required to 3
        data = await gnosisSafe.contract.addOwner.getData(accounts[2], 3)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Owner count is still 2
        let owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction add owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 3)
        assert.equal(await gnosisSafe.isOwner(accounts[2]), true)
        assert.equal(await gnosisSafe.required(), 3)
        // Remove owner and set required to 2
        data = await gnosisSafe.contract.removeOwner.getData(accounts[2], 2)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[1]})
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction remove owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[2]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        assert.equal(await gnosisSafe.isOwner(accounts[2]), false)
        assert.equal(await gnosisSafe.required(), 2)
        // Replace owner transaction
        data = await gnosisSafe.contract.replaceOwner.getData(accounts[0], accounts[2])
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Owner count is still 2
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 2)
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction replace owner',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.isOwner(accounts[0]), false)
        assert.equal(await gnosisSafe.isOwner(accounts[2]), true)
    })

    it('should create a new Safe and add and remove an exception and update a condition', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Add exception
        let exception = "0xbc1e40869e04dbe797e707405fea119dd3382794"
        data = await gnosisSafe.contract.addException.getData(exception)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        assert.equal(await gnosisSafe.isException(exception), false)
        utils.logGasUsage(
            'confirmAndExecuteTransaction add exception',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.isException(exception), true)
        // Remove exception
        data = await gnosisSafe.contract.removeException.getData(exception)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction remove exception',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.isException(exception), false)
        // Change condition
        let condition = "0xcc1e40869e04dbe797e707405fea119dd3382794"
        data = await gnosisSafe.contract.changeCondition.getData(condition)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        assert.equal(await gnosisSafe.condition(), "0x0000000000000000000000000000000000000000")
        // Confirm and execute transaction with account 1
        utils.logGasUsage(
            'confirmAndExecuteTransaction change condition',
            await gnosisSafe.confirmAndExecuteTransaction(
                gnosisSafe.address, 0, data, CALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await gnosisSafe.condition(), condition)
    })

    it('should create a new Safe and add a new owner using signed messages', async () => {
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
        // Add owner
        data = await gnosisSafe.contract.addOwner.getData(lightwalletAccounts[2], 2)
        transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, data, CALL, 0)
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
                gnosisSafe.address, 0, data, CALL, 0, sigV, sigR, sigS, {from: accounts[0]}
            )
        )
        owners = await gnosisSafe.getOwners()
        assert.equal(owners.length, 4)
    })

    it('should create a new Safe and do a CREATE transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create test contract
        let source = `
        contract Test {
            function x() pure returns (uint) {
                return 21;
            }
        }`
        let output = await solc.compile(source, 0);
        let interface = JSON.parse(output.contracts[':Test']['interface'])
        let bytecode = '0x' + output.contracts[':Test']['bytecode']
        data = bytecode
        transactionHash = await gnosisSafe.getTransactionHash(0, 0, data, CREATE, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        const TestContract = web3.eth.contract(interface);
        // Confirm and execute transaction with account 1
        let testContract = getParamFromTxEvent(
            await gnosisSafe.confirmAndExecuteTransaction(
                0, 0, data, CREATE, 0, {from: accounts[1]}
            ),
            'createdContract', TestContract, 'CreateExecution'
        )
        assert.equal(await testContract.x(), 21)
    })

    it('should create a new Safe and do a DELEGATECALL transaction', async () => {
        // Create Gnosis Safe
        gnosisSafe = await GnosisSafe.new([accounts[0], accounts[1]], 2)
        // Create test contract and test library
        let source = `
        contract Test {
            mapping (address => uint) public balances;
            function addOne() {
                balances[msg.sender] += 1;
            }
        }

        library TestLibrary {
            function addTwo(address x) {
                Test(x).addOne();
                Test(x).addOne();
            }
        }`
        let output = await solc.compile(source, 0);
        // Create test contract
        let contractInterface = JSON.parse(output.contracts[':Test']['interface'])
        let contractBytecode = '0x' + output.contracts[':Test']['bytecode']
        transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: contractBytecode, gas: 4000000})
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestContract = web3.eth.contract(contractInterface)
        let testContract = TestContract.at(receipt.contractAddress)
        // Create library contract
        let libraryInterface = JSON.parse(output.contracts[':TestLibrary']['interface'])
        let libraryBytecode = '0x' + output.contracts[':TestLibrary']['bytecode']
        transactionHash = await web3.eth.sendTransaction({from: accounts[0], data: libraryBytecode, gas: 4000000})
        receipt = web3.eth.getTransactionReceipt(transactionHash);
        const TestLibrary = web3.eth.contract(libraryInterface)
        let testLibrary = await TestLibrary.at(receipt.contractAddress)
        // Do DELEGATECALL
        data = await testLibrary.addTwo.getData(testContract.address)
        transactionHash = await gnosisSafe.getTransactionHash(testLibrary.address, 0, data, DELEGATECALL, 0)
        // Confirm transaction with account 0
        await gnosisSafe.confirmTransaction(transactionHash, {from: accounts[0]})
        // Confirm and execute transaction with account 1
        assert.equal(await testContract.balances(gnosisSafe.address), 0)
        utils.logGasUsage(
            'confirmAndExecuteTransaction do DELEGATECALL',
            await gnosisSafe.confirmAndExecuteTransaction(
                testLibrary.address, 0, data, DELEGATECALL, 0, {from: accounts[1]}
            )
        )
        assert.equal(await testContract.balances(gnosisSafe.address), 2)
    })
})
