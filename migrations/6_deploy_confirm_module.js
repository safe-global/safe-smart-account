var ConfirmedTransactionModule = artifacts.require("./ConfirmedTransactionModule.sol");

module.exports = function(deployer) {
    deployer.deploy(ConfirmedTransactionModule).then(function (module) {
        module.setup()
        return module
    });
};
