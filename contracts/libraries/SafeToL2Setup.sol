// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {SafeStorage} from "../libraries/SafeStorage.sol";

/**
 * @title Safe to L2 Setup Contract
 * @dev We made the L1 "default" because on average the L2 price per gas is ~1000x cheaper than L1, so defaulting to L1 and going to L2 is overall more efficient.
 * @notice This contract facilitates the deployment of a Safe to the same address on all networks by
 *         automatically changing the singleton to the L2 version when not on chain ID 1.
 */
contract SafeToL2Setup is SafeStorage {
    /**
     * @notice Address of the contract.
     * @dev This is used to ensure that the contract is only ever `DELEGATECALL`-ed.
     */
    address public immutable _SELF;

    /**
     * @notice Event indicating a change of singleton address.
     * @param singleton New singleton address
     */
    event ChangedSingleton(address singleton);

    /**
     * @notice Initializes a new {SafeToL2Setup} instance.
     */
    constructor() {
        _SELF = address(this);
    }

    /**
     * @notice Modifier ensure a function is only called via `DELEGATECALL`. Will revert otherwise.
     */
    modifier onlyDelegateCall() {
        require(address(this) != _SELF, "SafeToL2Setup should only be called via delegatecall");
        _;
    }

    /**
     * @notice Modifier to prevent using initialized Safes.
     */
    modifier onlyNonceZero() {
        require(nonce == 0, "Safe must have not executed any tx");
        _;
    }

    /**
     * @notice Modifier to ensure that the specified account is a contract.
     *
     */
    modifier onlyContract(address account) {
        require(_codeSize(account) != 0, "Account doesn't contain code");
        _;
    }

    /**
     * @notice Setup the Safe with the provided L2 singleton if needed.
     * @dev This function checks that the chain ID is not 1, and if it isn't updates the singleton
     *      to the provided L2 singleton.
     */
    function setupToL2(address l2Singleton) public onlyDelegateCall onlyNonceZero onlyContract(l2Singleton) {
        if (_chainId() != 1) {
            singleton = l2Singleton;
            emit ChangedSingleton(l2Singleton);
        }
    }

    /**
     * @notice Returns the current chain ID.
     */
    function _chainId() private view returns (uint256 result) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            result := chainid()
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice Returns the code size of the specified account.
     */
    function _codeSize(address account) internal view returns (uint256 result) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            result := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */
    }
}
