import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AddressZero } from "@ethersproject/constants";
import { getSafeWithOwners } from "../utils/setup";
import {
  buildContractCall,
  executeContractCallWithSigners,
} from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";

describe("ScopeTransactionGuard", async () => {
  const [user1] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const safe = await getSafeWithOwners([user1.address]);
    const guardFactory = await hre.ethers.getContractFactory(
      "ScopeTransactionGuard"
    );
    const guard = await guardFactory.deploy();
    await guard.allowTarget(guard.address);
    await guard.allowFunction(
      guard.address,
      guard.interface.getSighash("allowTarget")
    );
    await executeContractCallWithSigners(
      safe,
      safe,
      "enableModule",
      [user1.address],
      [user1]
    );
    await executeContractCallWithSigners(
      safe,
      safe,
      "setGuard",
      [guard.address],
      [user1]
    );
    return {
      safe,
      guardFactory,
      guard,
    };
  });

  describe("fallback", async () => {
    it("must NOT revert on fallback without value", async () => {
      const { guard } = await setupTests();
      await user1.sendTransaction({
        to: guard.address,
        data: "0xbaddad",
      });
    });
    it("should revert on fallback with value", async () => {
      const { guard } = await setupTests();
      await expect(
        user1.sendTransaction({
          to: guard.address,
          data: "0xbaddad",
          value: 1,
        })
      ).to.be.reverted;
    });
  });

  describe("checkTransaction", async () => {
    it("should revert delegate call if delegate calls are not allowed to target", async () => {
      const { safe, guard } = await setupTests();
      const tx = buildContractCall(safe, "setGuard", [AddressZero], 0, true);
      await expect(
        guard.checkTransaction(
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
          tx.safeTxGas,
          tx.baseGas,
          tx.gasPrice,
          tx.gasToken,
          tx.refundReceiver,
          "0x",
          user1.address
        )
      ).to.be.revertedWith("Delegate call not allowed to this address");
    });

    it("should revert on delegate call via Safe if delegate calls are not allowed to target", async () => {
      const { safe } = await setupTests();
      await expect(
        executeContractCallWithSigners(
          safe,
          safe,
          "setGuard",
          [AddressZero],
          [user1],
          true
        )
      ).to.be.revertedWith("Delegate call not allowed to this address");
    });

    it("should allow delegate call via Safe if delegate calls are allowed to target", async () => {
      const { safe, guard } = await setupTests();
      await guard.allowTarget(safe.address);
      await guard.allowDelegateCall(safe.address);
      await expect(
        executeContractCallWithSigners(
          safe,
          safe,
          "setGuard",
          [AddressZero],
          [user1],
          true
        )
      );
    });

    it("can allow target with safe", async () => {
      const { safe, guard } = await setupTests();
      await guard.setScope(guard.address, true);
      await guard.transferOwnership(safe.address);
      await expect(
        executeContractCallWithSigners(
          safe,
          guard,
          "allowTarget",
          [AddressZero],
          [user1]
        )
      );
    });
  });
});
