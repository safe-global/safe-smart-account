// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Multi Send Call Only - Allows to batch multiple transactions into one, but only calls
 * @notice The guard logic is not required here as this contract doesn't support nested delegate calls
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract MultiSendCallOnly {
    /**
     * @dev The address of the {MultiSendCallOnly} contract.
     */
    address private immutable MULTISEND_SINGLETON;

    constructor() {
        MULTISEND_SINGLETON = address(this);
    }

    /**
     * @dev Sends multiple transactions and reverts all if one fails.
     * @param transactions Encoded transactions. Each transaction is encoded as a packed bytes of
     *                     operation has to be uint8(0) in this version (=> 1 byte),
     *                     to as a address (=> 20 bytes),
     *                     value as a uint256 (=> 32 bytes),
     *                     data length as a uint256 (=> 32 bytes),
     *                     data as bytes.
     *                     see abi.encodePacked for more information on packed encoding
     * @notice The code is for the most part the same as the normal MultiSend (to keep compatibility),
     *         but reverts if a transaction tries to use a delegatecall.
     * @notice This method is payable as delegatecalls keep the msg.value from the previous call
     *         If the calling method (e.g. execTransaction) received ETH this would revert otherwise
     */
    function multiSend(bytes memory transactions) public payable {
        // Keep track of the unused balance that was included in the call. This may seem counter-
        // inuitive compared to tracking the total used balance, but it prevents an edge case with
        // multiple transactions where:
        // - caller sends value `x`
        // - `n` times, a meta transaction is executed to a contract that:
        //   - receives the value `x`
        //   - sends back the value `x` through non-calling mechanisms (`SELFDESTRUCT` or a
        //     potential future `PAY`)
        // If we were to track the total used balance, it  would be possible this way (however
        // implausible) for `n * x` to overflow a `uint256`.
        //
        // Additionally, just checking `address(this).balance` isn't sound, as it would allow
        // malicious actors to front-run transactions to the `MultiSendCallOnly` and increase the
        // multiSend contract balance through non-calling mechanisms and cause unrelated
        // transactions to revert.
        uint256 unusedValue = msg.value;

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
                // We shift by 248 bits (256 - 8 [operation byte]) it right since mload will always load 32 bytes (a word).
                // This will also zero out unused data.
                let operation := shr(0xf8, mload(add(transactions, i)))
                // We offset the load address by 1 byte (operation byte)
                // We shift it right by 96 bits (256 - 160 [20 address bytes]) to right-align the data and zero out unused data.
                let to := shr(0x60, mload(add(transactions, add(i, 0x01))))
                // Defaults `to` to `address(this)` if `address(0)` is provided.
                to := or(to, mul(iszero(to), address()))
                // We offset the load address by 21 byte (operation byte + 20 address bytes)
                let value := mload(add(transactions, add(i, 0x15)))
                // Record the used value; we use saturating subtraction to allow for native tokens
                // that are stuck in the contract to be transferred out. We use some cheeky
                // branchless math for maximum gas efficiency:
                // - if `unusedValue > value`, then this will compute the difference that we want:
                //   `1 * (unusedValue - value) = unusedValue - value`
                // - if `unusedValue <= value, then this will saturate to `0` as we want:
                //   `0 * unchecked { unusedValue - value } = 0`
                unusedValue := mul(gt(unusedValue, value), sub(unusedValue, value))
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

        require(address(this) != MULTISEND_SINGLETON || unusedValue == 0, "MultiSend has leftover balance");
    }
}
