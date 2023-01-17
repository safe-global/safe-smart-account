import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { parseEther } from "@ethersproject/units";
import { defaultAbiCoder } from "@ethersproject/abi";
import {
  getSafeWithOwners,
  deployContract,
  getCompatFallbackHandler,
} from "../utils/setup";
import {
  buildContractCall,
  buildContractSignature,
  buildSafeTransaction,
  executeTx,
  populateExecuteTx,
  safeSignTypedData,
} from "../../src/utils/execution";

describe("GnosisSafe", async () => {
  const [user1, user2, user3] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const exploitHandlerSource = `
        contract Test {
            address public target;
            bytes public nextTransaction;
            function isValidSignature(bytes memory _data, bytes memory _signature) public returns (bytes4) {
                if (nextTransaction.length > 0) {
                    (bool success, ) = target.call{ gas: type(uint256).max }(nextTransaction);
                    require(success, "Failed to exploit");
                }
                return 0x20c13b0b;
            }

            function executeNextTransaction() public {
                (bool success, ) = target.call(nextTransaction);
                require(success, "Failed to execute");
            }

            function resetNextTransaction() public {
                nextTransaction = "";
                target = address(0);
            }

            function setNextTransaction(address safe, bytes calldata data) public {
                nextTransaction = data;
                target = safe;
            }
        }`;
    const exploitHandler = await deployContract(
      user1,
      exploitHandlerSource
    );
    const ownerSafe = await getSafeWithOwners(
      [user1.address],
      1,
      exploitHandler.address
    );
    return {
      safe: await getSafeWithOwners([ownerSafe.address, user2.address, user3.address], 2),
      ownerSafe,
      exploitHandler,
    };
  });

  describe("Nonce Reorder Exploit", async () => {
    it("should not to reorder transaction as a malicious contract owner", async () => {
      const { safe, ownerSafe, exploitHandler } = await setupTests();
      // Safe should be empty again
      await user1.sendTransaction({ to: safe.address, value: parseEther("1") });
      await expect(
        await hre.ethers.provider.getBalance(safe.address)
      ).to.be.deep.eq(parseEther("1"));

      const operation = 0;
      const to = user1.address;
      const value = parseEther("1");
      const data = "0x";
      const nonce = await safe.nonce();

      // First transaction (transfer out all ETH)
      const transferTx = buildSafeTransaction({
        to,
        value,
        data,
        operation,
        nonce,
      });
      const transferTxSigs = [
        await buildContractSignature(ownerSafe.address, "0x"), // Owner will approve any transaction without signature data
        await safeSignTypedData(user2, safe, transferTx),
      ];

      // Second transaction (change threshold to 1)
      const thresholdTx = await buildContractCall(
        safe,
        "changeThreshold",
        [1],
        nonce + 1
      );
      const thresholdTxSigs = [
        await safeSignTypedData(user2, safe, thresholdTx),
        await safeSignTypedData(user3, safe, thresholdTx),
      ];
      const thresholdTxPopulated = await populateExecuteTx(safe, thresholdTx, thresholdTxSigs)
      await exploitHandler.setNextTransaction(safe.address, thresholdTxPopulated.data!!)

      // Transaction should fail (invalid signatures should revert the Ethereum transaction)
      await expect(
        executeTx(safe, transferTx, transferTxSigs),
        "Transaction should fail if invalid signature is provided"
      ).to.be.reverted;
      expect(
        await hre.ethers.provider.getBalance(safe.address)
      ).to.be.deep.eq(parseEther("1"));

      await exploitHandler.resetNextTransaction()
      await executeTx(safe, transferTx, transferTxSigs);

      // Safe should be empty again
      await expect(
        await hre.ethers.provider.getBalance(safe.address)
      ).to.be.deep.eq(parseEther("0"));
      expect(
        await safe.getThreshold()
      ).to.be.eq(2);

      await exploitHandler.setNextTransaction(safe.address, thresholdTxPopulated.data!!)
      await exploitHandler.executeNextTransaction()

      expect(
        await safe.getThreshold()
      ).to.be.eq(1);
    });
  });
});
