import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getMock, getSafeWithOwners } from "../utils/setup";
import { buildSafeTransaction, buildSignatureBytes, executeContractCallWithSigners, executeTx, safeApproveHash } from "../../src/utils/execution";

describe("GuardManager", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupWithTemplate = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock();
        const safe = await getSafeWithOwners([user2.address])
        await executeContractCallWithSigners(safe, safe, "setGuard", [mock.address], [user2])
        return {
            safe,
            mock
        }
    })

    describe("setGuard", async () => {

        it('is correctly set', async () => {
            const { safe, mock } = await setupWithTemplate()

            const slot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("guard_manager.guard.address"))

            await executeContractCallWithSigners(safe, safe, "setGuard", [AddressZero], [user2])

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, slot)
            ).to.be.eq("0x" + "".padStart(64, "0"))

            await expect(
                await executeContractCallWithSigners(safe, safe, "setGuard", [mock.address], [user2])
            ).to.emit(safe, "ChangedGuard").withArgs(mock.address)

            // Check fallback handler
            await expect(
                await hre.ethers.provider.getStorageAt(safe.address, slot)
            ).to.be.eq("0x" + mock.address.toLowerCase().slice(2).padStart(64, "0"))
        })

        it('reverts if the guard reverts', async () => {
            const { safe, mock } = await setupWithTemplate()

            const safeTx = buildSafeTransaction({ to: mock.address, data: "0xbaddad42", nonce: 1 })
            const signature = await safeApproveHash(user2, safe, safeTx)
            const signatureBytes = buildSignatureBytes([signature])
            const guardInterface = (await hre.ethers.getContractAt("Guard", mock.address)).interface
            const checkData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas,
                safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver,
                signatureBytes, user1.address
            ])
            await mock.givenCalldataRevertWithMessage(checkData, "Computer says Nah")

            await expect(
                executeTx(safe, safeTx, [signature])
            ).to.be.revertedWith("Computer says Nah")

            await mock.reset()

            await expect(
                executeTx(safe, safeTx, [signature])
            ).to.emit(safe, "ExecutionSuccess")

            expect(await mock.callStatic.invocationCount()).to.be.deep.equals(BigNumber.from(2));
            expect(await mock.callStatic.invocationCountForCalldata(checkData)).to.be.deep.equals(BigNumber.from(1));
            expect(await mock.callStatic.invocationCountForCalldata("0xbaddad42")).to.be.deep.equals(BigNumber.from(1));
        })
    })
})