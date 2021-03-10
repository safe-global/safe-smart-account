import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { compile, getCreateCall, getSafeWithOwners } from "../utils/setup";
import { buildContractCall, executeTx, safeApproveHash } from "../utils/execution";
import { parseEther } from "@ethersproject/units";

describe("CreateCall", async () => {

    const CONTRACT_SOURCE = `
    contract Test {
        address public creator;
        constructor() payable {
            creator = msg.sender;
        }

        function x() public pure returns (uint) {
            return 21;
        }
    }`
    const compiledTestContract = await compile(CONTRACT_SOURCE);

    const [user1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        return {
            safe: await getSafeWithOwners([user1.address]),
            createCall: await getCreateCall()
        }
    })

    describe("performCreate", async () => {

        it('should revert if called directly and no value is on the factory', async () => {
            const { createCall } = await setupTests()
            await expect(
                createCall.performCreate(1, compiledTestContract.data)
            ).to.be.revertedWith("Could not deploy contract")
        })

        it('can call factory directly', async () => {
            const { createCall } = await setupTests()
            const createCallNonce = await ethers.provider.getTransactionCount(createCall.address)
            const address = ethers.utils.getContractAddress({ from: createCall.address, nonce: createCallNonce })

            await expect(
                createCall.performCreate(0, compiledTestContract.data)
            ).to.emit(createCall, "ContractCreation").withArgs(address)

            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(createCall.address)
        })

        it('should fail if Safe does not have value to send along', async () => {
            const { safe, createCall } = await setupTests()

            const tx = await buildContractCall(createCall, "performCreate", [1, compiledTestContract.data], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionFailure")
        })

        it('should successfully create contract and emit event', async () => {
            const { safe, createCall } = await setupTests()

            const safeEthereumNonce = await ethers.provider.getTransactionCount(safe.address)
            const address = ethers.utils.getContractAddress({ from: safe.address, nonce: safeEthereumNonce })

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safe.address)
            const tx = await buildContractCall(createCall, "performCreate", [0, compiledTestContract.data], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionSuccess").and.to.emit(safeCreateCall, "ContractCreation").withArgs(address)

            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(safe.address)
        })

        it('should successfully create contract and send along ether', async () => {
            const { safe, createCall } = await setupTests()
            await user1.sendTransaction({ to: safe.address, value: parseEther("1") })
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1"))

            const safeEthereumNonce = await ethers.provider.getTransactionCount(safe.address)
            const address = ethers.utils.getContractAddress({ from: safe.address, nonce: safeEthereumNonce })

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safe.address)
            const tx = await buildContractCall(createCall, "performCreate", [parseEther("1"), compiledTestContract.data], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionSuccess").and.to.emit(safeCreateCall, "ContractCreation").withArgs(address)

            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("0"))
            await expect(await hre.ethers.provider.getBalance(address)).to.be.deep.eq(parseEther("1"))
            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(safe.address)
        })
    })

    describe("performCreate2", async () => {

        const salt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("createCall"))

        it('should revert if called directly and no value is on the factory', async () => {
            const { createCall } = await setupTests()
            await expect(
                createCall.performCreate2(1, compiledTestContract.data, salt)
            ).to.be.revertedWith("Could not deploy contract")
        })

        it('can call factory directly', async () => {
            const { createCall } = await setupTests()
            const address = ethers.utils.getCreate2Address(createCall.address, salt, ethers.utils.keccak256(compiledTestContract.data))

            await expect(
                createCall.performCreate2(0, compiledTestContract.data, salt)
            ).to.emit(createCall, "ContractCreation").withArgs(address)

            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(createCall.address)
        })

        it('should fail if Safe does not have value to send along', async () => {
            const { safe, createCall } = await setupTests()

            const tx = await buildContractCall(createCall, "performCreate2", [1, compiledTestContract.data, salt], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionFailure")
        })

        it('should successfully create contract and emit event', async () => {
            const { safe, createCall } = await setupTests()

            const address = ethers.utils.getCreate2Address(safe.address, salt, ethers.utils.keccak256(compiledTestContract.data))

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safe.address)
            const tx = await buildContractCall(createCall, "performCreate2", [0, compiledTestContract.data, salt], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionSuccess").and.to.emit(safeCreateCall, "ContractCreation").withArgs(address)

            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(safe.address)
        })

        it('should successfully create contract and send along ether', async () => {
            const { safe, createCall } = await setupTests()
            await user1.sendTransaction({ to: safe.address, value: parseEther("1") })
            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("1"))

            const address = ethers.utils.getCreate2Address(safe.address, salt, ethers.utils.keccak256(compiledTestContract.data))

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safe.address)
            const tx = await buildContractCall(createCall, "performCreate2", [parseEther("1"), compiledTestContract.data, salt], await safe.nonce(), true)
            await expect(
                executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])
            ).to.emit(safe, "ExecutionSuccess").and.to.emit(safeCreateCall, "ContractCreation").withArgs(address)

            await expect(await hre.ethers.provider.getBalance(safe.address)).to.be.deep.eq(parseEther("0"))
            await expect(await hre.ethers.provider.getBalance(address)).to.be.deep.eq(parseEther("1"))
            const newContract = new ethers.Contract(address, compiledTestContract.interface, user1)
            expect(await newContract.creator()).to.be.eq(safe.address)
        })
    })
})