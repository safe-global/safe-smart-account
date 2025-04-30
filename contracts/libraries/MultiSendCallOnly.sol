// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Multi Send Call Only
 * @notice Batch multiple transactions into one, but only `CALL`s.
 * @dev The guard logic is not required here as this contract doesn't support nested `DELEGATECALL`s.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract MultiSendCallOnly {
    /**
     * @notice Sends multiple transactions and reverts all if one fails.
     * @dev The code is for the most part the same as the normal {MultiSend} in order to keep compatibility,
     *      but reverts if a transaction tries to perform a `DELEGATECALL` operation.
     *      This method is payable as `DELEGATECALL`s keep the `msg.value` from the previous call.
     *      Otherwise, calling this method from {execTransaction} that receives native token would revert.
     * @param transactions Encoded transactions. Each transaction is encoded as a packed bytes of:
     *                     1. _operation_ as a `uint8(0)` for `CALL` (=> 1 byte),
     *                     2. _to_ as a {address} (=> 20 bytes),
     *                     3. _value_ as a {uint256} (=> 32 bytes),
     *                     4. _data_ length as a {uint256} (=> 32 bytes),
     *                     5. _data_ as {bytes}.
     *                     see {abi.encodePacked} for more information on packed encoding
     */
    function multiSend(bytes memory transactions) public payable {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            let length := mload(transactions)
            let i := 0x20
            for {
                // Pre block is not used in "while mode"
            } lt(i, length) {
                // Post block is not used in "while mode"
            } {
                // First byte of the data is the operation.
                // We shift by 248 bits (256 - 8 [operation byte]) right, since mload will always load 32 bytes (a word).
                // This will also zero out unused data.
                let operation := shr(0xf8, mload(add(transactions, i)))
                // We offset the load address by 1 byte (operation byte)
                // We shift it right by 96 bits (256 - 160 [20 address bytes]) to right-align the data and zero out unused data.
                let to := shr(0x60, mload(add(transactions, add(i, 0x01))))
                // Defaults `to` to `address(this)` if `address(0)` is provided.
                to := or(to, mul(iszero(to), address()))
                // We offset the load address by 21 byte (operation byte + 20 address bytes)
                let value := mload(add(transactions, add(i, 0x15)))
                // We offset the load address by 53 byte (operation byte + 20 address bytes + 32 value bytes)
                let dataLength := mload(add(transactions, add(i, 0x35)))
                // We offset the load address by 85 byte (operation byte + 20 address bytes + 32 value bytes + 32 data length bytes)
                let data := add(transactions, add(i, 0x55))
                let success := 0
                switch operation
                case 0 {
                    success := call(gas(), to, value, data, dataLength, 0, 0)
                }
                // This version does not allow delegatecalls
                case 1 {
                    revert(0, 0)
                }
                if iszero(success) {
                    let ptr := mload(0x40)
                    returndatacopy(ptr, 0, returndatasize())
                    revert(ptr, returndatasize())
                }
                // Next entry starts at 85 byte + data length
                i := add(i, add(0x55, dataLength))
            }
        }
        /* solhint-enable no-inline-assembly */
    }
}
