// const utils = require('./utils')

// const GnosisSafeFactory = artifacts.require("./GnosisSafeFactory.sol");
// const GnosisSafe = artifacts.require("./GnosisSafe.sol");
// const WhitelistExtension = artifacts.require("./WhitelistExtension.sol");
// const WhitelistExtensionFactory = artifacts.require("./WhitelistExtensionFactory.sol");

// contract('WhitelistExtension', function(accounts) {

//     let gnosisSafe
//     let gnosisSafeFactory
//     let lw
//     let data
//     let transactionHash
//     let whitelistExtension

//     const CALL = 0
//     const DELEGATECALL = 1

//     beforeEach(async function () {
//         // Create lightwallet
//         lw = await utils.createLightwallet()
//     })

//     it('should create a new Safe with whitelist extension and execute a withdraw transaction to a whitelisted account', async () => {
//         // Gnosis Safe factory
//         gnosisSafeFactory = await GnosisSafeFactory.new()
//         // Create whitelist extension
//         whitelistExtensionFactory = await WhitelistExtensionFactory.new()
//         // Add extension to wallet
//         let extensionData = await whitelistExtensionFactory.contract.createWhitelistExtension.getData(gnosisSafeFactory.address, [accounts[3]])
//         gnosisSafe = utils.getParamFromTxEvent(
//             await gnosisSafeFactory.createGnosisSafe([accounts[0], accounts[1]], 2, whitelistExtensionFactory.address, extensionData),
//             'gnosisSafe', GnosisSafe, 'GnosisSafeCreation', 'Create Gnosis Safe and Whitelist extension'
//         )
//         extensions = await gnosisSafe.getExtensions()
//         assert.equal(extensions.length, 1)
//         whitelistExtension = WhitelistExtension.at(extensions[0])
//         // Deposit 1 eth
//         await web3.eth.sendTransaction({from: accounts[0], to: gnosisSafe.address, value: web3.toWei(1, 'ether')})
//         assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether'));
//         // Withdraw to whitelisted account
//         utils.logGasUsage(
//             'executeException withdraw to whitelisted account',
//             await gnosisSafe.executeExtension(
//                 accounts[3], 300, 0, 0, whitelistExtension.address, {from: accounts[1]}
//             )
//         )
//         assert.equal(await web3.eth.getBalance(gnosisSafe.address).toNumber(), web3.toWei(1, 'ether') - 300);
//     })

//     it('should create a new Safe with whitelist extension and add and remove an account from the whitelist', async () => {
//         // Gnosis Safe factory
//         gnosisSafeFactory = await GnosisSafeFactory.new()
//         // Create whitelist extension
//         whitelistExtensionFactory = await WhitelistExtensionFactory.new()
//         // Add extension to wallet
//         let extensionData = await whitelistExtensionFactory.contract.createWhitelistExtension.getData(gnosisSafeFactory.address, [])
//         gnosisSafe = utils.getParamFromTxEvent(
//             await gnosisSafeFactory.createGnosisSafe([lw.accounts[0], lw.accounts[1]], 2, whitelistExtensionFactory.address, extensionData),
//             'gnosisSafe', GnosisSafe, 'GnosisSafeCreation', 'Create Gnosis Safe and Whitelist extension'
//         )
//         extensions = await gnosisSafe.getExtensions()
//         assert.equal(extensions.length, 1)
//         whitelistExtension = WhitelistExtension.at(extensions[0])
//         assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), false)
//         // Add account 3 to whitelist
//         data = await whitelistExtension.contract.addToWhitelist.getData(accounts[3])
//         nonce = await gnosisSafe.nonce()
//         transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
//         //Confirm transaction with signed messages
//         sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
//         utils.logGasUsage(
//             'executeTransaction add account to whitelist',
//             await gnosisSafe.executeTransaction(
//                 whitelistExtension.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
//             )
//         )
//         assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), true)
//         // Remove account 3 from whitelist
//         data = await whitelistExtension.contract.removeFromWhitelist.getData(accounts[3])
//         nonce = await gnosisSafe.nonce()
//         transactionHash = await gnosisSafe.getTransactionHash(whitelistExtension.address, 0, data, CALL, nonce)
//         //Confirm transaction with signed messages
//         sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
//         utils.logGasUsage(
//             'executeTransaction add account to whitelist',
//             await gnosisSafe.executeTransaction(
//                 whitelistExtension.address, 0, data, CALL, sigs.sigV, sigs.sigR, sigs.sigS
//             )
//         )
//         assert.equal(await whitelistExtension.isWhitelisted(accounts[3]), false)
//     })
// });
