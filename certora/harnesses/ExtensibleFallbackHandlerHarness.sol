// SPDX-License-Identifier: LGPL-3.0-only
import "../munged/handler/ExtensibleFallbackHandler.sol";
import {ISafe} from "../munged/interfaces/ISafe.sol";

contract ExtensibleFallbackHandlerHarness is ExtensibleFallbackHandler {

    function getSafeMethod(ISafe safe, bytes4 selector) public view returns (bytes32) {
        return safeMethods[safe][selector];
    }

}