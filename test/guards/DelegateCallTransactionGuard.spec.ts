import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners } from "../utils/setup";
import { executeContractCallWithSigners } from "../utils/execution";

describe("DelegateCallTransactionGuard", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const safe = await getSafeWithOwners([user1.address])
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero)
        await executeContractCallWithSigners(safe, safe, "setGuard", [guard.address], [user1]) 
        return {
            safe,
            guard
        }
    })

    describe("fallback", async () => {
        it.skip('must NOT revert on fallbacl', async () => {
        })
    })
    
    describe("checkCalldata", async () => {

        it.skip('must NOT revert on unknown calldata', async () => {
        })

        it('should on delegate call', async () => {
            const { safe } = await setupTests()
            await expect(
                executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1], true)
            ).to.be.revertedWith("This call is restricted")

            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user1])
        })
    })
})