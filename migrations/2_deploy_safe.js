var GnosisSafe = artifacts.require("./GnosisSafe.sol");

module.exports = function(deployer) {
    deployer.deploy(GnosisSafe).then(function (safe) {
        return safe
    });
};
