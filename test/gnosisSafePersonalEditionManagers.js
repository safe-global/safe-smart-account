const utils = require('./utils/general')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")

contract('GnosisSafePersonalEdition', function(accounts) {

    let gnosisSafe
    let lw

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        gnosisSafeMasterCopy.setup([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x")

        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x")
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe',
        )
    })

    it('sentinels should not be owners or modules', async () => {
        
        assert.equal(await gnosisSafe.isOwner("0x1"), false)

        let sig = "0x" + "0000000000000000000000000000000000000000000000000000000000000001" + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
        await utils.assertRejects(
            gnosisSafe.execTransaction.estimateGas("0x1", 0, "0x", 0, 0, 0, 0, 0, 0, sig, { from: "0x0000000000000000000000000000000000000001"} ),
            "Should not be able to execute transaction from sentinel as owner"
        )

        await utils.assertRejects(
            gnosisSafe.execTransactionFromModule.estimateGas("0x1", 0, "0x", 0, { from: "0x0000000000000000000000000000000000000001"} ),
            "Should not be able to execute transaction from sentinel as module"
        )
    });
})
