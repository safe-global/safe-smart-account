var ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol");

module.exports = function(deployer) {
    deployer.deploy(ProxyFactory);
};
