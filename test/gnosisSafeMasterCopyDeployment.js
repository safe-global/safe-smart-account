const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const abi = require('ethereumjs-abi')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafe master copy deployment', function(accounts) {

    it('should not allow to call setup on mastercopy', async () => {
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        assert.equal(1, await gnosisSafeMasterCopy.getThreshold())
        assert.deepEqual([], await gnosisSafeMasterCopy.getOwners())
        assert.deepEqual([], await gnosisSafeMasterCopy.getModules())
        await utils.assertRejects(
            gnosisSafeMasterCopy.setup([accounts[0], accounts[1], accounts[2]], 2, 0, "0x", 0, 0, 0, 0),
            "Should not allow to call setup on mastercopy"
        )
    })
})
