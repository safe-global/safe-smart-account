const utils = require('./utils/general')
const safeUtils = require('./utils/execution')


const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")


contract('GnosisSafe using eth_signTypedData', function(accounts) {

    let gnosisSafe
    let executor = accounts[8]

    const CALL = 0
    const CREATE = 2

    let signTypedData = async function(account, data) {
        return new Promise(function (resolve, reject) {
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0", 
                method: "eth_signTypedData",
                params: [account, data],
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
            let typedData = {
                types: {
                    EIP712Domain: [
                        { type: "address", name: "verifyingContract" }
                    ],
                    // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
                    SafeTx: [
                        { type: "address", name: "to" },
                        { type: "uint256", name: "value" },
                        { type: "bytes", name: "data" },
                        { type: "uint8", name: "operation" },
                        { type: "uint256", name: "safeTxGas" },
                        { type: "uint256", name: "baseGas" },
                        { type: "uint256", name: "gasPrice" },
                        { type: "address", name: "gasToken" },
                        { type: "address", name: "refundReceiver" },
                        { type: "uint256", name: "nonce" },
                    ]
                },
                domain: {
                    verifyingContract: gnosisSafe.address
                },
                primaryType: "SafeTx",
                message: {
                    to: to,
                    value: value,
                    data: data,
                    operation: operation,
                    safeTxGas: txGasEstimate,
                    baseGas: baseGasEstimate,
                    gasPrice: gasPrice,
                    gasToken: txGasToken,
                    refundReceiver: refundReceiver,
                    nonce: nonce.toNumber()
                }
            }
            let signatureBytes = "0x"
            confirmingAccounts.sort()
            for (var i=0; i<confirmingAccounts.length; i++) {
                signatureBytes += (await signTypedData(confirmingAccounts[i], typedData)).replace('0x', '')
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
