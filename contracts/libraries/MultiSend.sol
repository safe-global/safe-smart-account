// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Multi Send
 * @notice Batch multiple transactions into one.
 * @author Nick Dodson - <nick.dodson@consensys.net>
 * @author Gonçalo Sá - <goncalo.sa@consensys.net>
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract MultiSend {
    /**
     * @dev The address of the {MultiSend} contract.
     */
    address private immutable MULTISEND_SINGLETON;

    constructor() {
        MULTISEND_SINGLETON = address(this);
    }

    /**
     * @notice Sends multiple transactions and reverts all if one fails.
     * @dev This method is payable as `DELEGATECALL`s keep the `msg.value` from the previous call.
     *      Otherwise, calling this method from {execTransaction} that receives native token would revert.
     * @param transactions Encoded transactions. Each transaction is encoded as a packed bytes of:
     *                     1. _operation_ as a {uint8}, 0 for a `CALL` or 1 for a `DELEGATECALL` (=> 1 byte),
     *                     2. _to_ as an {address} (=> 20 bytes),
     *                     3. _value_ as a {uint256} (=> 32 bytes),
     *                     4. _data_ length as a {uint256} (=> 32 bytes),
     *                     5. _data_ as {bytes}.
     *                     See {abi.encodePacked} for more information on packed encoding.
     */
    function multiSend(bytes memory transactions) public payable {
        require(address(this) != MULTISEND_SINGLETON, "MultiSend should only be called via delegatecall");
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
                case 1 {
                    success := delegatecall(gas(), to, data, dataLength, 0, 0)
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
