const utils = require('./utils/general')

const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const DefaultCallbackHandler = artifacts.require("./handler/DefaultCallbackHandler.sol")
const MockToken = artifacts.require('./mocks/ERC1155Token.sol');
        

contract('DefaultCallbackHandler', function(accounts) {

    let executor = accounts[8]
    let gnosisSafe
    let handler
    let lw

    const CALL = 0

    beforeEach(async function () {
        // Create Gnosis Safe and MultiSend library
        lw = await utils.createLightwallet()
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe", GnosisSafe)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, ""),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Module',
        )
        handler = await DefaultCallbackHandler.new()
    })

    it('test default handler callbacks', async () => {
        assert.equal(await handler.onERC1155Received.call(0, 0, 0, 0, 0), "0xf23a6e61")
        assert.equal(await handler.onERC1155BatchReceived.call(0, 0, [], [], 0), "0xbc197c81")
        assert.equal(await handler.onERC721Received.call(0, 0, 0, 0), "0x150b7a02")
        await handler.tokensReceived.call(0, 0, 0, 0, 0, 0) // Check that it doesn' revert
    })

    it('setup Safe with fallback handler', async () => {
        let safeHandler = DefaultCallbackHandler.at(gnosisSafe.address)
        // Check that Safe is NOT setup
        assert.equal(await gnosisSafe.getThreshold(), 0)
        // Check unset callbacks
        assert.equal(await safeHandler.onERC1155Received.call(0, 0, 0, 0, 0), "0x")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(0, 0, [], [], 0), "0x")
        assert.equal(await safeHandler.onERC721Received.call(0, 0, 0, 0), "0x")
        await safeHandler.tokensReceived.call(0, 0, 0, 0, 0, 0) // Check that it doesn' revert
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0, handler.address, 0, 0, 0)
        // Check fallback handler
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"), handler.address)
        // Check that Safe is setup
        assert.equal(await gnosisSafe.getThreshold(), 1)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1]])
        // Check callbacks
        assert.equal(await safeHandler.onERC1155Received.call(0, 0, 0, 0, 0), "0xf23a6e61")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(0, 0, [], [], 0), "0xbc197c81")
        assert.equal(await safeHandler.onERC721Received.call(0, 0, 0, 0), "0x150b7a02")
        await safeHandler.tokensReceived.call(0, 0, 0, 0, 0, 0) // Check that it doesn' revert
    })

    it('set fallback handler after Safe setup', async () => {
        let safeHandler = DefaultCallbackHandler.at(gnosisSafe.address)
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0, 0, 0, 0, 0)
        // Check that Safe is setup
        assert.equal(await gnosisSafe.getThreshold(), 1)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1]])
        // Check unset callbacks
        assert.equal(await safeHandler.onERC1155Received.call(0, 0, 0, 0, 0), "0x")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(0, 0, [], [], 0), "0x")
        assert.equal(await safeHandler.onERC721Received.call(0, 0, 0, 0), "0x")
        await safeHandler.tokensReceived.call(0, 0, 0, 0, 0, 0) // Check that it doesn' revert
        // Set fallback handler should fail if not triggered from contract
        await utils.assertRejects(
            gnosisSafe.setFallbackHandler(handler.address),
            "Should not be able to set fallback handler without Safe transaction"
        )
        // Set fallback handler via Safe transaction
        let setFallbackHandlerData = gnosisSafe.contract.setFallbackHandler.getData(handler.address)
        let transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, setFallbackHandlerData, CALL, 0, 0, 0, 0, 0, 0)
        let sigs = await utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        await gnosisSafe.execTransaction(gnosisSafe.address, 0, setFallbackHandlerData, CALL, 0, 0, 0, 0, 0, sigs, {from: executor})
        // Check fallback handler
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"), handler.address)
        // Check callbacks
        assert.equal(await safeHandler.onERC1155Received.call(0, 0, 0, 0, 0), "0xf23a6e61")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(0, 0, [], [], 0), "0xbc197c81")
        assert.equal(await safeHandler.onERC721Received.call(0, 0, 0, 0), "0x150b7a02")
        await safeHandler.tokensReceived.call(0, 0, 0, 0, 0, 0) // Check that it doesn' revert
    })

    it('check ERC1155 impl success', async () => {
        let token = await MockToken.new()
        
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0, handler.address, 0, 0, 0)
        // Check fallback handler
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"), handler.address)
        // Check minting tokens to contract
        await token.mint(gnosisSafe.address, 23, 1337, 0)
        assert.equal(await token.balanceOf.call(gnosisSafe.address, 23), 1337)
        
        // Check transfering tokens to contract
        await token.mint(accounts[0], 23, 23, 0)
        assert.equal(await token.balanceOf.call(accounts[0], 23), 23)

        await token.safeTransferFrom(accounts[0], gnosisSafe.address, 23, 23, 0)
        assert.equal(await token.balanceOf.call(accounts[0], 23), 0)
        assert.equal(await token.balanceOf.call(gnosisSafe.address, 23), 1360)
    })

    it('check ERC1155 impl reject', async () => {
        let token = await MockToken.new()
        
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, 0, 0, 0, 0, 0, 0)
        // Check fallback handler
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"), 0)

        await utils.assertRejects(
            token.mint(gnosisSafe.address, 23, 1337, 0),
            "Should not accept minted token if handler not set"
        )
        
        await token.mint(accounts[0], 23, 1337, 0)
        assert.equal(await token.balanceOf.call(accounts[0], 23), 1337)

        await utils.assertRejects(
            token.safeTransferFrom(accounts[0], gnosisSafe.address, 23, 1337, 0),
            "Should not accept sent token if handler not set"
        )
    })
})
