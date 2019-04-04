#!/usr/bin/env node
const fs = require('fs')
const util = require('util')
const path = require('path')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

zosFiles = [
  {
    networkID: 1,
    fileName: path.join(__dirname, "../zos.mainnet.json")
  },
  {
    networkID: 4,
    fileName: path.join(__dirname, "../zos.rinkeby.json")
  },
  {
    networkID: 42,
    fileName: path.join(__dirname, "../zos.kovan.json")
  },
  {
    networkID: 5,
    fileName: path.join(__dirname, "../zos.goerli.json")
  }
]

async function processAll(){
  for (let zosFile of zosFiles){
    const zosNetworkFileJson = JSON.parse(fs.readFileSync(zosFile.fileName))
  
    
    for (let name of Object.keys(zosNetworkFileJson.contracts)){
      var contract = zosNetworkFileJson.contracts[name]
      var contractName = name
      await injectNetwork(contractName, zosFile.networkID, contract.address)
    }
  }
}

async function injectNetwork(contractName, networkId, address) {
  console.log(`Updating ${contractName} with address ${address} on network ${networkId}`)
  const contractFile = `build/contracts/${contractName}.json`
  const contractConfig = JSON.parse(await readFile(contractFile))
  contractConfig.networks[networkId] = {
    "links": {},
    "events": {},
    "address": address,
    "updated_at": (new Date()).getTime()
  }
  await writeFile(contractFile, JSON.stringify(contractConfig, null, 2))
}

processAll()
