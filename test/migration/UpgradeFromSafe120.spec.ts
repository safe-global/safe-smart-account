import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafeSingleton, getFactory, getMock, getMultiSend } from "../utils/setup";
import { buildSafeTransaction, executeTx, safeApproveHash } from "../../src/utils/execution";
import { verificationTests } from "./subTests.spec";
import deploymentData from "../json/safeDeployment.json";
import { calculateProxyAddress } from "../../src/utils/proxies";

describe("Upgrade from Safe 1.2.0", () => {
    before(function () {
        /**
         * ## There's no safe 1.2.0 on zkSync, so we skip this test
         */
        if (hre.network.zksync) this.skip();
    });

    const ChangeMasterCopyInterface = new ethers.Interface(["function changeMasterCopy(address target)"]);

    // We migrate the Safe and run the verification tests
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock();
        const mockAddress = await mock.getAddress();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const singleton120 = (await (await user1.sendTransaction({ data: deploymentData.safe120 })).wait())?.contractAddress;
        if (!singleton120) throw new Error("Could not deploy Safe 1.2.0");

        const singleton150 = await (await getSafeSingleton()).getAddress();
        const factory = await getFactory();
        const saltNonce = 42;
        const proxyAddress = await calculateProxyAddress(factory, singleton120, "0x", saltNonce);
        await factory.createProxyWithNonce(singleton120, "0x", saltNonce).then((tx) => tx.wait());

        const safe = await hre.ethers.getContractAt("Safe", proxyAddress);
        await safe.setup([user1.address], 1, AddressZero, "0x", mockAddress, AddressZero, 0, AddressZero);

        expect(await safe.VERSION()).to.be.eq("1.2.0");
        const nonce = await safe.nonce();
        const data = ChangeMasterCopyInterface.encodeFunctionData("changeMasterCopy", [singleton150]);
        const tx = buildSafeTransaction({ to: await safe.getAddress(), data, nonce });
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
