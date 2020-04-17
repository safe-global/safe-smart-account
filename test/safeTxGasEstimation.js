const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")
const CreateCall = artifacts.require("./CreateCall.sol")

contract('Gas Estimation', function(accounts) {

    let gnosisSafe
    let lw
    let executor = accounts[8]

    const CALL = 0

    let gasUserContract

    const CONTRACT_SOURCE = `
    contract Test {

        uint256[] public data;

        constructor() public payable {}

        function nested(uint256 level, uint256 count) external {
            if (level == 0) {
                for (uint256 i = 0; i < count; i++) {
                    data.push(i);
                }
                return;
            }
            this.nested(level - 1, count);
        }

        function useGas(uint256 count) public {
            this.nested(6, count);
            this.nested(8, count);
        }
    }`

    beforeEach(async function () {
        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        gnosisSafe = await utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )

        // Test contract
        gasUserContract = await safeUtils.deployContract(accounts[0], CONTRACT_SOURCE);
    })

    // We skip this tests as it doesn't work with ganache-cli 6.3.0 but other more important test don't work with newer versions than that
    it.skip('should work with contract that uses a lot of gas', async () => {
        // Fund account for execution 
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.utils.toWei("1", 'ether')})

        let executorBalance = await web3.eth.getBalance(executor)

        let data = await gasUserContract.useGas(80).encodeABI()
        await safeUtils.executeTransaction(
            lw, gnosisSafe, 'call nested contract', [lw.accounts[0], lw.accounts[1]], 
            gasUserContract.options.address, 0, data, CALL, 
            executor
        )

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.utils.fromWei(executorDiff.toString(), 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
