import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getFactory, getSafeWithOwners } from "../utils/setup";
import { AddressZero } from "@ethersproject/constants";
import { Contract } from "ethers";
import { calculateProxyAddress } from "../utils/proxies";

describe("ProxyFactory", async () => {

    const SINGLETON_SOURCE = `
    contract Test {
        address _singleton;
        address public creator;
        bool public isInitialized;
        constructor() public payable {
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
    }`

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture()
        const singleton = await deployContract(user1, SINGLETON_SOURCE)
        return {
            safe: await getSafeWithOwners([user1.address]),
            factory: await getFactory(),
            singleton
        }
    })

    describe("createProxy", async () => {

        it('should revert with invalid initializer', async () => {
            const { factory, singleton } = await setupTests()
            await expect(
                factory.createProxy(singleton.address, "0x42baddad")
            ).to.be.revertedWith("Transaction reverted without a reason")
        })

        it('should emit event without initializing', async () => {
            const { factory, singleton } = await setupTests()
            const factoryNonce = await ethers.provider.getTransactionCount(factory.address)
            const proxyAddress = ethers.utils.getContractAddress({ from: factory.address, nonce: factoryNonce })
            await expect(
                factory.createProxy(singleton.address, "0x")
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(AddressZero)
            expect(await proxy.isInitialized()).to.be.eq(false)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
        })

        it('should emit event with initializing', async () => {
            const { factory, singleton } = await setupTests()
            const factoryNonce = await ethers.provider.getTransactionCount(factory.address)
            const proxyAddress = ethers.utils.getContractAddress({ from: factory.address, nonce: factoryNonce })
            await expect(
                factory.createProxy(singleton.address, singleton.interface.encodeFunctionData("init", []))
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(factory.address)
            expect(await proxy.isInitialized()).to.be.eq(true)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
        })
    })

    describe("createProxyWithNonce", async () => {

        const saltNonce = 42

        it('should revert with invalid initializer', async () => {
            const { factory, singleton } = await setupTests()
            await expect(
                factory.createProxyWithNonce(singleton.address, "0x42baddad", saltNonce)
            ).to.be.revertedWith("Transaction reverted without a reason")
        })

        it('should emit event without initializing', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = "0x"
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(AddressZero)
            expect(await proxy.isInitialized()).to.be.eq(false)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
        })

        it('should emit event with initializing', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = singleton.interface.encodeFunctionData("init", [])
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress)
            const proxy = singleton.attach(proxyAddress)
            expect(await proxy.creator()).to.be.eq(factory.address)
            expect(await proxy.isInitialized()).to.be.eq(true)
            expect(await proxy.masterCopy()).to.be.eq(singleton.address)
            expect(await singleton.masterCopy()).to.be.eq(AddressZero)
        })

        it('should not be able to deploy same proxy twice', async () => {
            const { factory, singleton } = await setupTests()
            const initCode = singleton.interface.encodeFunctionData("init", [])
            const proxyAddress = await calculateProxyAddress(factory, singleton.address, initCode, saltNonce)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.emit(factory, "ProxyCreation").withArgs(proxyAddress)
            await expect(
                factory.createProxyWithNonce(singleton.address, initCode, saltNonce)
            ).to.be.revertedWith("Create2 call failed")
        })
    })
})