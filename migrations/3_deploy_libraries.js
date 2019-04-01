var CreateAndAddModules = artifacts.require("./CreateAndAddModules.sol");
var MultiSend = artifacts.require("./MultiSend.sol");

module.exports = function(deployer) {
    deployer.deploy(CreateAndAddModules);
    deployer.deploy(MultiSend);
};
