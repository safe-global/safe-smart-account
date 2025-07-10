// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Proxy Interface
 * @notice Helper interface to access the singleton address of the Proxy on-chain.
 * @author Richard Meissner - @rmeissner
 */
interface IProxy {
    function masterCopy() external view returns (address);
}

/**
 * @title SafeProxy
 * @notice A generic proxy contract that allows the execution of all transactions by applying the code of a singleton contract.
 * @author Stefan George - <stefan@gnosis.io>
 * @author Richard Meissner - <richard@gnosis.io>
 */
contract SafeProxy {
    /**
     * @dev The singleton address to delegate all calls to.
     *      The singleton always needs to be first declared variable, in order to ensure that it is at the same location in the contracts to which calls are delegated.
     *      Its value can be retrieved via the {masterCopy} function.
     */
    address internal singleton;

    /**
     * @notice Safe proxy constructor.
     * @dev Sets the address of the singleton contract.
     * @param _singleton Singleton address.
     */
    constructor(address _singleton) {
        require(_singleton != address(0), "Invalid singleton address provided");
        singleton = _singleton;
    }

    /**
     * @notice Delegate all calls to the `singleton` implementation, and forward all return data to the caller.
     */
    fallback() external payable {
        // Note that this assembly block is **intentionally** not marked as memory-safe. First of all, it isn't memory
        // safe to begin with, and turning this into memory-safe assembly would just make it less gas efficient.
        // Additionally, we noticed that converting this to memory-safe assembly had no affect on optimizations of other
        // contracts (as it always gets compiled alone in its own compilation unit anyway). Because the assembly block
        // always halts and never returns control back to Solidity, disrespecting Solidity's memory safety invariants
        // is not an issue.
        /* solhint-disable no-inline-assembly */
        assembly {
            let _singleton := sload(0)
            // 0xa619486e == uint32(bytes4(keccak256("masterCopy()"))). Only the 4 first bytes of calldata are
            // considered to make it 100% Solidity ABI conformant.
            if eq(shr(224, calldataload(0)), 0xa619486e) {
                // We mask the singleton address when handling the `masterCopy()` call to ensure that it is correctly
                // ABI-encoded. We do this by shifting the address left by 96 bits (or 12 bytes) and then storing it in
                // memory with a 12 byte offset from where the return data starts. Note that we **intentionally** only
                // do this for the `masterCopy()` call, since the EVM `DELEGATECALL` opcode ignores the most-significant
                // 12 bytes from the address, so we do not need to make sure the top bytes are cleared when proxying
                // calls to the `singleton`. This saves us a tiny amount of gas per proxied call. Additionally, we write
                // to the "zero-memory" slot instead of the scratch space, which guarantees that 12 bytes of memory
                // preceding the singleton address are zero (which would not be guaranteed for the scratch space) [1].
                // This ensures that the data we return has the leading 12 bytes set to zero and conforms to the
                // Solidity ABI [2].
                //
                // [1]: https://docs.soliditylang.org/en/v0.7.6/internals/layout_in_memory.html
                // [2]: https://docs.soliditylang.org/en/v0.7.6/abi-spec.html#formal-specification-of-the-encoding
                mstore(0x6c, shl(96, _singleton))
                return(0x60, 0x20)
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
