const shell = require('shelljs')
const fs = require('fs')

require('dotenv').config()

const network = process.env.NETWORK

if (!network) {
  console.log('Please provide NETWORK env variable')
  process.exit(1)
}

console.log(`Deploy mastercopies to ${network}`)

const package = require('../package.json')

if (fs.existsSync('.openzeppelin/project.json')) {
  shell.rm('-rf', '.openzeppelin/project.json')
}

shell.exec(`npx oz init ${package.name} ${package.version}`)

shell.exec(`npx truffle compile`)

shell.exec(`npx oz add GnosisSafe --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

shell.exec(`npx oz add ProxyFactory --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

shell.exec(`npx oz add MultiSend --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

shell.exec(`npx oz add CreateAndAddModules --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

shell.exec(`npx oz add CreateCall --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

// Init master copies
shell.exec(`npx truffle --network ${network} exec scripts/init_contracts.js`)

// Add callback handler
shell.exec(`npx oz add DefaultCallbackHandler --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)

// Publish zos package
shell.exec(`npx oz publish --network ${network}`)

/*  
// Modules are disabled for now
//Add and deploy DailyLimitModule
shell.exec(`npx oz add DailyLimitModule --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy SocialRecoveryModule
shell.exec(`npx oz add SocialRecoveryModule --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy StateChannelModule
shell.exec(`npx oz add StateChannelModule --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy WhitelistModule
shell.exec(`npx oz add WhitelistModule --skip-compile`)
shell.exec(`npx oz push --network ${network} --skip-compile`)
*/