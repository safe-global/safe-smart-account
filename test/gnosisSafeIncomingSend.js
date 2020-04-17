const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const abi = require('ethereumjs-abi')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")

contract('GnosisSafe allow incoming funds via send/transfer', function(accounts) {

    let lw
    let gnosisSafe

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should be able to receive ETH via transfer', async () => {
        // Notes: It is not possible to load storage + a call + emit event with 2300 gas
        // Test Validator
        let source = `
        contract Test {
            function sendEth(address payable safe) public payable returns (bool success) {
                safe.transfer(msg.value);
            }
        }`
        let testCaller = await safeUtils.deployContract(accounts[0], source);
        await testCaller.methods.sendEth(gnosisSafe.address).send({from: accounts[0], value: web3.utils.toWei("1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether'))
    })

    it('should be able to receive ETH via send', async () => {
        // Notes: It is not possible to load storage + a call + emit event with 2300 gas
        // Test Validator
        let source = `
        contract Test {
            function sendEth(address payable safe) public payable returns (bool success) {
                require(safe.send(msg.value));
            }
        }`
        let testCaller = await safeUtils.deployContract(accounts[0], source);
        await testCaller.methods.sendEth(gnosisSafe.address).send({from: accounts[0], value: web3.utils.toWei("1", 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.utils.toWei("1", 'ether'))
    })
})
