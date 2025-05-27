// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(address to, uint256 value, bytes memory data, uint8 operation) external returns (bool success);
}

/// @dev A Dummy 4337 Module/Handler for testing purposes
///      ⚠️ ⚠️ ⚠️ DO NOT USE IN PRODUCTION ⚠️ ⚠️ ⚠️
///      The module does not perform ANY validation, it just executes validateUserOp and execTransaction
///      to perform the opcode level compliance by the bundler.
contract Test4337ModuleAndHandler {
    address public immutable MY_ADDRESS;
    address public immutable ENTRYPOINT;

    address internal constant SENTINEL_MODULES = address(0x1);

    constructor(address entryPointAddress) {
        ENTRYPOINT = entryPointAddress;
        MY_ADDRESS = address(this);
    }

    function validateUserOp(UserOperation calldata userOp, bytes32, uint256 missingAccountFunds) external returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(ENTRYPOINT, missingAccountFunds, "", 0);
        }

        return 0;
    }

    function execTransaction(address to, uint256 value, bytes calldata data) external payable {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(safe.execTransactionFromModule(to, value, data, 0), "tx failed");
    }

    function enableMyself() public {
        ISafe(payable(address(this))).enableModule(MY_ADDRESS);
    }
}
