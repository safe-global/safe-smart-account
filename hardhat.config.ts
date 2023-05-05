import type { HardhatUserConfig, HttpNetworkUserConfig } from "hardhat/types";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-deploy";
import dotenv from "dotenv";
import yargs from "yargs";
import { getSingletonFactoryInfo } from "@gnosis.pm/safe-singleton-factory";

const argv = yargs
    .option("network", {
        type: "string",
        default: "hardhat",
    })
    .help(false)
    .version(false).argv;

// Load environment variables.
dotenv.config();
const { NODE_URL, INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK, SOLIDITY_VERSION, SOLIDITY_SETTINGS } = process.env;

const DEFAULT_MNEMONIC = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
    sharedNetworkConfig.accounts = [PK];
} else {
    sharedNetworkConfig.accounts = {
        mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
    };
}

if (["mainnet", "rinkeby", "kovan", "goerli", "ropsten", "mumbai", "polygon"].includes(argv.network) && INFURA_KEY === undefined) {
    throw new Error(`Could not find Infura key in env, unable to connect to network ${argv.network}`);
}

import "./src/tasks/local_verify";
import "./src/tasks/test";
import "./src/tasks/deploy_zksync";
import "./src/tasks/deploy_contracts";
import "./src/tasks/show_codesize";
import { BigNumber } from "@ethersproject/bignumber";

const primarySolidityVersion = SOLIDITY_VERSION || "0.7.6";
const soliditySettings = !!SOLIDITY_SETTINGS ? JSON.parse(SOLIDITY_SETTINGS) : undefined;

const deterministicDeployment = (network: string) => {
    const info = getSingletonFactoryInfo(parseInt(network));
    if (!info) {
        throw new Error(`
        Safe factory not found for network ${network}. You can request a new deployment at https://github.com/safe-global/safe-singleton-factory.
        For more information, see https://github.com/safe-global/safe-contracts#replay-protection-eip-155
      `);
    }
    return {
        factory: info.address,
        deployer: info.signerAddress,
        funding: BigNumber.from(info.gasLimit).mul(BigNumber.from(info.gasPrice)).toString(),
        signedTx: info.transaction,
    };
};

const userConfig: HardhatUserConfig = {
    paths: {
        artifacts: "build/artifacts",
        cache: "build/cache",
        deploy: "src/deploy",
        sources: "contracts",
    },
    solidity: {
        compilers: [{ version: primarySolidityVersion, settings: soliditySettings }, { version: "0.6.12" }, { version: "0.5.17" }],
    },
    zksolc: {
        version: "1.3.8",
        compilerSource: "binary",
        settings: {
            isSystem: true,
        },
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
            blockGasLimit: 100000000,
            gas: 100000000,
        },
        mainnet: {
            ...sharedNetworkConfig,
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
        },
        xdai: {
            ...sharedNetworkConfig,
            url: "https://xdai.poanetwork.dev",
        },
        ewc: {
            ...sharedNetworkConfig,
            url: `https://rpc.energyweb.org`,
        },
        goerli: {
            ...sharedNetworkConfig,
            url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
        },
        mumbai: {
            ...sharedNetworkConfig,
            url: `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`,
        },
        polygon: {
            ...sharedNetworkConfig,
            url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
        },
        volta: {
            ...sharedNetworkConfig,
            url: `https://volta-rpc.energyweb.org`,
        },
        bsc: {
            ...sharedNetworkConfig,
            url: `https://bsc-dataseed.binance.org/`,
        },
        arbitrum: {
            ...sharedNetworkConfig,
            url: `https://arb1.arbitrum.io/rpc`,
        },
        fantomTestnet: {
            ...sharedNetworkConfig,
            url: `https://rpc.testnet.fantom.network/`,
        },
        avalanche: {
            ...sharedNetworkConfig,
            url: `https://api.avax.network/ext/bc/C/rpc`,
        },
        zkSyncTestnet: {
            ...sharedNetworkConfig,
            url: "https://testnet.era.zksync.dev",
            ethNetwork: "goerli",
            zksync: true,
        },
        zkSyncLocal: {
            /**
             * @description One of the default available accounts on the local node
             * @see https://github.com/matter-labs/local-setup/blob/main/rich-wallets.json
             * @address 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
             */
            accounts: ["0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110"],
            url: "http://localhost:3050",
            ethNetwork: "http://localhost:8545",
            zksync: true,
        },
    },
    deterministicDeployment,
    namedAccounts: {
        deployer: 0,
    },
    mocha: {
        timeout: 2000000,
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
};
if (NODE_URL) {
    userConfig.networks!!.custom = {
        ...sharedNetworkConfig,
        url: NODE_URL,
    };
}
export default userConfig;