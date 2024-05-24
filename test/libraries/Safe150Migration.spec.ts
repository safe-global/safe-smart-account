import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithSingleton, migrationContractTo150, getSafeSingletonAt } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import safeRuntimeBytecode from "../json/safeRuntimeBytecode.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

const SAFE_SINGLETON_150_ADDRESS = "0x477C3fb2D564349E2F95a2EF1091bF9657b26145";

const SAFE_SINGLETON_150_L2_ADDRESS = "0x551A2F9a71bF88cDBef3CBe60E95722f38eE0eAA";

const COMPATIBILITY_FALLBACK_HANDLER_150 = "0x4c95c836D31d329d80d696cb679f3dEa028Ad4e5";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

describe("Safe150Migration library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        // Set the runtime code for hardcoded addresses, so the expected events are emitted
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_ADDRESS, safeRuntimeBytecode.safe150]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_L2_ADDRESS, safeRuntimeBytecode.safe150l2]);
        await hre.network.provider.send("hardhat_setCode", [
            COMPATIBILITY_FALLBACK_HANDLER_150,
            safeRuntimeBytecode.safe150CompatibilityFallbackHandler,
        ]);

        const signers = await ethers.getSigners();
        const [user1] = signers;
        const singleton130Address = (await (await user1.sendTransaction({ data: deploymentData.safe130 })).wait())?.contractAddress;
        const singleton130L2Address = (await (await user1.sendTransaction({ data: deploymentData.safe130l2 })).wait())?.contractAddress;

        if (!singleton130Address || !singleton130L2Address) {
            throw new Error("Could not deploy Safe130 or Safe130L2");
        }
        const singleton130 = await getSafeSingletonAt(singleton130Address);
        const singleton130L2 = await getSafeSingletonAt(singleton130L2Address);

        const safeWith1967Proxy = await getSafeSingletonAt(
            await hre.ethers
                .getContractFactory("UpgradeableProxy")
                .then((factory) =>
                    factory.deploy(
                        singleton130Address,
                        singleton130.interface.encodeFunctionData("setup", [
                            [user1.address],
                            1,
                            AddressZero,
                            "0x",
                            AddressZero,
                            AddressZero,
                            0,
                            AddressZero,
                        ]),
                    ),
                )
                .then((proxy) => proxy.getAddress()),
        );
        const migration = await (await migrationContractTo150()).deploy();
        return {
            safe130: await getSafeWithSingleton(singleton130, [user1.address]),
            safe130l2: await getSafeWithSingleton(singleton130L2, [user1.address]),
            safeWith1967Proxy,
            migration,
            signers,
        };
    });

    describe("migrateSingleton", () => {
        it("reverts if the singleton in storage at slot 0 is not a contract", async () => {
            const {
                migration,
                safeWith1967Proxy,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safeWith1967Proxy, migration, "migrateSingleton", [], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("migrates the singleton", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateSingleton", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_ADDRESS);
        });

        it("doesn't touch important storage slots", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);
            const fallbackHandlerBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateSingleton", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).to.be.eq(
                fallbackHandlerBeforeMigration,
            );
        });
    });

    describe("migrateL2Singleton", () => {
        it("reverts if the singleton in storage at slot 0 is not a contract", async () => {
            const {
                migration,
                safeWith1967Proxy,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safeWith1967Proxy, migration, "migrateL2Singleton", [], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("migrates the singleton", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2Singleton", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_L2_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_L2_ADDRESS);
        });

        it("doesn't touch important storage slots", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2Singleton", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
        });
    });

    describe("migrateWithFallbackHandler", () => {
        it("reverts if the singleton in storage at slot 0 is not a contract", async () => {
            const {
                migration,
                safeWith1967Proxy,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safeWith1967Proxy, migration, "migrateWithFallbackHandler", [], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("migrates the singleton and the fallback handler", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateWithFallbackHandler", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_ADDRESS)
                .and.to.emit(safe130, "ChangedFallbackHandler")
                .withArgs(COMPATIBILITY_FALLBACK_HANDLER_150);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_ADDRESS);

            expect(await safe130.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                "0x" + COMPATIBILITY_FALLBACK_HANDLER_150.slice(2).toLowerCase().padStart(64, "0"),
            );
        });

        it("doesn't touch important storage slots", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateWithFallbackHandler", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
        });
    });

    describe("migrateL2WithFallbackHandler", () => {
        it("reverts if the singleton in storage at slot 0 is not a contract", async () => {
            const {
                migration,
                safeWith1967Proxy,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safeWith1967Proxy, migration, "migrateL2WithFallbackHandler", [], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("migrates the singleton and the fallback handler", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2WithFallbackHandler", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_L2_ADDRESS)
                .and.to.emit(safe130l2, "ChangedFallbackHandler")
                .withArgs(COMPATIBILITY_FALLBACK_HANDLER_150);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_L2_ADDRESS);

            expect(await safe130l2.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                "0x" + COMPATIBILITY_FALLBACK_HANDLER_150.slice(2).toLowerCase().padStart(64, "0"),
            );
        });

        it("doesn't touch important storage slots", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2WithFallbackHandler", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
        });
    });
});
