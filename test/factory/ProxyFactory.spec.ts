import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getFactory, getMock, getSafeWithOwners, getSafeProxyRuntimeCode } from "../utils/setup";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "ethers";
import { calculateChainSpecificProxyAddress, calculateProxyAddress, calculateProxyAddressWithCallback } from "../../src/utils/proxies";
import { chainId } from "./../utils/encoding";

describe("ProxyFactory", async () => {
    const SINGLETON_SOURCE = `
    contract Test {
        address _singleton;
        address public creator;
        bool public isInitialized;
        constructor() payable {
            creator = msg.sender;
        }

        function init() public {
            require(!isInitialized, "Is initialized");
            creator = msg.sender;
            isInitialized = true;
        }

        function masterCopy() public pure returns (address) {
            return address(0);
        }

        function forward(address to, bytes memory data) public returns (bytes memory result) {
            (,result) = to.call(data);
        }
    }`;

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const singleton = await deployContract(user1, SINGLETON_SOURCE);
        return {
            safe: await getSafeWithOwners([user1.address]),
            factory: await getFactory(),
            mock: await getMock(),
            singleton,
        };
    });

    describe("createProxyWithNonce", async () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            const randomAddress = ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20)));
            await expect(factory.createProxyWithNonce(randomAddress, "0x", saltNonce)).to.be.revertedWith(
                "Singleton contract not deployed",
            );
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            await expect(factory.createProxyWithNonce(singleton.address, "0x42baddad", saltNonce)).to.be.revertedWith(
                "Transaction reverted without a reason",
            );
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = "0x";
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            const proxy = singleton.attach(proxyAddress);

            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singleton.address);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            const proxy = singleton.attach(proxyAddress);
            expect(await proxy.creator()).to.be.eq(factory.address);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singleton.address);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce)).to.be.revertedWith("Create2 call failed");
        });
    });

    describe("createChainSpecificProxyWithNonce", async () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            await expect(factory.createProxyWithNonce(AddressZero, "0x", saltNonce)).to.be.revertedWith("Singleton contract not deployed");
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            await expect(factory.createProxyWithNonce(singleton.address, "0x42baddad", saltNonce)).to.be.revertedWith(
                "Transaction reverted without a reason",
            );
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = "0x";
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            const proxy = singleton.attach(proxyAddress);
            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singleton.address);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            const proxy = singleton.attach(proxyAddress);
            expect(await proxy.creator()).to.be.eq(factory.address);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singleton.address);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should deploy proxy to create2 address with chainid included in salt", async () => {
            const { factory, singleton } = await setupTests();
            const provider = hre.ethers.provider;
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singleton.address, initCode, saltNonce, await chainId());
            expect(await provider.getCode(proxyAddress)).to.eq("0x");

            await factory.createChainSpecificProxyWithNonce(singleton.address, initCode, saltNonce);

            expect(await provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            await expect(factory.createProxyWithNonce(singleton.address, initCode, saltNonce)).to.be.revertedWith("Create2 call failed");
        });
    });

    describe("createProxyWithCallback", async () => {
        const saltNonce = 42;

        it("check callback is invoked", async () => {
            const { factory, mock, singleton } = await setupTests();
            const callback = await hre.ethers.getContractAt("IProxyCreationCallback", mock.address);
            const initCode = singleton.interface.encodeFunctionData("init", []);

            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, mock.address);
            await expect(factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);

            expect(await mock.callStatic.invocationCount()).to.be.deep.equal(BigNumber.from(1));

            const callbackData = callback.interface.encodeFunctionData("proxyCreated", [
                proxyAddress,
                factory.address,
                initCode,
                saltNonce,
            ]);
            expect(await mock.callStatic.invocationCountForMethod(callbackData)).to.be.deep.equal(BigNumber.from(1));
        });

        it("check callback error cancels deployment", async () => {
            const { factory, mock, singleton } = await setupTests();
            const initCode = "0x";
            await mock.givenAnyRevert();
            await expect(
                factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address),
                "Should fail if callback fails",
            ).to.be.reverted;

            await mock.reset();
            // Should be successfull now
            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, mock.address);
            await expect(factory.createProxyWithCallback(singleton.address, initCode, saltNonce, mock.address))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
        });

        it("should work without callback", async () => {
            const { factory, singleton } = await setupTests();
            const initCode = "0x";
            const proxyAddress = await calculateProxyAddressWithCallback(factory, singleton.address, initCode, saltNonce, AddressZero);
            await expect(factory.createProxyWithCallback(singleton.address, initCode, saltNonce, AddressZero))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singleton.address);
            const proxy = singleton.attach(proxyAddress);
            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singleton.address);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });
    });
});
