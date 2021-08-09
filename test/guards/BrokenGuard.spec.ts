import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getMock, getSafeWithOwners } from "../utils/setup";
import { buildSafeTransaction, calculateSafeTransactionHash, executeContractCallWithSigners, executeTxWithSigners } from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { AddressZero } from "@ethersproject/constants";

describe("BrokenGuard", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const safe = await getSafeWithOwners([user1.address])
        const guardFactory = await hre.ethers.getContractFactory("BrokenGuard");
        const guard = await guardFactory.deploy()
        const mock = await getMock()
        await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1])

        return {
            safe,
            mock
        }
    })

    describe("reverting guard should be replaceable", async () => {
        it('owner should be able to turn guard off', async () => {
            const { safe } = await setupTests()
            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1])
        })
    })
})
