import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { deployContractFromSource, getSafe } from "../utils/setup";

describe("Safe", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const gasCappedTransferSource = `
            contract Test {
                function transferEth(address payable safe) public payable returns (bool success) {
                    safe.transfer(msg.value);
                }
                function sendEth(address payable safe) public payable returns (bool success) {
                    require(safe.send(msg.value));
                }
            }`;
        const callSource = `
            contract Test {
                function callEth(address payable safe) public payable returns (bool success) {
                    (bool success,) = safe.call{ value: msg.value }("");
                    require(success);
                }
            }`;
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        return {
            safe: await getSafe({ owners: [user1.address] }),
            gasCappedTransferContract: hre.network.zksync ? null : await deployContractFromSource(user1, gasCappedTransferSource),
            callContract: await deployContractFromSource(user1, callSource),
            signers,
        };
    });

    describe("fallback", () => {
        it("should be able to receive ETH via transfer", async () => {
            if (hre.network.zksync) {
                // zksync doesn't support .transfer
                return;
            }

            const { safe, gasCappedTransferContract } = await setupTests();
            const safeAddress = await safe.getAddress();

            // Notes: It is not possible to load storage + a call + emit event with 2300 gas
            await expect(gasCappedTransferContract?.transferEth(safeAddress, { value: ethers.parseEther("1") })).to.be.reverted;
        });

        it("should be able to receive ETH via send", async () => {
            if (hre.network.zksync) {
                // zksync doesn't support .transfer
                return;
            }

            const { safe, gasCappedTransferContract } = await setupTests();
            const safeAddress = await safe.getAddress();

            // Notes: It is not possible to load storage + a call + emit event with 2300 gas
            await expect(gasCappedTransferContract?.sendEth(safeAddress, { value: ethers.parseEther("1") })).to.be.reverted;
        });

        it("should be able to receive ETH via call", async () => {
            const { safe, callContract } = await setupTests();
            const safeAddress = await safe.getAddress();
            const callerAddress = await callContract.getAddress();

            await expect(
                callContract.callEth(safeAddress, {
                    value: ethers.parseEther("1"),
                }),
            )
                .to.emit(safe, "SafeReceived")
                .withArgs(callerAddress, ethers.parseEther("1"));
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("1"));
        });

        it("should be able to receive ETH via transaction", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            await expect(
                user1.sendTransaction({
                    to: safeAddress,
                    value: ethers.parseEther("1"),
                }),
            )
                .to.emit(safe, "SafeReceived")
                .withArgs(user1.address, ethers.parseEther("1"));
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("1"));
        });

        it("should throw for incoming eth with data", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            await expect(user1.sendTransaction({ to: safeAddress, value: 23, data: "0xbaddad" })).to.be.revertedWithoutReason();
        });
    });
});
