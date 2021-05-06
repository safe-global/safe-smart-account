// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title Handler Context - allows to extract calling context
/// @author Richard Meissner - <richard@gnosis.pm>
/// @notice based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/f8cc8b844a9f92f63dc55aa581f7d643a1bc5ac1/contracts/metatx/ERC2771Context.sol
contract HandlerContext {
    // This function does not rely on a trusted forwarder. Use the returned value only to check information against the calling manager.
    /// @notice This is only reliable in combination with a FallbackManager that supports this (e.g. Safe contract >=1.3.0).
    ///         When using this functionality make sure that the linked _manager (aka msg.sender) supports this.
    function _msgSender() internal pure returns (address sender) {
        // The assembly code is more direct than the Solidity version using `abi.decode`.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sender := shr(96, calldataload(sub(calldatasize(), 20)))
        }
    }

    // Function do differentiate more clearly between msg.sender and the calling manager
    function _manager() internal view returns (address) {
        return msg.sender;
    }
}
