#!/usr/bin/env node
const IPFS = require('ipfs-http-client');

const fs = require('fs')
const util = require('util')
const path = require('path')

const log = console.log

const copyFile = util.promisify(fs.copyFile)
const writeFile = util.promisify(fs.writeFile)

const contractDir = path.join("build", "contracts")
const metaDir = path.join("build", "meta")
const pkg = require(path.join("..", "package.json"))
const supportedContracts = pkg.ethereum.contracts

async function main() {
    const upload = process.argv.findIndex((value) => value === "--upload") >= 0
    const ipfs = IPFS({
        host: 'ipfs.infura.io',
        port: '5001',
        protocol: 'https'
    });

    if (!fs.existsSync(metaDir)) {
        fs.mkdirSync(metaDir);
    }

    log("Generating metadata...")
    log("======================")
    console.log('Current directory: ' + process.cwd());
    console.log({supportedContracts})
    for (contract of supportedContracts) {
        console.log({contract})
        const contractArtifact = require(path.join(process.cwd(), contractDir, `${contract}.json`));
        log();
        log(contractArtifact.contractName);
        log("-".repeat(contractArtifact.contractName.length));
    
        const etherscanConfig = {
            language: "",
            sources: {},
            settings: {},
            evmVersion: ""
        }
    
        const meta = JSON.parse(contractArtifact.metadata)
        etherscanConfig.language = meta.language
        etherscanConfig.evmVersion = meta.evmVersion
        for (let source in meta.sources) {
            const pathParts = source.split("/")
            const sourceFile = path.join(process.cwd(), source)
            await copyFile(sourceFile, path.join(metaDir, pathParts[pathParts.length - 1]));
            const contractSource = fs.readFileSync(sourceFile)
            etherscanConfig.sources[source] = { content: contractSource.toString() }
            if (upload) {
                for await (const res of ipfs.add(contractSource)) {
                    log(`metadata: ${res.path}`);
                }
            }
        }
    
        log(`Write ${contract}Meta.json`);
        const contractMetaFile = path.join(process.cwd(), metaDir, `${contract}Meta.json`);
        await writeFile(contractMetaFile, contractArtifact.metadata)
    
        log(`Write ${contract}Etherscan.json`);
        const contractEtherscanFile = path.join(process.cwd(), metaDir, `${contract}Etherscan.json`);
        await writeFile(contractEtherscanFile, JSON.stringify(etherscanConfig))
    }

    log();
    log('Finished.');
    log();
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.log(err);
        process.exit(1)
    })