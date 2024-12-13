import { expect } from "chai";
import hre from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { deployContractFromSource } from "../utils/setup";

describe("Proxy", () => {
    describe("constructor", () => {
        it("should revert with invalid singleton address", async () => {
            const Proxy = await hre.ethers.getContractFactory("SafeProxy");
            await expect(Proxy.deploy(AddressZero)).to.be.revertedWith("Invalid singleton address provided");
        });
    });

    describe("masterCopy", () => {
        const SINGLETON_SOURCE = `
        contract Test {
            uint256 _singletonSlot;
            function masterCopy() public pure returns (address) {
                return address(0);
            }
            function overwriteSingletonSlot(uint256 value) public {
                _singletonSlot = value;
            }
            function theAnswerToLifeTheUniverseAndEverything() public pure returns (uint256) {
                return 42;
            }
        }`;

        const setupTests = hre.deployments.createFixture(async () => {
            const [deployer] = await hre.ethers.getSigners();
            const singleton = await deployContractFromSource(deployer, SINGLETON_SOURCE);
            const Proxy = await hre.ethers.getContractFactory("SafeProxy");
            const proxyDeployment = await Proxy.deploy(singleton.target);
            const proxy = singleton.attach(proxyDeployment) as typeof singleton;
            return {
                singleton,
                proxy,
            };
        });

        it("should return the master copy address regardless of implementation", async () => {
            const { singleton, proxy } = await setupTests();
            expect(await singleton.masterCopy()).to.equal(hre.ethers.ZeroAddress);
            expect(await proxy.masterCopy()).to.equal(await singleton.getAddress());
        });

        it("should correctly mask the address value", async () => {
            const { proxy } = await setupTests();
            await proxy.overwriteSingletonSlot(hre.ethers.MaxUint256);
            expect(await proxy.masterCopy()).to.equal(hre.ethers.getAddress(`0x${"ff".repeat(20)}`));
        });

        it("should ignore most significant bits when calling singleton", async () => {
            const { singleton, proxy } = await setupTests();
            const singletonAddressAsUint = BigInt(await singleton.getAddress());
            const mask = 0xffffffffffffffffffffffffn << 160n;

            expect(await proxy.theAnswerToLifeTheUniverseAndEverything()).to.equal(42);
            await proxy.overwriteSingletonSlot(singletonAddressAsUint | mask);
            expect(await proxy.theAnswerToLifeTheUniverseAndEverything()).to.equal(42);
        });
    });
});
