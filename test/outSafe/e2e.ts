import { expect } from "chai";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { AddressZero } from "@ethersproject/constants";
import { mine, time } from "@nomicfoundation/hardhat-network-helpers";

import hre, { deployments, waffle } from "hardhat";
import { getRandomIntAsString } from "../utils/numbers";
import { BigNumberish, Contract, Signer, ethers } from "ethers";
import {
    SafeSignature,
    buildSafeTransaction,
    buildSignatureBytes,
    executeContractCallWithSigners,
    safeSignTypedData,
} from "../../src/utils/execution";

export const EIP712_WITHDRAWAL_TYPE = {
    // "OutWithdrawal(address to,address asset,uint8 assetType,uint256 amount,uint256 blockNonce,uint32 expiry)"
    OutWithdrawal: [
        { type: "address", name: "to" },
        { type: "address", name: "asset" },
        { type: "uint8", name: "assetType" },
        { type: "uint256", name: "amount" },
        { type: "uint256", name: "blockNonce" },
        { type: "uint32", name: "expiry" },
    ],
};

enum AssetType {
    ETH = 0,
    ERC20 = 1,
}

interface Withdrawal {
    to: string;
    asset: string;
    assetType: AssetType;
    amount: BigNumberish;
    blockNonce: BigNumberish;
    expiry: number;
}

const signWithdrawalData = async (
    signer: Signer & TypedDataSigner,
    safe: Contract,
    data: Withdrawal,
    chainId?: BigNumberish,
): Promise<SafeSignature> => {
    if (!chainId && !signer.provider) throw Error("Provider required to retrieve chainId");
    const cid = chainId || (await signer.provider!.getNetwork()).chainId;
    const signerAddress = await signer.getAddress();
    return {
        signer: signerAddress,
        data: await signer._signTypedData({ verifyingContract: safe.address, chainId: cid }, EIP712_WITHDRAWAL_TYPE, data),
    };
};

const getOutSafeSingleton = async () => {
    const OutSafe = await hre.ethers.getContractFactory("OutSafe");
    return await OutSafe.deploy();
};

const getOutProxyFactory = async () => {
    const OutFactory = await hre.ethers.getContractFactory("OutSafeProxyFactory");
    return await OutFactory.deploy();
};

const getOutSafeTemplateAddress = async (saltNumber: string = getRandomIntAsString()) => {
    const singleton = await getOutSafeSingleton();
    const factory = await getOutProxyFactory();
    const template = await factory.callStatic.createProxyWithNonce(singleton.address, "0x", saltNumber);
    await factory.createProxyWithNonce(singleton.address, "0x", saltNumber).then((tx: any) => tx.wait());
    return template;
};

const getOutSafe = async (address: string) => {
    const Safe = await hre.ethers.getContractFactory("OutSafe");
    return Safe.attach(address);
};

const getERC20 = async () => {
    const ERC20 = await hre.ethers.getContractFactory("ERC20Token");
    return await ERC20.deploy();
};

describe("OutSafe - e2e", async () => {
    const [admin1, admin2, admin3, admin4, user1, user2, user3, user4, hotWallet1] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const templateAddress = await getOutSafeTemplateAddress();
        const outSafe = await getOutSafe(templateAddress);

        await outSafe.setup(
            [admin1.address, admin2.address, admin3.address, admin4.address],
            3,
            AddressZero,
            "0x",
            AddressZero,
            AddressZero,
            0,
            AddressZero,
        );

        return {
            outSafe,
            erc20: await getERC20(),
        };
    });

    it("should allow user to deposit ETH to the safe", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("1.0"),
        });
        expect((await waffle.provider.getBalance(outSafe.address)).toString()).to.be.equal(ethers.utils.parseEther("1.0"));
    });

    it("should not allow user to send ETH to the safe directly", async () => {
        const { outSafe } = await setupTests();
        await expect(
            user1.sendTransaction({
                to: outSafe.address,
                value: ethers.utils.parseEther("1.0"),
            }),
        ).to.be.reverted;
        expect((await waffle.provider.getBalance(outSafe.address)).toString()).to.be.equal("0");
    });

    it("should allow user to deposit ERC20 to the safe", async () => {
        const { erc20, outSafe } = await setupTests();
        await erc20.transfer(user1.address, 1000);
        expect(await erc20.balanceOf(user1.address)).to.be.equal(1000);

        await erc20.connect(user1).transfer(outSafe.address, 1000);
        expect(await erc20.balanceOf(outSafe.address)).to.be.equal(1000);
    });

    it("should be able to withdraw ETH from the safe with multi sig", async () => {
        const { erc20, outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("1.0"),
        });
        const to = user2.address;
        // const data = gasUser.interface.encodeFunctionData("useGas", [80]);
        const tx = buildSafeTransaction({
            to,
            value: ethers.utils.parseEther("0.5"),
            nonce: await outSafe.nonce(),
        });
        const sig1 = await safeSignTypedData(admin1, outSafe, tx);
        const sig2 = await safeSignTypedData(admin2, outSafe, tx);
        const sig3 = await safeSignTypedData(admin3, outSafe, tx);
        const sig4 = await safeSignTypedData(admin4, outSafe, tx);

        const oldBalance = await waffle.provider.getBalance(to);

        const signaturesByBytes = buildSignatureBytes([sig1, sig3, sig4]);
        await outSafe.execTransaction(
            tx.to,
            tx.value,
            tx.data,
            tx.operation,
            tx.safeTxGas,
            tx.baseGas,
            tx.gasPrice,
            tx.gasToken,
            tx.refundReceiver,
            signaturesByBytes,
        );

        expect(await waffle.provider.getBalance(to)).to.be.equal(oldBalance.add(ethers.utils.parseEther("0.5")));
    });

    it("should be able to withdraw ERC20 from the safe with multi sig", async () => {
        const { erc20, outSafe } = await setupTests();
        await erc20.transfer(user1.address, 1000);
        await erc20.connect(user1).transfer(outSafe.address, 1000);

        const data = erc20.interface.encodeFunctionData("transfer", [user2.address, 1000]);
        // const data = gasUser.interface.encodeFunctionData("useGas", [80]);
        const tx = buildSafeTransaction({
            to: erc20.address,
            data,
            nonce: await outSafe.nonce(),
        });
        const sig1 = await safeSignTypedData(admin1, outSafe, tx);
        const sig2 = await safeSignTypedData(admin2, outSafe, tx);
        const sig3 = await safeSignTypedData(admin3, outSafe, tx);
        const sig4 = await safeSignTypedData(admin4, outSafe, tx);

        const signaturesByBytes = buildSignatureBytes([sig3, sig2, sig1]);
        await outSafe.execTransaction(
            tx.to,
            tx.value,
            tx.data,
            tx.operation,
            tx.safeTxGas,
            tx.baseGas,
            tx.gasPrice,
            tx.gasToken,
            tx.refundReceiver,
            signaturesByBytes,
        );

        expect(await erc20.balanceOf(user2.address)).to.be.equal(1000);
    });

    it("should be able to have hot wallet address added with signatures", async () => {
        const { outSafe } = await setupTests();
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("5.0"));
    });

    it("should not be able to have hot wallet address added directly", async () => {
        const { outSafe } = await setupTests();
        await expect(outSafe.setHotWallet(hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")])).to.be.revertedWith("GS031");
    });

    it("should allow ETH withdrawal from a hot wallet within limit", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("5.0"));

        const oldUser2Balance = await waffle.provider.getBalance(user2.address);
        let currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        const response = await outSafe
            .connect(user2)
            .withdraw(
                withdrawal1.asset,
                withdrawal1.assetType,
                withdrawal1.amount,
                withdrawal1.blockNonce,
                withdrawal1.expiry,
                hotWallet1.address,
                sig1,
            );

        const receipt = await response.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        expect(await waffle.provider.getBalance(user2.address)).to.be.equal(oldUser2Balance.add(withdrawal1.amount).sub(gasUsed));

        const oldUser3Balance = await waffle.provider.getBalance(user3.address);
        currentBlock = await waffle.provider.getBlockNumber();

        const withdrawal2: Withdrawal = {
            to: user3.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("3.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig2 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal2);

        await outSafe
            .connect(user2)
            .withdrawTo(
                user3.address,
                withdrawal2.asset,
                withdrawal2.assetType,
                withdrawal2.amount,
                withdrawal2.blockNonce,
                withdrawal2.expiry,
                hotWallet1.address,
                sig2,
            );
        expect(await waffle.provider.getBalance(user3.address)).to.be.equal(oldUser3Balance.add(withdrawal2.amount));
    });

    it("should not allow ETH withdrawal from a hot wallet over limit", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("4.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("4.0"));

        const oldUser2Balance = await waffle.provider.getBalance(user2.address);
        let currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        const response = await outSafe
            .connect(user2)
            .withdraw(
                withdrawal1.asset,
                withdrawal1.assetType,
                withdrawal1.amount,
                withdrawal1.blockNonce,
                withdrawal1.expiry,
                hotWallet1.address,
                sig1,
            );

        const receipt = await response.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        expect(await waffle.provider.getBalance(user2.address)).to.be.equal(oldUser2Balance.add(withdrawal1.amount).sub(gasUsed));

        currentBlock = await waffle.provider.getBlockNumber();

        const withdrawal2: Withdrawal = {
            to: user3.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("3.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig2 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal2);

        await expect(
            outSafe
                .connect(user2)
                .withdrawTo(
                    user3.address,
                    withdrawal2.asset,
                    withdrawal2.assetType,
                    withdrawal2.amount,
                    withdrawal2.blockNonce,
                    withdrawal2.expiry,
                    hotWallet1.address,
                    sig2,
                ),
        ).to.be.revertedWith("OS05");
    });

    it("should allow/disallow ERC20 withdrawal like ETH withdrawal", async () => {
        const { outSafe, erc20 } = await setupTests();

        await erc20.transfer(user1.address, 1000);
        await erc20.connect(user1).transfer(outSafe.address, 1000);

        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [erc20.address], [1000]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, erc20.address)).to.be.equal(1000);

        let currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: erc20.address,
            assetType: AssetType.ERC20,
            amount: 700,
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        await outSafe
            .connect(user2)
            .withdraw(
                withdrawal1.asset,
                withdrawal1.assetType,
                withdrawal1.amount,
                withdrawal1.blockNonce,
                withdrawal1.expiry,
                hotWallet1.address,
                sig1,
            );

        expect(await erc20.balanceOf(user2.address)).to.be.equal(700);

        currentBlock = await waffle.provider.getBlockNumber();

        const withdrawal2: Withdrawal = {
            to: user3.address,
            asset: erc20.address,
            assetType: AssetType.ERC20,
            amount: 300,
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig2 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal2);

        await outSafe
            .connect(user2)
            .withdrawTo(
                user3.address,
                withdrawal2.asset,
                withdrawal2.assetType,
                withdrawal2.amount,
                withdrawal2.blockNonce,
                withdrawal2.expiry,
                hotWallet1.address,
                sig2,
            );

        expect(await erc20.balanceOf(user3.address)).to.be.equal(300);
    });

    it("should not allow withdrawal from a unreognized wallet", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("4.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("4.0"));

        const currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(admin1, outSafe, withdrawal1);

        await expect(
            outSafe
                .connect(user2)
                .withdrawTo(
                    user2.address,
                    withdrawal1.asset,
                    withdrawal1.assetType,
                    withdrawal1.amount,
                    withdrawal1.blockNonce,
                    withdrawal1.expiry,
                    admin1.address,
                    sig1,
                ),
        ).to.be.revertedWith("OS05");
    });

    it("should not allow withdrawal from a invalid signature", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("4.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("4.0"));

        const currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        await expect(
            outSafe
                .connect(user2)
                .withdrawTo(
                    user3.address,
                    withdrawal1.asset,
                    withdrawal1.assetType,
                    ethers.utils.parseEther("3.0"),
                    withdrawal1.blockNonce,
                    withdrawal1.expiry,
                    hotWallet1.address,
                    sig1,
                ),
        ).to.be.revertedWith("OS04");
    });

    it("should not allow withdrawal with the same nonce", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("5.0"));

        const oldUser2Balance = await waffle.provider.getBalance(user2.address);
        const currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 1,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        const response = await outSafe
            .connect(user2)
            .withdraw(
                withdrawal1.asset,
                withdrawal1.assetType,
                withdrawal1.amount,
                withdrawal1.blockNonce,
                withdrawal1.expiry,
                hotWallet1.address,
                sig1,
            );

        const receipt = await response.wait();
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        expect(await waffle.provider.getBalance(user2.address)).to.be.equal(oldUser2Balance.add(withdrawal1.amount).sub(gasUsed));

        await expect(
            outSafe
                .connect(user2)
                .withdraw(
                    withdrawal1.asset,
                    withdrawal1.assetType,
                    withdrawal1.amount,
                    withdrawal1.blockNonce,
                    withdrawal1.expiry,
                    hotWallet1.address,
                    sig1,
                ),
        ).to.be.revertedWith("OS01");
    });

    it("should not allow withdrawal with the block nonce > block number", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("5.0"));

        const currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock + 2,
            expiry: 2000,
        };

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        await expect(
            outSafe
                .connect(user2)
                .withdraw(
                    withdrawal1.asset,
                    withdrawal1.assetType,
                    withdrawal1.amount,
                    withdrawal1.blockNonce,
                    withdrawal1.expiry,
                    hotWallet1.address,
                    sig1,
                ),
        ).to.be.revertedWith("OS03");
    });

    it("should not be able to allow withdrawal with an expired signature", async () => {
        const { outSafe } = await setupTests();
        await outSafe.connect(user1).deposit({
            value: ethers.utils.parseEther("5.0"),
        });
        await executeContractCallWithSigners(
            outSafe,
            outSafe,
            "setHotWallet",
            [hotWallet1.address, [AddressZero], [ethers.utils.parseEther("5.0")]],
            [admin1, admin2, admin3],
        );

        expect(await outSafe.getLimit(hotWallet1.address, AddressZero)).to.be.equal(ethers.utils.parseEther("5.0"));

        const currentBlock = await time.latestBlock();

        const withdrawal1: Withdrawal = {
            to: user2.address,
            asset: AddressZero,
            assetType: AssetType.ETH,
            amount: ethers.utils.parseEther("2.0"),
            blockNonce: currentBlock,
            expiry: 2000,
        };

        await mine(2000);

        const { data: sig1 } = await signWithdrawalData(hotWallet1, outSafe, withdrawal1);

        await expect(
            outSafe
                .connect(user2)
                .withdraw(
                    withdrawal1.asset,
                    withdrawal1.assetType,
                    withdrawal1.amount,
                    withdrawal1.blockNonce,
                    withdrawal1.expiry,
                    hotWallet1.address,
                    sig1,
                ),
        ).to.be.revertedWith("OS02");
    });
});
