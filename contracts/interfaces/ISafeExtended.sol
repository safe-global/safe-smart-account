// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISafe} from "./ISafe.sol";

/**
 * @title ISafeExtended - An extended version of ISafe Interface with inherited functions.
 * @author @safe-global/safe-protocol
 */
interface ISafeExtended is ISafe {
    /**
     * @dev External getter function for inherited functions.
     */
    function getModulesPaginated(address start, uint256 pageSize) external view returns (address[] memory array, address next);
    function getThreshold() external view returns (uint256);
    function isOwner(address owner) external view returns (bool);
    function getOwners() external view returns (address[] memory);
    function setFallbackHandler(address handler) external;
    function setGuard(address guard) external;
}
