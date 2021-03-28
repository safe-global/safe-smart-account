import { expect } from "chai";
import { waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { BigNumber } from "ethers";
import { benchmark } from "./utils/setup"

const testTarget = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const [user1] = waffle.provider.getWallets();

benchmark("Ether", [{
    name: "transfer",
    prepare: async (_, target: string, nonce: number) => {
        // Create account, as we don't want to test this in the benchmark
        await user1.sendTransaction({ to: testTarget, value: 1 })
        await user1.sendTransaction({ to: target, value: 1000 })
        return buildSafeTransaction({ to: testTarget, value: 500, safeTxGas: 1000000, nonce })
    },
    after: async () => {
        expect(
            await ethers.provider.getBalance(testTarget)
        ).to.be.deep.eq(BigNumber.from(501))
    },
}])