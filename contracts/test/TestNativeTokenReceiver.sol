// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/// @title TestNativeTokenReceiver
/// @dev This contract emits an event with sender, value, and remaining gas details whenever it receives Ether.
contract TestNativeTokenReceiver {
    /// @dev Emitted when the contract receives Ether.
    /// @param from The address of the sender.
    /// @param amount The amount of Ether received, in wei.
    /// @param forwardedGas The remaining gas at the time of transaction.
    event BreadReceived(address indexed from, uint256 amount, uint256 forwardedGas);

    /// @dev Fallback function that is called when the contract receives Ether.
    /// Emits the BreadReceived event with the sender's address, the amount of Ether sent, and the remaining gas.
    fallback() external payable {
        emit BreadReceived(msg.sender, msg.value, gasleft());
    }
}
