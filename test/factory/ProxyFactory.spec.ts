import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Contract } from "ethers";
import { deployContractFromSource, getFactory, getMock, getSafe, getSafeProxyRuntimeCode } from "../utils/setup";
import { AddressZero } from "@ethersproject/constants";
import { calculateChainSpecificProxyAddress, calculateProxyAddress } from "../../src/utils/proxies";
import { chainId } from "./../utils/encoding";

describe("ProxyFactory", () => {
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

        function revertingInitializer() public {
            revert("initialization reverted");
        }

        function masterCopy() public pure returns (address) {
            return address(0);
        }

        function forward(address to, bytes memory data) public returns (bytes memory result) {
            (,result) = to.call(data);
        }
    }`;

    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        const singleton = await deployContractFromSource(user1, SINGLETON_SOURCE);
        return {
            safe: await getSafe({ owners: [user1.address] }),
            factory: await getFactory(),
            mock: await getMock(),
            singleton,
        };
    });

    describe("proxyCreationCode && proxyCreationCodeHash", () => {
        it("hash of proxyCreationCode, singleton should be equal to the proxyCreationCodeHash", async () => {
            const { factory, singleton } = await setupTests();
            const creationCode = await factory.proxyCreationCode();
            const creationCodeHash = await factory.proxyCreationCodehash(await singleton.getAddress());
            const calculatedCreationCodeHash = ethers.keccak256(
                ethers.solidityPacked(["bytes", "uint256"], [creationCode, await singleton.getAddress()]),
            );
            expect(calculatedCreationCodeHash).to.be.eq(creationCodeHash);
        });

        it("should be possible to predict the create2 address of a proxy with proxyCreationCode", async () => {
            const { factory, singleton } = await setupTests();
            const saltNonce = 42n;
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const creationCode = await factory.proxyCreationCode();
            const salt = ethers.solidityPackedKeccak256(
                ["bytes32", "uint256"],
                [ethers.solidityPackedKeccak256(["bytes"], [initCode]), saltNonce],
            );
            const deploymentCode = ethers.solidityPacked(["bytes", "uint256"], [creationCode, await singleton.getAddress()]);

            const proxyAddress = await factory.createProxyWithNonce.staticCall(singletonAddress, initCode, saltNonce);
            const calculatedProxyAddressWithEthers = ethers.getCreate2Address(
                await factory.getAddress(),
                salt,
                ethers.keccak256(deploymentCode),
            );

            expect(proxyAddress).to.be.eq(calculatedProxyAddressWithEthers);
        });

        it("should be possible to predict the create2 address of a proxy with proxyCreationCodeHash", async () => {
            const { factory, singleton } = await setupTests();
            const saltNonce = 42n;
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const creationCodeHash = await factory.proxyCreationCodehash(await singleton.getAddress());
            const salt = ethers.solidityPackedKeccak256(
                ["bytes32", "uint256"],
                [ethers.solidityPackedKeccak256(["bytes"], [initCode]), saltNonce],
            );

            const proxyAddress = await factory.createProxyWithNonce.staticCall(singletonAddress, initCode, saltNonce);
            const calculatedProxyAddressWithEthers = ethers.getCreate2Address(await factory.getAddress(), salt, creationCodeHash);

            expect(proxyAddress).to.be.eq(calculatedProxyAddressWithEthers);
        });
    });

    describe("createProxyWithNonce", () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            const randomAddress = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
            await expect(factory.createProxyWithNonce(randomAddress, "0x", saltNonce)).to.be.revertedWith(
                "Singleton contract not deployed",
            );
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            await expect(factory.createProxyWithNonce(singletonAddress, "0x42baddad", saltNonce)).to.be.revertedWithoutReason();
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = "0x";
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            const proxy = singleton.attach(proxyAddress) as Contract;

            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const factoryAddress = await factory.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(factoryAddress);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            await expect(factory.createProxyWithNonce(singletonAddress, initCode, saltNonce)).to.be.revertedWith("Create2 call failed");
        });

        it("should propagate initializer reverts", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("revertingInitializer", []);
            await expect(factory.createProxyWithNonce(singletonAddress, initCode, saltNonce)).to.be.revertedWith("initialization reverted");
        });
    });

    describe("createProxyWithNonceL2", () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            const randomAddress = ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
            await expect(factory.createProxyWithNonceL2(randomAddress, "0x", saltNonce)).to.be.revertedWith(
                "Singleton contract not deployed",
            );
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            await expect(factory.createProxyWithNonceL2(singletonAddress, "0x42baddad", saltNonce)).to.be.revertedWithoutReason();
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = "0x";
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce);
            const proxy = singleton.attach(proxyAddress) as Contract;

            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const factoryAddress = await factory.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce);
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(factoryAddress);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce);
            await expect(factory.createProxyWithNonceL2(singletonAddress, initCode, saltNonce)).to.be.revertedWith("Create2 call failed");
        });

        it("should propagate initializer reverts", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("revertingInitializer", []);
            await expect(factory.createProxyWithNonceL2(singletonAddress, initCode, saltNonce)).to.be.revertedWith(
                "initialization reverted",
            );
        });
    });

    describe("createProxyWithNonce & createProxyWithNonceL2", () => {
        const saltNonce = 42;

        it("should result in same proxy", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateProxyAddress(factory, singletonAddress, initCode, saltNonce);
            const proxyAddressOnchain = await factory.createProxyWithNonce.staticCall(singletonAddress, initCode, saltNonce);
            const proxyAddressOnchainL2 = await factory.createProxyWithNonceL2.staticCall(singletonAddress, initCode, saltNonce);
            expect(proxyAddress).to.be.eq(proxyAddressOnchain);
            expect(proxyAddress).to.be.eq(proxyAddressOnchainL2);
        });
    });

    describe("createChainSpecificProxyWithNonce", () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            await expect(factory.createChainSpecificProxyWithNonce(AddressZero, "0x", saltNonce)).to.be.revertedWith(
                "Singleton contract not deployed",
            );
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            await expect(
                factory.createChainSpecificProxyWithNonce(singletonAddress, "0x42baddad", saltNonce),
            ).to.be.revertedWithoutReason();
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = "0x";
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const factoryAddress = await factory.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(factoryAddress);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should deploy proxy to create2 address with chainid included in salt", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const provider = hre.ethers.provider;
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            expect(await provider.getCode(proxyAddress)).to.eq("0x");

            await factory.createChainSpecificProxyWithNonce(singletonAddress, initCode, saltNonce).then((tx) => tx.wait(1));

            expect(await provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonce(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress);
            await expect(factory.createChainSpecificProxyWithNonce(singletonAddress, initCode, saltNonce)).to.be.revertedWith(
                "Create2 call failed",
            );
        });
    });

    describe("createChainSpecificProxyWithNonceL2", () => {
        const saltNonce = 42;

        it("should revert if singleton address is not a contract", async () => {
            const { factory } = await setupTests();
            await expect(factory.createChainSpecificProxyWithNonceL2(AddressZero, "0x", saltNonce)).to.be.revertedWith(
                "Singleton contract not deployed",
            );
        });

        it("should revert with invalid initializer", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            await expect(
                factory.createChainSpecificProxyWithNonceL2(singletonAddress, "0x42baddad", saltNonce),
            ).to.be.revertedWithoutReason();
        });

        it("should emit event without initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = "0x";
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ChainSpecificProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce, await chainId());
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(AddressZero);
            expect(await proxy.isInitialized()).to.be.eq(false);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should emit event with initializing", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const factoryAddress = await factory.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ChainSpecificProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce, await chainId());
            const proxy = singleton.attach(proxyAddress) as Contract;
            expect(await proxy.creator()).to.be.eq(factoryAddress);
            expect(await proxy.isInitialized()).to.be.eq(true);
            expect(await proxy.masterCopy()).to.be.eq(singletonAddress);
            expect(await singleton.masterCopy()).to.be.eq(AddressZero);
            expect(await hre.ethers.provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should deploy proxy to create2 address with chainid included in salt", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const provider = hre.ethers.provider;
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            expect(await provider.getCode(proxyAddress)).to.eq("0x");

            await factory.createChainSpecificProxyWithNonceL2(singletonAddress, initCode, saltNonce).then((tx) => tx.wait(1));

            expect(await provider.getCode(proxyAddress)).to.be.eq(await getSafeProxyRuntimeCode());
        });

        it("should not be able to deploy same proxy twice", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();
            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonceL2(singletonAddress, initCode, saltNonce))
                .to.emit(factory, "ProxyCreation")
                .withArgs(proxyAddress, singletonAddress)
                .to.emit(factory, "ChainSpecificProxyCreationL2")
                .withArgs(proxyAddress, singletonAddress, initCode, saltNonce, await chainId());
            await expect(factory.createChainSpecificProxyWithNonceL2(singletonAddress, initCode, saltNonce)).to.be.revertedWith(
                "Create2 call failed",
            );
        });
    });

    describe("createChainSpecificProxyWithNonce & createChainSpecificProxyWithNonceL2", () => {
        const saltNonce = 42;

        it("should result in same proxy", async () => {
            const { factory, singleton } = await setupTests();
            const singletonAddress = await singleton.getAddress();

            const initCode = singleton.interface.encodeFunctionData("init", []);
            const proxyAddress = await calculateChainSpecificProxyAddress(factory, singletonAddress, initCode, saltNonce, await chainId());
            const proxyAddressOnchain = await factory.createChainSpecificProxyWithNonce.staticCall(singletonAddress, initCode, saltNonce);
            const proxyAddressOnchainL2 = await factory.createChainSpecificProxyWithNonceL2.staticCall(
                singletonAddress,
                initCode,
                saltNonce,
            );
            expect(proxyAddress).to.be.eq(proxyAddressOnchain);
            expect(proxyAddress).to.be.eq(proxyAddressOnchainL2);
        });
    });
});
