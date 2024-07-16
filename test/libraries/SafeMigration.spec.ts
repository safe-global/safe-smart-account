import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { getSafeWithSingleton, getSafeSingletonAt, safeMigrationContract } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import safeRuntimeBytecode from "../json/safeRuntimeBytecode.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

const SAFE_SINGLETON_150_ADDRESS = "0x477C3fb2D564349E2F95a2EF1091bF9657b26145";
const SAFE_SINGLETON_150_L2_ADDRESS = "0x551A2F9a71bF88cDBef3CBe60E95722f38eE0eAA";

describe("SafeMigration Library", () => {
    const migratedInterface = new ethers.Interface(["function masterCopy() view returns(address)"]);

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;

        // Set the runtime code for hardcoded addresses, so the expected events are emitted
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_ADDRESS, safeRuntimeBytecode.safe150]);
        await hre.network.provider.send("hardhat_setCode", [SAFE_SINGLETON_150_L2_ADDRESS, safeRuntimeBytecode.safe150l2]);

        const singleton130Address = (await (await user1.sendTransaction({ data: deploymentData.safe130 })).wait())?.contractAddress;
        const singleton130L2Address = (await (await user1.sendTransaction({ data: deploymentData.safe130l2 })).wait())?.contractAddress;

        if (!singleton130Address || !singleton130L2Address) {
            throw new Error("Could not deploy Safe130 or Safe130L2");
        }
        const singleton130 = await getSafeSingletonAt(singleton130Address);
        const singleton130L2 = await getSafeSingletonAt(singleton130L2Address);

        const migration = await (await safeMigrationContract()).deploy(SAFE_SINGLETON_150_ADDRESS, SAFE_SINGLETON_150_L2_ADDRESS);

        return {
            signers,
            safe130: await getSafeWithSingleton(singleton130, [user1.address]),
            safe130l2: await getSafeWithSingleton(singleton130L2, [user1.address]),
            migration,
        };
    });

    describe("migrateSingleton", async () => {
        it("migrates the singleton", async () => {
            const {
                safe130l2,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130l2.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(
                executeContractCallWithSigners(safe130l2, migration, "migrateSingleton", [SAFE_SINGLETON_150_ADDRESS], [user1], true),
            )
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_ADDRESS);
        });
    });

    describe("migrateL2Singleton", async () => {
        it("migrates the singleton", async () => {
            const {
                safe130,
                migration,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe130.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(
                executeContractCallWithSigners(safe130, migration, "migrateL2Singleton", [SAFE_SINGLETON_150_L2_ADDRESS], [user1], true),
            )
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(SAFE_SINGLETON_150_L2_ADDRESS);

            const singletonResp = await user1.call({ to: safeAddress, data: migratedInterface.encodeFunctionData("masterCopy") });
            expect(migratedInterface.decodeFunctionResult("masterCopy", singletonResp)[0]).to.eq(SAFE_SINGLETON_150_L2_ADDRESS);
        });
    });
});
