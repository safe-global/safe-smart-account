// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title GnosisSafeMath
 * @dev Math operations with safety checks that revert on error
 * Renamed from SafeMath to GnosisSafeMath to avoid conflicts
 * TODO: remove once open zeppelin update to solc 0.5.0
 */
library GnosisSafeMath {
  /**
  * @dev Returns the largest of two numbers.
  */
  function max(uint256 a, uint256 b) internal pure returns (uint256) {
    return a >= b ? a : b;
  }
}