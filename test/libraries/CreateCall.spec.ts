import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { compile, getCreateCall, getSafe } from "../utils/setup";
import { buildContractCall, executeTx, safeApproveHash } from "../../src/utils/execution";

const CONTRACT_SOURCE = `
contract Test {
    address public creator;
    constructor() payable {
        creator = msg.sender;
    }

    function x() public pure returns (uint) {
        return 21;
    }
}`;

describe("CreateCall", () => {
    before(function () {
        /**
         * performCreate and performCreate2 functions of CreateCall.sol will not work on zkSync because the compiler
         * needs to be aware of the code at compile time.
         * @see https://docs.zksync.io/build/developer-reference/ethereum-differences/evm-instructions#create-create2
         */
        if (hre.network.zksync) this.skip();
    });

    const setupTests = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const testContract = await compile(CONTRACT_SOURCE);
        const signers = await hre.ethers.getSigners();
        const [user1] = signers;
        return {
            safe: await getSafe({ owners: [user1.address] }),
            createCall: await getCreateCall(),
            testContract,
            signers,
        };
    });

    describe("performCreate", () => {
        it("should revert if called directly and no value is on the factory", async () => {
            const { createCall, testContract } = await setupTests();
            await expect(createCall.performCreate(1, testContract.data)).to.be.revertedWith("Could not deploy contract");
        });

        it("can call factory directly", async () => {
            const {
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const createCallAddress = await createCall.getAddress();
            const createCallNonce = await ethers.provider.getTransactionCount(createCallAddress);
            const address = ethers.getCreateAddress({ from: createCallAddress, nonce: createCallNonce });

            await expect(createCall.performCreate(0, testContract.data)).to.emit(createCall, "ContractCreation").withArgs(address);

            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(createCallAddress);
        });

        it("should fail if Safe does not have value to send along", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();

            const tx = await buildContractCall(createCall, "performCreate", [1, testContract.data], await safe.nonce(), true);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.revertedWith("Could not deploy contract");
        });

        it("should successfully create contract and emit event", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const safeEthereumNonce = await ethers.provider.getTransactionCount(safeAddress);
            const address = ethers.getCreateAddress({ from: safeAddress, nonce: safeEthereumNonce });

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safeAddress);
            const tx = await buildContractCall(createCall, "performCreate", [0, testContract.data], await safe.nonce(), true);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]))
                .to.emit(safe, "ExecutionSuccess")
                .and.to.emit(safeCreateCall, "ContractCreation")
                .withArgs(address);

            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(safeAddress);
        });

        it("should successfully create contract and send along ether", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: ethers.parseEther("1") });
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("1"));

            const safeEthereumNonce = await ethers.provider.getTransactionCount(safeAddress);
            const address = ethers.getCreateAddress({ from: safeAddress, nonce: safeEthereumNonce });

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safeAddress);
            const tx = await buildContractCall(
                createCall,
                "performCreate",
                [ethers.parseEther("1"), testContract.data],
                await safe.nonce(),
                true,
            );
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]))
                .to.emit(safe, "ExecutionSuccess")
                .and.to.emit(safeCreateCall, "ContractCreation")
                .withArgs(address);

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(address)).to.eq(ethers.parseEther("1"));
            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(safeAddress);
        });
    });

    describe("performCreate2", () => {
        const salt = ethers.keccak256(ethers.toUtf8Bytes("createCall"));

        it("should revert if called directly and no value is on the factory", async () => {
            const { createCall, testContract } = await setupTests();
            await expect(createCall.performCreate2(1, testContract.data, salt)).to.be.revertedWith("Could not deploy contract");
        });

        it("can call factory directly", async () => {
            const {
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const createCallAddress = await createCall.getAddress();
            const address = ethers.getCreate2Address(createCallAddress, salt, ethers.keccak256(testContract.data));

            await expect(createCall.performCreate2(0, testContract.data, salt))
                .to.emit(createCall, "ContractCreation")
                .withArgs(address);

            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(createCallAddress);
        });

        it("should fail if Safe does not have value to send along", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();

            const tx = await buildContractCall(createCall, "performCreate2", [1, testContract.data, salt], await safe.nonce(), true);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)])).to.revertedWith("Could not deploy contract");
        });

        it("should successfully create contract and emit event", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();

            const address = ethers.getCreate2Address(safeAddress, salt, ethers.keccak256(testContract.data));

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safeAddress);
            const tx = await buildContractCall(createCall, "performCreate2", [0, testContract.data, salt], await safe.nonce(), true);
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]))
                .to.emit(safe, "ExecutionSuccess")
                .and.to.emit(safeCreateCall, "ContractCreation")
                .withArgs(address);

            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(safeAddress);
        });

        it("should successfully create contract and send along ether", async () => {
            const {
                safe,
                createCall,
                testContract,
                signers: [user1],
            } = await setupTests();
            const safeAddress = await safe.getAddress();
            await user1.sendTransaction({ to: safeAddress, value: ethers.parseEther("1") });
            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("1"));

            const address = ethers.getCreate2Address(safeAddress, salt, ethers.keccak256(testContract.data));

            // We require this as 'emit' check the address of the event
            const safeCreateCall = createCall.attach(safeAddress);
            const tx = await buildContractCall(
                createCall,
                "performCreate2",
                [ethers.parseEther("1"), testContract.data, salt],
                await safe.nonce(),
                true,
            );
            await expect(executeTx(safe, tx, [await safeApproveHash(user1, safe, tx, true)]))
                .to.emit(safe, "ExecutionSuccess")
                .and.to.emit(safeCreateCall, "ContractCreation")
                .withArgs(address);

            await expect(await hre.ethers.provider.getBalance(safeAddress)).to.eq(ethers.parseEther("0"));
            await expect(await hre.ethers.provider.getBalance(address)).to.eq(ethers.parseEther("1"));
            const newContract = new ethers.Contract(address, testContract.interface, user1);
            expect(await newContract.creator()).to.be.eq(safeAddress);
        });
    });
});
