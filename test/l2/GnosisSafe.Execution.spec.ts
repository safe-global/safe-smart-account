import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getMock, getSafeWithOwners, getWallets } from "../utils/setup";
import { safeApproveHash, buildSafeTransaction, buildSignatureBytes, executeTx, executeContractCallWithSigners } from "../../src/utils/execution";
import { parseEther } from "@ethersproject/units";
import { safeContractUnderTest } from "../utils/config";

describe("GnosisSafeL2", async () => {

    before(function () {
        if (safeContractUnderTest() != "GnosisSafeL2") {
            this.skip()
        }
    });

    const [user1, user2] = getWallets(hre);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock()
        return {
            safe: await getSafeWithOwners([user1.address]),
            mock
        }
    })

    describe("execTransactions", async () => {

        /**
         * ## In order not to trigger HandlePayment() in GnosisSafe.sol (which uses unsupported send() function)
         * we don't set gasPrice and refundReceiver
         * It should be possible to use HandlePayment() after a protocol upgrade (see link2) 
         * @see https://era.zksync.io/docs/dev/building-on-zksync/contracts/differences-with-ethereum.html#using-call-over-send-or-transfer
         * @see https://twitter.com/zksync/status/1644459406828924934
         */
        it('should emit SafeMultiSigTransaction event', async () => {
            const { safe } = await setupTests()
            const tx = buildSafeTransaction({
                to: user1.address, nonce: await safe.nonce(), operation: 0, 
                gasPrice: hre.network.zksync ? undefined : 1, 
                safeTxGas: 100000, 
                refundReceiver: hre.network.zksync ? undefined : user2.address
            })

            await (await user1.sendTransaction({ to: safe.address, value: parseEther("1") })).wait()
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1"))

            const additionalInfo = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [tx.nonce, user1.address, 1])
            const signatures = [await safeApproveHash(user1, safe, tx, true)]
            const signatureBytes = buildSignatureBytes(signatures).toLowerCase()
            let executedTx: any;
            await expect(
                executeTx(safe, tx, signatures).then((tx) => { executedTx = tx; return tx })
            )
                .to.emit(safe, "ExecutionSuccess")
                .to.emit(safe, "SafeMultiSigTransaction")
                .withArgs(
                    tx.to,
                    tx.value,
                    tx.data,
                    tx.operation,
                    tx.safeTxGas,
                    tx.baseGas,
                    tx.gasPrice,
                    tx.gasToken,
                    tx.refundReceiver,
                    signatureBytes,
                    additionalInfo
                )
        })

        it('should emit SafeModuleTransaction event', async () => {
            const { safe, mock } = await setupTests()
            const user2Safe = safe.connect(user2)
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])

            //Use manual gasLimit because gas estimation fails for this function on zkSync, though transaction executed successfully
            await expect(
                user2Safe.execTransactionFromModule(
                    mock.address, 0, "0xbaddad", 0, 
                    { gasLimit: hre.network.zksync ? 500000 : undefined }
                )
            )
                .to.emit(safe, "SafeModuleTransaction").withArgs(user2.address, mock.address, 0, "0xbaddad", 0)
                .to.emit(safe, "ExecutionFromModuleSuccess").withArgs(user2.address)
        })

    })
})
