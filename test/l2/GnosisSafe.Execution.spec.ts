import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getMock, getSafeWithOwners } from "../utils/setup";
import { safeApproveHash, buildSafeTransaction, buildSignatureBytes, executeTx, executeContractCallWithSigners } from "../../src/utils/execution";
import { parseEther } from "@ethersproject/units";
import { safeContractUnderTest } from "../utils/config";

describe("GnosisSafeL2", async () => {

    before(function () {
        if (safeContractUnderTest() != "GnosisSafeL2") {
            this.skip()
        }
    });

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock()
        return {
            safe: await getSafeWithOwners([user1.address]),
            mock
        }
    })

    describe("execTransactions", async () => {

        it('should emit SafeMultiSigTransaction event', async () => {
            const { safe } = await setupTests()
            const tx = buildSafeTransaction({
                to: user1.address, nonce: await safe.nonce(), operation: 0, gasPrice: 1, safeTxGas: 100000, refundReceiver: user2.address
            })

            await user1.sendTransaction({ to: safe.address, value: parseEther("1") })
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

            await expect(
                user2Safe.execTransactionFromModule(mock.address, 0, "0xbaddad", 0)
            )
                .to.emit(safe, "SafeModuleTransaction").withArgs(user2.address, mock.address, 0, "0xbaddad", 0)
                .to.emit(safe, "ExecutionFromModuleSuccess").withArgs(user2.address)
        })

    })
})