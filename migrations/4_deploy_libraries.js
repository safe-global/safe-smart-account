var CreateCall = artifacts.require("./CreateCall.sol");
var MultiSend = artifacts.require("./MultiSend.sol");

module.exports = function(deployer) {
    deployer.deploy(MultiSend);
    deployer.deploy(CreateCall);
};
