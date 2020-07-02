const utils = require('./utils/general')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol');

contract('GnosisSafe using contract signatures', function(accounts) {

    let owner
    let gnosisSafe
    let executor = accounts[8]

    const CALL = 0

    beforeEach(async function () {
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Mock Owners
        owner = await MockContract.new()
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([owner.address], 1, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    let simulateSignatureFailure = async function(to, value, data, operation, sigs, message) {
        let failed = false
        try {
            await gnosisSafe.execTransaction.estimateGas(
                to, value, data, operation, 0, 0, 0, 0, 0, sigs, {from: executor}
            )
        } catch (e) {
            failed = true
            assert.equal(e.message, ("VM Exception while processing transaction: revert " + message).trim())
        } finally {
            assert.ok(failed, "Transaction execution should fail")
        }
    }

    it('should fail for invalid signature bytes', async () => {
        // For any signature check they should return true
        await owner.givenAnyReturnBool(true);
        
        // Deposit 1 ETH
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'))

        let tx
        // Withdraw 1 ETH
        let to = accounts[9]
        let value = web3.toWei(1, 'ether')
        let data = "0x"
        let operation = CALL

        /** Case: Data pointer references inside signatures */
        
        let insideSigns = "0x" + "000000000000000000000000" + owner.address.replace('0x', '') + "0000000000000000000000000000000000000000000000000000000000000020" + "00" + // r, s, v  
            "0000000000000000000000000000000000000000000000000000000000000000" // Some data to read

        await simulateSignatureFailure(to, value, data, operation, insideSigns, "Invalid contract signature location: inside static part")

        /** Case: There is no data appended */
        
        let sigsBase = "0x" + "000000000000000000000000" + owner.address.replace('0x', '') + "0000000000000000000000000000000000000000000000000000000000000041" + "00" // r, s, v

        await simulateSignatureFailure(to, value, data, operation, sigsBase, "Invalid contract signature location: length not present")

        /** Case: There is a wrong length specified for the data */

        // Append faulty signature data: length, but no data
        let invalidLengthSig = sigsBase + "0000000000000000000000000000000000000000000000000000000000000020"

        await simulateSignatureFailure(to, value, data, operation, invalidLengthSig, "Invalid contract signature location: data not complete")

        // Safe should be empty again
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), web3.toWei(1, 'ether'))
    })

    
})
