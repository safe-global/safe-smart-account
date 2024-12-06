import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe, getSafeSingleton, migrationContractFactory } from "../utils/setup";
import deploymentData from "../json/safeDeployment.json";
import { executeContractCallWithSigners } from "../../src/utils/execution";

describe("Migration 1.2.0", () => {
    before(function () {
        /**
         * ## Migration test is not relevant for zkSync: there is no 1.2.0 of safe-contracts on zkSync
         */
        if (hre.network.zksync) this.skip();
    });

    const MigratedInterface = new ethers.Interface([
        "function domainSeparator() view returns(bytes32)",
        "function masterCopy() view returns(address)",
    ]);

    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const singleton120 = (await (await user1.sendTransaction({ data: deploymentData.safe120 })).wait())?.contractAddress;
        if (!singleton120) {
            throw new Error("Could not deploy SafeSingleton120");
        }

        const migration = await (await migrationContractFactory()).deploy(singleton120);
        return {
            singleton: await getSafeSingleton(),
            singleton120,
            safe: await getSafe({ owners: [user1.address] }),
            migration,
            signers,
        };
    });
    describe("constructor", () => {
        it("can not use 0 Address", async () => {
            const {
                signers: [user1],
            } = await setupTests();
            const tx = await (await migrationContractFactory()).getDeployTransaction(AddressZero);
            await expect(user1.sendTransaction(tx)).to.be.revertedWith("Invalid singleton address provided");
        });
    });

    describe("migrate", () => {
        it("can only be called from Safe itself", async () => {
            const { migration } = await setupTests();
            await expect(migration.migrate()).to.be.revertedWith("Migration should only be called via delegatecall");
        });

        it("can migrate", async () => {
            const {
                safe,
                migration,
                singleton120,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            // The emit matcher checks the address, which is the Safe as delegatecall is used
            const migrationSafe = migration.attach(safeAddress);

            await expect(await ethers.provider.getStorage(safeAddress, "0x" + "".padEnd(62, "0") + "06")).to.be.eq(
                "0x" + "".padEnd(64, "0"),
            );

            await expect(executeContractCallWithSigners(safe, migration, "migrate", [], [user1], true))
                .to.emit(migrationSafe, "ChangedMasterCopy")
                .withArgs(singleton120);

            const expectedDomainSeparator = ethers.TypedDataEncoder.hashDomain({ verifyingContract: safeAddress });

            await expect(await ethers.provider.getStorage(safeAddress, "0x06")).to.be.eq(expectedDomainSeparator);

            const respData = await user1.call({ to: safeAddress, data: MigratedInterface.encodeFunctionData("domainSeparator") });
            await expect(MigratedInterface.decodeFunctionResult("domainSeparator", respData)[0]).to.be.eq(expectedDomainSeparator);

            const masterCopyResp = await user1.call({ to: safeAddress, data: MigratedInterface.encodeFunctionData("masterCopy") });
            await expect(MigratedInterface.decodeFunctionResult("masterCopy", masterCopyResp)[0]).to.be.eq(singleton120);
        });
    });
});
