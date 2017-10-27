var GnosisSafeFactory = artifacts.require("./GnosisSafeFactory.sol");
var GnosisSafeWithHistoryFactory = artifacts.require("./GnosisSafeWithHistoryFactory.sol");
var DailyLimitExceptionFactory = artifacts.require("./exceptions/DailyLimitExceptionFactory.sol");
var WhitelistExceptionFactory = artifacts.require("./exceptions/WhitelistExceptionFactory.sol");
var LastResortExceptionFactory = artifacts.require("./exceptions/LastResortExceptionFactory.sol");
var DelayedExecutionConditionFactory = artifacts.require("./exceptions/DelayedExecutionConditionFactory.sol");

module.exports = function(deployer) {
    deployer.deploy(GnosisSafeFactory);
    deployer.deploy(GnosisSafeWithHistoryFactory);
    deployer.deploy(DailyLimitExceptionFactory);
    deployer.deploy(WhitelistExceptionFactory);
    deployer.deploy(LastResortExceptionFactory);
    deployer.deploy(DelayedExecutionConditionFactory);
};
