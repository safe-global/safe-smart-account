// SPDX-License-Identifier: LGPL-3.0-only

pragma solidity >=0.7.0 <0.9.0;

// Import the contract so hardhat compiles it, and we have the ABI available
// solhint-disable no-unused-import
import {UpgradeableProxy} from "@openzeppelin/contracts/proxy/UpgradeableProxy.sol";
import {MockContract} from "@safe-global/mock-contract/contracts/MockContract.sol";
