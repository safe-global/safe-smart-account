#!/usr/bin/env node
const fs = require('fs')
const util = require('util')
const path = require('path')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const pkg = require(path.join("..", "package.json"))

const contractDir = path.join("build", "contracts");
const networksFile = path.join("networks.json");
const supportedNetworks = pkg.ethereum.networks
const supportedContracts = pkg.ethereum.contracts

async function process() {
    const contractFiles = fs.readdirSync(contractDir);
    const extractedNetworks = JSON.parse(fs.readFileSync(networksFile))
    for (let contract of contractFiles) {
        const contractFile = path.join(contractDir, contract)
        if (supportedContracts.indexOf(contract.slice(0, -5)) < 0) {
            console.log(`Delete ${contractFile}`)
            fs.unlinkSync(contractFile)
        } else {
            const contractJson = JSON.parse(fs.readFileSync(contractFile))
            const networks = contractJson.networks
            contractJson.networks = {}
            for (let network of supportedNetworks) {
                const networkData = networks[network]
                if (!networkData) continue
                contractJson.networks[network] = networkData
                extractedNetworks[contractJson.contractName][network] = networkData
            }
            await writeFile(contractFile, JSON.stringify(contractJson, null, 2))
        }
    }
    await writeFile(networksFile, JSON.stringify(extractedNetworks, null, 2))
}

process()