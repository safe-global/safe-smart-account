const utils = require('./utils/general')

const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol");
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
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, "0x"),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Module',
        )
        handler = await DefaultCallbackHandler.new()
    })

    it('test default handler callbacks', async () => {
        assert.equal(await handler.onERC1155Received.call(utils.Address0, utils.Address0, 0, 0, "0x"), "0xf23a6e61")
        assert.equal(await handler.onERC1155BatchReceived.call(utils.Address0, utils.Address0, [], [], "0x"), "0xbc197c81")
        assert.equal(await handler.onERC721Received.call(utils.Address0, utils.Address0, 0, "0x"), "0x150b7a02")
        await handler.tokensReceived.call(utils.Address0, utils.Address0, utils.Address0, 0, "0x", "0x") // Check that it doesn't revert
    })

    const checkRawResponse = async (contract, data, expectedResponse) => {
        assert.equal(await web3.eth.call({
            to: contract.address,
            data: data,
        }), expectedResponse)
    }

    it('setup Safe with fallback handler', async () => {
        let safeHandler = await DefaultCallbackHandler.at(gnosisSafe.address)
        // Check that Safe is NOT setup
        assert.equal(await gnosisSafe.getThreshold(), 0)
        // Check unset callbacks
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC1155Received(utils.Address0, utils.Address0, 0, 0, "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC1155BatchReceived(utils.Address0, utils.Address0, [], [], "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC721Received(utils.Address0, utils.Address0, 0, "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.tokensReceived(utils.Address0, utils.Address0, utils.Address0, 0, "0x", "0x").encodeABI(), "0x")
        // Setup Safe
        await gnosisSafe.setup([accounts[0], accounts[1]], 1, utils.Address0, "0x", handler.address, utils.Address0, 0, utils.Address0)
        // Check fallback handler
        const fallbackHandlerAddress = await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
        assert.equal(fallbackHandlerAddress, handler.address.toLowerCase())
        // Check that Safe is setup
        assert.equal(await gnosisSafe.getThreshold(), 1)
        assert.deepEqual(await gnosisSafe.getOwners(), [accounts[0], accounts[1]])
        // Check callbacks
        assert.equal(await safeHandler.onERC1155Received.call(utils.Address0, utils.Address0, 0, 0, "0x"), "0xf23a6e61")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(utils.Address0, utils.Address0, [], [], "0x"), "0xbc197c81")
        assert.equal(await safeHandler.onERC721Received.call(utils.Address0, utils.Address0, 0, "0x"), "0x150b7a02")
        await safeHandler.tokensReceived.call(utils.Address0, utils.Address0, utils.Address0, 0, "0x", "0x") // Check that it doesn't revert
    })

    it('set fallback handler after Safe setup', async () => {
        let safeHandler = await DefaultCallbackHandler.at(gnosisSafe.address)
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0)
        // Check that Safe is setup
        assert.equal(await gnosisSafe.getThreshold(), 1)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1]].map((a) => web3.utils.toChecksumAddress(a)))
        // Check unset callbacks
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC1155Received(utils.Address0, utils.Address0, 0, 0, "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC1155BatchReceived(utils.Address0, utils.Address0, [], [], "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.onERC721Received(utils.Address0, utils.Address0, 0, "0x").encodeABI(), "0x")
        checkRawResponse(safeHandler, await safeHandler.contract.methods.tokensReceived(utils.Address0, utils.Address0, utils.Address0, 0, "0x", "0x").encodeABI(), "0x")
        // Set fallback handler should fail if not triggered from contract
        await utils.assertRejects(
            gnosisSafe.setFallbackHandler(handler.address),
            "Should not be able to set fallback handler without Safe transaction"
        )
        // Set fallback handler via Safe transaction
        let setFallbackHandlerData = gnosisSafe.contract.methods.setFallbackHandler(handler.address).encodeABI()
        let transactionHash = await gnosisSafe.getTransactionHash(gnosisSafe.address, 0, setFallbackHandlerData, CALL, 0, 0, 0, utils.Address0, utils.Address0, 0)
        let sigs = await utils.signTransaction(lw, [lw.accounts[0]], transactionHash)
        await gnosisSafe.execTransaction(gnosisSafe.address, 0, setFallbackHandlerData, CALL, 0, 0, 0, utils.Address0, utils.Address0, sigs, {from: executor})
        // Check fallback handler
        const fallbackHandlerAddress = await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
        assert.equal(fallbackHandlerAddress, handler.address.toLowerCase())
        // Check callbacks
        assert.equal(await safeHandler.onERC1155Received.call(utils.Address0, utils.Address0, 0, 0, "0x"), "0xf23a6e61")
        assert.equal(await safeHandler.onERC1155BatchReceived.call(utils.Address0, utils.Address0, [], [], "0x"), "0xbc197c81")
        assert.equal(await safeHandler.onERC721Received.call(utils.Address0, utils.Address0, 0, "0x"), "0x150b7a02")
        await safeHandler.tokensReceived.call(utils.Address0, utils.Address0, utils.Address0, 0, "0x", "0x") // Check that it doesn't revert
    })

    it('check ERC1155 impl success', async () => {
        let token = await MockToken.new()
        
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, utils.Address0, "0x", handler.address, utils.Address0, 0, utils.Address0)
        // Check fallback handler
        const fallbackHandlerAddress = await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5")
        assert.equal(fallbackHandlerAddress, handler.address.toLowerCase())
        // Check minting tokens to contract
        await token.mint(gnosisSafe.address, 23, 1337, "0x")
        assert.equal(await token.balanceOf.call(gnosisSafe.address, 23), 1337)
        
        // Check transfering tokens to contract
        await token.mint(accounts[0], 23, 23, "0x")
        assert.equal(await token.balanceOf.call(accounts[0], 23), 23)

        await token.safeTransferFrom(accounts[0], gnosisSafe.address, 23, 23, "0x")
        assert.equal(await token.balanceOf.call(accounts[0], 23), 0)
        assert.equal(await token.balanceOf.call(gnosisSafe.address, 23), 1360)
    })

    it('check ERC1155 impl reject', async () => {
        let token = await MockToken.new()
        
        // Setup Safe
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1]], 1, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0)
        // Check fallback handler
        assert.equal(await web3.eth.getStorageAt(gnosisSafe.address, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"), 0)

        await utils.assertRejects(
            token.mint(gnosisSafe.address, 23, 1337, "0x"),
            "Should not accept minted token if handler not set"
        )
        
        await token.mint(accounts[0], 23, 1337, "0x")
        assert.equal(await token.balanceOf.call(accounts[0], 23), 1337)

        await utils.assertRejects(
            token.safeTransferFrom(accounts[0], gnosisSafe.address, 23, 1337, "0x"),
            "Should not accept sent token if handler not set"
        )
    })
})
