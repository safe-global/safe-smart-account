import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { getSafeWithSingleton, migrationContractFrom130To141, getSafeSingletonAt } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import safeRuntimeBytecode from "../json/safeRuntimeBytecode.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

const SAFE_SINGLETON_141_ADDRESS = "0x41675C099F32341bf84BFc5382aF534df5C7461a";

const SAFE_SINGLETON_141_L2_ADDRESS = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";

const COMPATIBILITY_FALLBACK_HANDLER_141 = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

describe("Safe130To141Migration library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        // Set the runtime code for hardcoded addresses
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_141_ADDRESS, safeRuntimeBytecode.safe141]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_141_L2_ADDRESS, safeRuntimeBytecode.safe141l2]);
        await hre.network.provider.send("hardhat_setCode", [
            COMPATIBILITY_FALLBACK_HANDLER_141,
            safeRuntimeBytecode.safe141fallbackHandler,
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

        const migration = await (await migrationContractFrom130To141()).deploy();
        return {
            safe130: await getSafeWithSingleton(singleton130, [user1.address]),
            safe130l2: await getSafeWithSingleton(singleton130L2, [user1.address]),
            migration,
            signers,
        };
    });

    describe("constructor", () => {
        it("cannot be initialized if the contracts are not deployed", async () => {
            const factory = await migrationContractFrom130To141();
            await expect(factory.deploy()).to.be.revertedWith("Safe 1.4.1 Singleton is not deployed");
        });
    });

    describe("migrate", () => {
        it("can only be called from Safe itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrate()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130, migration, "migrate", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_141_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_141_ADDRESS);
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

            await expect(executeContractCallWithSigners(safe130, migration, "migrate", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });

    describe("migrateWithFallbackHandler", () => {
        it("can only be called from Safe itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrateWithFallbackHandler()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
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
                .withArgs(SAFE_SINGLETON_141_ADDRESS)
                .and.to.emit(safe130, "ChangedFallbackHandler")
                .withArgs(COMPATIBILITY_FALLBACK_HANDLER_141);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_141_ADDRESS);

            expect(await safe130.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                "0x" + COMPATIBILITY_FALLBACK_HANDLER_141.slice(2).toLowerCase().padStart(64, "0"),
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

            await expect(executeContractCallWithSigners(safe130, migration, "migrateWithFallbackHandler", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });

    describe("migrateL2", () => {
        it("can only be called from Safe itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrateL2()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_141_L2_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_141_L2_ADDRESS);
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

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });

    describe("migrateL2WithFallbackHandler", () => {
        it("can only be called from Safe itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrateL2WithFallbackHandler()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
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
                .withArgs(SAFE_SINGLETON_141_L2_ADDRESS)
                .and.to.emit(safe130l2, "ChangedFallbackHandler")
                .withArgs(COMPATIBILITY_FALLBACK_HANDLER_141);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            await expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_141_L2_ADDRESS);

            expect(await safe130l2.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                "0x" + COMPATIBILITY_FALLBACK_HANDLER_141.slice(2).toLowerCase().padStart(64, "0"),
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

            await expect(executeContractCallWithSigners(safe130l2, migration, "migrateL2WithFallbackHandler", [], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
        });
    });
});
