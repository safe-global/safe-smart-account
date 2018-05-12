var ProxyFactory = artifacts.require("./ProxyFactory.sol");
var GnosisSafePersonalEdition = artifacts.require("./GnosisSafePersonalEdition.sol");
var GnosisSafeTeamEdition = artifacts.require("./GnosisSafeTeamEdition.sol");
var GnosisSafeStateChannelEdition = artifacts.require("./GnosisSafeStateChannelEdition.sol");
var DailyLimitModule = artifacts.require("./DailyLimitModule.sol");
var DailyLimitModuleWithSignature = artifacts.require("./DailyLimitModuleWithSignature.sol");
var SocialRecoveryModule = artifacts.require("./SocialRecoveryModule.sol");
var WhitelistModule = artifacts.require("./WhitelistModule.sol");
var CreateAndAddModule = artifacts.require("./CreateAndAddModule.sol");
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
    deployer.deploy(GnosisSafeStateChannelEdition).then(initSafe);
    deployer.deploy(DailyLimitModule).then(function (module) {
        module.setup([],[])
        return module
    });
    deployer.deploy(DailyLimitModuleWithSignature).then(function (module) {
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
    deployer.deploy(CreateAndAddModule);
    deployer.deploy(MultiSend);
};
