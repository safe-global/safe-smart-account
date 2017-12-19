var ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = function(deployer) {
    deployer.deploy(ProxyFactory);
};
