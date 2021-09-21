import { expect } from "chai";
import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { getContractStorageLayout } from "../utils/storage";

const EXPECTED_LAYOUT = [
  { name: "singleton", slot: "0", offset: 0, type: "t_address" },
  {
    name: "modules",
    slot: "1",
    offset: 0,
    type: "t_mapping(t_address,t_address)",
  },
  {
    name: "owners",
    slot: "2",
    offset: 0,
    type: "t_mapping(t_address,t_address)",
  },
  { name: "ownerCount", slot: "3", offset: 0, type: "t_uint256" },
  { name: "threshold", slot: "4", offset: 0, type: "t_uint256" },
  { name: "nonce", slot: "5", offset: 0, type: "t_uint256" },
  {
    name: "_deprecatedDomainSeparator",
    slot: "6",
    offset: 0,
    type: "t_bytes32",
  },
  {
    name: "signedMessages",
    slot: "7",
    offset: 0,
    type: "t_mapping(t_bytes32,t_uint256)",
  },
  {
    name: "approvedHashes",
    slot: "8",
    offset: 0,
    type: "t_mapping(t_address,t_mapping(t_bytes32,t_uint256))",
  },
];

describe("GnosisSafeStorage", async () => {
  it("follows the expected storage layout", async () => {
    const gnosisSafeStorageLayout = await getContractStorageLayout(
      hre,
      "GnosisSafeStorage"
    );

    expect(gnosisSafeStorageLayout).to.deep.eq(EXPECTED_LAYOUT);
  });
});
