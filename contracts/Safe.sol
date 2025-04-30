// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {FallbackManager} from "./base/FallbackManager.sol";
import {ITransactionGuard, GuardManager} from "./base/GuardManager.sol";
import {ModuleManager} from "./base/ModuleManager.sol";
import {OwnerManager} from "./base/OwnerManager.sol";
import {NativeCurrencyPaymentFallback} from "./common/NativeCurrencyPaymentFallback.sol";
import {SecuredTokenTransfer} from "./common/SecuredTokenTransfer.sol";
import {SignatureDecoder} from "./common/SignatureDecoder.sol";
import {Singleton} from "./common/Singleton.sol";
import {StorageAccessible} from "./common/StorageAccessible.sol";
import {SafeMath} from "./external/SafeMath.sol";
import {ISafe} from "./interfaces/ISafe.sol";
import {ISignatureValidator, ISignatureValidatorConstants} from "./interfaces/ISignatureValidator.sol";
import {Enum} from "./libraries/Enum.sol";

/**
 * @title Safe
 * @notice A multi-signature wallet with support for confirmations using signed messages based on EIP-712.
 * @dev Most important concepts:
 *      - Threshold: Number of required confirmations for a Safe transaction.
 *      - Owners: List of addresses that control the Safe. They are the only ones that can add/remove owners, change the threshold and
 *        approve transactions. Managed in `OwnerManager`.
 *      - Transaction Hash: Hash of a transaction is calculated using the EIP-712 typed structured data hashing scheme.
 *      - Nonce: Each transaction should have a different nonce to prevent replay attacks.
 *      - Signature: A valid signature of an owner of the Safe for a transaction hash.
 *      - Guards: Guards are contracts that can execute pre- and post- transaction checks. There are two types of guards:
 *          1. Transaction Guard: managed in `GuardManager` for transactions executed with `execTransaction`.
 *          2. Module Guard: managed in `ModuleManager` for transactions executed with `execTransactionFromModule`
 *      - Modules: Modules are contracts that can be used to extend the write functionality of a Safe. Managed in `ModuleManager`.
 *      - Fallback: Fallback handler is a contract that can provide additional functionality for Safe. Managed in `FallbackManager`. Please read the security risks in the `IFallbackManager` interface.
 *      Note: This version of the implementation contract doesn't emit events for the sake of gas efficiency and therefore requires a tracing node for indexing/
 *      For the events-based implementation see `SafeL2.sol`.
 * @author Stefan George - @Georgi87
 * @author Richard Meissner - @rmeissner
 */
contract Safe is
    Singleton,
    NativeCurrencyPaymentFallback,
    ModuleManager,
    GuardManager,
    OwnerManager,
    SignatureDecoder,
    SecuredTokenTransfer,
    ISignatureValidatorConstants,
    FallbackManager,
    StorageAccessible,
    ISafe
{
    using SafeMath for uint256;

    /**
     * @inheritdoc ISafe
     */
    string public constant override VERSION = "1.5.0";

    /**
     * @dev The precomputed EIP-712 domain separator hash for Safe typed data hashing and signing.
     *      Precomputed value of: `keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")`.
     */
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;

    /**
     * @dev The precomputed EIP-712 type hash for the Safe transaction type.
     *      Precomputed value of: `keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)")`.
     */
    bytes32 private constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

    /**
     * @inheritdoc ISafe
     */
    uint256 public override nonce;

    /**
     * @dev Deprecated precomputed domain separator.
     *      It is no longer in use but remains declared for storage layout compatibility across Safe versions.
     */
    bytes32 private _deprecatedDomainSeparator;

    /**
     * @inheritdoc ISafe
     * @dev Mapping to keep track of all message hashes that have been approved by ALL REQUIRED owners.
     */
    mapping(bytes32 => uint256) public override signedMessages;

    /**
     * @inheritdoc ISafe
     * @dev Mapping to keep track of all hashes (message or transaction) that have been approved by ANY owners.
     */
    mapping(address => mapping(bytes32 => uint256)) public override approvedHashes;

    /**
     * @notice Safe singleton constructor.
     * @dev This constructor implementation ensures that this contract can only be used as a singleton for proxy contracts.
     */
    constructor() {
        // By setting the threshold it is not possible to call setup anymore, so we create a Safe with 0 owners and threshold 1.
        // This is an unusable Safe, perfect for the singleton
        threshold = 1;
    }

    /**
     * @inheritdoc ISafe
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
    ) external override {
        // Emit the setup event optimistically. This ensures that changes such as `addOwner` and `changeThreshold` that are part
        // of the  `to.delegatecall(data)` that happen in the `setupModules` call emit events in order relative to the setup
        // event, making it easier for off-chain indexers to reliably reconstruct the Safe configuration.
        emit SafeSetup(msg.sender, _owners, _threshold, to, fallbackHandler);

        // `setupOwners` checks if the `threshold` is already set, therefore preventing this method from being called more than once.
        setupOwners(_owners, _threshold);
        if (fallbackHandler != address(0)) internalSetFallbackHandler(fallbackHandler);
        // As `setupOwners` can only be called if the contract has not been initialized we don't need a check for `setupModules`.
        setupModules(to, data);

        if (payment > 0) {
            // To avoid running into issues with EIP-170 we reuse the `handlePayment` function (to avoid adjusting code that has been verified we do not adjust the method itself):
            // `baseGas = 0`, `gasPrice = 1` and `gas = payment`, therefore: `amount = (payment + 0) * 1 = payment`.
            handlePayment(payment, 0, 1, paymentToken, paymentReceiver);
        }
    }

    /**
     * @inheritdoc ISafe
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
    ) external payable override returns (bool success) {
        onBeforeExecTransaction(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);
        bytes32 txHash;
        // Use scope here to limit variable lifetime and prevent "stack too deep" errors.
        {
            txHash = getTransactionHash(
                // Transaction info:
                to,
                value,
                data,
                operation,
                safeTxGas,
                // Payment info:
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                // We use the post-increment here, so the current `nonce` value is used and incremented afterwards.
                nonce++
            );
            checkSignatures(msg.sender, txHash, signatures);
        }
        address guard = getGuard();
        {
            if (guard != address(0)) {
                ITransactionGuard(guard).checkTransaction(
                    // Transaction info:
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    // Payment info:
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    // Signature info:
                    signatures,
                    msg.sender
                );
            }
        }

        // We require some gas to emit the events (at least 2500) after the execution and some to perform code until the execution (500).
        // We also include the 1/64 in the check that is not sent along with a call to counteract potential shortings because of EIP-150.
        // We use `<< 6` instead of `* 64` as the `SHL` opcode only uses 3 gas, while the equivalent `MUL` opcode uses 5 gas.
        if (gasleft() < ((safeTxGas << 6) / 63).max(safeTxGas + 2500) + 500) revertWithError("GS010");
        // Use scope here to limit variable lifetime and prevent "stack too deep" errors.
        {
            uint256 gasUsed = gasleft();
            // If the `gasPrice` is 0 we assume that nearly all available gas can be used (it is always more than `safeTxGas`).
            // We only subtract 2500 (compared to the 3000 before) to ensure that the amount passed is still higher than `safeTxGas`.
            success = execute(to, value, data, operation, gasPrice == 0 ? (gasleft() - 2500) : safeTxGas);
            gasUsed = gasUsed.sub(gasleft());
            // If no `safeTxGas` and no `gasPrice` was set (i.e. both are 0), then the internal transaction must be successful.
            // This makes it possible to use `estimateGas` without issues, as it searches for the minimum gas where the transaction doesn't revert.
            if (!success && safeTxGas == 0 && gasPrice == 0) {
                /* solhint-disable no-inline-assembly */
                /// @solidity memory-safe-assembly
                assembly {
                    let ptr := mload(0x40)
                    returndatacopy(ptr, 0, returndatasize())
                    revert(ptr, returndatasize())
                }
                /* solhint-enable no-inline-assembly */
            }
            // We transfer the calculated transaction costs to the `tx.origin` to avoid sending it to intermediate contracts that have made calls.
            uint256 payment = 0;
            if (gasPrice > 0) {
                payment = handlePayment(gasUsed, baseGas, gasPrice, gasToken, refundReceiver);
            }
            if (success) emit ExecutionSuccess(txHash, payment);
            else emit ExecutionFailure(txHash, payment);
        }
        {
            if (guard != address(0)) {
                ITransactionGuard(guard).checkAfterExecution(txHash, success);
            }
        }
    }

    /**
     * @notice Handles the payment for a Safe transaction.
     * @param gasUsed Gas used by the Safe transaction.
     * @param baseGas Gas costs that are independent of the transaction execution (e.g. base transaction fee, signature check, payment of the refund).
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of the gas payment (or 0 for `tx.origin`).
     * @return payment The amount of payment made in the specified token.
     */
    function handlePayment(
        uint256 gasUsed,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver
    ) private returns (uint256 payment) {
        // solhint-disable-next-line avoid-tx-origin
        address payable receiver = refundReceiver == address(0) ? payable(tx.origin) : refundReceiver;
        if (gasToken == address(0)) {
            // For native tokens, we will only adjust the gas price to not be higher than the actually used gas price.
            payment = gasUsed.add(baseGas).mul(gasPrice < tx.gasprice ? gasPrice : tx.gasprice);
            (bool refundSuccess, ) = receiver.call{value: payment}("");
            if (!refundSuccess) revertWithError("GS011");
        } else {
            payment = gasUsed.add(baseGas).mul(gasPrice);
            if (!transferToken(gasToken, receiver, payment)) revertWithError("GS012");
        }
    }

    /**
     * @notice Checks whether the contract signature is valid. Reverts otherwise.
     * @dev This is extracted to a separate function for better compatibility with Certora's prover.
     *      More info here: <https://github.com/safe-global/safe-smart-account/pull/661>
     * @param owner Address of the owner used to sign the message.
     * @param dataHash Hash of the data (could be either a message hash or transaction hash).
     * @param signatures Signatures that are being verified.
     * @param offset Offset to the start of the contract signature in the {signatures} byte array.
     */
    function checkContractSignature(address owner, bytes32 dataHash, bytes memory signatures, uint256 offset) internal view {
        // Check that signature data pointer (`s`) is in bounds to read the 32-byte data length value in `signatures`.
        if (offset.add(32) > signatures.length) revertWithError("GS022");

        // Check if the contract signature is in bounds: start of data is `s + 32` and the end is `start + signatures.length`.
        uint256 contractSignatureLen;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            contractSignatureLen := mload(add(add(signatures, offset), 0x20))
        }
        /* solhint-enable no-inline-assembly */
        if (offset.add(32).add(contractSignatureLen) > signatures.length) revertWithError("GS023");

        // Check signature.
        bytes memory contractSignature;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // The signature data for the contract is appended to the concatenated signatures and the offset is stored in `s`.
            // We already checked that it is within bounds and do not need to worry about arithmetic overflows.
            contractSignature := add(add(signatures, offset), 0x20)
        }
        /* solhint-enable no-inline-assembly */

        if (ISignatureValidator(owner).isValidSignature(dataHash, contractSignature) != EIP1271_MAGIC_VALUE) revertWithError("GS024");
    }

    /**
     * @inheritdoc ISafe
     */
    function checkSignatures(address executor, bytes32 dataHash, bytes memory signatures) public view override {
        // Load threshold to avoid multiple storage loads.
        uint256 _threshold = threshold;
        // Check that a threshold is set.
        if (_threshold == 0) revertWithError("GS001");
        checkNSignatures(executor, dataHash, signatures, _threshold);
    }

    /**
     * @inheritdoc ISafe
     */
    function checkNSignatures(
        address executor,
        bytes32 dataHash,
        bytes memory signatures,
        uint256 requiredSignatures
    ) public view override {
        // Check that the provided signature data is not too short.
        if (signatures.length < requiredSignatures.mul(65)) revertWithError("GS020");
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 v; // Implicit conversion from uint8 to uint256 will be done for `v` received from `signatureSplit(...)`.
        bytes32 r;
        // We do not enforce the `s` to be from the lower half of the curve.
        // This essentially means that for every signature, there's another valid signature (known as ECDSA malleability).
        // Since we have other mechanisms to prevent duplicated signatures (ordered owners array) and replay protection (nonce),
        // we can safely ignore ECDSA malleability.
        bytes32 s;
        uint256 i;
        for (i = 0; i < requiredSignatures; ++i) {
            (v, r, s) = signatureSplit(signatures, i);
            if (v == 0) {
                // If `v` is 0 then it is a contract signature
                // When handling contract signatures the address of the contract is encoded into r
                currentOwner = address(uint160(uint256(r)));

                // Check that signature data pointer (`s`) is not pointing inside the static part of the signatures bytes.
                // This check is not completely accurate, since it is possible that more signatures than the threshold are sent.
                // Here we only check that the pointer is not pointing inside the part that is being processed.
                if (uint256(s) < requiredSignatures.mul(65)) revertWithError("GS021");

                // The contract signature check is extracted to a separate function for better compatibility with formal verification
                // A quote from the Certora team:
                // "The assembly code broke the pointer analysis, which switched the prover in failsafe mode, where it is (a) much slower and (b) computes different hashes than in the normal mode."
                // More info here: <https://github.com/safe-global/safe-smart-account/pull/661>.
                checkContractSignature(currentOwner, dataHash, signatures, uint256(s));
            } else if (v == 1) {
                // If `v` is 1 then it is an approved hash.
                // When handling approved hashes the address of the approver is encoded into `r`.
                currentOwner = address(uint160(uint256(r)));
                // Hashes are automatically approved by the `executor` or when they have been pre-approved via a separate transaction.
                if (executor != currentOwner && approvedHashes[currentOwner][dataHash] == 0) revertWithError("GS025");
            } else if (v > 30) {
                // If `v > 30` then default `v` (27, 28) has been adjusted to encode an `eth_sign` signature.
                // To support `eth_sign` and similar we adjust `v` and hash the `dataHash` with the EIP-191 message prefix before applying `ecrecover`.
                currentOwner = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), uint8(v - 4), r, s);
            } else {
                // Default is `ecrecover` for the provided `dataHash`.
                currentOwner = ecrecover(dataHash, uint8(v), r, s);
            }
            if (currentOwner <= lastOwner || owners[currentOwner] == address(0) || currentOwner == SENTINEL_OWNERS)
                revertWithError("GS026");
            lastOwner = currentOwner;
        }
    }

    /**
     * @notice Checks whether the signature provided is valid for the provided hash. Reverts otherwise.
     *         The `data` parameter is completely ignored during signature verification.
     * @dev This function is provided for compatibility with previous versions.
     *      Use `checkSignatures(address,bytes32,bytes)` instead.
     *      ⚠️⚠️⚠️ If the caller is an owner of the Safe, it can trivially sign any hash with a pre-approve signature and may reduce the threshold of the signature by 1. ⚠️⚠️⚠️
     * @param dataHash Hash of the data (could be either a message hash or transaction hash).
     * @param data **IGNORED** The data pre-image.
     * @param signatures Packed signature data that should be verified.
     *                   Can be packed ECDSA signature `r:bytes32 || s:bytes32 || v:uint8`, contract signature (EIP-1271), or approved hash.
     */
    function checkSignatures(bytes32 dataHash, bytes calldata data, bytes memory signatures) external view {
        data;
        checkSignatures(msg.sender, dataHash, signatures);
    }

    /**
     * @notice Checks whether the signature provided is valid for the provided hash. Reverts otherwise.
     *         The `data` parameter is completely ignored during signature verification.
     * @dev This function is provided for compatibility with previous versions.
     *      Use `checkNSignatures(address,bytes32,bytes,uint256)` instead.
     *      ⚠️⚠️⚠️ If the caller is an owner of the Safe, it can trivially sign any hash with a pre-approve signature and may reduce the threshold of the signature by 1. ⚠️⚠️⚠️
     * @param dataHash Hash of the data (could be either a message hash or transaction hash).
     * @param data **IGNORED** The data pre-image.
     * @param signatures Packed signature data that should be verified.
     *                   Can be packed ECDSA signature `r:bytes32 || s:bytes32 || v:uint8`, contract signature (EIP-1271), or approved hash.
     * @param requiredSignatures Amount of required valid owner signatures.
     */
    function checkNSignatures(bytes32 dataHash, bytes calldata data, bytes memory signatures, uint256 requiredSignatures) external view {
        data;
        checkNSignatures(msg.sender, dataHash, signatures, requiredSignatures);
    }

    /**
     * @inheritdoc ISafe
     */
    function approveHash(bytes32 hashToApprove) external override {
        if (owners[msg.sender] == address(0)) revertWithError("GS030");
        approvedHashes[msg.sender][hashToApprove] = 1;
        emit ApproveHash(hashToApprove, msg.sender);
    }

    /**
     * @inheritdoc ISafe
     */
    function domainSeparator() public view override returns (bytes32 domainHash) {
        // We opted for using assembly code here, because the way Solidity compiler we use (0.7.6) allocates memory is
        // inefficient. We do not need to allocate memory for temporary variables to be used in the keccak256 call.
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Get the free memory pointer
            let ptr := mload(0x40)

            // Prepare the domain data for hashing in memory.
            mstore(ptr, DOMAIN_SEPARATOR_TYPEHASH)
            mstore(add(ptr, 32), chainid())
            mstore(add(ptr, 64), address())

            // Compute the domain separator.
            domainHash := keccak256(ptr, 96)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @inheritdoc ISafe
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
    ) public view override returns (bytes32 txHash) {
        bytes32 domainHash = domainSeparator();

        // We opted for using assembly code here, because the way Solidity compiler we use (0.7.6) allocates memory is
        // inefficient. We do not need to allocate memory for temporary variables to be used in the `keccak256` call.
        //
        // WARNING: We do not clean potential dirty bits in types that are less than 256 bits (addresses and `Enum.Operation`)
        // Solidity types that are smaller than 256 bit can have dirty high bits when accessed in assembly according to the spec
        // (see the warning in <https://docs.soliditylang.org/en/v0.7.6/assembly.html#access-to-external-variables-functions-and-libraries>).
        // However, we read most of the data from calldata, where the variables are not packed, and the only variable we read from storage is `uint256 nonce`.
        // This is not a problem, however, we must consider this for potential future changes.
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Get the free memory pointer.
            let ptr := mload(0x40)

            // Step 1: Hash the transaction data.
            // Copy transaction data to memory and hash it.
            calldatacopy(ptr, data.offset, data.length)
            let calldataHash := keccak256(ptr, data.length)

            // Step 2: Prepare the SafeTX struct for hashing.
            // Layout in memory:
            // ptr +   0: `SAFE_TX_TYPEHASH` (constant defining the Safe transaction struct hash)
            // ptr +  32: `to`
            // ptr +  64: `value`
            // ptr +  96: `calldataHash = keccak256(data)`
            // ptr + 128: `operation`
            // ptr + 160: `safeTxGas`
            // ptr + 192: `baseGas`
            // ptr + 224: `gasPrice`
            // ptr + 256: `gasToken`
            // ptr + 288: `refundReceiver`
            // ptr + 320: `nonce`
            mstore(ptr, SAFE_TX_TYPEHASH)
            mstore(add(ptr, 32), to)
            mstore(add(ptr, 64), value)
            mstore(add(ptr, 96), calldataHash)
            mstore(add(ptr, 128), operation)
            mstore(add(ptr, 160), safeTxGas)
            mstore(add(ptr, 192), baseGas)
            mstore(add(ptr, 224), gasPrice)
            mstore(add(ptr, 256), gasToken)
            mstore(add(ptr, 288), refundReceiver)
            mstore(add(ptr, 320), _nonce)

            // Step 3: Calculate the final EIP-712 hash.
            // First, hash the SafeTX struct (352 bytes total length).
            mstore(add(ptr, 64), keccak256(ptr, 352))
            // Store the EIP-712 prefix (`0x1901`), note that integers are left-padded with 0's,
            // so the EIP-712 encoded data starts at `add(ptr, 30)`.
            mstore(ptr, 0x1901)
            // Store the domain separator.
            mstore(add(ptr, 32), domainHash)
            // Calculate the hash.
            txHash := keccak256(add(ptr, 30), 66)
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @notice A hook that gets called before execution of the {execTransaction} method.
     * @param to Destination address of Safe transaction.
     * @param value Native token value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Base gas costs that are independent of the transaction execution.
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 for the native token) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 for `tx.origin`).
     * @param signatures Signature data for the executed transaction.
     */
    function onBeforeExecTransaction(
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
    ) internal virtual {}
}
