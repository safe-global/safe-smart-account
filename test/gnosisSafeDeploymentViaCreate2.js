const utils = require('./utils/general')
const safeUtils = require('./utils/execution')
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const Proxy = artifacts.require("./GnosisSafeProxy.sol")
const ProxyInterface = artifacts.require("./IProxy.sol")
const ProxyFactory = artifacts.require("./GnosisSafeProxyFactory.sol")
const MockContract = artifacts.require('./MockContract.sol')
const MockToken = artifacts.require('./Token.sol')

contract('GnosisSafe deployment via create2', function(accounts) {

    const CALL = 0

    const gasPrice = web3.utils.toWei('20', 'gwei')

    let funder
    let proxyFactory
    let gnosisSafeMasterCopy
    let lw

    let getCreationData = async function(gasToken, userCosts, creationNonce) {
        gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, gasToken, userCosts, utils.Address0
        ).encodeABI()

        let proxyCreationCode = await proxyFactory.proxyCreationCode()
        assert.equal(proxyCreationCode, Proxy.bytecode)
        let constructorData = abi.rawEncode(
            ['address'],
            [ gnosisSafeMasterCopy.address ]
        ).toString('hex')
        let encodedNonce = abi.rawEncode(['uint256'], [creationNonce]).toString('hex')
        let target = "0x" + ethUtil.generateAddress2(proxyFactory.address, ethUtil.keccak256("0x" + ethUtil.keccak256(gnosisSafeData).toString("hex") + encodedNonce), proxyCreationCode + constructorData).toString("hex")
        console.log("    Predicted safe address: " + target)
        assert.equal(await web3.eth.getCode(target), "0x")
        return {
            safe: target,
            data: gnosisSafeData,
            gasToken: gasToken,
            userCosts: userCosts,
            gasPrice: gasPrice,
            creationNonce: creationNonce
        }
    }

    let deployWithCreationData = async function(creationData) {
      let estimatedAddressData = 
        proxyFactory.contract.methods.calculateCreateProxyWithNonceAddress(gnosisSafeMasterCopy.address, creationData.data, creationData.creationNonce).encodeABI()
      let estimatedAddressResponse = await web3.eth.call({to: proxyFactory.address, from: funder, data: estimatedAddressData, gasPrice: 0})
      let estimatedAddress = '0x' + estimatedAddressResponse.substring(138, 138 + 40)
      let tx = proxyFactory.createProxyWithNonce(
            gnosisSafeMasterCopy.address, creationData.data, creationData.creationNonce,
            {from: funder, gasPrice: gasPrice}
        )

      let safeAddress = await utils.getParamFromTxEvent(
          await tx,
          'ProxyCreation', 'proxy', proxyFactory.address, null, 'create Gnosis Safe',
      )

      console.log("    Deployed safe address: " + safeAddress)
      assert.equal(estimatedAddress, safeAddress.toLowerCase())
      let proxy = await ProxyInterface.at(safeAddress)
      assert.equal(await proxy.masterCopy(), gnosisSafeMasterCopy.address)
    }

    beforeEach(async function () {
        proxyFactory = await ProxyFactory.new()
        funder = accounts[5]
        // Create lightwallet
        lw = await utils.createLightwallet()
        gnosisSafeMasterCopy = await GnosisSafe.new()
    })

    it('should create safe from random account and pay in ETH', async () => {

        // Estimate safe creation costs
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        let creationNonce = new Date().getTime()
        let estimate = (await proxyFactory.createProxyWithNonce.estimateGas(gnosisSafeMasterCopy.address, gnosisSafeData, creationNonce)) + 14000
        let creationData = await getCreationData(utils.Address0, estimate * gasPrice, creationNonce)

        // User funds safe
        await web3.eth.sendTransaction({from: accounts[1], to: creationData.safe, value: creationData.userCosts})
        assert.equal(await web3.eth.getBalance(creationData.safe), creationData.userCosts)
        let funderBalance = await web3.eth.getBalance(funder)

        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), await proxyFactory.proxyRuntimeCode())

        let gnosisSafe = await GnosisSafe.at(creationData.safe)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]].map((o) => web3.utils.toChecksumAddress(o)))
        let funderDiff = await web3.eth.getBalance(funder) - funderBalance
        console.log("    Executor earned " + web3.utils.fromWei(funderDiff.toString(), 'ether') + " ETH")
        assert.ok(funderDiff > 0)

        await web3.eth.sendTransaction({from: accounts[1], to: gnosisSafe.address, value: web3.utils.toWei("1.1", 'ether')})
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, accounts[8])
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction withdraw 0.5 ETH', [lw.accounts[0], lw.accounts[2]], accounts[0], web3.utils.toWei("0.5", 'ether'), "0x", CALL, accounts[8])
    })

    it('should create safe from random account and pay with token', async () => {
        // Deploy token
        let token = await safeUtils.deployToken(accounts[0])

        let creationNonce = new Date().getTime()

        // We just set an fix amount of tokens to pay
        let creationData = await getCreationData(token.options.address, 1337, creationNonce)

        // User funds safe
        await token.methods.transfer(creationData.safe, creationData.userCosts).send({from: accounts[0]})
        assert.equal(await token.methods.balances(creationData.safe).call(), creationData.userCosts)
        assert.equal(await token.methods.balances(funder).call(), 0)

        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), await proxyFactory.proxyRuntimeCode())

        let gnosisSafe = await GnosisSafe.at(creationData.safe)
        assert.deepEqual(await gnosisSafe.getOwners(), [lw.accounts[0], lw.accounts[1], lw.accounts[2]].map((o) => web3.utils.toChecksumAddress(o)))
        assert.equal(await token.methods.balances(funder).call(), creationData.userCosts)
        assert.equal(await token.methods.balances(gnosisSafe.address).call(), 0)

        await token.methods.transfer(gnosisSafe.address, 3141596).send({from: accounts[0]})
        let data = await token.methods.transfer(accounts[1], 212121).encodeABI()
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction token transfer', [lw.accounts[0], lw.accounts[2]], token.options.address, 0, data, CALL, accounts[8], { gasToken: token.options.address })
        await safeUtils.executeTransaction(lw, gnosisSafe, 'executeTransaction token transfer', [lw.accounts[0], lw.accounts[2]], token.options.address, 0, data, CALL, accounts[8], { gasToken: token.options.address })

        assert.equal(await token.methods.balances(accounts[1]).call(), 424242)
    })

    it('should fail if ether payment fails', async () => {
        // We just set an fix amount of eth to pay
        let creationData = await getCreationData(utils.Address0, 5000 * gasPrice, new Date().getTime())
        utils.assertRejects(deployWithCreationData(creationData), "Deployment without enough ETH should fail")
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')
    })

    it('should fail if token payment fails', async () => {
        // Deploy token
        let token = await safeUtils.deployToken(accounts[0])

        let nonce = new Date().getTime()
        // We just set an fix amount of tokens to pay
        let creationData = await getCreationData(token.options.address, 1337, nonce)
        utils.assertRejects(deployWithCreationData(creationData), "Deployment without enough tokens should fail")
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')

        let mockContract = await MockContract.new()
        let mockToken = await MockToken.at(mockContract.address)

        await mockContract.givenAnyRunOutOfGas()
        creationData = await getCreationData(mockToken.address, 1337, nonce)
        utils.assertRejects(deployWithCreationData(creationData), "Deployment without enough gas should fail")
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')


        await mockContract.givenAnyRevert()
        creationData = await getCreationData(mockToken.address, 1337, nonce)
        utils.assertRejects(deployWithCreationData(creationData), "Deployment when payment fails should fail")
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')


        await mockContract.givenAnyReturnBool(false)
        creationData = await getCreationData(mockToken.address, 1337, nonce)
        utils.assertRejects(deployWithCreationData(creationData), "Deployment when payment transfer returns false should fail")
        assert.equal(await web3.eth.getCode(creationData.safe), '0x')

        // We deploy a proxy to the same predicted address to make sure that even after a failure we could deploy a successfull one
        await mockContract.givenAnyReturnBool(true)
        creationData = await getCreationData(mockToken.address, 1337, nonce)
        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), await proxyFactory.proxyRuntimeCode())

    })

    it('should fail when creating the same proxy twice', async () => {
	// Estimate safe creation costs
        let gnosisSafeData = await gnosisSafeMasterCopy.contract.methods.setup(
            [lw.accounts[0], lw.accounts[1], lw.accounts[2]], 2, utils.Address0, "0x", utils.Address0, utils.Address0, 0, utils.Address0
        ).encodeABI()
        let creationNonce = new Date().getTime()
        let estimate = (await proxyFactory.createProxyWithNonce.estimateGas(gnosisSafeMasterCopy.address, gnosisSafeData, creationNonce)) + 9000
        let creationData = await getCreationData(utils.Address0, estimate * gasPrice, creationNonce)

        // User funds safe
        await web3.eth.sendTransaction({from: accounts[1], to: creationData.safe, value: creationData.userCosts})
        assert.equal(await web3.eth.getBalance(creationData.safe), creationData.userCosts)

        await deployWithCreationData(creationData)
        assert.equal(await web3.eth.getCode(creationData.safe), await proxyFactory.proxyRuntimeCode())

        utils.assertRejects(deployWithCreationData(creationData), "Deployment fails as same proxy with same params (and address) was already deployed")

        let estimatedAddressData = proxyFactory.contract.methods.calculateCreateProxyWithNonceAddress(gnosisSafeMasterCopy.address, creationData.data, creationData.creationNonce).encodeABI()
        let errorMessage = await utils.getErrorMessage(proxyFactory.address, 0, estimatedAddressData, funder)
	    assert.equal(errorMessage, 'Create2 call failed')
    })

})
