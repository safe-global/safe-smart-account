import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import {
    getSafe,
    getSafeSingletonAt,
    safeMigrationContract,
    getSafeSingletonContract,
    getSafeL2SingletonContract,
    getCompatFallbackHandler,
} from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import fallbackHandlerDeploymentData from "../json/fallbackHandlerDeployment.json";

import { executeContractCallWithSigners } from "../../src/utils/execution";
import { SafeMigration } from "../../typechain-types";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

const migrationPaths = [
    {
        testSuiteName: "1.3.0 to latest (1.5.0)",
        from: { safeDeploymentData: deploymentData.safe130, safeL2DeploymentData: deploymentData.safe130l2 },
        latest: true,
    },
    {
        testSuiteName: "1.3.0 to 1.4.1",
        from: { safeDeploymentData: deploymentData.safe130, safeL2DeploymentData: deploymentData.safe130l2 },
        // `to` is used when the target contracts are not latest. So, we need to provide the bytecode
        // of the old version of the contracts
        to: {
            safeDeploymentData: deploymentData.safe141,
            safeL2DeploymentData: deploymentData.safe141l2,
            safeCompatFallbackHandler: fallbackHandlerDeploymentData.compatibilityFallbackHandler141,
        },
    },
    {
        testSuiteName: "1.4.1 to latest (1.5.0)",
        from: {
            safeDeploymentData: deploymentData.safe141,
            safeL2DeploymentData: deploymentData.safe141l2,
        },
        latest: true,
    },
];

describe("SafeMigration Library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    let SAFE_SINGLETON_ADDRESS: string | null | undefined;
    let SAFE_SINGLETON_L2_ADDRESS: string | null | undefined;
    let COMPATIBILITY_FALLBACK_HANDLER: string | null | undefined;

    describe("constructor", () => {
        const setupTests = deployments.createFixture(async () => {
            return {
                singletonAddress: await getSafeSingletonContract(),
                singletonL2Address: await getSafeL2SingletonContract(),
                compatibilityFallbackHandlerAddress: await getCompatFallbackHandler(),
            };
        });

        it("reverts when Safe singleton is not a contract", async () => {
            const { singletonL2Address, compatibilityFallbackHandlerAddress } = await setupTests();
            await expect(
                hre.ethers.deployContract("SafeMigration", [ethers.ZeroAddress, singletonL2Address, compatibilityFallbackHandlerAddress]),
            ).to.be.revertedWith("Safe Singleton is not deployed");
        });

        it("reverts when SafeL2 singleton is not a contract", async () => {
            const { singletonAddress, compatibilityFallbackHandlerAddress } = await setupTests();
            await expect(
                hre.ethers.deployContract("SafeMigration", [singletonAddress, ethers.ZeroAddress, compatibilityFallbackHandlerAddress]),
            ).to.be.revertedWith("Safe Singleton (L2) is not deployed");
        });

        it("reverts when fallback handler is not a contract", async () => {
            const { singletonAddress, singletonL2Address } = await setupTests();
            await expect(
                hre.ethers.deployContract("SafeMigration", [singletonAddress, singletonL2Address, ethers.ZeroAddress]),
            ).to.be.revertedWith("fallback handler is not deployed");
        });
    });

    migrationPaths.forEach(({ testSuiteName, from, to, latest }) => {
        describe(testSuiteName, () => {
            const setupTests = deployments.createFixture(async ({ deployments }) => {
                await deployments.fixture();
                const signers = await ethers.getSigners();
                const [user1] = signers;
                let migration: SafeMigration;

                if (latest) {
                    migration = await safeMigrationContract();
                    SAFE_SINGLETON_ADDRESS = await (await getSafeSingletonContract()).getAddress();
                    SAFE_SINGLETON_L2_ADDRESS = await (await getSafeL2SingletonContract()).getAddress();
                    COMPATIBILITY_FALLBACK_HANDLER = await (await getCompatFallbackHandler()).getAddress();
                } else {
                    SAFE_SINGLETON_ADDRESS = (await (await user1.sendTransaction({ data: to?.safeDeploymentData })).wait())
                        ?.contractAddress;
                    SAFE_SINGLETON_L2_ADDRESS = (await (await user1.sendTransaction({ data: to?.safeL2DeploymentData })).wait())
                        ?.contractAddress;
                    COMPATIBILITY_FALLBACK_HANDLER = (await (await user1.sendTransaction({ data: to?.safeL2DeploymentData })).wait())
                        ?.contractAddress;

                    migration = (await hre.ethers.deployContract("SafeMigration", [
                        SAFE_SINGLETON_ADDRESS,
                        SAFE_SINGLETON_L2_ADDRESS,
                        COMPATIBILITY_FALLBACK_HANDLER,
                    ])) as unknown as SafeMigration;
                }

                const singletonAddress = (await (await user1.sendTransaction({ data: from.safeDeploymentData })).wait())?.contractAddress;
                const singletonL2Address = (await (await user1.sendTransaction({ data: from.safeL2DeploymentData })).wait())
                    ?.contractAddress;

                if (!singletonAddress || !singletonL2Address) {
                    throw new Error("Could not deploy safe or safeL2");
                }
                const singleton = await getSafeSingletonAt(singletonAddress);
                const singletonL2 = await getSafeSingletonAt(singletonL2Address);

                return {
                    signers,
                    safe: await getSafe({ singleton: singleton, owners: [user1.address] }),
                    safeL2: await getSafe({ singleton: singletonL2, owners: [user1.address] }),
                    migration,
                };
            });

            describe("migrateSingleton", () => {
                it("reverts if not called via delegatecall", async () => {
                    const {
                        safe,
                        migration,
                        signers: [user1],
                    } = await setupTests();
                    await expect(
                        executeContractCallWithSigners(safe, migration, "migrateSingleton", [], [user1], false),
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

                    await expect(executeContractCallWithSigners(safe, migration, "migrateSingleton", [], [user1], true))
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

                    expect(await executeContractCallWithSigners(safe, migration, "migrateSingleton", [], [user1], true));

                    expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(BigInt(nonceBeforeMigration) + 1n);
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
                        executeContractCallWithSigners(safe, migration, "migrateWithFallbackHandler", [], [user1], false),
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

                    await expect(executeContractCallWithSigners(safe, migration, "migrateWithFallbackHandler", [], [user1], true))
                        .to.emit(migrationSafe, "ChangedMasterCopy")
                        .withArgs(SAFE_SINGLETON_ADDRESS)
                        .and.to.emit(safe, "ChangedFallbackHandler")
                        .withArgs(COMPATIBILITY_FALLBACK_HANDLER);

                    const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                    expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_ADDRESS);

                    expect(await safe.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                        "0x" + COMPATIBILITY_FALLBACK_HANDLER?.slice(2).toLowerCase().padStart(64, "0"),
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

                    expect(await executeContractCallWithSigners(safe, migration, "migrateWithFallbackHandler", [], [user1], true));

                    expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(BigInt(nonceBeforeMigration) + 1n);
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
                        executeContractCallWithSigners(safe, migration, "migrateL2Singleton", [], [user1], false),
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

                    await expect(executeContractCallWithSigners(safeL2, migration, "migrateL2Singleton", [], [user1], true))
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

                    expect(await executeContractCallWithSigners(safeL2, migration, "migrateL2Singleton", [], [user1], true));

                    expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(BigInt(nonceBeforeMigration) + 1n);
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
                        executeContractCallWithSigners(safe, migration, "migrateL2WithFallbackHandler", [], [user1], false),
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

                    await expect(executeContractCallWithSigners(safeL2, migration, "migrateL2WithFallbackHandler", [], [user1], true))
                        .to.emit(migrationSafe, "ChangedMasterCopy")
                        .withArgs(SAFE_SINGLETON_L2_ADDRESS)
                        .and.to.emit(safeL2, "ChangedFallbackHandler")
                        .withArgs(COMPATIBILITY_FALLBACK_HANDLER);

                    const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
                    expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_L2_ADDRESS);

                    expect(await safeL2.getStorageAt(FALLBACK_HANDLER_STORAGE_SLOT, 1)).to.eq(
                        "0x" + COMPATIBILITY_FALLBACK_HANDLER?.slice(2).toLowerCase().padStart(64, "0"),
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

                    expect(await executeContractCallWithSigners(safeL2, migration, "migrateL2WithFallbackHandler", [], [user1], true));

                    expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
                    expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(BigInt(nonceBeforeMigration) + 1n);
                    expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
                });
            });
        });
    });
});
