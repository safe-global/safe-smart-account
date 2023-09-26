import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { getSafeSingleton, getSafeWithOwners } from "../utils/setup";
import { killLibContract } from "../utils/contracts";

describe("StorageAccessible", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const [user1, user2] = await ethers.getSigners();
        const killLib = await killLibContract(user1);
        return {
            safe: await getSafeWithOwners([user1.address, user2.address], 1),
            killLib,
        };
    });

    describe("getStorage", () => {
        it("can read singleton", async () => {
            await setupTests();
            const singleton = await getSafeSingleton();
            expect(await singleton.getStorageAt(3, 2)).to.be.eq(ethers.solidityPacked(["uint256", "uint256"], [0, 1]));
        });

        it("can read instantiated Safe", async () => {
            const { safe } = await setupTests();
            const singleton = await getSafeSingleton();
            const singletonAddress = await singleton.getAddress();

            // Read singleton address, empty slots for module and owner linked lists, owner count and threshold
            expect(await safe.getStorageAt(0, 5)).to.be.eq(
                ethers.solidityPacked(["uint256", "uint256", "uint256", "uint256", "uint256"], [singletonAddress, 0, 0, 2, 1]),
            );
        });
    });

    describe("simulateAndRevert", () => {
        it("should revert changes", async () => {
            const { safe, killLib } = await setupTests();
            const killLibAddress = await killLib.getAddress();

            await expect(safe.simulateAndRevert.staticCall(killLibAddress, killLib.interface.encodeFunctionData("killme"))).to.be.reverted;
        });

        it("should revert the revert with message", async () => {
            const { safe, killLib } = await setupTests();
            const killLibAddress = await killLib.getAddress();

            await expect(safe.simulateAndRevert.staticCall(killLibAddress, killLib.interface.encodeFunctionData("trever"))).to.be.reverted;
        });

        it("should return estimate in revert", async () => {
            const { safe, killLib } = await setupTests();
            const killLibAddress = await killLib.getAddress();
            const safeAddress = await safe.getAddress();

            await expect(
                safe.simulateAndRevert.staticCall(killLibAddress, killLib.interface.encodeFunctionData("estimate", [safeAddress, "0x"])),
            ).to.be.reverted;
        });
    });
});
