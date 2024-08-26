import { signHash } from "./../../src/utils/execution";
import { expect } from "chai";
import hre from "hardhat";
import { getMock, getSafe } from "../utils/setup";
import { buildSafeTransaction, calculateSafeTransactionHash, executeContractCallWithSigners, executeTx } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { getSenderAddressFromContractRunner } from "../utils/contracts";

describe("DebugTransactionGuard", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const safe = await getSafe({ owners: [user1.address] });
        const guardFactory = await hre.ethers.getContractFactory("DebugTransactionGuard");
        const guard = await guardFactory.deploy();
        const guardAddress = await guard.getAddress();
        const mock = await getMock();
        await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], [user1]);
        return {
            safe,
            mock,
            guardFactory,
            guard,
            signers,
        };
    });

    describe("fallback", () => {
        it("must NOT revert on fallback without value", async () => {
            const {
                guard,
                signers: [user1],
            } = await setupTests();
            const guardAddress = await guard.getAddress();
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
        it("should emit debug events", async () => {
            const {
                safe,
                mock,
                guard,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            const mockAddress = await mock.getAddress();
            const senderAddress = await getSenderAddressFromContractRunner(safe);
            const nonce = await safe.nonce();
            const safeTx = buildSafeTransaction({ to: mockAddress, data: "0xbaddad42", nonce });
            const safeTxHash = calculateSafeTransactionHash(safeAddress, safeTx, await chainId());
            const signature = await signHash(user1, safeTxHash);

            await expect(executeTx(safe, safeTx, [signature]))
                .to.emit(guard, "TransactionDetails")
                .withArgs(
                    safeAddress,
                    safeTxHash,
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.operation,
                    safeTx.safeTxGas,
                    false,
                    safeTx.nonce,
                    signature.data,
                    senderAddress,
                )
                .and.to.emit(guard, "GasUsage")
                .withArgs(safeAddress, safeTxHash, nonce, true);

            expect(await mock.invocationCount.staticCall()).to.be.eq(1);
            expect(await mock.invocationCountForCalldata.staticCall("0xbaddad42")).to.be.eq(1);
        });
    });
});
