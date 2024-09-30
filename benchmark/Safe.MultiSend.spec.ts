import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { benchmark, Contracts } from "./utils/setup";
import { buildMultiSendSafeTx } from "../src/utils/multisend";

benchmark("MultiSend", async () => {
    const [, , , , user5] = await ethers.getSigners();

    return [
        {
            name: "multiple ERC20 transfers",
            prepare: async (contracts: Contracts, target: string, nonce: BigNumberish) => {
                const token = contracts.additions.token;
                const multiSend = contracts.additions.multiSend;
                await token.transfer(target, 1500);
                const transfer = {
                    to: await token.getAddress(),
                    value: 0,
                    data: token.interface.encodeFunctionData("transfer", [user5.address, 500]),
                    operation: 0,
                };
                return buildMultiSendSafeTx(
                    multiSend,
                    [...Array(3)].map(() => transfer),
                    nonce,
                );
            },
            after: async (contracts: Contracts) => {
                expect(await contracts.additions.token.balanceOf(user5.address)).to.eq(1500n);
            },
            fixture: async () => {
                const multiSendFactory = await ethers.getContractFactory("MultiSend");
                const multiSend = await multiSendFactory.deploy();
                const guardFactory = await ethers.getContractFactory("DelegateCallTransactionGuard");
                const tokenFactory = await ethers.getContractFactory("ERC20Token");
                return {
                    multiSend,
                    guard: await guardFactory.deploy(multiSend),
                    token: await tokenFactory.deploy(),
                };
            },
        },
    ];
});
