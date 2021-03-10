import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployContract, getSafeWithOwners } from "../utils/setup";
import { BigNumber } from "ethers";

describe("GnosisSafe", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const reverterSource = `
            contract Reverter {
                function revert() public {
                    require(false, "Shit happens");
                }
            }`
        const reverter = await deployContract(user1, reverterSource);
        const decoderSource = `
            contract Decoder {
                function decode(address to, bytes memory data) public returns (bytes memory) {
                    (bool success, bytes memory data) = to.call(data);
                    require(!success, "Shit happens");
                    return data;
                }
            } `
        const decoder = await deployContract(user1, decoderSource);
        return {
            safe: await getSafeWithOwners([user1.address]),
            reverter,
            decoder
        }
    })

    describe("requiredTxGas", async () => {

        it('should revert without reason if tx fails', async () => {
            const { safe, reverter } = await setupTests()
            const readOnlySafe = safe.connect(hre.ethers.provider)
            const data = reverter.interface.encodeFunctionData("revert", [])
            await expect(
                readOnlySafe.callStatic.requiredTxGas(
                    reverter.address, 0, data, 0,
                    { from: safe.address }
                )
            ).to.be.revertedWith("Transaction reverted without a reason")
        })

        it('should always revert', async () => {
            const { safe } = await setupTests()
            const readOnlySafe = safe.connect(hre.ethers.provider)
            await readOnlySafe.callStatic.requiredTxGas(
                safe.address, 0, "0x", 0,
                { from: safe.address }
            ).then(() => {
                throw Error("Should never be successful")
            }, (error) => {
                const message: string = error.message
                expect(message.indexOf("Transaction reverted without a reason") < 0).to.be.true
            })
        })

        it('can be called from another contract', async () => {
            const { safe, decoder } = await setupTests()
            const data = safe.interface.encodeFunctionData("requiredTxGas", [safe.address, 0, "0x", 0])
            const result = await decoder.callStatic.decode(safe.address, data)
            expect(BigNumber.from("0x" + result.slice(result.length - 32)).toNumber()).to.be.lt(10000)
        })
    })
})