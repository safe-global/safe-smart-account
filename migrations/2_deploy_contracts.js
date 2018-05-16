var ProxyFactory = artifacts.require("./ProxyFactory.sol");
var GnosisSafePersonalEdition = artifacts.require("./GnosisSafePersonalEdition.sol");
var GnosisSafeTeamEdition = artifacts.require("./GnosisSafeTeamEdition.sol");
var StateChannelModule = artifacts.require("./StateChannelModule.sol");
var DailyLimitModule = artifacts.require("./DailyLimitModule.sol")
var SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");
var WhitelistModule = artifacts.require("./WhitelistModule.sol");
var CreateAndAddModules = artifacts.require("./CreateAndAddModules.sol");
var MultiSend = artifacts.require("./MultiSend.sol");


const notOwnedAddress = "0x0000000000000000000000000000000000000002"
const notOwnedAddress2 = "0x0000000000000000000000000000000000000003"

let initSafe = function (safe) {
    safe.setup([notOwnedAddress], 1, 0, 0)
    return safe
}

module.exports = function(deployer) {
    deployer.deploy(ProxyFactory);
    deployer.deploy(GnosisSafePersonalEdition).then(initSafe);
    deployer.deploy(GnosisSafeTeamEdition).then(initSafe);
    deployer.deploy(StateChannelModule).then(function (module) {
        module.setup()
        return module
    });
    deployer.deploy(DailyLimitModule).then(function (module) {
        module.setup([],[])
        return module
    });
    deployer.deploy(SocialRecoveryModule).then(function (module) {
        module.setup([notOwnedAddress, notOwnedAddress2], 2)
        return module
    });
    deployer.deploy(WhitelistModule).then(function (module) {
        module.setup([])
        return module
    });
    deployer.deploy(CreateAndAddModules);
    deployer.deploy(MultiSend);
};
