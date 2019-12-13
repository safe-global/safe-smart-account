const utils = require('./utils/general')
const safeUtils = require('./utils/execution')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")


contract('GnosisSafe using eth_sign', function(accounts) {

    let gnosisSafe
    let executor = accounts[8]

    const CALL = 0
    const CREATE = 2

    let ethSign = async function(account, hash) {
        return new Promise(function (resolve, reject) {
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0", 
                method: "eth_sign",
                params: [account, hash],
                id: new Date().getTime()
            }, function(err, response) {
                if (err) { 
                    return reject(err);
                }
                resolve(response.result);
            });
        });
    }

    beforeEach(async function () {
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let gnosisSafeMasterCopy = await utils.deployContract("deploying Gnosis Safe Mastercopy", GnosisSafe)
        // Create Gnosis Safe
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[0], accounts[1], accounts[2]], 2, 0, "0x", 0, 0, 0, 0)
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe Proxy',
        )
    })

    it('should deposit and withdraw 1 ETH', async () => {
        // Deposit 1 ETH + some spare money for execution 
        assert.equal(await web3.eth.getBalance(gnosisSafe.address), 0)
        await web3.eth.sendTransaction({from: accounts[9], to: gnosisSafe.address, value: web3.toWei(1.1, 'ether')})
        assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1.1, 'ether'))

        let executorBalance = await web3.eth.getBalance(executor).toNumber()

        let confirmingAccounts = [accounts[0], accounts[2]]
        let signer = async function(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce) {
            let txHash = await gnosisSafe.getTransactionHash(to, value, data, operation, txGasEstimate, baseGasEstimate, gasPrice, txGasToken, refundReceiver, nonce)
            let signatureBytes = "0x"
            confirmingAccounts.sort()
            for (var i=0; i<confirmingAccounts.length; i++) {
                // Adjust v (it is + 27 => EIP-155 and + 4 to differentiate them from typed data signatures in the Safe)
                let signature = (await ethSign(confirmingAccounts[i], txHash)).replace('0x', '').replace(/00$/,"1f").replace(/01$/,"20")
                signatureBytes += (signature)
            }
            return signatureBytes
        }

        // Withdraw 1 ETH
        await safeUtils.executeTransactionWithSigner(signer, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', confirmingAccounts, accounts[9], web3.toWei(0.5, 'ether'), "0x", CALL, executor)

        await safeUtils.executeTransactionWithSigner(signer, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', confirmingAccounts, accounts[9], web3.toWei(0.5, 'ether'), "0x", CALL, executor)

        // Should fail as it is over the balance (payment should still happen)
        await safeUtils.executeTransactionWithSigner(signer, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', confirmingAccounts, accounts[9], web3.toWei(0.5, 'ether'), "0x", CALL, executor, { fails: true })

        let executorDiff = await web3.eth.getBalance(executor) - executorBalance
        console.log("    Executor earned " + web3.fromWei(executorDiff, 'ether') + " ETH")
        assert.ok(executorDiff > 0)
    })
})
