const utils = require('./utils')
const solc = require('solc')
const ABI = require('ethereumjs-abi')
const BigNumber = require('bignumber.js')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const TransferLimitModule = artifacts.require("./modules/TransferLimitModule.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')


const CALL = 0

contract('TransferLimitModule setup', (accounts) => {
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()
    })

    it('should validate time period', async () => {
        assert(await reverts(setupModule(
            lw,
            [[0], [100], 60 * 59, 0, 0, 2, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })

    it('should validate threshold', async () => {
        assert(await reverts(setupModule(
            lw,
            [[0], [100], 24 * 60 * 60, 0, 0, 0, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')

        assert(await reverts(setupModule(
            lw,
            [[0], [100], 24 * 60 * 60, 0, 0, 3, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })
})

contract('TransferLimitModule authorization', (accounts) => {
    let safe
    let module
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()

        let res = await setupModule(
            lw,
            [[0], [100], 60 * 60 * 24, 0, 0, 2, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]

        assert.equal(await module.manager.call(), safe.address)

        // Deposit 1 eth
        await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))
    })

    it('should withdraw only when authorized', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0, 0, 0]
        let sigs = await signModuleTx(module, params, lw, [lw.accounts[0]])

        // Withdrawal should fail for only one signature
        await utils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[1]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
    })

    it('should allow withdrawal for delegate', async () => {
        await updateDelegate(safe, module, lw, lw.accounts[3])
        let delegate = await module.delegate.call()
        assert.equal(delegate, lw.accounts[3])

        let params = [0, accounts[0], 50, 0, 0, 0, 0, 0]
        let sigs = await signModuleTx(module, params, lw, [lw.accounts[3]])

        // Withdrawal should fail for only one signature by delegate
        await utils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[3]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
    })
})

contract('TransferLimitModule transfer limits', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Mock token that always transfers successfully
        token = await MockContract.new()
        await token.givenAnyReturnBool(true)

        let det = new BigNumber(10)
        det = det.pow(18)

        // Mock PriceOracle, each wei is priced at 1 dai!
        /*let priceOracle = await MockContract.new()
        await priceOracle.givenMethodReturnUint(web3.sha3('getUSDETHPrice()').slice(0, 10), det.toString())*/

        // Mock DutchExchange
        dutchx = await MockContract.new()
        // Each token costs 1 Wei
        await dutchx.givenMethodReturn(
            web3.sha3('getPriceOfTokenInLastAuction(address)').slice(0, 10),
            ABI.rawEncode(['uint256', 'uint256'], [1, det.toString()]).toString()
        )
        /*await dutchx.givenMethodReturnAddress(
            web3.sha3('ethUSDOracle()').slice(0, 10),
            priceOracle.address
        )*/

        let res = await setupModule(
            lw,
            [[0, token.address], [100, 200], 60 * 60 * 24, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]

        assert.equal(await module.manager.call(), safe.address)
    })

    it('should withdraw ether within transfer limit', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        // Withdrawal should fail as there is no ETH in the Safe
        await utils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'Not enough funds'
        )

        // Deposit 1 eth
        await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))

        sigs = await signModuleTx(module, params, lw, signers)
        // Withdraw transfer limit
        utils.logGasUsage(
            'executeTransferLimit withdraw transfer limit',
            await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        )
    })

    it('should not withdraw ether more than limit', async () => {
        // Deposit 1 eth
        await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))

        let params = [0, accounts[0], 150, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for over withdraw'
        )
    })

    it('should withdraw token within transfer limit', async () => {
        let params = [token.address, accounts[0], 50, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
    })

    it('should not withdraw token more than limit', async () => {
        let params = [token.address, accounts[0], 250, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })

    it('should not withdraw token more than global ether limit', async () => {
        let params = [token.address, accounts[0], 170, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })

    /*it('should not withdraw token more than global dai limit', async () => {
        let params = [token.address, accounts[0], 130, 0, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })*/
})

const reverts = (p) => new Promise((resolve) => p.then(() => resolve(false)).catch((e) => resolve(e.message.search('revert') >= 0)))

const signModuleTx = async (module, params, lw, signers) => {
    let nonce = await module.nonce()
    let txHash = await module.getTransactionHash(...params, nonce)
    let sigs = utils.signTransaction(lw, signers, txHash)

    return sigs
}

const updateDelegate = async (safe, module, lw, delegate) => {
    let data = await module.contract.setDelegate.getData(delegate)

    let nonce = await safe.nonce()
    let transactionHash = await safe.getTransactionHash(module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, nonce)
    let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[2]], transactionHash)

    await safe.execTransaction(
        module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, sigs
    )
}

const setupModule = async (lw, params, safeOwners, safeThreshold) => {
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new()
    let createAndAddModules = await CreateAndAddModules.new()
    let gnosisSafeMasterCopy = await GnosisSafe.new()

    let transferLimitModuleMasterCopy = await TransferLimitModule.new()
    let moduleData = await transferLimitModuleMasterCopy.contract.setup.getData(...params)
    let proxyFactoryData = await proxyFactory.contract.createProxy.getData(transferLimitModuleMasterCopy.address, moduleData)
    let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
    let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData(safeOwners, safeThreshold, createAndAddModules.address, createAndAddModulesData)

    safe = utils.getParamFromTxEvent(
        await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
        'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Transfer Limit Module',
    )
    let modules = await safe.getModules()
    module = TransferLimitModule.at(modules[0])

    return [ safe, module ]
}
