import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { benchmark } from "./utils/setup";

const testTarget = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

benchmark("Ether", async () => {
    const [user1] = await ethers.getSigners();
    return [
        {
            name: "transfer",
            prepare: async (_, target: string, nonce: BigNumberish) => {
                // Create account, as we don't want to test this in the benchmark
                await user1.sendTransaction({ to: testTarget, value: 1 });
                await user1.sendTransaction({ to: target, value: 1000 });
                return buildSafeTransaction({ to: testTarget, value: 500, safeTxGas: 1000000, nonce });
            },
            after: async () => {
                expect(await ethers.provider.getBalance(testTarget)).to.eq(501n);
            },
        },
    ];
});
