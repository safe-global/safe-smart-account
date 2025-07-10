// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {Enum} from "./../libraries/Enum.sol";
import {IFallbackManager} from "./IFallbackManager.sol";
import {IGuardManager} from "./IGuardManager.sol";
import {IModuleManager} from "./IModuleManager.sol";
import {INativeCurrencyPaymentFallback} from "./INativeCurrencyPaymentFallback.sol";
import {IOwnerManager} from "./IOwnerManager.sol";
import {IStorageAccessible} from "./IStorageAccessible.sol";

/**
 * @title Safe Interface
 * @notice A multi-signature wallet with support for confirmations using signed messages based on EIP-712.
 * @dev This is a Solidity interface definition to the Safe account.
 * @author @safe-global/safe-protocol
 */
interface ISafe is INativeCurrencyPaymentFallback, IModuleManager, IGuardManager, IOwnerManager, IFallbackManager, IStorageAccessible {
    /**
     * @notice Safe setup event.
     * @param initiator Caller of the {setup} function.
     * @param owners The initial owners that the safe was set up with.
     * @param threshold The initial signature threshold.
     * @param initializer The address of the setup initializer contract.
     * @param fallbackHandler The address of the initial fallback handler configured for the Safe.
     */
    event SafeSetup(address indexed initiator, address[] owners, uint256 threshold, address initializer, address fallbackHandler);
    /**
     * @notice A transaction hash was approved by an owner.
     * @param approvedHash The hash that was approved.
     * @param owner The owner that approved it.
     */
    event ApproveHash(bytes32 indexed approvedHash, address indexed owner);
    /**
     * @notice A Safe message was signed.
     * @param msgHash The hash the message that was signed.
     */
    event SignMsg(bytes32 indexed msgHash);
    /**
     * @notice A Safe transaction reverted.
     * @dev This event is emitted when {execTransaction} is configured to not revert on failed execution.
     *      The Safe's nonce will increment and payment for the transaction will be processed.
     * @param txHash The Safe transaction hash.
     * @param payment The payment amount.
     */
    event ExecutionFailure(bytes32 indexed txHash, uint256 payment);
    /**
     * @notice A Safe transaction executed.
     * @param txHash The Safe transaction hash.
     * @param payment The payment amount.
     */
    event ExecutionSuccess(bytes32 indexed txHash, uint256 payment);

    /**
     * @notice Sets an initial storage of the Safe account.
     * @dev This method can only be called once.
     *      ⚠️⚠️⚠️ If a proxy was created without setting up, anyone can call setup and claim the proxy. ⚠️⚠️⚠️
     *      ⚠️⚠️⚠️ A Safe can set itself as an owner which is a valid setup for EIP-7702 delegations.
     *      However, if address of the accounts is not an EOA and cannot sign for itself, you can
     *      potentially block access to the account completely. For example, if you have a `n/n`
     *      Safe (so `threshold == ownerCount`) and one of the owners is the Safe itself and not
     *      an EIP-7702 delegated account, then it will not be possible to produce a valid
     *      signature for the Safe. ⚠️⚠️⚠️
     *      This method emits a {SafeSetup} event with the setup parameters instead of reading from storage,
     *      which may be inaccurate if the delegate call to `to` modifies the owners, threshold or fallback handler.
     * @param _owners Array of initial Safe owners.
     * @param _threshold Number of required confirmations for a Safe transaction.
     * @param to Optional initializer contract address. It will be `DELEGATECALL`-ed with `data`.
     *           Use the 0 address to not perform any additional initialization.
     * @param data Data payload for the `to` initializer contract.
     * @param fallbackHandler Handler for fallback calls to this contract.
     * @param paymentToken Token that should be used for the payment (0 for native token).
     * @param payment Value that should be paid.
     * @param paymentReceiver Address that should receive the payment (or 0 if `tx.origin`).
     */
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    /** @notice Executes a transaction with `operation` to the `to` address with a native token `value` with a `data` payload.
     *          Pays `gasPrice * gasLimit` in `gasToken` token to the `refundReceiver`.
     * @dev The fees are always transferred, even if the user transaction fails.
     *      This method doesn't perform any sanity check of the transaction, such as:
     *      - if the contract at `to` address has code or not
     *      - if the `gasToken` is a contract or not
     *      It is the responsibility of the caller to perform such checks.
     * @param to Destination address of Safe transaction.
     * @param value Native token value of the Safe transaction.
     * @param data Data payload of the Safe transaction.
     * @param operation Operation type of the Safe transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Base gas costs that are independent of the transaction execution (e.g. base transaction fee, signature check, payment of the refund).
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of the gas payment (or 0 for `tx.origin`).
     * @param signatures Packed signature data that should be verified.
     *                   Can be packed ECDSA signature `r:bytes32 || s:bytes32 || v:uint8`, contract signature (EIP-1271), or approved hash.
     * @return success Boolean indicating transaction's success.
     */
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);

    /**
     * @notice Checks whether the signature provided is valid for the provided data and hash and executor. Reverts otherwise.
     * @param executor Address that executes the transaction.
     *        ⚠️⚠️⚠️ Make sure that the executor address is a legitimate executor.
     *        Incorrectly passed the executor might reduce the threshold by 1 signature. ⚠️⚠️⚠️
     * @param dataHash Hash of the data (could be either a message hash or transaction hash).
     * @param signatures Packed signature data that should be verified.
     *                   Can be packed ECDSA signature `r:bytes32 || s:bytes32 || v:uint8`, contract signature (EIP-1271), or approved hash.
     */
    function checkSignatures(address executor, bytes32 dataHash, bytes memory signatures) external view;

    /**
     * @notice Checks whether the signature provided is valid for the provided data and hash. Reverts otherwise.
     * @dev Since the EIP-1271 does an external call, be mindful of reentrancy attacks.
     * @param executor Address that executes the transaction.
     *        ⚠️⚠️⚠️ Make sure that the executor address is a legitimate executor.
     *        Incorrectly passed the executor might reduce the threshold by 1 signature. ⚠️⚠️⚠️
     * @param dataHash Hash of the data (could be either a message hash or transaction hash).
     * @param signatures Packed signature data that should be verified.
     *                   Can be packed ECDSA signature `r:bytes32 || s:bytes32 || v:uint8`, contract signature (EIP-1271), or approved hash.
     * @param requiredSignatures Amount of required valid signatures.
     */
    function checkNSignatures(address executor, bytes32 dataHash, bytes memory signatures, uint256 requiredSignatures) external view;

    /**
     * @notice Marks hash `hashToApprove` as approved for `msg.sender`.
     * @dev This can be used with a pre-approved hash transaction signature.
     *      IMPORTANT: The approved hash stays approved forever. There's no revocation mechanism, so it behaves similarly to ECDSA signatures.
     * @param hashToApprove The hash to mark as approved for signatures that are verified by this contract.
     */
    function approveHash(bytes32 hashToApprove) external;

    /**
     * @dev Returns the domain separator for this contract, as defined in the EIP-712 standard.
     * @return The domain separator hash.
     */
    function domainSeparator() external view returns (bytes32);

    /**
     * @notice Returns transaction hash to be signed by owners.
     * @param to Destination address of Safe transaction.
     * @param value Native token value of the Safe transaction.
     * @param data Data payload of the Safe transaction.
     * @param operation Operation type of the Safe transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Base gas costs that are independent of the transaction execution (e.g. base transaction fee, signature check, payment of the refund).
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of the gas payment (or 0 for `tx.origin`).
     * @param _nonce Safe transaction nonce.
     * @return Safe transaction hash.
     */
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);

    /**
     * @notice Returns a descriptive version of the Safe contract.
     * @return The version string.
     */
    // solhint-disable-next-line func-name-mixedcase
    function VERSION() external view returns (string memory);

    /**
     * @notice Returns the nonce of the Safe contract.
     * @return The current nonce.
     */
    function nonce() external view returns (uint256);

    /**
     * @notice Returns a non-zero value if the `messageHash` is signed for the Safe.
     * @param messageHash The hash of message that should be checked.
     * @return An integer denoting whether or not the hash is signed for the Safe.
     *         A non-zero value indicates that the hash is signed.
     */
    function signedMessages(bytes32 messageHash) external view returns (uint256);

    /**
     * @notice Returns a non-zero value if the `messageHash` is approved by the `owner`.
     * @param owner The owner address that may have approved a hash.
     * @param messageHash The hash of message to check.
     * @return An integer denoting whether or not the hash is approved by the owner.
     *         A non-zero value indicates that the hash is approved.
     */
    function approvedHashes(address owner, bytes32 messageHash) external view returns (uint256);
}
