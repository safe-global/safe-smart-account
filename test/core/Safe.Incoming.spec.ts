import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { deployContract, getSafeWithOwners } from "../utils/setup";

describe("Safe", () => {
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const source = `
        contract Test {
            function transferEth(address payable safe) public payable returns (bool success) {
                safe.transfer(msg.value);
            }
            function sendEth(address payable safe) public payable returns (bool success) {
                require(safe.send(msg.value));
            }
            function callEth(address payable safe) public payable returns (bool success) {
                (bool success,) = safe.call{ value: msg.value }("");
                require(success);
            }
        }`;
        const signers = await ethers.getSigners();
        const [user1] = signers;
        return {
            safe: await getSafeWithOwners([user1.address]),
            caller: await deployContract(user1, source),
            signers,
        };
    });

    describe("fallback", () => {
        it("should be able to receive ETH via transfer", async () => {
            const { safe, caller } = await setupTests();
            const safeAddress = await safe.getAddress();

            // Notes: It is not possible to load storage + a call + emit event with 2300 gas
            await expect(caller.transferEth(safeAddress, { value: ethers.parseEther("1") })).to.be.reverted;
        });

        it("should be able to receive ETH via send", async () => {
            const { safe, caller } = await setupTests();
            const safeAddress = await safe.getAddress();

            // Notes: It is not possible to load storage + a call + emit event with 2300 gas
            await expect(caller.sendEth(safeAddress, { value: ethers.parseEther("1") })).to.be.reverted;
        });

        it("should be able to receive ETH via call", async () => {
            const { safe, caller } = await setupTests();
            const safeAddress = await safe.getAddress();
            const callerAddress = await caller.getAddress();

            await expect(
                caller.callEth(safeAddress, {
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

            await expect(user1.sendTransaction({ to: safeAddress, value: 23, data: "0xbaddad" })).to.be.reverted;
        });
    });
});
