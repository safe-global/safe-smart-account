import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { benchmark, Contracts } from "./utils/setup";

const [, , , , user5] = await ethers.getSigners();

benchmark("ERC1155", [
    {
        name: "transfer",
        prepare: async (contracts: Contracts, target: string, nonce: number) => {
            const token = contracts.additions.token;
            await token.mint(target, 23, 1337, "0x");
            const data = token.interface.encodeFunctionData("safeTransferFrom", [target, user5.address, 23, 500, "0x"]);
            return buildSafeTransaction({ to: token.address, data, safeTxGas: 1000000, nonce });
        },
        after: async (contracts: Contracts) => {
            expect(await contracts.additions.token.balanceOf(user5.address, 23)).to.eq(500n);
        },
        fixture: async () => {
            const tokenFactory = await ethers.getContractFactory("ERC1155Token");
            return {
                token: await tokenFactory.deploy(),
            };
        },
    },
]);
