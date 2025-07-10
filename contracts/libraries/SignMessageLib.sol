// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "./../interfaces/ISafe.sol";
import {ERC712} from "./ERC712.sol";
import {SafeStorage} from "./SafeStorage.sol";

/**
 * @title SignMessageLib - Allows to sign messages on-chain by writing the signed message hashes on-chain.
 * @author Richard Meissner - @rmeissner
 */
contract SignMessageLib is SafeStorage {
    event SignMsg(bytes32 indexed msgHash);

    /**
     * @notice Marks a message (`_data`) as signed.
     * @dev Can be verified using EIP-1271 validation method by passing the pre-image of the message hash and empty bytes as the signature.
     * @param _data Arbitrary length data that should be marked as signed on the behalf of address(this).
     */
    function signMessage(bytes calldata _data) external {
        bytes32 msgHash = getMessageHash(_data);
        signedMessages[msgHash] = 1;
        emit SignMsg(msgHash);
    }

    /**
     * @dev Returns the hash of a message that can be signed by owners.
     * @param message Message that should be hashed.
     * @return Message hash.
     */
    function getMessageHash(bytes memory message) public view returns (bytes32) {
        ISafe safe = ISafe(payable(address(this)));
        return ERC712.getSafeMessageHash(safe.domainSeparator(), message);
    }
}
