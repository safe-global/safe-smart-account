#!/usr/bin/env node
const fs = require('fs')
const util = require('util')
const path = require('path')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

ozFiles = [
  {
    networkID: 1,
    fileName: path.join(__dirname, "../.openzeppelin/mainnet.json")
  },
  {
    networkID: 4,
    fileName: path.join(__dirname, "../.openzeppelin/rinkeby.json")
  },
  {
    networkID: 42,
    fileName: path.join(__dirname, "../.openzeppelin/kovan.json")
  },
  {
    networkID: 5,
    fileName: path.join(__dirname, "../.openzeppelin/goerli.json")
  }
]

async function processAll(){
  for (let ozFile of ozFiles){
    const ozNetworkFileJson = JSON.parse(fs.readFileSync(ozFile.fileName))
  
    
    for (let name of Object.keys(ozNetworkFileJson.contracts)){
      var contract = ozNetworkFileJson.contracts[name]
      var contractName = name
      await injectNetwork(contractName, ozFile.networkID, contract.address)
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
