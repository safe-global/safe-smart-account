import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";

type StateVariable = {
    name: string;
    slot: string;
    offset: number;
    type: string;
};

export const EXPECTED_SAFE_STORAGE_LAYOUT: StateVariable[] = [
    { name: "singleton", slot: "0", offset: 0, type: "t_address" },
    {
        name: "modules",
        slot: "1",
        offset: 0,
        type: "t_mapping(t_address,t_address)",
    },
    {
        name: "owners",
        slot: "2",
        offset: 0,
        type: "t_mapping(t_address,t_address)",
    },
    { name: "ownerCount", slot: "3", offset: 0, type: "t_uint256" },
    { name: "threshold", slot: "4", offset: 0, type: "t_uint256" },
    { name: "nonce", slot: "5", offset: 0, type: "t_uint256" },
    {
        name: "_deprecatedDomainSeparator",
        slot: "6",
        offset: 0,
        type: "t_bytes32",
    },
    {
        name: "signedMessages",
        slot: "7",
        offset: 0,
        type: "t_mapping(t_bytes32,t_uint256)",
    },
    {
        name: "approvedHashes",
        slot: "8",
        offset: 0,
        type: "t_mapping(t_address,t_mapping(t_bytes32,t_uint256))",
    },
];

export const getContractStorageLayout = async (hre: HardhatRuntimeEnvironment, smartContractName: string) => {
    const { sourceName, contractName } = await hre.artifacts.readArtifact(smartContractName);

    const stateVariables: StateVariable[] = [];

    for (const artifactPath of await hre.artifacts.getBuildInfoPaths()) {
        const artifact = fs.readFileSync(artifactPath);
        const artifactJsonABI = JSON.parse(artifact.toString());

        const artifactIncludesStorageLayout = artifactJsonABI?.output?.contracts?.[sourceName]?.[contractName]?.storageLayout;
        if (!artifactIncludesStorageLayout) {
            continue;
        }

        const contractStateVariablesFromArtifact = artifactJsonABI.output.contracts[sourceName][contractName].storageLayout.storage;
        for (const stateVariable of contractStateVariablesFromArtifact) {
            stateVariables.push({
                name: stateVariable.label,
                slot: stateVariable.slot,
                offset: stateVariable.offset,
                type: stateVariable.type,
            });
        }

        // The same contract can be present in multiple artifacts; thus we break if we already got
        // storage layout once
        break;
    }

    return stateVariables;
};
