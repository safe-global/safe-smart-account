import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners, calculateSafeMessageHash } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";

describe("SignMessageLib", async () => {
    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const lib = await (await hre.ethers.getContractFactory("SignMessageLib")).deploy();
        return {
            safe: await getSafeWithOwners([user1.address, user2.address]),
            lib,
        };
    });

    describe("signMessage", async () => {
        it("can only if msg.sender provides domain separator", async () => {
            const { lib } = await setupTests();
            await expect(lib.signMessage("0xbaddad")).to.be.reverted;
        });

        it("should emit event", async () => {
            const { safe, lib } = await setupTests();
            // Required to check that the event was emitted from the right address
            const libSafe = lib.attach(safe.address);
            const messageHash = calculateSafeMessageHash(safe, "0xbaddad", await chainId());

            expect(await safe.signedMessages(messageHash)).to.be.eq(0);

            await expect(executeContractCallWithSigners(safe, lib, "signMessage", ["0xbaddad"], [user1, user2], true))
                .to.emit(libSafe, "SignMsg")
                .withArgs(messageHash);

            expect(await safe.signedMessages(messageHash)).to.be.eq(1);
        });

        it("can be used only via DELEGATECALL opcode", async () => {
            const { lib } = await setupTests();

            expect(lib.signMessage("0xbaddad")).to.revertedWith("function selector was not recognized and there's no fallback function");
        });

        it("changes the expected storage slot without touching the most important ones", async () => {
            const { safe, lib } = await setupTests();

            const SIGNED_MESSAGES_MAPPING_STORAGE_SLOT = 7;
            const message = "no rugpull, funds must be safu";
            const eip191MessageHash = hre.ethers.utils.hashMessage(message);
            const safeInternalMsgHash = calculateSafeMessageHash(safe, hre.ethers.utils.hashMessage(message), await chainId());
            const expectedStorageSlot = hre.ethers.utils.keccak256(
                hre.ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "uint256"],
                    [safeInternalMsgHash, SIGNED_MESSAGES_MAPPING_STORAGE_SLOT],
                ),
            );

            const masterCopyAddressBeforeSigning = await hre.ethers.provider.getStorageAt(safe.address, 0);
            const ownerCountBeforeSigning = await hre.ethers.provider.getStorageAt(safe.address, 3);
            const thresholdBeforeSigning = await hre.ethers.provider.getStorageAt(safe.address, 4);
            const nonceBeforeSigning = await hre.ethers.provider.getStorageAt(safe.address, 5);
            const msgStorageSlotBeforeSigning = await hre.ethers.provider.getStorageAt(safe.address, expectedStorageSlot);

            expect(nonceBeforeSigning).to.be.eq(`0x${"0".padStart(64, "0")}`);
            expect(await safe.signedMessages(safeInternalMsgHash)).to.be.eq(0);
            expect(msgStorageSlotBeforeSigning).to.be.eq(`0x${"0".padStart(64, "0")}`);

            await executeContractCallWithSigners(safe, lib, "signMessage", [eip191MessageHash], [user1, user2], true);

            const masterCopyAddressAfterSigning = await hre.ethers.provider.getStorageAt(safe.address, 0);
            const ownerCountAfterSigning = await hre.ethers.provider.getStorageAt(safe.address, 3);
            const thresholdAfterSigning = await hre.ethers.provider.getStorageAt(safe.address, 4);
            const nonceAfterSigning = await hre.ethers.provider.getStorageAt(safe.address, 5);
            const msgStorageSlotAfterSigning = await hre.ethers.provider.getStorageAt(safe.address, expectedStorageSlot);

            expect(await safe.signedMessages(safeInternalMsgHash)).to.be.eq(1);
            expect(masterCopyAddressBeforeSigning).to.be.eq(masterCopyAddressAfterSigning);
            expect(thresholdBeforeSigning).to.be.eq(thresholdAfterSigning);
            expect(ownerCountBeforeSigning).to.be.eq(ownerCountAfterSigning);
            expect(nonceAfterSigning).to.be.eq(`0x${"1".padStart(64, "0")}`);
            expect(msgStorageSlotAfterSigning).to.be.eq(`0x${"1".padStart(64, "0")}`);
        });
    });
});
