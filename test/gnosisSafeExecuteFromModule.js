const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const BigNumber = require('bignumber.js')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')

contract('GnosisSafe', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const CALL = 0

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        gnosisSafe = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        gnosisSafe.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
    })

    it('Check that correct data is returned', async () => {
        // Deposit 1 ETH + some spare money for execution
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        let enableModuleData = gnosisSafe.contract.enableModule.getData(accounts[0])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'enable account as module', [lw.accounts[0], lw.accounts[2]], gnosisSafe.address, 0, enableModuleData, CALL, executor)

        let getModulesData = gnosisSafe.contract.getModules.getData()
        assert.deepEqual(
            [true, '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000' + accounts[0].slice(2)],
            await gnosisSafe.execTransactionFromModuleReturnData.call(gnosisSafe.address, 0, getModulesData, CALL)
        )
    })
})
