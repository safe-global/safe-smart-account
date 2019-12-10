/*
Deployment steps:
- Set version number in npm package
- Change oz app owner to new deployer
  - Project uses Truffle 4 right now, but this script requires Truffle 5
  - truffle exec scripts/change_oz_owner.js --network=<network> --newOwner="<address>"
- Use deployment command to deploy new versions
*/

// Truffle 5 script

const fs = require('fs')

const transferOwner = async function (address, newOwner) {
  const ownableJson = JSON.parse(
    fs.readFileSync(
      'node_modules/@openzeppelin/upgrades/build/contracts/OpenZeppelinUpgradesOwnable.json'
    )
  )
  let contract = new web3.eth.Contract(ownableJson['abi'], address)
  let currentOwner = await contract.methods.owner().call()
  console.log('Change owner from', currentOwner, 'to', newOwner)
  return await contract.methods
    .transferOwnership(newOwner)
    .send({ from: currentOwner })
    .on('transactionHash', function(hash){ console.log('Transaction hash:', hash); })
}

module.exports = async function (callback) {
  var network = undefined
  var newOwner = undefined
  process.argv.forEach(function (arg) {
    if (arg.startsWith('--network=')) {
      network = arg.slice(10)
    }
    if (arg.startsWith('--newOwner=')) {
      newOwner = arg.slice(11)
    }
  })
  if (!network) {
    console.log('Please explicitely provide the network')
    callback()
    return
  }
  if (!newOwner) {
    console.log('Please provide the new owner')
    callback()
    return
  }
  console.log("Network:", network)
  console.log("New owner:", newOwner)
  var oz = JSON.parse(fs.readFileSync('./.openzeppelin/' + network + '.json'))

  try {
    console.log('Change owner of App at', oz['app'].address)
    console.log(await transferOwner(oz['app'].address, newOwner))
    console.log('Change owner of Package at', oz['package'].address)
    console.log(await transferOwner(oz['package'].address, newOwner))
    console.log('Change owner of Provider at', oz['provider'].address)
    console.log(await transferOwner(oz['provider'].address, newOwner))
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