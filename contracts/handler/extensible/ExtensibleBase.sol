// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "../../interfaces/ISafe.sol";
import {HandlerContext} from "../HandlerContext.sol";
import {MarshalLib} from "./MarshalLib.sol";

interface IFallbackMethod {
    function handle(ISafe safe, address sender, uint256 value, bytes calldata data) external returns (bytes memory result);
}

interface IStaticFallbackMethod {
    function handle(ISafe safe, address sender, uint256 value, bytes calldata data) external view returns (bytes memory result);
}

/**
 * @title Base contract for Extensible Fallback Handlers
 * @dev This contract provides the base for storage and modifiers for extensible fallback handlers
 * @author mfw78 <mfw78@rndlabs.xyz>
 */
abstract contract ExtensibleBase is HandlerContext {
    // --- events ---
    event AddedSafeMethod(ISafe indexed safe, bytes4 selector, bytes32 method);
    event ChangedSafeMethod(ISafe indexed safe, bytes4 selector, bytes32 oldMethod, bytes32 newMethod);
    event RemovedSafeMethod(ISafe indexed safe, bytes4 selector);

    // --- storage ---

    // A mapping of Safe => selector => method
    // The method is a bytes32 that is encoded as follows:
    // - The first byte is 0x00 if the method is static and 0x01 if the method is not static
    // - The last 20 bytes are the address of the handler contract
    // The method is encoded / decoded using the MarshalLib
    mapping(ISafe => mapping(bytes4 => bytes32)) public safeMethods;

    // --- modifiers ---
    modifier onlySelf() {
        // Use the `HandlerContext._msgSender()` to get the caller of the fallback function
        // Use the `HandlerContext._manager()` to get the manager, which should be the Safe
        // Require that the caller is the Safe itself
        require(_msgSender() == _manager(), "only safe can call this method");
        _;
    }

    // --- internal ---

    function _setSafeMethod(ISafe safe, bytes4 selector, bytes32 newMethod) internal {
        (, address newHandler) = MarshalLib.decode(newMethod);
        mapping(bytes4 => bytes32) storage safeMethod = safeMethods[safe];
        bytes32 oldMethod = safeMethod[selector];
        (, address oldHandler) = MarshalLib.decode(oldMethod);

        if (address(newHandler) == address(0) && address(oldHandler) != address(0)) {
            delete safeMethod[selector];
            emit RemovedSafeMethod(safe, selector);
        } else {
            safeMethod[selector] = newMethod;
            if (address(oldHandler) == address(0)) {
                emit AddedSafeMethod(safe, selector, newMethod);
            } else {
                emit ChangedSafeMethod(safe, selector, oldMethod, newMethod);
            }
        }
    }

    /**
     * Dry code to get the Safe and the original `msg.sender` from the FallbackManager
     * @return safe The safe whose FallbackManager is making this call
     * @return sender The original `msg.sender` (as received by the FallbackManager)
     */
    function _getContext() internal view returns (ISafe safe, address sender) {
        safe = ISafe(payable(_manager()));
        sender = _msgSender();
    }

    /**
     * Get the context and the method handler applicable to the current call
     * @return safe The safe whose FallbackManager is making this call
     * @return sender The original `msg.sender` (as received by the FallbackManager)
     * @return isStatic Whether the method is static (`view`) or not
     * @return handler the address of the handler contract
     */
    function _getContextAndHandler() internal view returns (ISafe safe, address sender, bool isStatic, address handler) {
        (safe, sender) = _getContext();
        (isStatic, handler) = MarshalLib.decode(safeMethods[safe][msg.sig]);
    }
}
