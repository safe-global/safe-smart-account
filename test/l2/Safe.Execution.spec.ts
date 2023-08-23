import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { getMock, getSafeWithOwners } from "../utils/setup";
import {
    safeApproveHash,
    buildSafeTransaction,
    buildSignatureBytes,
    executeTx,
    executeContractCallWithSigners,
} from "../../src/utils/execution";
import { safeContractUnderTest } from "../utils/config";

describe("SafeL2", () => {
    before(function () {
        if (safeContractUnderTest() != "SafeL2") {
            this.skip();
        }
    });

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        const signers = await ethers.getSigners();
        const [user1] = signers;
        await deployments.fixture();
        const mock = await getMock();
        return {
            safe: await getSafeWithOwners([user1.address]),
            mock,
            signers,
        };
    });

    describe("execTransactions", async () => {
        it("should emit SafeMultiSigTransaction event", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const tx = buildSafeTransaction({
                to: user1.address,
                nonce: await safe.nonce(),
                operation: 0,
                gasPrice: 1,
                safeTxGas: 100000,
                refundReceiver: user2.address,
            });

            await user1.sendTransaction({ to: safeAddress, value: ethers.parseEther("1") });
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.be.deep.eq(ethers.parseEther("1"));

            const additionalInfo = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address", "uint256"],
                [tx.nonce, user1.address, 1],
            );
            const signatures = [await safeApproveHash(user1, safe, tx, true)];
            const signatureBytes = buildSignatureBytes(signatures).toLowerCase();

            await expect(executeTx(safe, tx, signatures))
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
                    additionalInfo,
                );
        });

        it("should emit SafeModuleTransaction event", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "SafeModuleTransaction")
                .withArgs(user2.address, mockAddress, 0, "0xbaddad", 0)
                .to.emit(safe, "ExecutionFromModuleSuccess")
                .withArgs(user2.address);
        });
    });
});
