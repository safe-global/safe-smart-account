import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getMock } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("OwnerManager", async () => {

    const [user1, user2, user3] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address])
        }
    })

    describe("addOwnerWithThreshold", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.addOwnerWithThreshold(user2.address, 1)).to.be.revertedWith("GS031")
        })

        it('can not set Safe itself', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [safe.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not set sentinel', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [AddressOne, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not set 0 Address', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [AddressZero, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not add owner twice', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])

            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not add owner and change threshold to 0', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 0], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not add owner and change threshold to larger number than new owner count', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 3], [user1])
            ).to.revertedWith("GS013")
        })

        it('emits event for new owner', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            ).to.emit(safe, "AddedOwner").withArgs(user2.address).and.to.not.emit(safe, "ChangedThreshold")

            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.getOwners()).to.be.deep.equal([user2.address, user1.address])
        })

        it('emits event for new owner and threshold if changed', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 2], [user1])
            )
                .to.emit(safe, "AddedOwner").withArgs(user2.address)
                .and.to.emit(safe, "ChangedThreshold").withArgs(2)

            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(2))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.getOwners()).to.be.deep.equal([user2.address, user1.address])
        })
    })

    describe("removeOwner", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.removeOwner(AddressOne, user2.address, 1)).to.be.revertedWith("GS031")
        })

        it('can not remove sentinel', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])

            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, AddressOne, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not remove 0 Address', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])

            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, AddressZero, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid target', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user1.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid sentinel', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressZero, user2.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid source', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user1.address, user2.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not remove owner and change threshold to larger number than new owner count', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 2], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not remove owner and change threshold to 0', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 0], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not remove owner only owner', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user1.address, 1], [user1])
            ).to.revertedWith("GS013")
        })

        it('emits event for removed owner and threshold if changed', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user3.address, 2], [user1])
            await expect(await safe.getOwners()).to.be.deep.equal([user3.address, user2.address, user1.address])
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(2))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.isOwner(user2.address)).to.be.true
            await expect(await safe.isOwner(user3.address)).to.be.true

            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user3.address, user2.address, 1], [user1, user2])
            ).to.emit(safe, "RemovedOwner").withArgs(user2.address).and.to.emit(safe, "ChangedThreshold").withArgs(1)
            await expect(await safe.getOwners()).to.be.deep.equal([user3.address, user1.address])
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.isOwner(user2.address)).to.be.false
            await expect(await safe.isOwner(user3.address)).to.be.true

            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [AddressOne, user3.address, 1], [user1])
            ).to.emit(safe, "RemovedOwner").withArgs(user3.address).and.to.not.emit(safe, "ChangedThreshold")
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.isOwner(user2.address)).to.be.false
            await expect(await safe.isOwner(user3.address)).to.be.false
            await expect(await safe.getOwners()).to.be.deep.equal([user1.address])
        })

        it.skip('Check internal ownercount state', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "addOwnerWithThreshold", [user2.address, 1], [user1])
            await expect(
                executeContractCallWithSigners(safe, safe, "removeOwner", [user2.address, user1.address, 2], [user1])
            ).to.revertedWith("GS013")
        })
    })

    describe("swapOwner", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.swapOwner(AddressOne, user1.address, user2.address)).to.be.revertedWith("GS031")
        })

        it('can not swap in Safe itself', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, safe.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not swap in sentinel', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, AddressOne], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not swap in 0 Address', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, AddressZero], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not swap in existing owner', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, user1.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not swap out sentinel', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user1.address, AddressOne, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('can not swap out 0 address', async () => {
            const { safe } = await setupTests()

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user3.address, AddressZero, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid target', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user3.address, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid sentinel', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressZero, user1.address, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('Invalid prevOwner, owner pair provided - Invalid source', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [user2.address, user1.address, user2.address], [user1])
            ).to.revertedWith("GS013")
        })

        it('emits event for replacing owner', async () => {
            const { safe } = await setupTests()
            await expect(await safe.getOwners()).to.be.deep.equal([user1.address])
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.isOwner(user1.address)).to.be.true
            await expect(await safe.isOwner(user2.address)).to.be.false

            await expect(
                executeContractCallWithSigners(safe, safe, "swapOwner", [AddressOne, user1.address, user2.address], [user1])
            ).to.emit(safe, "RemovedOwner").withArgs(user1.address).and.to.emit(safe, "AddedOwner").withArgs(user2.address)
            await expect(await safe.getOwners()).to.be.deep.equal([user2.address])
            await expect(await safe.getThreshold()).to.be.deep.eq(BigNumber.from(1))
            await expect(await safe.isOwner(user1.address)).to.be.false
            await expect(await safe.isOwner(user2.address)).to.be.true
        })
    })

    describe("changeThreshold", async () => {
        it('can only be called from Safe itself', async () => {
            const { safe } = await setupTests()
            await expect(safe.changeThreshold(1)).to.be.revertedWith("GS031")
        })
    })
})