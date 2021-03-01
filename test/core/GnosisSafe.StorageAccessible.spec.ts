import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getSafeSingleton, getDefaultCallbackHandler, getSafeWithOwners } from "../utils/setup";
import { BigNumber, utils } from "ethers";

describe("StorageAccessible", async () => {

    const [user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const handler = await getDefaultCallbackHandler()
        const source = `
            contract Test {
                function killme() public {
                    selfdestruct(payable(msg.sender));
                }

                function expose() public returns (address handler) {
                    bytes32 slot = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;
                    assembly {
                        handler := sload(slot)
                    }
                }

                function estimate(address to, bytes memory data) public returns (uint256) {
                    uint256 startGas = gasleft();
                    (bool success,) = to.call{ gas: gasleft() }(data);
                    require(success, "Transaction failed");
                    return startGas - gasleft();
                }

                address singleton;
                uint256 public value = 0;
                function updateAndGet() public returns (uint256) {
                    value++;
                    return value;
                }

                function trever() public returns (address handler) {
                    revert("Why are you doing this?");
                }
            }`
        const killLib = await deployContract(user1, source);
        return {
            safe: await getSafeWithOwners([user1.address, user2.address], 1, handler.address),
            killLib,
            handler
        }
    })

    describe("getStorageAt", async () => {

        it('can read singleton', async () => {
            await setupTests()
            const singleton = await getSafeSingleton()
            expect(
                await singleton.getStorageAt(3, 2)
            ).to.be.eq(utils.solidityPack(['uint256', 'uint256'], [0, 1]))
        })

        it('can read instantiated Safe', async () => {
            const { safe } = await setupTests()
            const singleton = await getSafeSingleton()
            // Read singleton address, empty slots for module and owner linked lists, owner count and threshold
            expect(
                await safe.getStorageAt(0, 5)
            ).to.be.eq(utils.solidityPack(['uint256', 'uint256', 'uint256', 'uint256', 'uint256'], [singleton.address, 0, 0, 2, 1]))
        })
    })

    describe("simulateDelegatecall", async () => {

        it('should revert changes', async () => {
            const { safe, killLib } = await setupTests()
            const code = await hre.ethers.provider.getCode(safe.address)
            expect(
                await safe.callStatic.simulateDelegatecall(killLib.address, killLib.interface.encodeFunctionData("killme"))
            ).to.be.eq("0x")
            expect(
                await hre.ethers.provider.getCode(safe.address)
            ).to.be.eq(code)
        })

        it('should return result', async () => {
            const { safe, killLib, handler } = await setupTests()
            expect(
                await safe.callStatic.simulateDelegatecall(killLib.address, killLib.interface.encodeFunctionData("expose"))
            ).to.be.eq("0x000000000000000000000000" + handler.address.slice(2).toLowerCase())
        })

        it('should propagate revert message', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateDelegatecall(killLib.address, killLib.interface.encodeFunctionData("trever"))
            ).to.revertedWith("Why are you doing this?")
        })

        it('should simulate transaction', async () => {
            const { safe, killLib } = await setupTests()
            const estimate = await safe.callStatic.simulateDelegatecall(
                killLib.address,
                killLib.interface.encodeFunctionData("estimate", [safe.address, "0x"])
            )
            expect(BigNumber.from(estimate).toNumber()).to.be.lte(5000)
        })

        it('should return modified state', async () => {
            const { safe, killLib } = await setupTests()
            const value = await safe.callStatic.simulateDelegatecall(
                killLib.address,
                killLib.interface.encodeFunctionData("updateAndGet", [])
            )
            expect(BigNumber.from(value).toNumber()).to.be.eq(1)
            expect((await killLib.value()).toNumber()).to.be.eq(0)
        })
    })

    describe("simulateDelegatecallInternal", async () => {

        it('should revert changes', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateDelegatecallInternal(killLib.address, killLib.interface.encodeFunctionData("killme"))
            ).to.be.reverted
        })

        it('should revert the revert with message', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateDelegatecallInternal(killLib.address, killLib.interface.encodeFunctionData("trever"))
            ).to.revertedWith("Why are you doing this?")
        })

        it('should return estimate in revert', async () => {
            const { safe, killLib } = await setupTests()
            await expect(
                safe.callStatic.simulateDelegatecallInternal(killLib.address, killLib.interface.encodeFunctionData("estimate", [safe.address, "0x"]))
            ).to.be.reverted
        })
    })
})