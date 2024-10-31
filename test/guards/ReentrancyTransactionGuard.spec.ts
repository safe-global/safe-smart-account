import { expect } from "chai";
import hre from "hardhat";
import { getMock, getSafe } from "../utils/setup";
import {
    buildSafeTransaction,
    buildSignatureBytes,
    executeContractCallWithSigners,
    executeTx,
    executeTxWithSigners,
    safeSignTypedData,
} from "../../src/utils/execution";

describe("ReentrancyTransactionGuard", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const safe = await getSafe({ owners: [user1.address] });
        const guardFactory = await hre.ethers.getContractFactory("ReentrancyTransactionGuard");
        const guard = await guardFactory.deploy();
        const guardAddress = await guard.getAddress();
        const mock = await getMock();
        await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], [user1]);
        return {
            safe,
            mock,
            guardFactory,
            guard,
            guardAddress,
            signers,
        };
    });

    describe("fallback", () => {
        it("must NOT revert on fallback without value", async () => {
            const {
                guardAddress,
                signers: [user1],
            } = await setupTests();

            await user1.sendTransaction({
                to: guardAddress,
                data: "0xbaddad",
            });
        });
        it("should revert on fallback with value", async () => {
            const {
                guard,
                signers: [user1],
            } = await setupTests();
            const guardAddress = await guard.getAddress();
            await expect(
                user1.sendTransaction({
                    to: guardAddress,
                    data: "0xbaddad",
                    value: 1,
                }),
            ).to.be.reverted;
        });
    });

    describe("checkTransaction", () => {
        it("should revert if Safe tries to reenter execTransaction", async () => {
            const {
                safe,
                mock,
                signers: [user1],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const safeAddress = await safe.getAddress();
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce: nonce + 1n });
            const signatures = [await safeSignTypedData(user1, safeAddress, safeTx)];
            const signatureBytes = buildSignatureBytes(signatures);

            await expect(
                executeContractCallWithSigners(
                    safe,
                    safe,
                    "execTransaction",
                    [
                        safeTx.to,
                        safeTx.value,
                        safeTx.data,
                        safeTx.operation,
                        safeTx.safeTxGas,
                        safeTx.baseGas,
                        safeTx.gasPrice,
                        safeTx.gasToken,
                        safeTx.refundReceiver,
                        signatureBytes,
                    ],
                    [user1],
                ),
            ).to.be.revertedWith("Reentrancy detected");

            expect(await mock.invocationCount()).to.be.eq(0);
        });

        it("should be able to execute without nesting", async () => {
            const {
                safe,
                mock,
                guard,
                signers: [user1],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const safeAddress = await safe.getAddress();
            const guardAddress = await guard.getAddress();
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce: nonce + 1n });
            const signatures = [await safeSignTypedData(user1, safeAddress, safeTx)];

            await executeTxWithSigners(safe, buildSafeTransaction({ to: guardAddress, data: "0x", nonce: nonce }), [user1]);
            await executeTx(safe, safeTx, signatures);

            expect(await mock.invocationCount()).to.be.eq(1);
            expect(await mock.invocationCountForCalldata("0xbaddad42")).to.be.eq(1);
        });
    });
});
