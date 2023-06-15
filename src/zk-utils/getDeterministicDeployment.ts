import { DeterministicDeploymentInfo } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function getDeterministicDeployment(hre: HardhatRuntimeEnvironment): Promise<DeterministicDeploymentInfo> {
    const config = hre.config.deterministicDeployment;
    if (!config) throw new Error("deterministicDeployment is not available");

    const { chainId } = await hre.ethers.provider.getNetwork();

    const deploymentInfo = typeof config == "function" ? config(String(chainId)) : config?.[chainId];
    if (!deploymentInfo) throw new Error(`Cannot find deterministic deployment for network with chainId ${chainId}`);

    return deploymentInfo;
}

export default getDeterministicDeployment
