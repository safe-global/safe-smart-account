// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "./GnosisSafeStorage.sol";
import "../GnosisSafe.sol";

/// @title SignMessageLib - Allows to set an entry in the signedMessages
/// @author Richard Meissner - <richard@gnosis.io>
contract SignMessageLib is GnosisSafeStorage {
    //keccak256(
    //    "SafeMessage(bytes message)"
    //);
    bytes32 private constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;

    event SignMsg(bytes32 indexed msgHash);

    /// @dev Marks a message as signed, so that it can be used with EIP-1271
    /// @notice Marks a message (`_data`) as signed.
    /// @param _data Arbitrary length data that should be marked as signed on the behalf of address(this)
    function signMessage(bytes calldata _data) external {
        bytes32 msgHash = getMessageHash(_data);
        signedMessages[msgHash] = 1;
        emit SignMsg(msgHash);
    }

    /// @dev Returns hash of a message that can be signed by owners.
    /// @param message Message that should be hashed
    /// @return Message hash.
    function getMessageHash(bytes memory message) public view returns (bytes32) {
        bytes32 safeMessageHash = keccak256(abi.encode(SAFE_MSG_TYPEHASH, keccak256(message)));
        return
            keccak256(abi.encodePacked(bytes1(0x19), bytes1(0x01), GnosisSafe(payable(address(this))).domainSeparator(), safeMessageHash));
    }
}
