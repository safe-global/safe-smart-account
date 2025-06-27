import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe, getSafeSingletonAt, getSafeSingleton, getCompatFallbackHandler } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import { Safe, SafeL2 } from "../../typechain-types";
import {
    buildSafeTransaction,
    executeContractCallWithSigners,
    executeTx,
    executeTxWithSigners,
    safeApproveHash,
} from "../../src/utils/execution";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

describe("SafeToL2Migration library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const signers = await ethers.getSigners();
        const [user1] = signers;

        const networkKey = hre.network.zksync ? "zksync" : "evm";
        const singletonDeployment = async (key: keyof typeof deploymentData) => {
            const code = (deploymentData[key] as { evm: string; zksync?: string })[networkKey];
            if (code === undefined) {
                throw new Error(`bytecode not avilable for ${key} on ${networkKey}`);
            }
            const factory = new hre.ethers.ContractFactory(["constructor()"], code, user1);
            const contract = await factory.deploy();
            return getSafeSingletonAt(await contract.getAddress());
        };

        let singleton111: Safe | SafeL2 | undefined;
        let safe111: Safe | SafeL2 | undefined;
        if (!hre.network.zksync) {
            singleton111 = await singletonDeployment("safe111");
            safe111 = await getSafe({ singleton: singleton111, owners: [user1.address] });
        }

        const singleton130 = await singletonDeployment("safe130");
        const singleton130l2 = await singletonDeployment("safe130l2");
        const singleton141 = await singletonDeployment("safe141");
        const singleton141l2 = await singletonDeployment("safe141l2");

        const safeWith1967Proxy = await getSafeSingletonAt(
            await hre.ethers
                .getContractFactory("UpgradeableProxy")
                .then(async (factory) =>
                    factory.deploy(
                        await singleton130.getAddress(),
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

        const singleton = await getSafeSingleton();
        const fallbackHandler = await getCompatFallbackHandler();

        const safeToL2MigrationContract = await hre.ethers.getContractFactory("SafeToL2Migration");
        const migration = await safeToL2MigrationContract.deploy();

        return {
            safe111,
            safe130: await getSafe({ singleton: singleton130, owners: [user1.address] }),
            safe141: await getSafe({ singleton: singleton141, owners: [user1.address] }),
            safeWith1967Proxy,
            migration,
            singleton,
            fallbackHandler,
            singleton111,
            singleton130,
            singleton130l2,
            singleton141,
            singleton141l2,
            signers,
        };
    });

    describe("migrateToL2", () => {
        it("reverts if the singleton is not set", async () => {
            const {
                migration,
                singleton130l2,
                safeWith1967Proxy,
                signers: [user1],
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(
                    safeWith1967Proxy,
                    migration,
                    "migrateToL2",
                    [await singleton130l2.getAddress()],
                    [user1],
                    true,
                ),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if new singleton is the same as the old one", async () => {
            const {
                safe130,
                migration,
                singleton130,
                signers: [user1],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [await singleton130.getAddress()], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if the new singleton is not supported", async () => {
            const {
                safe130,
                migration,
                singleton,
                signers: [user1],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [await singleton.getAddress()], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if nonce > 0", async () => {
            const {
                safe130,
                migration,
                singleton130,
                singleton130l2,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            expect(await safe130.nonce()).to.be.eq(0);

            // Increase nonce by sending eth
            await user1.sendTransaction({ to: safeAddress, value: ethers.parseEther("1") });
            const nonce = 0;
            const safeTx = buildSafeTransaction({ to: user1.address, value: ethers.parseEther("1"), nonce });
            await executeTxWithSigners(safe130, safeTx, [user1]);

            expect(await safe130.nonce()).to.be.eq(1);
            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [await singleton130l2.getAddress()], [user1], true),
            ).to.be.revertedWith("GS013");

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(await singleton130.getAddress());
        });

        it("migrates from singleton 1.3.0 to 1.3.0L2", async () => {
            const {
                safe130,
                migration,
                singleton130l2,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);
            const migrationAddress = await migration.getAddress();

            const functionName = "migrateToL2";
            const expectedData = migration.interface.encodeFunctionData(functionName, [await singleton130l2.getAddress()]);
            const safeThreshold = await safe130.getThreshold();
            const additionalInfo = hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address", "uint256"],
                [0, user1.address, safeThreshold],
            );
            await expect(
                executeContractCallWithSigners(safe130, migration, functionName, [await singleton130l2.getAddress()], [user1], true),
            )
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(await singleton130l2.getAddress())
                .to.emit(migrationSafe, "SafeMultiSigTransaction")
                .withArgs(
                    migrationAddress,
                    0,
                    expectedData,
                    1,
                    0,
                    0,
                    0,
                    AddressZero,
                    AddressZero,
                    "0x", // We cannot detect signatures
                    additionalInfo,
                );

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(await singleton130l2.getAddress());
            expect(await safe130.nonce()).to.be.eq(1);
        });

        it("migrates from singleton 1.4.1 to 1.4.1L2", async () => {
            const {
                safe141,
                migration,
                singleton141l2,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe141.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);
            const migrationAddress = await migration.getAddress();

            const functionName = "migrateToL2";
            const expectedData = migration.interface.encodeFunctionData(functionName, [await singleton141l2.getAddress()]);
            const safeThreshold = await safe141.getThreshold();
            const additionalInfo = hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address", "uint256"],
                [0, user1.address, safeThreshold],
            );
            await expect(
                executeContractCallWithSigners(safe141, migration, functionName, [await singleton141l2.getAddress()], [user1], true),
            )
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(await singleton141l2.getAddress())
                .to.emit(migrationSafe, "SafeMultiSigTransaction")
                .withArgs(
                    migrationAddress,
                    0,
                    expectedData,
                    1,
                    0,
                    0,
                    0,
                    AddressZero,
                    AddressZero,
                    "0x", // We cannot detect signatures
                    additionalInfo,
                );

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(await singleton141l2.getAddress());
            expect(await safe141.nonce()).to.be.eq(1);
        });

        it("migrates from singleton 1.1.1 to 1.4.1L2", async () => {
            const {
                safe111,
                migration,
                fallbackHandler,
                singleton141l2,
                signers: [user1],
            } = await setupTests();
            if (typeof safe111 === "undefined") {
                if (!hre.network.zksync) throw new Error("Safe 1.1.1 was undefined");
                // Safe 1.1.1 was never deployed to zksync
                return;
            }

            const safeAddress = await safe111.getAddress();
            expect(await safe111.VERSION()).eq("1.1.1");
            expect("0x" + (await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).slice(26)).to.be.eq(
                AddressZero,
            );

            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);
            const migrationAddress = await migration.getAddress();

            const functionName = "migrateFromV111";
            const data = migration.interface.encodeFunctionData(functionName, [
                await singleton141l2.getAddress(),
                await fallbackHandler.getAddress(),
            ]);
            const nonce = await safe111.nonce();
            expect(nonce).to.be.eq(0);
            const safeThreshold = await safe111.getThreshold();
            const additionalInfo = hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address", "uint256"],
                [0, user1.address, safeThreshold],
            );

            const tx = buildSafeTransaction({ to: migrationAddress, data, operation: 1, nonce });

            expect(await executeTx(safe111, tx, [await safeApproveHash(user1, safe111, tx, true)]))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(await singleton141l2.getAddress())
                .to.emit(migrationSafe, "SafeMultiSigTransaction")
                .withArgs(
                    migrationAddress,
                    0,
                    data,
                    1,
                    0,
                    0,
                    0,
                    AddressZero,
                    AddressZero,
                    "0x", // We cannot detect signatures
                    additionalInfo,
                )
                .to.emit(migrationSafe, "SafeSetup")
                .withArgs(migrationAddress, await safe111.getOwners(), safeThreshold, AddressZero, await fallbackHandler.getAddress());

            expect(await safe111.nonce()).to.be.eq(1);
            expect(await safe111.VERSION()).to.be.eq("1.4.1");
            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(await singleton141l2.getAddress());
            expect("0x" + (await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).slice(26)).to.be.eq(
                (await fallbackHandler.getAddress()).toLowerCase(),
            );
        });

        it("doesn't touch important storage slots", async function () {
            if (hre.config.gasReporter.enabled) {
                // For some reason, this test does not play nice with the gas reporter, so skip it
                // when gas reporting is enabled.
                this.skip();
            }

            const {
                safe130,
                migration,
                singleton130l2,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);
            const fallbackHandlerBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT);

            await executeContractCallWithSigners(safe130, migration, "migrateToL2", [await singleton130l2.getAddress()], [user1], true);

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(
                hre.ethers.toBeHex(BigInt(nonceBeforeMigration) + 1n, 32),
            );
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).to.be.eq(
                fallbackHandlerBeforeMigration,
            );
        });
    });
});
