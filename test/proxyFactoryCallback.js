const utils = require('./utils/general')

const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const IProxyCreationCallback = artifacts.require("./IProxyCreationCallback.sol")
const MockContract = artifacts.require('./MockContract.sol')

contract('ProxyFactory', function(accounts) {

    let proxyFactory

    beforeEach(async function () {
        proxyFactory = await ProxyFactory.new()
    })

    it('Check callback is invoked', async () => {
        let mock = await MockContract.new()
        let callback = await IProxyCreationCallback.at(mock.address)
        let proxy = utils.getParamFromTxEvent(
            await proxyFactory.createProxyWithCallback(proxyFactory.address, "0x", 123456, callback.address),
            'ProxyCreation', 'proxy', proxyFactory.address, null, 'create proxy',
        )

        let allInvocations = await mock.invocationCount.call()
        assert.equal(1, allInvocations)

        let callbackData = callback.contract.proxyCreated.getData(proxy, proxyFactory.address, "0x", 123456)
        let callbackInvocations = await mock.invocationCountForMethod.call(callbackData)
        assert.equal(1, callbackInvocations)

    })

    it('Check callback error cancels deployment', async () => {
        let mock = await MockContract.new()
        await mock.givenAnyRevert()
        await utils.assertRejects(
            proxyFactory.createProxyWithCallback(proxyFactory.address, "0x", 123456, mock.address),
            "Should fail if callback fails"
        )
        
        await mock.reset()
        // Should be successfull now
        await proxyFactory.createProxyWithCallback(proxyFactory.address, "0x", 123456, mock.address)
    })

    it('Should work without callback', async () => {
        await proxyFactory.createProxyWithCallback(proxyFactory.address, "0x", 123456, 0)
    })
})
