// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ErrorMessage} from "../libraries/ErrorMessage.sol";

/**
 * @title Self Authorized
 * @notice Authorizes current contract to perform actions on itself.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SelfAuthorized is ErrorMessage {
    /**
     * @dev Ensure that the `msg.sender` is the current contract.
     */
    function requireSelfCall() private view {
        if (msg.sender != address(this)) revertWithError("GS031");
    }

    /**
     * @notice Ensure that a function is authorized.
     * @dev This modifier authorizes calls by ensuring that the contract called itself.
     */
    modifier authorized() {
        // Modifiers are copied around during compilation. This is a function call to minimized the bytecode size.
        requireSelfCall();
        _;
    }
}
