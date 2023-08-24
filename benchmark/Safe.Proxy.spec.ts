import { buildSafeTransaction } from "../src/utils/execution";
import { benchmark } from "./utils/setup";
import { getFactory } from "../test/utils/setup";

benchmark("Proxy", async () => [
    {
        name: "creation",
        prepare: async (contracts, _, nonce) => {
            const factory = contracts.additions.factory;
            const factoryAddress = await factory.getAddress();
            // We're cheating and passing the factory address as a singleton address to bypass a check that singleton contract exists
            const data = factory.interface.encodeFunctionData("createProxyWithNonce", [factoryAddress, "0x", 0]);
            return buildSafeTransaction({ to: factoryAddress, data, safeTxGas: 1000000, nonce });
        },
        fixture: async () => {
            return {
                factory: await getFactory(),
            };
        },
    },
]);

benchmark("Proxy", async () => [
    {
        name: "chain specific creation",
        prepare: async (contracts, _, nonce) => {
            const factory = contracts.additions.factory;
            const factoryAddress = await factory.getAddress();
            // We're cheating and passing the factory address as a singleton address to bypass a check that singleton contract exists
            const data = factory.interface.encodeFunctionData("createChainSpecificProxyWithNonce", [factoryAddress, "0x", 0]);
            return buildSafeTransaction({ to: factoryAddress, data, safeTxGas: 1000000, nonce });
        },
        fixture: async () => {
            return {
                factory: await getFactory(),
            };
        },
    },
]);
