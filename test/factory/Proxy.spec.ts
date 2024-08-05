import { expect } from "chai";
import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { getWallets } from "../utils/setup";
import * as zk from 'zksync-web3';

describe("Proxy", async () => {

    describe("constructor", async () => {

        it('should revert with invalid singleton address', async () => {
            if (!hre.network.zksync) {
                const Proxy = await hre.ethers.getContractFactory("GnosisSafeProxy");
            await expect(
                Proxy.deploy(AddressZero)
            ).to.be.revertedWith("Invalid singleton address provided")
            } else {
                const deployer = new Deployer(hre, getWallets(hre)[0] as zk.Wallet);
                const artifact = await deployer.loadArtifact("GnosisSafeProxy");
                await expect(
                    deployer.deploy(artifact, [AddressZero])
                ).to.be.revertedWith("Invalid singleton address provided")
            }
        })

    })
})