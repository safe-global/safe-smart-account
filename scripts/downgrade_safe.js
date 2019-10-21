const fs = require('fs')
const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const StateChannelModule = artifacts.require("./StateChannelModule.sol")
const DailyLimitModule = artifacts.require("./DailyLimitModule.sol")
const SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol")
const WhitelistModule = artifacts.require("./WhitelistModule.sol")

const notOwnedAddress = "0x0000000000000000000000000000000000000002"
const notOwnedAddress2 = "0x0000000000000000000000000000000000000003"

const ignoreErrors = function(promise) {
    return promise.catch(function(error){
        console.log("Failed:", error.tx || error.message)
    })
}

let getMasterCopy = async function(safe) {
    return new Promise(function (resolve, reject) {
        web3.eth.getStorageAt(safe.address, 0, (err, resp) => {
            if (err) return reject(err)
            resolve("0x" + resp.slice(26))
        })
    })
}

module.exports = function(callback) {
    let newMasterCopy = "0x8942595A2dC5181Df0465AF0D7be08c8f23C93af"
    let safeAddress= "0x2ADADa78996E22489e43b97f57daE71492dC11f8"
    web3.eth.getAccounts((err, accounts) => {
        if (err) return callback(err)
        let account = accounts[0]
        web3.eth.getBalance(account, (err, balance) => {console.log(balance.toNumber())})
        console.log(account)
        let signature = "0x000000000000000000000000" + account.replace('0x', '') + "0000000000000000000000000000000000000000000000000000000000000000" + "01"
        let safe = GnosisSafe.at(safeAddress)
        getMasterCopy(safe)
            .then((masterCopy) => {
                console.log(masterCopy)
                if (masterCopy == newMasterCopy) {
                    callback("no downgrade required")
                    return
                }
                return safe.getOwners()
            })
            .then((owners) => {
                console.log(owners)
                let data = safe.contract.changeMasterCopy.getData(newMasterCopy)
                console.log(data)
                return safe.execTransaction(safe.address, 0, data, 0, 0, 0, 0, 0, 0, signature, {from: account})
            })
            .then((tx) => {
                console.log(tx)
                callback("done")
            })
            .catch((err) => {
                callback(err)
            })
    })
}
