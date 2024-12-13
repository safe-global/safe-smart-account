// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe, IStaticFallbackMethod, IFallbackMethod, ExtensibleBase} from "./ExtensibleBase.sol";

interface IFallbackHandler {
    function setSafeMethod(bytes4 selector, bytes32 newMethod) external;
}

/**
 * @title FallbackHandler - A fully extensible fallback handler for Safes
 * @dev This contract provides a fallback handler for Safes that can be extended with custom fallback handlers
 *      for specific methods.
 * @author mfw78 <mfw78@rndlabs.xyz>
 */
abstract contract FallbackHandler is ExtensibleBase, IFallbackHandler {
    // --- setters ---

    /**
     * Setter for custom method handlers
     * @param selector The `bytes4` selector of the method to set the handler for
     * @param newMethod A contract that implements the `IFallbackMethod` or `IStaticFallbackMethod` interface
     */
    function setSafeMethod(bytes4 selector, bytes32 newMethod) public override onlySelf {
        _setSafeMethod(ISafe(payable(_msgSender())), selector, newMethod);
    }

    // --- fallback ---

    // solhint-disable-next-line
    fallback(bytes calldata) external returns (bytes memory result) {
        require(msg.data.length >= 24, "invalid method selector");
        (ISafe safe, address sender, bool isStatic, address handler) = _getContextAndHandler();
        require(handler != address(0), "method handler not set");

        if (isStatic) {
            result = IStaticFallbackMethod(handler).handle(safe, sender, 0, msg.data[:msg.data.length - 20]);
        } else {
            result = IFallbackMethod(handler).handle(safe, sender, 0, msg.data[:msg.data.length - 20]);
        }
    }
}
