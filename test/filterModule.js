const utils = require('./utils')
//const solc = require('solc')
const safeUtils = require('./utilsPersonalSafe')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol");
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const FilterModule = artifacts.require("./modules/Filter.sol");

const sleep = require('sleep');


contract('Filter', function(accounts) {

    let gnosisSafe
    let filterModule
    let lw

    const CALL = 0

    it('should fail', async () => {

        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([lw.accounts[0]], 1, 0, "0x")
        let filterModuleMasterCopy = await FilterModule.new()
        // Initialize module master copy
        filterModuleMasterCopy.setup()
        // Create Gnosis Safe and Daily Limit Module in one transactions
        let moduleData = await filterModuleMasterCopy.contract.setup.getData()
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(filterModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], accounts[0]], 2, createAndAddModules.address, createAndAddModulesData)
        //let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x")
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Daily Limit Module',
        )
        let modules = await gnosisSafe.getModules()
        console.log("Modules : ", modules)
        filterModule = FilterModule.at(modules[0])
        assert.equal(await filterModule.manager.call(), gnosisSafe.address)

        /*
        ///////////// FAILS WITH MODULE AND WORKS WITHOUT
        let executor = accounts[8]
        //withdraw 0.5 ETH
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.toWei(0.5, 'ether'), "0x", CALL, executor)
        console.log("after withdraw without filter : ",await web3.eth.getBalance(gnosisSafe.address).toNumber())
        */

        /////////CHANGE OWNERSHIP////////////////
        console.log("Old owner : ",await filterModule.getOwner())
        console.log("Changing owner to accounts[1]")
        await filterModule.replaceOwner(accounts[1])
        console.log("New owner : ",await filterModule.getOwner())

        /////////LOAD AND WITHDRAW///////////////
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
        console.log("after load : ",await web3.eth.getBalance(gnosisSafe.address).toNumber())

        var event = filterModule.Event();
        event.watch(function(err, result) {console.log("got a succefull event")});

        utils.logGasUsage(
            'execTransactionFromModule withdraw with filter',
            await filterModule.executeFilter(
            accounts[0], 50, {from: accounts[1]}
            )
        )

    })

});
