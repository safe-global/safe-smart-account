import type { Artifact } from "hardhat/types";
import { PolyjuiceWallet, PolyjuiceJsonRpcProvider } from "@polyjuice-provider/ethers";
import { ContractFactory, Signer } from "ethers";
import { DeployOptions, DeployResult, Address } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { PayableOverrides } from '@ethersproject/contracts';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { lazyObject } from 'hardhat/plugins';
import { extendEnvironment } from "hardhat/config";
import { UnknownSignerError } from "hardhat-deploy/dist/src/errors";
import { DeploymentsManager } from "hardhat-deploy/dist/src/DeploymentsManager";

const nervosProviderConfig = {
    web3Url: "https://godwoken-testnet-web3-rpc.ckbapp.dev"
};

const rpc = new PolyjuiceJsonRpcProvider(nervosProviderConfig, nervosProviderConfig.web3Url);
const deployerWallet = new PolyjuiceWallet("0xd9066ff9f753a1898709b568119055660a77d9aae4d7a4ad677b8fb3d2a571e5", nervosProviderConfig, rpc) as Signer;

const provider = rpc;

extendEnvironment(async (hre) => {
    const deployer = await deployerWallet.getAddress();
    
    const deploymentsManager = new DeploymentsManager(
        hre,
        lazyObject(() => hre.network) // IMPORTANT, else other plugin cannot set env.network before end, like solidity-coverage does here in the coverage task :  https://github.com/sc-forks/solidity-coverage/blob/3c0f3a5c7db26e82974873bbf61cf462072a7c6d/plugins/resources/nomiclabs.utils.js#L93-L98
    );

    const willSaveToDisk = () => {
        return (deploymentsManager as any).db.writeDeploymentsToFiles && (deploymentsManager as any).network.saveDeployments;
    };
    const onPendingTx = deploymentsManager.onPendingTx.bind(deploymentsManager);
    const originalDeploymentsExtension = hre.deployments;
    const saveDeployment = originalDeploymentsExtension.save;
    const log = originalDeploymentsExtension.log;
    const print = (msg: string) => {
        if ((deploymentsManager as any).db.logEnabled) {
          process.stdout.write(msg);
        }
      };

    console.log("deployer: ", deployer);

    function getFrom(from: string): {
        address: Address;
        ethersSigner: Signer;
        hardwareWallet?: string;
        unknown: boolean;
    } {
        let ethersSigner = deployerWallet;
        let hardwareWallet: string | undefined = undefined;
        let unknown = false;

        if (from.length >= 64) {
            if (from.length === 64) {
                from = '0x' + from;
            }

            from = deployer;
        }

        return { address: from, ethersSigner, hardwareWallet, unknown };
    }

    const getArtifact = originalDeploymentsExtension.getArtifact;

    async function getArtifactFromOptions(
        name: string,
        options: DeployOptions
    ): Promise<{
        artifact: Artifact;
        artifactName?: string;
    }> {
        let artifact: Artifact;
        let artifactName: string | undefined;
        if (options.contract) {
            if (typeof options.contract === 'string') {
                artifactName = options.contract;
                artifact = await getArtifact(artifactName);
            } else {
                artifact = options.contract as Artifact; // TODO better handling
            }
        } else {
            artifactName = name;
            artifact = await getArtifact(artifactName);
        }
        return { artifact, artifactName };
    }

    function linkRawLibrary(
        bytecode: string,
        libraryName: string,
        libraryAddress: string
    ): string {
        const address = libraryAddress.replace('0x', '');
        let encodedLibraryName;
        if (libraryName.startsWith('$') && libraryName.endsWith('$')) {
            encodedLibraryName = libraryName.slice(1, libraryName.length - 1);
        } else {
            encodedLibraryName = solidityKeccak256(['string'], [libraryName]).slice(
                2,
                36
            );
        }
        const pattern = new RegExp(`_+\\$${encodedLibraryName}\\$_+`, 'g');
        if (!pattern.exec(bytecode)) {
            throw new Error(
                `Can't link '${libraryName}' (${encodedLibraryName}) in \n----\n ${bytecode}\n----\n`
            );
        }
        return bytecode.replace(pattern, address);
    }

    function linkRawLibraries(
        bytecode: string,
        libraries: { [libraryName: string]: Address }
    ): string {
        for (const libName of Object.keys(libraries)) {
            const libAddress = libraries[libName];
            bytecode = linkRawLibrary(bytecode, libName, libAddress);
        }
        return bytecode;
    }

    function linkLibraries(
        artifact: {
            bytecode: string;
            linkReferences?: {
                [libraryFileName: string]: {
                    [libraryName: string]: Array<{ length: number; start: number }>;
                };
            };
        },
        libraries?: { [libraryName: string]: Address }
    ) {
        let bytecode = artifact.bytecode;

        if (libraries) {
            if (artifact.linkReferences) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const [fileName, fileReferences] of Object.entries(
                    artifact.linkReferences
                )) {
                    for (const [libName, fixups] of Object.entries(fileReferences)) {
                        const addr = libraries[libName];
                        if (addr === undefined) {
                            continue;
                        }

                        for (const fixup of fixups) {
                            bytecode =
                                bytecode.substr(0, 2 + fixup.start * 2) +
                                addr.substr(2) +
                                bytecode.substr(2 + (fixup.start + fixup.length) * 2);
                        }
                    }
                }
            } else {
                bytecode = linkRawLibraries(bytecode, libraries);
            }
        }

        // TODO return libraries object with path name <filepath.sol>:<name> for names

        return bytecode;
    }

    async function getLinkedArtifact(
        name: string,
        options: DeployOptions
    ): Promise<{ artifact: Artifact; artifactName: string | undefined }> {
        // TODO get linked artifact
        const { artifact, artifactName } = await getArtifactFromOptions(
            name,
            options
        );
        const byteCode = linkLibraries(artifact, options.libraries);
        return { artifact: { ...artifact, bytecode: byteCode }, artifactName };
    }

    async function fetchIfDifferent(
        name: string,
        options: DeployOptions
    ): Promise<{ differences: boolean; address?: string }> {
        options = { ...options }; // ensure no change
        const argArray = options.args ? [...options.args] : [];
        // await init();

        const deployment = await originalDeploymentsExtension.getOrNull(name);
        if (deployment) {
            if (options.skipIfAlreadyDeployed) {
                return { differences: false, address: undefined }; // TODO check receipt, see below
            }
            // TODO transactionReceipt + check for status
            let transactionDetailsAvailable = false;
            let transaction;
            if (deployment.receipt) {
                transactionDetailsAvailable = !!deployment.receipt.transactionHash;
                transaction = await provider.getTransaction(
                    deployment.receipt.transactionHash
                );
            } else if (deployment.transactionHash) {
                transactionDetailsAvailable = true;
                transaction = await provider.getTransaction(deployment.transactionHash);
            }

            if (transaction) {
                const { ethersSigner } = await getFrom(options.from);
                const { artifact } = await getArtifactFromOptions(name, options);
                const abi = artifact.abi;
                const byteCode = linkLibraries(artifact, options.libraries);
                const factory = new ContractFactory(abi, byteCode, ethersSigner);
                const newTransaction = factory.getDeployTransaction(...argArray);
                const newData = newTransaction.data?.toString();

                if (transaction.data !== newData) {
                    return { differences: true, address: deployment.address };
                }
                return { differences: false, address: deployment.address };
            } else {
                if (transactionDetailsAvailable) {
                    throw new Error(
                        `cannot get the transaction for ${name}'s previous deployment, please check your node synced status.`
                    );
                } else {
                    console.error(
                        `no transaction details found for ${name}'s previous deployment, if the deployment is t be discarded, please delete the file`
                    );
                    return { differences: false, address: deployment.address };
                }
            }
        }
        return { differences: true, address: undefined };
    }

    async function handleSpecificErrors<T>(p: Promise<T>): Promise<T> {
        let result: T;
        try {
            result = await p;
        } catch (e) {
            if (
                typeof (e as any).message === 'string' &&
                (e as any).message.indexOf('already known') !== -1
            ) {
                console.log(
                    `
  Exact same transaction already in the pool, node reject duplicates.
  You'll need to wait the tx resolve, or increase the gas price via --gasprice (this will use old tx type)
          `
                );
                throw new Error(
                    'Exact same transaction already in the pool, node reject duplicates'
                );
                // console.log(
                //   `\nExact same transaction already in the pool, node reject duplicates, waiting for it instead...\n`
                // );
                // const signedTx = await ethersSigner.signTransaction(unsignedTx);
                // const decoded = parseTransaction(signedTx);
                // if (!decoded.hash) {
                //   throw new Error(
                //     'tx with same hash already in the pool, failed to decode to get the hash'
                //   );
                // }
                // const txHash = decoded.hash;
                // tx = Object.assign(decoded as TransactionResponse, {
                //   wait: (confirmations: number) =>
                //     provider.waitForTransaction(txHash, confirmations),
                //   confirmations: 0,
                // });
            } else {
                console.error((e as any).message, JSON.stringify(e), e);
                throw e;
            }
        }
        return result;
    }

    function updateDeploymentsManager(options: DeployOptions) {
        const db = (deploymentsManager as any).db;
        db.logEnabled = options.log;
        db.gasPrice = options.gasPrice;
    }

    async function _deploy(
        name: string,
        options: DeployOptions
    ): Promise<DeployResult> {
        updateDeploymentsManager(options);

        const args: any[] = options.args ? [...options.args] : [];
        // await (this as any).init();
        const {
            address: from,
            ethersSigner,
            hardwareWallet,
            unknown,
        } = getFrom(options.from);

        const { artifact: linkedArtifact, artifactName } = await getLinkedArtifact(
            name,
            options
        );

        const overrides: PayableOverrides = {
            gasLimit: options.gasLimit,
            gasPrice: options.gasPrice,
            // maxFeePerGas: options.maxFeePerGas,
            // maxPriorityFeePerGas: options.maxPriorityFeePerGas,
            value: options.value,
            nonce: options.nonce,
        };

        const factory = new ContractFactory(
            linkedArtifact.abi,
            linkedArtifact.bytecode,
            ethersSigner
        );
        const numArguments = factory.interface.deploy.inputs.length;
        if (args.length !== numArguments) {
            throw new Error(
                `expected ${numArguments} constructor arguments, got ${args.length}`
            );
        }
        const unsignedTx = factory.getDeployTransaction(...args, overrides);

        // await overrideGasLimit(unsignedTx, options, (newOverrides) =>
        //   ethersSigner.estimateGas(newOverrides)
        // );
        // await setupGasPrice(unsignedTx);
        // await setupNonce(from, unsignedTx);

        if (unknown) {
            throw new UnknownSignerError({
                from,
                ...JSON.parse(JSON.stringify(unsignedTx)),
            });
        }

        if (options.log || hardwareWallet) {
            print(`deploying "${name}"`);
            if (hardwareWallet) {
                print(` (please confirm on your ${hardwareWallet})`);
            }
        }
        let tx = await handleSpecificErrors(
            ethersSigner.sendTransaction(unsignedTx)
        );

        if (options.log || hardwareWallet) {
            print(` (tx: ${tx.hash})...`);
        }

        // if (options.autoMine) {
        //   try {
        //     await provider.send('evm_mine', []);
        //   } catch (e) {}
        // }

        let preDeployment = {
            ...linkedArtifact,
            transactionHash: tx.hash,
            args,
            linkedData: options.linkedData,
        };

        if (artifactName && willSaveToDisk()) {
            const extendedArtifact = await originalDeploymentsExtension.getExtendedArtifact(
                artifactName
            );
            preDeployment = {
                ...extendedArtifact,
                ...preDeployment,
            };
        }
        tx = await onPendingTx(tx, name, preDeployment);
        const WAIT_CONFIRMATIONS = 1;
        const receipt = await tx.wait(WAIT_CONFIRMATIONS);
        const address = receipt.contractAddress;
        const deployment = {
            ...preDeployment,
            address,
            receipt,
            transactionHash: receipt.transactionHash,
            libraries: options.libraries,
        };
        await saveDeployment(name, deployment);
        if (options.log || hardwareWallet) {
            print(
                `: deployed at ${deployment.address} with ${receipt?.gasUsed} gas\n`
            );
        }
        return {
            ...deployment,
            address,
            newlyDeployed: true,
        };
    }

    async function _deployOne(
        name: string,
        options: DeployOptions,
        failsOnExistingDeterminisitc?: boolean
    ): Promise<DeployResult> {
        const argsArray = options.args ? [...options.args] : [];
        options = { ...options, args: argsArray };

        let result: DeployResult;

        const diffResult = await fetchIfDifferent(name, options);
        if (diffResult.differences) {
            result = await _deploy(name, options);
        } else {
            if (failsOnExistingDeterminisitc && options.deterministicDeployment) {
                throw new Error(
                    `already deployed on same deterministic address: ${diffResult.address}`
                );
            }
            const deployment = await originalDeploymentsExtension.getOrNull(name);
            if (deployment) {
                if (
                    options.deterministicDeployment &&
                    diffResult.address &&
                    diffResult.address.toLowerCase() !== deployment.address.toLowerCase()
                ) {
                    const { artifact: linkedArtifact, artifactName } =
                        await getLinkedArtifact(name, options);

                    // receipt missing
                    const newDeployment = {
                        ...linkedArtifact,
                        address: diffResult.address,
                        linkedData: options.linkedData,
                        libraries: options.libraries,
                        args: argsArray,
                    };
                    await saveDeployment(name, newDeployment);
                    // await saveDeployment(name, newDeployment, artifactName);
                    result = {
                        ...newDeployment,
                        newlyDeployed: false,
                    };
                } else {
                    result = deployment as DeployResult;
                    result.newlyDeployed = false;
                }
            } else {
                if (!diffResult.address) {
                    throw new Error(
                        'no differences found but no address, this should be impossible'
                    );
                }

                const { artifact: linkedArtifact, artifactName } =
                    await getLinkedArtifact(name, options);

                // receipt missing
                const newDeployment = {
                    ...linkedArtifact,
                    address: diffResult.address,
                    linkedData: options.linkedData,
                    libraries: options.libraries,
                    args: argsArray,
                };
                await saveDeployment(name, newDeployment);
                // await saveDeployment(name, newDeployment, artifactName);
                result = {
                    ...newDeployment,
                    newlyDeployed: false,
                };
            }
            if (options.log) {
                log(`reusing "${name}" at ${result.address}`);
            }
        }

        return result;
    }

    const hreNew: HardhatRuntimeEnvironment = {
        deployments: {
            ...originalDeploymentsExtension,
            deploy: async function deploy(
                name: string,
                options: DeployOptions
            ): Promise<DeployResult> {
                options = { ...options }; // ensure no change
                // await init();
                if (!options.proxy) {
                    return _deployOne(name, options);
                }
                throw new Error('Unimplemented _deployViaEIP173Proxy');
                // return _deployViaEIP173Proxy(name, options);
            }
        },
        getNamedAccounts: async () => ({ deployer })
    } as Partial<HardhatRuntimeEnvironment> as HardhatRuntimeEnvironment;

    hre.deployments = hreNew.deployments;
    hre.getNamedAccounts = hreNew.getNamedAccounts;
});