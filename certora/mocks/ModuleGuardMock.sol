// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;
import {IModuleGuard} from "../munged/base/ModuleManager.sol";
import {IERC165} from "../munged/interfaces/IERC165.sol";
import "../munged/libraries/Enum.sol";

contract ModuleGuardMock is IModuleGuard {

    constructor(){
        preCheckedTransactions = false ;
        postCheckedTransactions = false ;
    }

    // some mock variables 
    bool public preCheckedTransactions ;
    bool public postCheckedTransactions ;

    function resetChecks() external {
        preCheckedTransactions = false ;
        postCheckedTransactions = false ;
    }

    /**
     * @notice Checks the module transaction details.
     * @dev The function needs to implement module transaction validation logic.
     * @param to The address to which the transaction is intended.
     * @param value The value of the transaction in Wei.
     * @param data The transaction data.
     * @param operation The type of operation of the module transaction.
     * @param module The module involved in the transaction.
     * @return moduleTxHash The hash of the module transaction.
     */
    function checkModuleTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        address module
    ) external override returns (bytes32 moduleTxHash) {
        // updates transaction checked
        preCheckedTransactions = true ;
        // if it passes, it returns a string of bytes
        return bytes32(0);
    }

    /**
     * @notice Checks after execution of module transaction.
     * @dev The function needs to implement a check after the execution of the module transaction.
     * @param txHash The hash of the module transaction.
     * @param success The status of the module transaction execution.
     */
    function checkAfterModuleExecution(bytes32 txHash, bool success) external override {
        postCheckedTransactions = true;
    }

    /**
     * @dev Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding EIP section
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(IModuleGuard).interfaceId || // 0x58401ed8
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }

}