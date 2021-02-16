import { expect } from "chai";
import { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeSingleton } from "../utils/setup";

describe("GnosisSafe", async () => {
    
    const [user1, user2, user3] = waffle.provider.getWallets();

    describe("Singleton", async () => {
        it('should not allow to call setup on mastercopy', async () => {
            await deployments.fixture();
            const singleton = await getSafeSingleton()
            await expect(
                await singleton.getThreshold()
            ).to.be.deep.eq(BigNumber.from(1))
            await expect(
                await singleton.getModules()
            ).to.be.deep.eq([])

            // "Should not be able to retrieve owners (currently the contract will run in an endless loop when not initialized)"
            await expect(
                singleton.getOwners()
            ).to.be.reverted

            await expect(
                singleton.setup([user1.address, user2.address, user3.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("Owners have already been setup")
        })
    })
})