import { expect } from "chai";
import hre, { ethers, deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeSingleton, getFactory, getMock, getMultiSend } from "../utils/setup";
import { buildSafeTransaction, executeTx, safeApproveHash } from "../../src/utils/execution";
import { verificationTests } from "./subTests.spec";
import deploymentData from "../json/safeDeployment.json";
import { calculateProxyAddress } from "../../src/utils/proxies";

describe("Upgrade from Safe 1.2.0", () => {
    const [user1] = waffle.provider.getWallets();

    const ChangeMasterCopyInterface = new ethers.utils.Interface(["function changeMasterCopy(address target)"]);

    // We migrate the Safe and run the verification tests
    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const mock = await getMock();
        const singleton120 = (await (await user1.sendTransaction({ data: deploymentData.safe120 })).wait()).contractAddress;
        const singleton140 = (await getSafeSingleton()).address;
        const factory = await getFactory();
        const saltNonce = 42;
        const proxyAddress = await calculateProxyAddress(factory, singleton120, "0x", saltNonce);
        await factory.createProxyWithNonce(singleton120, "0x", saltNonce).then((tx: any) => tx.wait());

        const Safe = await hre.ethers.getContractFactory("Safe");
        const safe = Safe.attach(proxyAddress);
        await safe.setup([user1.address], 1, AddressZero, "0x", mock.address, AddressZero, 0, AddressZero);

        expect(await safe.VERSION()).to.be.eq("1.2.0");
        const nonce = await safe.callStatic.nonce();
        const data = ChangeMasterCopyInterface.encodeFunctionData("changeMasterCopy", [singleton140]);
        const tx = buildSafeTransaction({ to: safe.address, data, nonce });
        await executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]);
        expect(await safe.VERSION()).to.be.eq("1.4.0");

        return {
            migratedSafe: safe,
            mock,
            multiSend: await getMultiSend(),
        };
    });
    verificationTests(setupTests);
});
