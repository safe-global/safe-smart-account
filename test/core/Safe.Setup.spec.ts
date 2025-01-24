import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";

import { deployContractFromSource, getMock, getSafeSingleton, getSafeTemplate } from "../utils/setup";
import { calculateSafeDomainSeparator } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";
import { chainId, encodeTransfer } from "../utils/encoding";
import { getSenderAddressFromContractRunner } from "../utils/contracts";

describe("Safe", () => {
    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        return {
            template: await getSafeTemplate(),
            mock: await getMock(),
            signers,
        };
    });

    describe("setup", () => {
        it("should not allow to call setup on singleton", async () => {
            const {
                signers: [user1, user2, user3],
            } = await setupTests();
            const singleton = await getSafeSingleton();
            await expect(await singleton.getThreshold()).to.eq(1n);

            // Because setup wasn't called on the singleton it breaks the assumption made
            // within `getModulesPaginated` method that the linked list will be always correctly
            // initialized with 0x1 as a starting element and 0x1 as the end
            // But because `setupModules` wasn't called, it is empty.
            await expect(singleton.getModulesPaginated(AddressOne, 10)).to.be.reverted;

            // "Should not be able to retrieve owners (currently the contract will run in an endless loop when not initialized)"
            await expect(singleton.getOwners()).to.be.reverted;

            await expect(
                singleton.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS200");
        });

        it("should set domain hash", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            const templateAddress = await template.getAddress();
            const safeMsgSender = await getSenderAddressFromContractRunner(template);

            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            )
                .to.emit(template, "SafeSetup")
                .withArgs(safeMsgSender, [user1.address, user2.address, user3.address], 2, AddressZero, AddressZero);
            await expect(await template.domainSeparator()).to.be.eq(calculateSafeDomainSeparator(templateAddress, await chainId()));
            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address]);
            await expect(await template.getThreshold()).to.be.deep.eq(2n);
        });

        it("should revert if called twice", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            await (
                await template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                )
            ).wait();
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS200");
        });

        it("should revert if same owner is included twice", async () => {
            const {
                template,
                signers: [user1, user2],
            } = await setupTests();
            await expect(
                template.setup(
                    [user2.address, user1.address, user2.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS204");
        });

        it("should revert if 0 address is used as an owner", async () => {
            const {
                template,
                signers: [, user2],
            } = await setupTests();
            await expect(
                template.setup([user2.address, AddressZero], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS203");
        });

        it("should revert if Safe itself is used as an owner", async () => {
            const {
                template,
                signers: [, user2],
            } = await setupTests();
            const templateAddress = await template.getAddress();
            await expect(
                template.setup([user2.address, templateAddress], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS203");
        });

        it("should revert if sentinel is used as an owner", async () => {
            const {
                template,
                signers: [, user2],
            } = await setupTests();
            await expect(
                template.setup([user2.address, AddressOne], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS203");
        });

        it("should revert if same owner is included twice one after each other", async () => {
            const {
                template,
                signers: [, user2],
            } = await setupTests();
            await expect(
                template.setup([user2.address, user2.address], 2, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS203");
        });

        it("should revert if threshold is too high", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    4,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS201");
        });

        it("should revert if threshold is 0", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    0,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS202");
        });

        it("should revert if owners are empty", async () => {
            const { template } = await setupTests();
            await expect(template.setup([], 0, AddressZero, "0x", AddressZero, AddressZero, 0, AddressZero)).to.be.revertedWith("GS202");
        });

        it("should set fallback handler and call sub initializer", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            const templateAddress = await template.getAddress();
            const safeMsgSender = await getSenderAddressFromContractRunner(template);

            const source = `
            contract Initializer {
                function init(bytes4 data) public {
                    bytes32 slot = 0x4242424242424242424242424242424242424242424242424242424242424242;
                    /* solhint-disable no-inline-assembly */
                    /// @solidity memory-safe-assembly
                    assembly {
                        sstore(slot, data)
                    }
                    /* solhint-enable no-inline-assembly */
                }
            }`;
            const testInitializer = await deployContractFromSource(user1, source);
            const testInitializerAddress = await testInitializer.getAddress();
            const initData = testInitializer.interface.encodeFunctionData("init", ["0x42baddad"]);
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    testInitializerAddress,
                    initData,
                    AddressOne,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            )
                .to.emit(template, "SafeSetup")
                .withArgs(safeMsgSender, [user1.address, user2.address, user3.address], 2, testInitializerAddress, AddressOne);
            await expect(await template.domainSeparator()).to.be.eq(calculateSafeDomainSeparator(templateAddress, await chainId()));
            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address]);
            await expect(await template.getThreshold()).to.eq(2n);

            await expect(
                await hre.ethers.provider.getStorage(templateAddress, "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5"),
            ).to.be.eq("0x" + "1".padStart(64, "0"));

            await expect(
                await hre.ethers.provider.getStorage(templateAddress, "0x4242424242424242424242424242424242424242424242424242424242424242"),
            ).to.be.eq("0x" + "42baddad".padEnd(64, "0"));
        });

        it("should fail if sub initializer fails", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            const source = `
            contract Initializer {
                function init(bytes4 data) public {
                    require(false, "Computer says nah");
                }
            }`;
            const testInitializer = await deployContractFromSource(user1, source);
            const testInitializerAddress = await testInitializer.getAddress();
            const initData = testInitializer.interface.encodeFunctionData("init", ["0x42baddad"]);
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    testInitializerAddress,
                    initData,
                    AddressZero,
                    AddressZero,
                    0,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS000");
        });

        it("should fail if ether payment fails", async () => {
            const {
                template,
                mock,
                signers: [user1, user2, user3],
            } = await setupTests();
            const payment = 133742;

            const transferData = encodeTransfer(user1.address, payment);
            await mock.givenCalldataRevert(transferData);
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    payment,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS011");
        });

        it("should work with ether payment to deployer", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            const templateAddress = await template.getAddress();
            const deployerAddress = await getSenderAddressFromContractRunner(template);
            const payment = ethers.parseEther("10");
            await user1.sendTransaction({ to: templateAddress, value: payment });
            const userBalance = await hre.ethers.provider.getBalance(deployerAddress);
            await expect(await hre.ethers.provider.getBalance(templateAddress)).to.eq(ethers.parseEther("10"));

            await (
                await template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    AddressZero,
                    payment,
                    AddressZero,
                )
            ).wait();

            await expect(await hre.ethers.provider.getBalance(templateAddress)).to.eq(ethers.parseEther("0"));
            await expect(userBalance < (await hre.ethers.provider.getBalance(deployerAddress))).to.be.true;
        });

        it("should work with ether payment to account", async () => {
            const {
                template,
                signers: [user1, user2, user3],
            } = await setupTests();
            const templateAddress = await template.getAddress();
            const payment = ethers.parseEther("10");
            await user1.sendTransaction({ to: templateAddress, value: payment });
            const userBalance = await hre.ethers.provider.getBalance(user2.address);
            await expect(await hre.ethers.provider.getBalance(templateAddress)).to.eq(ethers.parseEther("10"));

            await template.setup(
                [user1.address, user2.address, user3.address],
                2,
                AddressZero,
                "0x",
                AddressZero,
                AddressZero,
                payment,
                user2.address,
            );

            await expect(await hre.ethers.provider.getBalance(templateAddress)).to.eq(ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(user2.address)).to.eq(userBalance + payment);

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address]);
        });

        it("should fail if token payment fails", async () => {
            const {
                template,
                mock,
                signers: [user1, user2, user3],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const payment = 133742;

            const transferData = encodeTransfer(user1.address, payment);
            await mock.givenCalldataRevert(transferData);
            await expect(
                template.setup(
                    [user1.address, user2.address, user3.address],
                    2,
                    AddressZero,
                    "0x",
                    AddressZero,
                    mockAddress,
                    payment,
                    AddressZero,
                ),
            ).to.be.revertedWith("GS012");
        });

        it("should work with token payment to deployer", async () => {
            const {
                template,
                mock,
                signers: [user1, user2, user3],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const payment = 133742;
            const deployerAddress = await getSenderAddressFromContractRunner(template);

            const transferData = encodeTransfer(deployerAddress, payment);
            await mock.givenCalldataReturnBool(transferData, true);
            await template.setup(
                [user1.address, user2.address, user3.address],
                2,
                AddressZero,
                "0x",
                AddressZero,
                mockAddress,
                payment,
                AddressZero,
            );

            expect(await mock.invocationCountForCalldata.staticCall(transferData)).to.eq(1n);

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address]);
        });

        it("should work with token payment to account", async () => {
            const {
                template,
                mock,
                signers: [user1, user2, user3],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const payment = 133742;

            const transferData = encodeTransfer(user2.address, payment);
            await mock.givenCalldataReturnBool(transferData, true);
            await template.setup(
                [user1.address, user2.address, user3.address],
                2,
                AddressZero,
                "0x",
                AddressZero,
                mockAddress,
                payment,
                user2.address,
            );

            expect(await mock.invocationCountForCalldata.staticCall(transferData)).to.eq(1n);

            await expect(await template.getOwners()).to.be.deep.eq([user1.address, user2.address, user3.address]);
        });

        it("should revert if the initializer address does not contain code", async () => {
            const {
                template,
                signers: [user1, user2],
            } = await setupTests();

            await expect(
                template.setup([user1.address], 1, user2.address, "0xbeef73", AddressZero, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS002");
        });

        it("should fail if tried to set the fallback handler address to self", async () => {
            const {
                template,
                signers: [user1],
            } = await setupTests();
            const templateAddress = await template.getAddress();

            await expect(
                template.setup([user1.address], 1, AddressZero, "0x", templateAddress, AddressZero, 0, AddressZero),
            ).to.be.revertedWith("GS400");
        });
    });
});
