// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title SecuredTokenTransfer - Secure token transfer.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SecuredTokenTransfer {
    /**
     * @notice Transfers a token and returns a boolean if it was a success
     * @dev It checks the return data of the transfer call and returns true if the transfer was successful.
     *      It doesn't check if the `token` address is a contract or not.
     * @param token Token that should be transferred
     * @param receiver Receiver to whom the token should be transferred
     * @param amount The amount of tokens that should be transferred
     * @return transferred Returns true if the transfer was successful
     */
    function transferToken(address token, address receiver, uint256 amount) internal returns (bool transferred) {
        // 0xa9059cbb - bytes4(keccak256("transfer(address,uint256)"))
        bytes memory data = abi.encodeWithSelector(0xa9059cbb, receiver, amount);
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // We write the return value to scratch space.
            // See https://docs.soliditylang.org/en/v0.7.6/internals/layout_in_memory.html#layout-in-memory
            let success := call(sub(gas(), 10000), token, 0, add(data, 0x20), mload(data), 0, 0x20)
            switch returndatasize()
            case 0 {
                transferred := success
            }
            case 0x20 {
                transferred := iszero(or(iszero(success), iszero(mload(0))))
            }
            default {
                transferred := 0
            }
        }
        /* solhint-enable no-inline-assembly */
    }
}
