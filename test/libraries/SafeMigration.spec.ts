import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { getSafeWithSingleton, getSafeSingletonAt, safeMigrationContract } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import safeRuntimeBytecode from "../json/safeRuntimeBytecode.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

const SAFE_SINGLETON_ADDRESS = "0x477C3fb2D564349E2F95a2EF1091bF9657b26145";

const SAFE_SINGLETON_L2_ADDRESS = "0x551A2F9a71bF88cDBef3CBe60E95722f38eE0eAA";

const COMPATIBILITY_FALLBACK_HANDLER = "0x4c95c836D31d329d80d696cb679f3dEa028Ad4e5";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

const migrationPaths = [
    {
        from: { safeDeploymentData: deploymentData.safe130, safeL2DeploymentData: deploymentData.safe130l2 },
        to: {
            safeRuntimeBytecode: safeRuntimeBytecode.safe150,
            safeL2RuntimeBytecode: safeRuntimeBytecode.safe150l2,
            fallbackHandlerRuntimeBytecode: safeRuntimeBytecode.safe150CompatibilityFallbackHandler,
        },
    },
];

describe("SafeMigration Library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    migrationPaths.forEach(({ from, to }) => {
        const setupTests = deployments.createFixture(async ({ deployments }) => {
            await deployments.fixture();
            const signers = await ethers.getSigners();
            const [user1] = signers;

            // Set the runtime code for hardcoded addresses, so the expected events are emitted
            await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_ADDRESS, to.safeRuntimeBytecode]);
            await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_L2_ADDRESS, to.safeL2RuntimeBytecode]);
            await hre.network.provider.send("hardhat_setCode", [COMPATIBILITY_FALLBACK_HANDLER, to.fallbackHandlerRuntimeBytecode]);

            const singletonAddress = (await (await user1.sendTransaction({ data: from.safeDeploymentData })).wait())?.contractAddress;
            const singletonL2Address = (await (await user1.sendTransaction({ data: from.safeL2DeploymentData })).wait())?.contractAddress;

            if (!singletonAddress || !singletonL2Address) {
                throw new Error("Could not deploy safe or safeL2");
            }
            const singleton = await getSafeSingletonAt(singletonAddress);
            const singletonL2 = await getSafeSingletonAt(singletonL2Address);

            const migration = await (
                await safeMigrationContract()
            ).deploy(SAFE_SINGLETON_ADDRESS, SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER);

            return {
                signers,
                safe: await getSafeWithSingleton(singleton, [user1.address]),
                safeL2: await getSafeWithSingleton(singletonL2, [user1.address]),
                migration,
            };
        });

        describe("constructor", () => {
            it("reverts when Safe singleton is not a contract", async () => {
                await setupTests();

                await expect(
                    (await safeMigrationContract()).deploy(ethers.ZeroAddress, SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER),
                ).to.be.revertedWith("Safe Singleton is not deployed");
            });

            it("reverts when SafeL2 singleton is not a contract", async () => {
                await setupTests();

                await expect(
                    (await safeMigrationContract()).deploy(SAFE_SINGLETON_ADDRESS, ethers.ZeroAddress, COMPATIBILITY_FALLBACK_HANDLER),
                ).to.be.revertedWith("Safe Singleton (L2) is not deployed");
            });

            it("reverts when fallback handler is not a contract", async () => {
                await setupTests();

                await expect(
                    (await safeMigrationContract()).deploy(SAFE_SINGLETON_ADDRESS, SAFE_SINGLETON_L2_ADDRESS, ethers.ZeroAddress),
                ).to.be.revertedWith("fallback handler is not deployed");
            });
        });

        describe("migrateSingleton", () => {
            it("reverts if not called via delegatecall", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(safe, migration, "migrateSingleton", [SAFE_SINGLETON_ADDRESS], [user1], false),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on target singleton codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(safe, migration, "migrateSingleton", [SAFE_SINGLETON_L2_ADDRESS], [user1], true),
                ).to.be.revertedWith("GS013");
            });

            it("migrates the singleton", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safe.getAddress();
                // The emit matcher checks the address, which is the Safe as delegatecall is used
                const migrationSafe = migration.attach(safeAddress);

                await expect(executeContractCallWithSigners(safe, migration, "migrateSingleton", [SAFE_SINGLETON_ADDRESS], [user1], true))
                    .to.emit(migrationSafe, "ChangedMasterCopy")
                    .withArgs(SAFE_SINGLETON_ADDRESS);

                const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_ADDRESS);
            });

            it("doesn't touch important storage slots", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safe.getAddress();

                const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
                const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
                const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
                const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);
                const fallbackHandlerBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT);

                expect(await executeContractCallWithSigners(safe, migration, "migrateSingleton", [SAFE_SINGLETON_ADDRESS], [user1], true));

                expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(
                    ethers.toBigInt(nonceBeforeMigration) + ethers.toBigInt(1),
                );
                expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).to.be.eq(
                    fallbackHandlerBeforeMigration,
                );
            });
        });

        describe("migrateWithFallbackHandler", () => {
            it("reverts if not called via delegatecall", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateWithFallbackHandler",
                        [SAFE_SINGLETON_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        false,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on target singleton codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateWithFallbackHandler",
                        [SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("migrates the singleton", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safe.getAddress();
                // The emit matcher checks the address, which is the Safe as delegatecall is used
                const migrationSafe = migration.attach(safeAddress);

                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateWithFallbackHandler",
                        [SAFE_SINGLETON_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                )
                    .to.emit(migrationSafe, "ChangedMasterCopy")
                    .withArgs(SAFE_SINGLETON_ADDRESS)
                    .and.to.emit(safe, "ChangedFallbackHandler")
                    .withArgs(COMPATIBILITY_FALLBACK_HANDLER);

                const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_ADDRESS);

                expect(await safe.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                    "0x" + COMPATIBILITY_FALLBACK_HANDLER.slice(2).toLowerCase().padStart(64, "0"),
                );
            });

            it("doesn't touch important storage slots", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safe.getAddress();

                const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
                const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
                const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
                const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);

                expect(
                    await executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateWithFallbackHandler",
                        [SAFE_SINGLETON_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                );

                expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(
                    ethers.toBigInt(nonceBeforeMigration) + ethers.toBigInt(1),
                );
                expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
            });
        });

        describe("migrateL2Singleton", () => {
            it("reverts if not called via delegatecall", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(safe, migration, "migrateL2Singleton", [SAFE_SINGLETON_L2_ADDRESS], [user1], false),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on target singleton codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(safe, migration, "migrateL2Singleton", [SAFE_SINGLETON_ADDRESS], [user1], true),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on fallback handler codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateWithFallbackHandler",
                        [SAFE_SINGLETON_ADDRESS, SAFE_SINGLETON_L2_ADDRESS],
                        [user1],
                        true,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("migrates the singleton", async () => {
                const {
                    safeL2,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safeL2.getAddress();
                // The emit matcher checks the address, which is the Safe as delegatecall is used
                const migrationSafe = migration.attach(safeAddress);

                await expect(
                    executeContractCallWithSigners(safeL2, migration, "migrateL2Singleton", [SAFE_SINGLETON_L2_ADDRESS], [user1], true),
                )
                    .to.emit(migrationSafe, "ChangedMasterCopy")
                    .withArgs(SAFE_SINGLETON_L2_ADDRESS);

                const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_L2_ADDRESS);
            });

            it("doesn't touch important storage slots", async () => {
                const {
                    safeL2,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safeL2.getAddress();

                const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
                const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
                const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
                const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);
                const fallbackHandlerBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT);

                expect(
                    await executeContractCallWithSigners(
                        safeL2,
                        migration,
                        "migrateL2Singleton",
                        [SAFE_SINGLETON_L2_ADDRESS],
                        [user1],
                        true,
                    ),
                );

                expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(
                    ethers.toBigInt(nonceBeforeMigration) + ethers.toBigInt(1),
                );
                expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).to.be.eq(
                    fallbackHandlerBeforeMigration,
                );
            });
        });

        describe("migrateL2WithFallbackHandler", () => {
            it("reverts if not called via delegatecall", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateL2WithFallbackHandler",
                        [SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        false,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on target singleton codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateL2WithFallbackHandler",
                        [SAFE_SINGLETON_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("reverts on fallback handler codehash mismatch", async () => {
                const {
                    safe,
                    migration,
                    signers: [user1],
                } = await setupTests();
                await expect(
                    executeContractCallWithSigners(
                        safe,
                        migration,
                        "migrateL2WithFallbackHandler",
                        [SAFE_SINGLETON_L2_ADDRESS, SAFE_SINGLETON_ADDRESS],
                        [user1],
                        true,
                    ),
                ).to.be.revertedWith("GS013");
            });

            it("migrates the singleton", async () => {
                const {
                    safeL2,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safeL2.getAddress();
                // The emit matcher checks the address, which is the Safe as delegatecall is used
                const migrationSafe = migration.attach(safeAddress);

                await expect(
                    executeContractCallWithSigners(
                        safeL2,
                        migration,
                        "migrateL2WithFallbackHandler",
                        [SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                )
                    .to.emit(migrationSafe, "ChangedMasterCopy")
                    .withArgs(SAFE_SINGLETON_L2_ADDRESS)
                    .and.to.emit(safeL2, "ChangedFallbackHandler")
                    .withArgs(COMPATIBILITY_FALLBACK_HANDLER);

                const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_L2_ADDRESS);

                expect(await safeL2.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                    "0x" + COMPATIBILITY_FALLBACK_HANDLER.slice(2).toLowerCase().padStart(64, "0"),
                );
            });

            it("doesn't touch important storage slots", async () => {
                const {
                    safeL2,
                    migration,
                    signers: [user1],
                } = await setupTests();
                const safeAddress = await safeL2.getAddress();

                const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
                const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
                const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
                const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);

                expect(
                    await executeContractCallWithSigners(
                        safeL2,
                        migration,
                        "migrateL2WithFallbackHandler",
                        [SAFE_SINGLETON_L2_ADDRESS, COMPATIBILITY_FALLBACK_HANDLER],
                        [user1],
                        true,
                    ),
                );

                expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(
                    ethers.toBigInt(nonceBeforeMigration) + ethers.toBigInt(1),
                );
                expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
            });
        });
    });
});
