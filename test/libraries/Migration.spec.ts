import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners, getSafeSingleton, migrationContract } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";

describe("Migration", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        // TODO: replace with test singleton
        const migration = await (await migrationContract()).deploy(user1.address)
        return {
            singleton: await getSafeSingleton(),
            safe: await getSafeWithOwners([user1.address]),
            migration
        }
    })
    describe("constructor", async () => {
        it('can not use 0 Address', async () => {
            await setupTests()
            const tx = (await migrationContract()).getDeployTransaction(AddressZero)
            await expect(
                user1.sendTransaction(tx)
            ).to.be.revertedWith("Invalid singleton address provided")
        })
    })

    describe("migrate", async () => {
        it('can only be called from Safe itself', async () => {
            const { migration } = await setupTests()
            await expect(migration.migrate()).to.be.revertedWith("Method can only be called from this contract")
        })

        it.skip('can migrate', async () => {
        })
    })
})