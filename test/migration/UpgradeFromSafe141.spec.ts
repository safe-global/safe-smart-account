import { expect } from "chai";
import { ethers } from "ethers";
import hre, { deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import * as zk from "zksync-ethers";
import { getFactory, getMock, getMultiSend } from "../utils/setup";
import { buildSafeTransaction, executeTx, safeApproveHash } from "../../src/utils/execution";
import { verificationTests } from "./subTests.spec";
import deploymentData from "../json/safeDeployment.json";
import { calculateProxyAddress } from "../../src/utils/proxies";

describe("Upgrade from Safe 1.4.1", () => {
    // We migrate the Safe and run the verification tests
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock();
        const mockAddress = await mock.getAddress();
        const [user1] = await hre.ethers.getSigners();
        let singleton141;
        if (hre.network.zksync) {
            const factory = new zk.ContractFactory(deploymentData.safe141.abi, deploymentData.safe141.zksync, user1, "create");
            const contract = await factory.deploy();
            singleton141 = await (contract as ethers.Contract).getAddress();
        } else {
            singleton141 = (await (await user1.sendTransaction({ data: deploymentData.safe141.evm })).wait())?.contractAddress;
        }
        if (!singleton141) throw new Error("Could not deploy Safe 1.4.1");

        const factory = await getFactory();
        const saltNonce = 42;
        const proxyAddress = await calculateProxyAddress(factory, singleton141, "0x", saltNonce);
        await factory.createProxyWithNonce(singleton141, "0x", saltNonce).then((tx) => tx.wait());

        const safe = await hre.ethers.getContractAt("Safe", proxyAddress);
        await safe.setup([user1.address], 1, AddressZero, "0x", mockAddress, AddressZero, 0, AddressZero);

        expect(await safe.VERSION()).to.be.eq("1.4.1");
        const safeMigrationDeployment = await deployments.get("SafeMigration");
        const safeMigration = await hre.ethers.getContractAt("SafeMigration", safeMigrationDeployment.address);
        const nonce = await safe.nonce();
        const data = safeMigration.interface.encodeFunctionData("migrateSingleton");
        const tx = buildSafeTransaction({ to: await safeMigration.getAddress(), data, nonce, operation: 1 });
        await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
        expect(await safe.VERSION()).to.be.eq("1.5.0");

        return {
            migratedSafe: safe,
            mock,
            multiSend: await getMultiSend(),
        };
    });

    it("passes the Safe 1.4.1 tests", async () => {
        await verificationTests(setupTests);
    });
});
