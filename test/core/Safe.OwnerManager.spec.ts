import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("OwnerManager", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;
        return {
            safe: await getSafe({ owners: [user1.address] }),
            signers,
        };
    });

    describe("addOwnerWithThreshold", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.addOwnerWithThreshold(user2.address, 1)).to.be.revertedWith("GS031");
        });

        it("can not set Safe itself", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [safeAddress, 1], [user1])).to.revertedWith(
                "GS203",
            );
        });

        it("can not set sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [AddressOne, 1], [user1])).to.revertedWith(
                "GS203",
            );
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [AddressZero, 1], [user1])).to.revertedWith(
                "GS203",
            );
        });

        it("can not add owner twice", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])).to.revertedWith(
                "GS204",
            );
        });

        it("can not add owner and change threshold to 0", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 0], [user1])).to.revertedWith(
                "GS202",
            );
        });

        it("can not add owner and change threshold to larger number than new owner count", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 3], [user1])).to.revertedWith(
                "GS201",
            );
        });

        it("emits event for new owner", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]))
                .to.emit(safe, "AddedOwner")
                .withArgs(user2.address)
                .and.to.not.emit(safe, "ChangedThreshold");

            await expect(await safe.getThreshold()).to.equal(1n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.getOwners()).to.deep.eq([user2.address, user1.address]);
        });

        it("emits event for new owner and threshold if changed", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 2], [user1]))
                .to.emit(safe, "AddedOwner")
                .withArgs(user2.address)
                .and.to.emit(safe, "ChangedThreshold")
                .withArgs(2);

            await expect(await safe.getThreshold()).to.be.deep.eq(2n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.getOwners()).to.be.deep.equal([user2.address, user1.address]);
        });
    });

    describe("removeOwner", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.removeOwner(AddressOne, user2.address, 1)).to.be.revertedWith("GS031");
        });

        it("can not remove sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, AddressOne, 1], [user1])).to.revertedWith(
                "GS203",
            );
        });

        it("can not remove 0 Address", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, AddressZero, 1], [user1])).to.revertedWith(
                "GS203",
            );
        });

        it("Invalid prevOwner, owner pair provided - Invalid target", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user1.address, 1], [user1]),
            ).to.revertedWith("GS205");
        });

        it("Invalid prevOwner, owner pair provided - Invalid sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressZero, user2.address, 1], [user1]),
            ).to.revertedWith("GS205");
        });

        it("Invalid prevOwner, owner pair provided - Invalid source", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user1.address, user2.address, 1], [user1]),
            ).to.revertedWith("GS205");
        });

        it("can not remove owner and change threshold to larger number than new owner count", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 2], [user1]),
            ).to.revertedWith("GS201");
        });

        it("can not remove owner and change threshold to 0", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 0], [user1]),
            ).to.revertedWith("GS202");
        });

        it("can not remove owner only owner", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user1.address, 1], [user1]),
            ).to.revertedWith("GS201");
        });

        it("emits event for removed owner and threshold if changed", async () => {
            const {
                safe,
                signers: [user1, user2, user3],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user3.address, 2], [user1]);
            await expect(await safe.getOwners()).to.be.deep.equal([user3.address, user2.address, user1.address]);
            await expect(await safe.getThreshold()).to.be.deep.eq(2n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.isOwner(user2.address)).to.be.true;
            await expect(await safe.isOwner(user3.address)).to.be.true;

            await expect(executeContractCallWithSigners(safe, safe, "removeOwner", [user3.address, user2.address, 1], [user1, user2]))
                .to.emit(safe, "RemovedOwner")
                .withArgs(user2.address)
                .and.to.emit(safe, "ChangedThreshold")
                .withArgs(1);
            await expect(await safe.getOwners()).to.be.deep.equal([user3.address, user1.address]);
            await expect(await safe.getThreshold()).to.be.deep.eq(1n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.isOwner(user2.address)).to.be.false;
            await expect(await safe.isOwner(user3.address)).to.be.true;

            await expect(executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user3.address, 1], [user1]))
                .to.emit(safe, "RemovedOwner")
                .withArgs(user3.address)
                .and.to.not.emit(safe, "ChangedThreshold");
            await expect(await safe.getThreshold()).to.be.deep.eq(1n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.isOwner(user2.address)).to.be.false;
            await expect(await safe.isOwner(user3.address)).to.be.false;
            await expect(await safe.getOwners()).to.be.deep.equal([user1.address]);
        });

        it("Check internal ownerCount state", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 2], [user1]),
            ).to.revertedWith("GS201");
        });
    });

    describe("swapOwner", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(safe.swapOwner(AddressOne, user1.address, user2.address)).to.be.revertedWith("GS031");
        });

        it("can not swap in Safe itself", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, safeAddress], [user1]),
            ).to.revertedWith("GS203");
        });

        it("can not swap in sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, AddressOne], [user1]),
            ).to.revertedWith("GS203");
        });

        it("can not swap in 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, AddressZero], [user1]),
            ).to.revertedWith("GS203");
        });

        it("can not swap in existing owner", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, user1.address], [user1]),
            ).to.revertedWith("GS204");
        });

        it("can not swap out sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user1.address, AddressOne, user2.address], [user1]),
            ).to.revertedWith("GS203");
        });

        it("can not swap out 0 address", async () => {
            const {
                safe,
                signers: [user1, user2, user3],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user3.address, AddressZero, user2.address], [user1]),
            ).to.revertedWith("GS203");
        });

        it("Invalid prevOwner, owner pair provided - Invalid target", async () => {
            const {
                safe,
                signers: [user1, user2, user3],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user3.address, user2.address], [user1]),
            ).to.revertedWith("GS205");
        });

        it("Invalid prevOwner, owner pair provided - Invalid sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressZero, user1.address, user2.address], [user1]),
            ).to.revertedWith("GS205");
        });

        it("Invalid prevOwner, owner pair provided - Invalid source", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user2.address, user1.address, user2.address], [user1]),
            ).to.revertedWith("GS205");
        });

        it("emits event for replacing owner", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(await safe.getOwners()).to.be.deep.eq([user1.address]);
            await expect(await safe.getThreshold()).to.eq(1n);
            await expect(await safe.isOwner(user1.address)).to.be.true;
            await expect(await safe.isOwner(user2.address)).to.be.false;

            await expect(executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, user2.address], [user1]))
                .to.emit(safe, "RemovedOwner")
                .withArgs(user1.address)
                .and.to.emit(safe, "AddedOwner")
                .withArgs(user2.address);
            await expect(await safe.getOwners()).to.be.deep.equal([user2.address]);
            await expect(await safe.getThreshold()).to.eq(1n);
            await expect(await safe.isOwner(user1.address)).to.be.false;
            await expect(await safe.isOwner(user2.address)).to.be.true;
        });
    });

    describe("changeThreshold", () => {
        it("can only be called from Safe itself", async () => {
            const { safe } = await setupTests();
            await expect(safe.changeThreshold(1)).to.be.revertedWith("GS031");
        });
    });
});
