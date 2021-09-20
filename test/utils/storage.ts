import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";

type StateVariable = {
  name: string;
  slot: string;
  offset: number;
  type: string;
};

export const getContractStorageLayout = async (
  hre: HardhatRuntimeEnvironment,
  smartContractName: string
) => {
  const { sourceName, contractName } = await hre.artifacts.readArtifact(
    smartContractName
  );

  for (const artifactPath of await hre.artifacts.getBuildInfoPaths()) {
    const artifact = fs.readFileSync(artifactPath);
    const artifactJsonABI = JSON.parse(artifact.toString());
    try {
      if (
        !artifactJsonABI.output.contracts[sourceName][contractName] &&
        !artifactJsonABI.output.contracts[sourceName][contractName]
          .storageLayout
      ) {
        continue;
      }
    } catch (e) {
      continue;
    }

    const contract: { name: string; stateVariables: StateVariable[] } = {
      name: contractName,
      stateVariables: [],
    };
    for (const stateVariable of artifactJsonABI.output.contracts[sourceName][
      contractName
    ].storageLayout.storage) {
      contract.stateVariables.push({
        name: stateVariable.label,
        slot: stateVariable.slot,
        offset: stateVariable.offset,
        type: stateVariable.type,
      });
    }

    console.log({ contract });
  }
};
