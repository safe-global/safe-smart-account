var GnosisSafeFactory = artifacts.require("./GnosisSafeFactory.sol");
var GnosisSafeWithDescriptionsFactory = artifacts.require("./GnosisSafeWithDescriptionsFactory.sol");

module.exports = function(deployer) {
  deployer.deploy(GnosisSafeFactory);
  deployer.deploy(GnosisSafeWithDescriptionsFactory);
};
