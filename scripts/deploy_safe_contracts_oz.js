const shell = require('shelljs')
const fs = require('fs')

require('dotenv').config()

const network = process.env.NETWORK

if (!network) {
  console.log('Please provide NETWORK env variable')
  process.exit(1)
}

const exec = function(command) {
  if (shell.exec(command).code !== 0) {
    shell.echo('Error: command failed ' + command);
    shell.exit(1);
  }
}

console.log(`Deploy mastercopies to ${network}`)

const package = require('../package.json')

if (fs.existsSync('.openzeppelin/project.json')) {
  shell.rm('-rf', '.openzeppelin/project.json')
}

exec(`npx oz init ${package.name} ${package.version}`)

exec(`npx truffle compile`)

exec(`npx oz add GnosisSafe --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile --force`) // --force since GnosisSafe has a constructor

// Add factories
exec(`npx oz add ProxyFactory --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)

// Add libraries
exec(`npx oz add MultiSend --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile --force`) // --force since MultiSend has a constructor

exec(`npx oz add CreateAndAddModules --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)

exec(`npx oz add CreateCall --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)

// Add callback handlers
exec(`npx oz add DefaultCallbackHandler --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)

// Publish zos package
exec(`npx oz publish --network ${network}`)

/*  
// Modules are disabled for now
//Add and deploy DailyLimitModule
exec(`npx oz add DailyLimitModule --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy SocialRecoveryModule
exec(`npx oz add SocialRecoveryModule --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy StateChannelModule
exec(`npx oz add StateChannelModule --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)
// Add and deploy WhitelistModule
exec(`npx oz add WhitelistModule --skip-compile`)
exec(`npx oz push --network ${network} --skip-compile`)
*/