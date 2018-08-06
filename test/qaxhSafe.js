const utils = require('./utils')
//const solc = require('solc')
const safeUtils = require('./utilsPersonalSafe')

const GnosisSafe = artifacts.require("./GnosisSafePersonalEdition.sol");
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol");
const ProxyFactory = artifacts.require("./ProxyFactory.sol");
const QaxhModule = artifacts.require("./modules/QaxhModule.sol");
const QaxhMasterLedger = artifacts.require("./QaxhMasterLedger.sol");

//A qaxh safe is a gnosis safe personal edition whose only owner is the qaxh address
//And who has a QaxhModule enabled (and only that)

//here, the qaxh address is played by accounts[8]

contract('QaxhModule', function(accounts) {

    let gnosisSafe
    let qaxhModule
    let lw
    let qaxhMasterLedger

    const CALL = 0

    beforeEach(async function () {

        // Create lightwallet
        lw = await utils.createLightwallet()
        // Create Master Copies
        let proxyFactory = await ProxyFactory.new()
        let createAndAddModules = await CreateAndAddModules.new()
        let gnosisSafeMasterCopy = await GnosisSafe.new()
        // Initialize safe master copy
        gnosisSafeMasterCopy.setup([accounts[8]], 1, 0, "0x")
        let qaxhModuleMasterCopy = await QaxhModule.new()
        // Initialize module master copy
        qaxhModuleMasterCopy.setup()
        // Create Gnosis Safe and Daily Limit Module in one transactions
        let moduleData = await qaxhModuleMasterCopy.contract.setup.getData()
        let proxyFactoryData = await proxyFactory.contract.createProxy.getData(qaxhModuleMasterCopy.address, moduleData)
        let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
        let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([accounts[8]], 1, createAndAddModules.address, createAndAddModulesData)
        //let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData([lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, 0, "0x")
        gnosisSafe = utils.getParamFromTxEvent(
            await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
            'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Filter Module',
        )

        let modules = await gnosisSafe.getModules()
        qaxhModule = QaxhModule.at(modules[0])

        qaxhMasterLedger = await QaxhMasterLedger.new()
        await qaxhMasterLedger.setQaxh(accounts[8])
        await qaxhModule.setLedger(qaxhMasterLedger.address)
    })


    it('every test is here', async () => {

        //qaxh is played by accounts[8]
        //the owner is played by accounts[7]
        await qaxhModule.setQaxh(accounts[8])
        await qaxhModule.replaceOwner(accounts[7], {from : accounts[8]})

        //testing : setup the ledger
        console.log("\n Ledger : \n ")

        assert(!(await qaxhMasterLedger.qaxhSafe(accounts[0])), "initialisation fails")
        assert(await qaxhMasterLedger.addSafe(accounts[0], {from : accounts[8]}), "safe adding fails")
        assert(await qaxhMasterLedger.qaxhSafe(accounts[0]), "safe adding doesn't work")
        //fails rightfully : assert(await qaxhMasterLedger.addSafe(accounts[0], {from : accounts[0]}), "")
        console.log("   Adding a safe to the ledger : OK")

        assert(await qaxhMasterLedger.addSafe(accounts[1], {from : accounts[8]}), "lol")
        assert(await qaxhMasterLedger.removeSafe(accounts[1], {from : accounts[8]}), "removing safe fails")
        assert(!(await qaxhMasterLedger.qaxhSafe(accounts[1])), "removing safe doesn't work")
        // fails rightfully : assert(await qaxhMasterLedger.removeSafe(accounts[0], {from : accounts[0]}), "")
        console.log("   Removing a safe from the ledger : OK")

        //testing : loading the safe
        console.log("\n Loading the safe : \n ")

        await web3.eth.sendTransaction({from: accounts[7], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal( await web3.eth.getBalance(gnosisSafe.address).toNumber(), 100000000000000000)
        console.log("   Owner loading the safe : OK")

        await web3.eth.sendTransaction({from: accounts[1], to: gnosisSafe.address, value: web3.toWei(0.000000001, 'ether')})
        assert.equal( await web3.eth.getBalance(gnosisSafe.address).toNumber(), 100000001000000000)
        console.log("   Little payments loading the safe : OK")

        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.1, 'ether')})
        assert.equal( await web3.eth.getBalance(gnosisSafe.address).toNumber(), 200000001000000000)
        console.log("   Known safe loading the safe : OK")

        //testing : withdrawing
        console.log("\n Withdrawing from the safe : \n ")
        let oldBalanceSafe = await web3.eth.getBalance(gnosisSafe.address).toNumber()
        let oldBalanceAccount = await web3.eth.getBalance(accounts[0]).toNumber()
        await qaxhModule.sendFromSafe(accounts[0], web3.toWei(0.1, 'ether'), {from: accounts[7]})
        assert.equal(oldBalanceSafe - await web3.eth.getBalance(gnosisSafe.address).toNumber() , web3.toWei(0.1, 'ether'))
        assert.equal(await web3.eth.getBalance(accounts[0]).toNumber() - oldBalanceAccount, web3.toWei(0.1, 'ether'))
        console.log("   Withdrawing from safe : OK")

        //fails rightfully await qaxhModule.sendFromSafe(accounts[0], web3.toWei(0.1, 'ether'), {from: accounts[0]})


        ///fails : can't load safe if you're not the owner
        /*
        await gnosisSafe.send(web3.toWei(1.2, 'ether') , {from: accounts[2], gas: 20000})
        console.log("result : ", res)
        console.log("Balance : ", await web3.eth.getBalance(gnosisSafe.address).toNumber())
        */

        ///////////ONLY QAXH CAN WITHDRAW MONEY DIRECTLY FROM THE SAFE (at least, only someone with qaxh sign)

        /*
        // Withdraw 1 ETH
        console.log("Withdrawing 1 ETH")
        let executor = accounts[0]
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 1 ETH', [accounts[8]], accounts[3], web3.toWei(1, 'ether'), "0x", CALL, executor)
        console.log("Balance : ", await web3.eth.getBalance(gnosisSafe).toNumber())
        */
        //doesn't work because i'm way to lazy to adapt the utils function to address not in lw


        ///////////


        /*
        let modules = await gnosisSafe.getModules()
        console.log("Modules : ", modules)
        filterModule = FilterModule.at(modules[0])
        assert.equal(await filterModule.manager.call(), gnosisSafe.address)


        ////////////WATCH EVENTS/////////////////
        var event = filterModule.Event();
        event.watch(function(err, result) {console.log("got a succefull event")});

        var log = filterModule.Log();
        log.watch(function(err, result) {console.log("Got a load of ", result.args)});


        /////////CHANGE OWNERSHIP////////////////
        console.log("Old owner : ",await filterModule.getOwner())
        console.log("Changing owner to accounts[1]")
        await filterModule.replaceOwner(accounts[1])
        console.log("New owner : ",await filterModule.getOwner())


        /////////LOAD AND WITHDRAW///////////////
        await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(0.45, 'ether')}) //load from trusted address
        console.log("Balance after external load from trusted account : ",await web3.eth.getBalance(gnosisSafe.address).toNumber())
        await web3.eth.sendTransaction({from: accounts[1], to: gnosisSafe.address, value: web3.toWei(0.05, 'ether')}) //load small enough to pass
        console.log("Balance after external load with little enough value : ",await web3.eth.getBalance(gnosisSafe.address).toNumber())
        await filterModule.loadAccount({from: accounts[1], value : web3.toWei(0.6, 'ether') })
        console.log("Balance after internal load : ",await web3.eth.getBalance(filterModule.address).toNumber())



        utils.logGasUsage(
            'execTransactionFromModule withdraw with filter',
            await filterModule.sendTo(
            accounts[0], 50000000, {from: accounts[1]}
            )
        )
        */

        /*
        utils.logGasUsage(
            'transfer token',
            await filterModule.transferToken(
                accounts[0], 50, {from: accounts[1]}
            )
        )
        */

        ////////ACCESSING A TOKEN////////////////


    })

});
