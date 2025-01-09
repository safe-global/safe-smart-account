// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title IProxy - Helper interface to access the singleton address of the Proxy on-chain.
 * @author Richard Meissner - @rmeissner
 */
interface IProxy {
    function masterCopy() external view returns (address);
}

/**
 * @title SafeProxy - Generic proxy contract allows to execute all transactions applying the code of a master contract.
 * @author Stefan George - <stefan@gnosis.io>
 * @author Richard Meissner - <richard@gnosis.io>
 */
contract SafeProxy {
    // Singleton always needs to be first declared variable, to ensure that it is at the same location in the contracts to which calls are delegated.
    // To reduce deployment costs this variable is internal and needs to be retrieved via `getStorageAt`
    address internal singleton;

    /**
     * @notice Constructor function sets address of singleton contract.
     * @param _singleton Singleton address.
     */
    constructor(address _singleton) {
        require(_singleton != address(0), "Invalid singleton address provided");
        singleton = _singleton;
    }

    /// @dev Fallback function forwards all transactions and returns all received return data.
    fallback() external payable {
        // Note that this assembly block is **intentionally** not marked as memory-safe. First of all, it isn't memory
        // safe to begin with, and turning this into memory-safe assembly would just make it less gas efficient.
        // Additionally, we noticed that converting this to memory-safe assembly had no affect on optimizations of other
        // contracts (as it always gets compiled alone in its own compilation unit anyway).
        /* solhint-disable no-inline-assembly */
        assembly {
            let _singleton := sload(0)
            // 0xa619486e == bytes4(keccak256("masterCopy()")). The value is right padded to 32-bytes with 0s
            if eq(calldataload(0), 0xa619486e00000000000000000000000000000000000000000000000000000000) {
                // We mask the singleton address when handling the `masterCopy()` call to ensure that it is correctly
                // ABI-encoded. We do this by shifting the address left by 96 bits (or 12 bytes) and then storing it in
                // memory with a 12 byte offset from where the return data starts. Note that we **intentionally** only
                // do this for the `masterCopy()` call, since the EVM `DELEGATECALL` opcode ignores the most-significant
                // 12 bytes from the address, so we do not need to make sure the top bytes are cleared when proxying
                // calls to the `singleton`. This saves us a tiny amount of gas per proxied call.
                mstore(0x0c, shl(96, _singleton))
                return(0, 0x20)
            }
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), _singleton, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            if iszero(success) {
                revert(0, returndatasize())
            }
            return(0, returndatasize())
        }
        /* solhint-enable no-inline-assembly */
    }
}
