import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { defaultCallbackHandlerContract, defaultCallbackHandlerDeployment, getSafeTemplate, getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";

describe.only("ModuleManager", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return await getSafeWithOwners([user1.address])
    })

    describe("setFallbackManager", async () => {
        it('can only be called from Safe itself', async () => {
            const safe = await setupTests()
            await expect(
                await safe.enabledModule(user2.address)
            ).to.be.revertedWith("Method can only be called from this contract")
        })
    })
})