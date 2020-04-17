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

exec(`yarn oz init ${package.name} ${package.version}`)

exec(`yarn truffle compile`)

exec(`yarn oz add GnosisSafe --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile --force`) // --force since GnosisSafe has a constructor

// Add factories
exec(`yarn oz add ProxyFactory --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)

// Add libraries
exec(`yarn oz add MultiSend --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile --force`) // --force since MultiSend has a constructor

exec(`yarn oz add CreateAndAddModules --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)

exec(`yarn oz add CreateCall --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)

// Add callback handlers
exec(`yarn oz add DefaultCallbackHandler --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)

// Publish zos package
exec(`yarn oz publish --network ${network}`)

/*  
// Modules are disabled for now
//Add and deploy DailyLimitModule
exec(`yarn oz add DailyLimitModule --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)
// Add and deploy SocialRecoveryModule
exec(`yarn oz add SocialRecoveryModule --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)
// Add and deploy StateChannelModule
exec(`yarn oz add StateChannelModule --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)
// Add and deploy WhitelistModule
exec(`yarn oz add WhitelistModule --skip-compile`)
exec(`yarn oz push --network ${network} --skip-compile`)
*/