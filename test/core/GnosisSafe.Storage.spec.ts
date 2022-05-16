import { expect } from "chai";
import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getContractStorageLayout } from "../utils/storage";

describe("GnosisSafe", async () => {
  it("follows storage layout defined by GnosisSafeStorage library", async () => {
    const gnosisSafeStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafeStorage"
    );
    const gnosisSafeSingletonStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafe"
    );
    
    // Chai doesn't have built-in matcher for deep object equality
    // For the sake of simplicity I decided just to convert the object to a string and compare the strings
    expect(
      JSON.stringify(gnosisSafeSingletonStorageLayout).startsWith(
        JSON.stringify(gnosisSafeStorageLayout)
      )
    ).to.be.true;
  });
});
