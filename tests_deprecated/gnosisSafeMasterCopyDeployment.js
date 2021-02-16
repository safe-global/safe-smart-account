const utils = require('./utils/general')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")

contract('GnosisSafe master copy deployment', function(accounts) {

    it('should not allow to call setup on mastercopy', async () => {
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        assert.equal(1, await gnosisSafeMasterCopy.getThreshold())
        assert.deepEqual([], await gnosisSafeMasterCopy.getModules())
        try {
            await gnosisSafeMasterCopy.getOwners()
            assert.ok(false, "Should not be able to retrieve owners (currently the contract will run in an endless loop when not initialized)")
        } catch (e) {}
        await utils.assertRejects(
            gnosisSafeMasterCopy.setup([accounts[0], accounts[1], accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0),
            "Should not allow to call setup on mastercopy"
        )
    })
})
