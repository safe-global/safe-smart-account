/*
Deployment steps:
- Set version number in npm package
- Change zos app owner to new deployer
  - Project uses Truffle 4 right now, but this script requires Truffle 5
  - truffle exec scripts/change_zos_owner.js --network=<network> --newOwner="<address>"
- Use deployment python script to deploy new versions
*/

// Truffle 5 script

const fs = require('fs');

const transferOwner = async function(address, newOwner) {
    const ownableJson = JSON.parse(fs.readFileSync('node_modules/zos-lib/build/contracts/ZOSLibOwnable.json'))
    let contract = new web3.eth.Contract(ownableJson["abi"], address)
    let currentOwner = await contract.methods.owner().call()
    console.log("Change owner from", currentOwner, "to", newOwner)
    return await contract.methods.transferOwnership(newOwner).send({from:currentOwner})
} 

module.exports = async function(callback) {
    var network = undefined
    var newOwner = undefined
    process.argv.forEach(function(arg) {
        if (arg.startsWith("--network=")) {
            network = arg.slice(10)
        }
        if (arg.startsWith("--newOwner=")) {
            newOwner = arg.slice(11)
        }
    });
    if (!network) {
        console.log("Please explicitely provide the network")
        callback()
        return
    }
    if (!newOwner) {
        console.log("Please provide the new owner")
        callback()
        return
    } 
    console.log(newOwner)  
    var zos = JSON.parse(fs.readFileSync('./zos.' + network + '.json'));

    try {
        console.log("Change owner of App at", zos["app"].address)  
        console.log(await transferOwner(zos["app"].address, newOwner))
        console.log("Change owner of Package at", zos["package"].address)  
        console.log(await transferOwner(zos["package"].address, newOwner))
        console.log("Change owner of Provider at", zos["provider"].address)  
        console.log(await transferOwner(zos["provider"].address, newOwner))
    } catch (e) {
        callback(e)
        return
    }
    callback()
}

/*
// How to deploy contracts with correct compiler (Safe with 0.5.0 -> formally verified, ProxyFactory with 0.5.7 -> create2)
// Rename ProxyFactory.sol to ProxyFactory.sol_temp
npm explore truffle -- npm install solc@0.5.0
npx truffle compile

// Rename ProxyFactory.sol_temp to ProxyFactory.sol
npm explore truffle -- npm install solc@0.5.7
npx truffle compile
*/