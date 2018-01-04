var ProxyFactory = artifacts.require("./ProxyFactory.sol");
var GnosisSafe = artifacts.require("./GnosisSafe.sol");
var DailyLimitExtension = artifacts.require("./DailyLimitExtension.sol");
var SocialRecoveryExtension = artifacts.require("./SocialRecoveryExtension.sol");
var WhitelistExtension = artifacts.require("./WhitelistExtension.sol");
var CreateAndAddExtension = artifacts.require("./CreateAndAddExtension.sol");
var MultiSend = artifacts.require("./MultiSend.sol");


const notOwnedAddress = "0x0000000000000000000000000000000000000001"
const notOwnedAddress2 = "0x0000000000000000000000000000000000000002"

module.exports = function(deployer) {
    deployer.deploy(ProxyFactory);
    deployer.deploy(GnosisSafe, [notOwnedAddress], 1, 0, 0);
    deployer.deploy(DailyLimitExtension, [], []);
    deployer.deploy(SocialRecoveryExtension, [notOwnedAddress, notOwnedAddress2], 2);
    deployer.deploy(WhitelistExtension, []);
    deployer.deploy(CreateAndAddExtension);
    deployer.deploy(MultiSend);
};
