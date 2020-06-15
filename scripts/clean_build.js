#!/usr/bin/env node
const fs = require('fs')
const util = require('util')
const path = require('path')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const pkg = require(path.join("..", "package.json"))

const contractDir = path.join("build", "contracts");
const supportedNetworks = pkg.ethereum.networks
const supportedContracts = pkg.ethereum.contracts

async function process(){
    const contractFiles = fs.readdirSync(contractDir);
    for (let contract of contractFiles){
        const contractFile = path.join(contractDir, contract)
        if (supportedContracts.indexOf(contract.slice(0, -5)) < 0) {
            console.log(`Delete ${contractFile}`)
            fs.unlinkSync(contractFile)
        } else {
            const contractJson = JSON.parse(fs.readFileSync(contractFile))
            const networks = contractJson.networks
            contractJson.networks = {}
            for (let network of supportedNetworks) {
                contractJson.networks[network] = networks[network]
            }
            await writeFile(contractFile, JSON.stringify(contractJson, null, 2))
        }
    }
}

process()