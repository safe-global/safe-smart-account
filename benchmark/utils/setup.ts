import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getDefaultCallbackHandler, getSafeWithOwners } from "../../test/utils/setup";
import { logGas, executeTx, SafeTransaction, safeSignTypedData, SafeSignature, executeContractCallWithSigners } from "../../src/utils/execution";
import { Wallet, Contract } from "ethers";
import { AddressZero } from "@ethersproject/constants";

const [user1, user2, user3, user4, user5] = waffle.provider.getWallets();

export interface Contracts {
    targets: Contract[],
    additions: any | undefined
}

const generateTarget = async (owners: Wallet[], threshold: number, guardAddress: string, logGasUsage?: boolean) => {
    const fallbackHandler = await getDefaultCallbackHandler()
    const safe = await getSafeWithOwners(owners.map((owner) => owner.address), threshold, fallbackHandler.address, logGasUsage)
    await executeContractCallWithSigners(safe, safe, "setGuard", [guardAddress], owners)
    return safe
}

export const configs = [
    { name: "single owner", signers: [user1], threshold: 1 },
    { name: "single owner and guard", signers: [user1], threshold: 1, useGuard: true },
    { name: "2 out of 23", signers: [user1, user2], threshold: 2 },
    { name: "3 out of 3", signers: [user1, user2, user3], threshold: 3 },
    { name: "3 out of 5", signers: [user1, user2, user3, user4, user5], threshold: 3 },
]

export const setupBenchmarkContracts = (benchmarkFixture?: () => Promise<any>, logGasUsage?: boolean) => {
    return deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const guardFactory = await hre.ethers.getContractFactory("DelegateCallTransactionGuard");
        const guard = await guardFactory.deploy(AddressZero)
        const targets = []
        for (const config of configs) {
            targets.push(await generateTarget(config.signers, config.threshold, config.useGuard ? guard.address : AddressZero, logGasUsage))
        }
        return {
            targets,
            additions: (benchmarkFixture ? await benchmarkFixture() : undefined)
        }
    })
}

export interface Benchmark {
    name: string,
    prepare: (contracts: Contracts, target: string, nonce: number) => Promise<SafeTransaction>,
    after?: (contracts: Contracts) => Promise<void>,
    fixture?: () => Promise<any>
}

export const benchmark = async (topic: string, benchmarks: Benchmark[]) => {
    for (const benchmark of benchmarks) {
        const { name, prepare, after, fixture } = benchmark
        const contractSetup = setupBenchmarkContracts(fixture)
        describe(`${topic} - ${name}`, async () => {
            it("with an EOA", async () => {
                const contracts = await contractSetup()
                const tx = await prepare(contracts, user2.address, 0)
                await logGas(name, user2.sendTransaction({
                    to: tx.to,
                    value: tx.value,
                    data: tx.data
                }))
                if (after) await after(contracts)
            })
            for (const i in configs) {
                const config = configs[i]
                it(`with a ${config.name} Safe`, async () => {
                    const contracts = await contractSetup()
                    const target = contracts.targets[i]
                    const nonce = await target.nonce();
                    const tx = await prepare(contracts, target.address, nonce)
                    const threshold = await target.getThreshold()
                    const sigs: SafeSignature[] = await Promise.all(config.signers.slice(0, threshold).map(async (signer) => {
                        return await safeSignTypedData(signer, target, tx)
                    }))
                    await expect(
                        logGas(name, executeTx(target, tx, sigs))
                    ).to.emit(target, "ExecutionSuccess")
                    if (after) await after(contracts)
                })
            }
        })
    }
}