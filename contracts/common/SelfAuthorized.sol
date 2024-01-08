// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ErrorMessage} from "../libraries/ErrorMessage.sol";

/**
 * @title SelfAuthorized - Authorizes current contract to perform actions to itself.
 * @author Richard Meissner - @rmeissner
 */
abstract contract SelfAuthorized is ErrorMessage {
    function requireSelfCall() private view {
        if (msg.sender != address(this)) revertWithError("GS031");
    }

    modifier authorized() {
        // Modifiers are copied around during compilation. This is a function call as it minimized the bytecode size
        requireSelfCall();
        _;
    }
}
