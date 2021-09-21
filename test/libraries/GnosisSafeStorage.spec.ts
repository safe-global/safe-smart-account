import { expect } from "chai";
import assert from "assert";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getSafeWithOwners } from "../utils/setup";
import { chainId } from "../utils/encoding";
import { getContractStorageLayout } from "./../utils/storage";
import { assert } from "console";

describe("GnosisSafeStorage", async () => {
  const [user1, user2] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const lib = await (
      await hre.ethers.getContractFactory("GnosisSafeStorage")
    ).deploy();
    return {
      safe: await getSafeWithOwners([user1.address, user2.address]),
      lib,
    };
  });

  it("uses the same layout as GnosisSafe mastercopy contract", async () => {
    const gnosisSafeStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafeStorage"
    );
    const gnosisSafeMasterCopyStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafe"
    );

    gnosisSafeStorageLayout.every((variable) =>
      assert.(
        variable,
        gnosisSafeMasterCopyStorageLayout.find(
          (masterCopyVar) => masterCopyVar.name === variable.name
        )
      )
    );
  });
});
