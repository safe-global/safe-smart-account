const utils = require("./utils/general");
const safeUtils = require("./utils/execution");
const ethUtil = require("ethereumjs-util");
const abi = require("ethereumjs-abi");
const BigNumber = require("bignumber.js");

const GnosisSafe = artifacts.require("./GnosisSafe.sol");
const Proxy = artifacts.require("./GnosisSafeProxy.sol");
const ProxyInterface = artifacts.require("./IProxy.sol");
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol");

contract.only("Duplicate owners setup succeeds", function(accounts) {
  let gnosisSafe;
  let gnosisSafeMasterCopy;
  let lw;
  let executor = accounts[8];

  const CALL = 0;

  it("Setup with one duplicate owner and threshold of 2", async () => {
    // Create lightwallet
    lw = await utils.createLightwallet();
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new();
    gnosisSafeMasterCopy = await utils.deployContract(
      "deploying Gnosis Safe Mastercopy",
      GnosisSafe
    );
    // Create Gnosis Safe
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods
      .setup(
        [lw.accounts[0], lw.accounts[0]],
        2,
        utils.Address0,
        "0x",
        utils.Address0,
        utils.Address0,
        0,
        utils.Address0
      )
      .encodeABI();
    gnosisSafe = await utils.getParamFromTxEvent(
      await proxyFactory.createProxy(
        gnosisSafeMasterCopy.address,
        gnosisSafeData
      ),
      "ProxyCreation",
      "proxy",
      proxyFactory.address,
      GnosisSafe,
      "create Gnosis Safe Proxy"
    );

    console.log("owners: ");
    console.log(await gnosisSafe.getOwners());

    console.log("threshold: ");
    console.log(await gnosisSafe.getThreshold());

    assert.deepEqual(
      await gnosisSafe.getOwners(),
      utils.formatAddresses([lw.accounts[0], utils.Address0])
    );
  });

  it("Setup with multiple duplicate owners", async () => {
    // Create lightwallet
    lw = await utils.createLightwallet();
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new();
    gnosisSafeMasterCopy = await utils.deployContract(
      "deploying Gnosis Safe Mastercopy",
      GnosisSafe
    );
    // Create Gnosis Safe
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods
      .setup(
        [lw.accounts[1], lw.accounts[1], lw.accounts[0], lw.accounts[0]],
        4,
        utils.Address0,
        "0x",
        utils.Address0,
        utils.Address0,
        0,
        utils.Address0
      )
      .encodeABI();
    gnosisSafe = await utils.getParamFromTxEvent(
      await proxyFactory.createProxy(
        gnosisSafeMasterCopy.address,
        gnosisSafeData
      ),
      "ProxyCreation",
      "proxy",
      proxyFactory.address,
      GnosisSafe,
      "create Gnosis Safe Proxy"
    );

    console.log("owners: ");
    console.log(await gnosisSafe.getOwners());

    console.log("threshold: ");
    console.log(await gnosisSafe.getThreshold());

    assert.deepEqual(
      await gnosisSafe.getOwners(),
      utils.formatAddresses([
        lw.accounts[1],
        lw.accounts[0],
        utils.Address0,
        utils.Address0,
      ])
    );
  });

  it("Setup with duplicate owners threshold 3", async () => {
    // Create lightwallet
    lw = await utils.createLightwallet();
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new();
    gnosisSafeMasterCopy = await utils.deployContract(
      "deploying Gnosis Safe Mastercopy",
      GnosisSafe
    );
    // Create Gnosis Safe
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods
      .setup(
        [lw.accounts[1], lw.accounts[0], lw.accounts[0]],
        3,
        utils.Address0,
        "0x",
        utils.Address0,
        utils.Address0,
        0,
        utils.Address0
      )
      .encodeABI();
    gnosisSafe = await utils.getParamFromTxEvent(
      await proxyFactory.createProxy(
        gnosisSafeMasterCopy.address,
        gnosisSafeData
      ),
      "ProxyCreation",
      "proxy",
      proxyFactory.address,
      GnosisSafe,
      "create Gnosis Safe Proxy"
    );

    console.log("owners: ");
    console.log(await gnosisSafe.getOwners());

    console.log("threshold: ");
    console.log(await gnosisSafe.getThreshold());

    assert.deepEqual(
      await gnosisSafe.getOwners(),
      utils.formatAddresses([lw.accounts[1], lw.accounts[0], utils.Address0])
    );
    assert.equal(await gnosisSafe.getThreshold(), 3);
  });

  it("Setup with duplicate owners threshold 4", async () => {
    // Create lightwallet
    lw = await utils.createLightwallet();
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new();
    gnosisSafeMasterCopy = await utils.deployContract(
      "deploying Gnosis Safe Mastercopy",
      GnosisSafe
    );
    // Create Gnosis Safe
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods
      .setup(
        [lw.accounts[1], lw.accounts[0], lw.accounts[0], lw.accounts[2]],
        4,
        utils.Address0,
        "0x",
        utils.Address0,
        utils.Address0,
        0,
        utils.Address0
      )
      .encodeABI();
    gnosisSafe = await utils.getParamFromTxEvent(
      await proxyFactory.createProxy(
        gnosisSafeMasterCopy.address,
        gnosisSafeData
      ),
      "ProxyCreation",
      "proxy",
      proxyFactory.address,
      GnosisSafe,
      "create Gnosis Safe Proxy"
    );

    console.log("owners: ");
    console.log(await gnosisSafe.getOwners());

    console.log("threshold: ");
    console.log(await gnosisSafe.getThreshold());

    assert.deepEqual(
      await gnosisSafe.getOwners(),
      utils.formatAddresses([
        lw.accounts[1],
        lw.accounts[0],
        lw.accounts[2],
        utils.Address0,
      ])
    );
    assert.equal(await gnosisSafe.getThreshold(), 4);
  });
});
