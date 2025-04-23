// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Executor, Enum} from "../base/Executor.sol";

/**
 * @title Simulate Transaction Accessor
 * @notice Can be used with {StorageAccessible} to simulate Safe transactions.
 * @author Richard Meissner - @rmeissner
 */
contract SimulateTxAccessor is Executor {
    /**
     * @dev The address of the {SimulateTxAccessor} contract.
     */
    address private immutable ACCESSOR_SINGLETON;

    constructor() {
        ACCESSOR_SINGLETON = address(this);
    }

    /**
     * @notice Modifier to make a function callable via `DELEGATECALL` only.
     *         If the function is called via a regular call, it will revert.
     */
    modifier onlyDelegateCall() {
        require(address(this) != ACCESSOR_SINGLETON, "SimulateTxAccessor should only be called via delegatecall");
        _;
    }

    /**
     * @notice Simulates a Safe transaction and returns the used gas, success boolean and the return data.
     * @dev Executes the specified operation and returns the data from the call.
     *      This function must be called to be called via `DELEGATCALL`.
     *      This returns the data equal to `abi.encode(uint256(estimate), bool(success), bytes(returnData))`.
     *      Specifically, the return data will be: `estimate:uint256 || success:bool || returnData.length:uint256 || returnData:bytes`.
     * @param to Destination address.
     * @param value Native token value.
     * @param data Data payload.
     * @param operation Operation type (0 for `CALL`, 1 for `DELEGATECALL`).
     * @return estimate Gas used.
     * @return success Success boolean value.
     * @return returnData Return data.
     */
    function simulate(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external onlyDelegateCall returns (uint256 estimate, bool success, bytes memory returnData) {
        uint256 startGas = gasleft();
        success = execute(to, value, data, operation, gasleft());
        estimate = startGas - gasleft();
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Load free memory location.
            let ptr := mload(0x40)
            // We allocate memory for the return data by setting the free memory location to
            // current free memory location `ptr`, plus the size of the return data and an
            // addition 32 bytes for the return data length.
            mstore(0x40, add(ptr, add(returndatasize(), 0x20)))
            // Store the size.
            mstore(ptr, returndatasize())
            // Store the data.
            returndatacopy(add(ptr, 0x20), 0, returndatasize())
            // Point the return data to the correct memory location.
            returnData := ptr
        }
        /* solhint-enable no-inline-assembly */
    }
}
