// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Storage Accessible Interface
 * @author @safe-global/safe-protocol
 */
interface IStorageAccessible {
    /**
     * @notice Reads `length` bytes of storage in the current contract
     * @param offset The offset in the current contract's storage in words to start reading from.
     * @param length The number of words (32 bytes) of data to read.
     * @return The bytes that were read.
     */
    function getStorageAt(uint256 offset, uint256 length) external view returns (bytes memory);

    /**
     * @notice Performs a `DELEGATECALL` to a `targetContract` in the context of self.
     * @dev Internally reverts execution to avoid side effects (making it effectively static).
     *      This method reverts with data equal to `abi.encodePacked(uint256(success), uint256(response.length), bytes(response))`.
     *      Specifically, the return data after a call to this method will be:
     *      `success:uint256 || response.length:uint256 || response:bytes`.
     * @param targetContract Address of the contract containing the code to execute.
     * @param calldataPayload Calldata that should be sent to the target contract (encoded method name and arguments).
     */
    function simulateAndRevert(address targetContract, bytes memory calldataPayload) external;
}
