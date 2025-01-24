import { expect } from "chai";
import hre, { deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getAbi, getFactory, getMock, getMultiSend } from "../utils/setup";
import { buildSafeTransaction, executeTx, safeApproveHash } from "../../src/utils/execution";
import { verificationTests } from "./subTests.spec";
import deploymentData from "../json/safeDeployment.json";
import { calculateProxyAddress } from "../../src/utils/proxies";

describe("Upgrade from Safe 1.4.1 L2", () => {
    // We migrate the Safe and run the verification tests
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock();
        const mockAddress = await mock.getAddress();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const safeDeploymentData = hre.network.zksync ? deploymentData.safe141l2.zksync : deploymentData.safe141l2.evm;
        const safeContractFactory = new hre.ethers.ContractFactory(await getAbi("Safe"), safeDeploymentData, user1);
        const singleton141L2 = await (await safeContractFactory.deploy()).getAddress();
        if (!singleton141L2) throw new Error("Could not deploy Safe 1.4.1 L2");

        const factory = await getFactory();
        const saltNonce = 42;
        const proxyAddress = await calculateProxyAddress(factory, singleton141L2, "0x", saltNonce, hre.network.zksync);
        await factory.createProxyWithNonce(singleton141L2, "0x", saltNonce).then((tx) => tx.wait());

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
            signers,
        };
    });

    verificationTests(setupTests);
});
