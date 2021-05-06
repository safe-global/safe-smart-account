import { expect } from "chai";
import { waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { BigNumber } from "ethers";
import { benchmark, Contracts } from "./utils/setup"

const [, , , , user5] = waffle.provider.getWallets();

benchmark("ERC20", [{
    name: "transfer",
    prepare: async (contracts: Contracts, target: string, nonce: number) => {
        const token = contracts.additions.token
        await token.transfer(target, 1000)
        const data = token.interface.encodeFunctionData("transfer", [user5.address, 500])
        return buildSafeTransaction({ to: token.address, data, safeTxGas: 1000000, nonce })
    },
    after: async (contracts: Contracts) => {
        expect(
            await contracts.additions.token.balanceOf(user5.address)
        ).to.be.deep.eq(BigNumber.from(500))
    },
    fixture: async () => {
        const tokenFactory = await ethers.getContractFactory("ERC20Token")
        return {
            token: await tokenFactory.deploy()
        }
    }
}])