// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {IERC165} from "../../interfaces/IERC165.sol";
import {ISafe, MarshalLib, ExtensibleBase} from "./ExtensibleBase.sol";

interface IERC165Handler {
    function safeInterfaces(ISafe safe, bytes4 interfaceId) external view returns (bool);

    function setSupportedInterface(bytes4 interfaceId, bool supported) external;

    function addSupportedInterfaceBatch(bytes4 interfaceId, bytes32[] calldata handlerWithSelectors) external;

    function removeSupportedInterfaceBatch(bytes4 interfaceId, bytes4[] calldata selectors) external;
}

abstract contract ERC165Handler is ExtensibleBase, IERC165Handler {
    // --- events ---

    event AddedInterface(ISafe indexed safe, bytes4 interfaceId);
    event RemovedInterface(ISafe indexed safe, bytes4 interfaceId);

    // --- storage ---

    mapping(ISafe => mapping(bytes4 => bool)) public override safeInterfaces;

    // --- setters ---

    /**
     * Setter to indicate if an interface is supported (and thus reported by ERC165 supportsInterface)
     * @param interfaceId The interface id whose support is to be set
     * @param supported True if the interface is supported, false otherwise
     */
    function setSupportedInterface(bytes4 interfaceId, bool supported) public override onlySelf {
        ISafe safe = ISafe(payable(_manager()));
        // invalid interface id per ERC165 spec
        require(interfaceId != 0xffffffff, "invalid interface id");
        mapping(bytes4 => bool) storage safeInterface = safeInterfaces[safe];
        bool current = safeInterface[interfaceId];
        if (supported != current) {
            safeInterface[interfaceId] = supported;
            if (supported) {
                emit AddedInterface(safe, interfaceId);
            } else {
                emit RemovedInterface(safe, interfaceId);
            }
        }
    }

    /**
     * Batch add selectors for an interface.
     * @param _interfaceId The interface id to set
     * @param handlerWithSelectors The handlers encoded with the 4-byte selectors of the methods
     */
    function addSupportedInterfaceBatch(bytes4 _interfaceId, bytes32[] calldata handlerWithSelectors) external override onlySelf {
        ISafe safe = ISafe(payable(_msgSender()));
        bytes4 interfaceId;
        uint256 len = handlerWithSelectors.length;
        for (uint256 i = 0; i < len; ++i) {
            (bool isStatic, bytes4 selector, address handlerAddress) = MarshalLib.decodeWithSelector(handlerWithSelectors[i]);
            _setSafeMethod(safe, selector, MarshalLib.encode(isStatic, handlerAddress));
            if (i > 0) {
                interfaceId ^= selector;
            } else {
                interfaceId = selector;
            }
        }

        require(interfaceId == _interfaceId, "interface id mismatch");
        setSupportedInterface(_interfaceId, true);
    }

    /**
     * Batch remove selectors for an interface.
     * @param _interfaceId the interface id to remove
     * @param selectors The selectors of the methods to remove
     */
    function removeSupportedInterfaceBatch(bytes4 _interfaceId, bytes4[] calldata selectors) external override onlySelf {
        ISafe safe = ISafe(payable(_msgSender()));
        bytes4 interfaceId;
        uint256 len = selectors.length;
        for (uint256 i = 0; i < len; ++i) {
            _setSafeMethod(safe, selectors[i], bytes32(0));
            if (i > 0) {
                interfaceId ^= selectors[i];
            } else {
                interfaceId = selectors[i];
            }
        }

        require(interfaceId == _interfaceId, "interface id mismatch");
        setSupportedInterface(_interfaceId, false);
    }

    /**
     * @notice Implements ERC165 interface detection for the supported interfaces
     * @dev Inheriting contracts should override `_supportsInterface` to add support for additional interfaces
     * @param interfaceId The ERC165 interface id to check
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC165Handler).interfaceId ||
            _supportsInterface(interfaceId) ||
            safeInterfaces[ISafe(payable(_manager()))][interfaceId];
    }

    // --- internal ---

    /**
     * A stub function to be overridden by inheriting contracts to add support for additional interfaces
     * @param interfaceId The interface id to check support for
     * @return True if the interface is supported
     */
    function _supportsInterface(bytes4 interfaceId) internal view virtual returns (bool);
}
