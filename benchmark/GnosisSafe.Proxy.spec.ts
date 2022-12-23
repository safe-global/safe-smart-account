import "@nomiclabs/hardhat-ethers";
import { buildSafeTransaction } from "../src/utils/execution";
import { benchmark } from "./utils/setup"
import { getFactory } from "../test/utils/setup";

benchmark("Proxy", [{
    name: "creation",
    prepare: async (contracts,_,nonce) => {
        const factory = contracts.additions.factory
        // We're cheating and passing the factory address as a singleton address to bypass a check that singleton contract exists
        const data = factory.interface.encodeFunctionData("createProxyWithNonce", [factory.address, "0x", 0])
        return buildSafeTransaction({ to: factory.address, data, safeTxGas: 1000000, nonce })
    },
    fixture: async () => {
        return {
            factory: await getFactory(),
        }
    }
}])

benchmark("Proxy", [{
    name: "chain specific creation",
    prepare: async (contracts,_,nonce) => {
        const factory = contracts.additions.factory
        // We're cheating and passing the factory address as a singleton address to bypass a check that singleton contract exists
        const data = factory.interface.encodeFunctionData("createChainSpecificProxyWithNonce", [factory.address, "0x", 0])
        return buildSafeTransaction({ to: factory.address, data, safeTxGas: 1000000, nonce })
    },
    fixture: async () => {
        return {
            factory: await getFactory(),
        }
    }
}])
