var GnosisSafeFactory = artifacts.require("./GnosisSafeFactory.sol");
var DailyLimitExtensionFactory = artifacts.require("./exceptions/DailyLimitExtensionFactory.sol");

module.exports = function(deployer) {
    deployer.deploy(GnosisSafeFactory);
    deployer.deploy(DailyLimitExtensionFactory);
};
