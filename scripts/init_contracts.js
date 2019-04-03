const fs = require('fs');
const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const StateChannelModule = artifacts.require("./StateChannelModule.sol");
const DailyLimitModule = artifacts.require("./DailyLimitModule.sol")
const SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");
const WhitelistModule = artifacts.require("./WhitelistModule.sol");

const notOwnedAddress = "0x0000000000000000000000000000000000000002"
const notOwnedAddress2 = "0x0000000000000000000000000000000000000003"

const ignoreErrors = function(promise) {
    return promise.catch(function(error){
        console.log("Failed:", error.tx || error.message)
    })
} 

module.exports = function(callback) {
    var network = 'main'
    var processNext = false
    process.argv.forEach(function(arg) {
        if (processNext) {
            network = arg
            processNext = false
        }
        if (arg.startsWith("--network=")) {
            network = arg.slice(10)
        } else if (arg == "--network") {
            processNext = true
        }
    });
    var zos = JSON.parse(fs.readFileSync('./zos.' + network + '.json'));  
    Promise.all([
        ignoreErrors(GnosisSafe.at(zos.contracts['GnosisSafe'].address).setup([notOwnedAddress, notOwnedAddress2], 2, 0, 0, 0, 0, 0)),
        //ignoreErrors(StateChannelModule.at(zos.contracts['StateChannelModule'].address).setup()),
        //ignoreErrors(DailyLimitModule.at(zos.contracts['DailyLimitModule'].address).setup([],[])),
        //ignoreErrors(SocialRecoveryModule.at(zos.contracts['SocialRecoveryModule'].address).setup([notOwnedAddress, notOwnedAddress2], 2)),
        //ignoreErrors(WhitelistModule.at(zos.contracts['WhitelistModule'].address).setup([])),
    ])
        .then(function(values) {
            values.forEach(function(resp) {
                if (resp) {
                    console.log("Success:", resp.tx);
                }
            })
            callback("done")
        })
        .catch((err) => {
            callback(err)
        });
}