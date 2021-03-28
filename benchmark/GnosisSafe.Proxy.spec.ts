import "@nomiclabs/hardhat-ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { benchmark } from "./utils/setup"
import { getFactory } from "../test/utils/setup";

const testTarget = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

benchmark("Proxy", [{
    name: "creation",
    prepare: async (contracts,_,nonce) => {
        const factory = contracts.additions.factory
        const data = factory.interface.encodeFunctionData("createProxy", [testTarget, "0x"])
        return buildSafeTransaction({ to: factory.address, data, safeTxGas: 1000000, nonce })
    },
    fixture: async () => {
        return {
            factory: await getFactory()
        }
    }
}])