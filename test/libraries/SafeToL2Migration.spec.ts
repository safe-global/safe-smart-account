import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithSingleton, migrationContractTo150, getSafeSingletonAt, getMock } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import safeRuntimeBytecode from "../json/safeRuntimeBytecode.json";
import { buildSafeTransaction, executeContractCallWithSigners, executeTxWithSigners } from "../../src/utils/execution";

const SAFE_SINGLETON_141_ADDRESS = "0x3E5c63644E683549055b9Be8653de26E0B4CD36E";

const SAFE_SINGLETON_141_L2_ADDRESS = "0xfb1bffC9d739B8D520DaF37dF666da4C687191EA";

const SAFE_SINGLETON_150_ADDRESS = "0x88627c8904eCd9DF96A572Ef32A7ff13b199Ed8D";

const SAFE_SINGLETON_150_L2_ADDRESS = "0x0Ee37514644683f7EB9745a5726C722DeBa77e52";

const FALLBACK_HANDLER_STORAGE_SLOT = "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";

const GUARD_STORAGE_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

describe("SafeToL2Migration library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        // Set the runtime code for hardcoded addresses, so the expected events are emitted
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_141_ADDRESS, safeRuntimeBytecode.safe141]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_141_L2_ADDRESS, safeRuntimeBytecode.safe141l2]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_ADDRESS, safeRuntimeBytecode.safe150]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_L2_ADDRESS, safeRuntimeBytecode.safe150l2]);

        const signers = await ethers.getSigners();
        const [user1] = signers;
        const singleton130Address = (await (await user1.sendTransaction({ data: deploymentData.safe130 })).wait())?.contractAddress;
        const singleton130L2Address = (await (await user1.sendTransaction({ data: deploymentData.safe130l2 })).wait())?.contractAddress;

        if (!singleton130Address || !singleton130L2Address) {
            throw new Error("Could not deploy Safe130 or Safe130L2");
        }
        const singleton130 = await getSafeSingletonAt(singleton130Address);
        const singleton130L2 = await getSafeSingletonAt(singleton130L2Address);

        const guardContract = await hre.ethers.getContractAt("Guard", AddressZero);
        const guardEip165Calldata = guardContract.interface.encodeFunctionData("supportsInterface", ["0x945b8148"]);
        const validGuardMock = await getMock();
        await validGuardMock.givenCalldataReturnBool(guardEip165Calldata, true);

        const invalidGuardMock = await getMock();
        await invalidGuardMock.givenCalldataReturnBool(guardEip165Calldata, false);

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
        const safeToL2MigrationContract = await hre.ethers.getContractFactory("SafeToL2Migration");
        const migration = await safeToL2MigrationContract.deploy();
        return {
            safe130: await getSafeWithSingleton(singleton130, [user1.address]),
            safe130l2: await getSafeWithSingleton(singleton130L2, [user1.address]),
            safeWith1967Proxy,
            migration,
            signers,
            validGuardMock,
            invalidGuardMock,
            singleton130Address,
            singleton130L2Address,
        };
    });

    describe("migrateToL2", () => {
        it("reverts if the singleton is not set", async () => {
            const {
                migration,
                safeWith1967Proxy,
                signers: [user1],
                singleton130L2Address,
            } = await setupTests();

            await expect(
                executeContractCallWithSigners(safeWith1967Proxy, migration, "migrateToL2", [singleton130L2Address], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if new singleton is the same as the old one", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
                singleton130Address,
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [singleton130Address], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if new singleton is not supported", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [SAFE_SINGLETON_150_L2_ADDRESS], [user1], true),
            ).to.be.revertedWith("GS013");
        });

        it("reverts if nonce > 0", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
                singleton130Address,
                singleton130L2Address,
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            // Increase nonce by sending eth
            await user1.sendTransaction({ to: safeAddress, value: ethers.parseEther("1") });
            const nonce = 0;
            const safeTx = buildSafeTransaction({ to: user1.address, value: ethers.parseEther("1"), nonce });
            await executeTxWithSigners(safe130, safeTx, [user1]);

            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateToL2", [singleton130L2Address], [user1], true),
            ).to.be.revertedWith("GS013");

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(singleton130Address);
        });

        it("migrates from singleton 1.3.0 to 1.3.0L2", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
                singleton130L2Address,
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateToL2", [singleton130L2Address], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(singleton130L2Address);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(singleton130L2Address);
        });

        it("doesn't touch important storage slots", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
                singleton130L2Address,
            } = await setupTests();
            const safeAddress = await safe130.getAddress();

            const ownerCountBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 3);
            const thresholdBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 4);
            const nonceBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, 5);
            const guardBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT);
            const fallbackHandlerBeforeMigration = await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT);

            await expect(executeContractCallWithSigners(safe130, migration, "migrateToL2", [singleton130L2Address], [user1], true));

            expect(await hre.ethers.provider.getStorage(safeAddress, 3)).to.be.eq(ownerCountBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 4)).to.be.eq(thresholdBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, 5)).to.be.eq(nonceBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.be.eq(guardBeforeMigration);
            expect(await hre.ethers.provider.getStorage(safeAddress, FALLBACK_HANDLER_STORAGE_SLOT)).to.be.eq(
                fallbackHandlerBeforeMigration,
            );
        });
    });
});
