const ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = function(callback) {
    ProxyFactory.new().then(function(instance) {
            console.log("Deployment success:", instance.address)
            callback("done")
        }).catch(function(err) {
            console.log("Deployment failed:", err.tx)
            callback("done")
        });
}