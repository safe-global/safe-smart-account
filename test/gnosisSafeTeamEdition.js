const utils = require('./utils')
const solc = require('solc')

const GnosisSafe = artifacts.require("./GnosisSafeTeamEdition.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")


contract('GnosisSafeTeamEdition', function(accounts) {

    let gnosisSafe
    let executor = accounts[8]

    const MAX_GAS_PRICE = web3.toWei(100, 'gwei')

    const CALL = 0
    const CREATE = 2

    let executeTransaction = async function(subject, accounts, to, value, data, operation, sender) {
        let txSender = sender || executor 
        let nonce = utils.currentTimeNs()
        
        let executeData = gnosisSafe.contract.execTransactionIfApproved.getData(to, value, data, operation, nonce)
        assert.equal(await utils.getErrorMessage(gnosisSafe.address, 0, executeData), "Not enough confirmations")

        let approveData = gnosisSafe.contract.approveTransactionWithParameters.getData(to, value, data, operation, nonce)
        assert.equal(await utils.getErrorMessage(gnosisSafe.address, 0, approveData, "0x0000000000000000000000000000000000000002"), "Sender is not an owner")
        for (let account of (accounts.filter(a => a != txSender))) {
            utils.logGasUsage("confirm " + subject + " with " + account, await gnosisSafe.approveTransactionWithParameters(to, value, data, operation, nonce, {from: account}))
        }

        let tx = await gnosisSafe.execTransactionIfApproved(to, value, data, operation, nonce, {from: txSender})
        utils.logGasUsage(subject, tx)

        assert.equal(await utils.getErrorMessage(gnosisSafe.address, 0, approveData, accounts[0]), "Safe transaction already executed")
        assert.equal(await utils.getErrorMessage(gnosisSafe.address, 0, executeData), "Safe transaction already executed")
        return tx
    }

    beforeEach(async function () {
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([accounts[0]], 1, 0, "0x")
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1], accounts[2]], 2, 0, "0x")
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution 
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        await executeTransaction('executeTransaction withdraw 0.5 ETH', [accounts[0], accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL)

        await executeTransaction('executeTransaction withdraw 0.5 ETH', [accounts[0], accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL)

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0, 'ether'))
    })

    it('should deposit and withdraw 1 ETH with sender as owner', async () => {
        // Deposit 1 ETH + some spare money for execution 
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        // Withdraw 1 ETH
        await executeTransaction('executeTransaction withdraw 0.5 ETH', [accounts[0]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, accounts[2])

        await executeTransaction('executeTransaction withdraw 0.5 ETH', [accounts[0]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, accounts[2])

        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(0, 'ether'))
    })

    it('should add, remove and replace an owner and update the threshold', async () => {
        // Add owner and set threshold to 3
        assert.equal(await gnosisSafe.getThreshold(), 2)
        let data = await gnosisSafe.contract.addOwnerWithThreshold.getData(accounts[5], 3)
        await executeTransaction('add owner and set threshold to 3', [accounts[0], accounts[1]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[5], accounts[0], accounts[1], accounts[2]])
        assert.equal(await gnosisSafe.getThreshold(), 3)

        // Replace owner and keep threshold
        data = await gnosisSafe.contract.swapOwner.getData(accounts[1], accounts[2], accounts[3])
        await executeTransaction('replace owner', [accounts[0], accounts[1], accounts[2]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[5], accounts[0], accounts[1], accounts[3]])

        // Remove owner and reduce threshold to 2
        data = await gnosisSafe.contract.removeOwner.getData(accounts[1], accounts[3], 2)
        await executeTransaction('remove owner and reduce threshold to 2', [accounts[0], accounts[1], accounts[3]], gnosisSafe.address, 0, data, CALL)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[5], accounts[0], accounts[1]])
    })

    it('should do a CREATE transaction', async () => {
        // Create test contract
        let source = `
        contract Test {
            function x() pure returns (uint) {
                return 21;
            }
        }`
        let output = await solc.compile(source, 0);
        let interface = JSON.parse(output.contracts[':Test']['interface'])
        let data = '0x' + output.contracts[':Test']['bytecode']
        const TestContract = web3.eth.contract(interface);
        let testContract = utils.getParamFromTxEvent(
            await executeTransaction('create test contract', [accounts[0], accounts[1]], 0, 0, data, CREATE),
            'ContractCreation', 'newContract', gnosisSafe.address, TestContract, 'executeTransaction CREATE'
        )
        assert.equal(await testContract.x(), 21)
    })
})
