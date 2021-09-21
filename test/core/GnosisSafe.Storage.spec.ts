import { expect } from "chai";

import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getContractStorageLayout } from "../utils/storage";

describe("GnosisSafe", async () => {
  it("follows storage layout defined GnosisSafeStorage library", async () => {
    const gnosisSafeStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafeStorage"
    );
    const gnosisSafeMasterCopyStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafe"
    );

    expect(JSON.stringify(gnosisSafeMasterCopyStorageLayout)).to.include(
      JSON.stringify(gnosisSafeStorageLayout)
    );
  });
});
