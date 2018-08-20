pragma solidity 0.4.24;
import "./base/BaseSafe.sol";
import "./common/MasterCopy.sol";
import "./common/SignatureDecoder.sol";
import "./common/SecuredTokenTransfer.sol";
import "./interfaces/ISignatureValidator.sol";

/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
/// @author Ricardo Guilherme Schmidt - (Status Research & Development GmbH) - Gas Token Payment
contract GnosisSafe is MasterCopy, BaseSafe, SignatureDecoder, SecuredTokenTransfer, ISignatureValidator {

    string public constant NAME = "Gnosis Safe";
    string public constant VERSION = "0.0.1";

    //keccak256(
    //    "EIP712Domain(address verifyingContract)"
    //);
    bytes32 public constant DOMAIN_SEPERATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    //keccak256(
    //    "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 dataGas,uint256 gasPrice,address gasToken,uint256 nonce)"
    //);
    bytes32 public constant SAFE_TX_TYPEHASH = 0x25d046d03ed382d9c56da5eda028b368da618747b9a6080c9422e835abd69574;

    //keccak256(
    //    "SafeMessage(bytes message)"
    //);
    bytes32 public constant SAFE_MSG_TYPEHASH = 0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca;
    
    event ExecutionFailed(bytes32 txHash);

    uint256 public nonce;
    bytes32 public domainSeperator;
    // Mapping to keep track of all message hashes that have been approve by ALL REQUIRED owners
    mapping(bytes32 => uint256) signedMessage;
    // Mapping to keep track of all hashes (message or transaction) that have been approve by ANY owners
    mapping(address => mapping(bytes32 => uint256)) approvedHashes;

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setup(address[] _owners, uint256 _threshold, address to, bytes data)
        public
    {
        require(domainSeperator == 0, "Domain Seperator already set!");
        domainSeperator = keccak256(abi.encode(DOMAIN_SEPERATOR_TYPEHASH, this));
        setupSafe(_owners, _threshold, to, data);
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
    ///      Note: The fees are always transfered, even if the user transaction fails. 
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction and to pay the payment transfer
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v})
    function execTransactionAndPaySubmitter(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        bytes signatures
    )
        public
        returns (bool success)
    {
        uint256 startGas = gasleft();
        bytes memory txHashData = encodeTransactionData(to, value, data, operation, safeTxGas, dataGas, gasPrice, gasToken, nonce);
        require(checkSignatures(keccak256(txHashData), txHashData, signatures, true), "Invalid signatures provided");
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() >= safeTxGas, "Not enough gas to execute safe transaction");
        // If no safeTxGas has been set and the gasPrice is 0 we assume that all available gas can be used
        uint256 gasLimit;
        if (safeTxGas == 0 && gasPrice == 0) {
            gasLimit = gasleft();
        } else {
            gasLimit = safeTxGas;
        }
        success = execute(to, value, data, operation, gasLimit);
        if (!success) {
            emit ExecutionFailed(keccak256(txHashData));
        }
        
        // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        if (gasPrice > 0) {
            uint256 gasCosts = (startGas - gasleft()) + dataGas;
            uint256 amount = gasCosts * gasPrice;
            if (gasToken == address(0)) {
                 // solium-disable-next-line security/no-tx-origin,security/no-send
                require(tx.origin.send(amount), "Could not pay gas costs with ether");
            } else {
                 // solium-disable-next-line security/no-tx-origin
                require(transferToken(gasToken, tx.origin, amount), "Could not pay gas costs with token");
            }
        }
    }

    /**
    * @dev Should return whether the signature provided is valid for the provided data, hash
    * @param dataHash Hash of the data (could be either a message hash or transaction hash)
    * @param data That should be signed (this is passed to an external validator contract)
    * @param signatures Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.
    * @param consumeHash Indicates that in case of an approved hash the storage can be freed to save gas
    * @return a bool upon valid or invalid signature with corresponding _data
    */
    function checkSignatures(bytes32 dataHash, bytes data, bytes signatures, bool consumeHash)
        internal
        returns (bool)
    {
        // Check that the provided signature data is not too short
        if (signatures.length < threshold * 65) {
            return false;
        }
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;
        for (i = 0; i < threshold; i++) {
            (v, r, s) = signatureSplit(signatures, i);
            // If v is 0 then it is a contract signature
            if (v == 0) {
                // When handling contract signatures the address of the contract is encoded into r
                currentOwner = address(r);
                bytes memory contractSignature;
                // solium-disable-next-line security/no-inline-assembly
                assembly {
                    // The signature data for contract signatures is appended to the concatenated signatures and the offset is stored in s
                    contractSignature := add(add(signatures, s), 0x20)
                }
                if (!ISignatureValidator(currentOwner).isValidSignature(data, contractSignature)) {
                    return false;
                }
            // If v is 1 then it is an approved hash
            } else if (v == 1) {
                // When handling approved hashes the address of the approver is encoded into r
                currentOwner = address(r);
                // Hashes are automatically approved by the sender of the message or when they have been pre-approved via a separate transaction
                if (msg.sender != currentOwner && approvedHashes[currentOwner][dataHash] == 0) {
                    return false;
                }
                // Hash has been marked for consumption. If this hash was pre-approved free storage
                if (consumeHash && msg.sender != currentOwner) {
                    approvedHashes[currentOwner][dataHash] = 0;
                }
            } else {
                // Use ecrecover with the messageHash for EOA signatures
                currentOwner = ecrecover(dataHash, v, r, s);
            }
            if (currentOwner <= lastOwner || owners[currentOwner] == 0) {
                return false;
            }
            lastOwner = currentOwner;
        }
        return true;
    }

    /// @dev Allows to estimate a Safe transaction. 
    ///      This method is only meant for estimation purpose, therfore two different protection mechanism against execution in a transaction have been made:
    ///      1.) The method can only be called from the safe itself
    ///      2.) The response is returned with a revert
    ///      When estimating set `from` to the address of the safe.
    ///      Since the `estimateGas` function includes refunds, call this method to get an estimated of the costs that are deducted from the safe with `execTransactionAndPaySubmitter`
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @return Estimate without refunds and overhead fees (base transaction and payload data gas costs).
    function requiredTxGas(address to, uint256 value, bytes data, Enum.Operation operation)
        public
        authorized
        returns (uint256)
    {
        uint256 startGas = gasleft();
        // We don't provide an error message here, as we use it to return the estimate
        // solium-disable-next-line error-reason
        require(execute(to, value, data, operation, gasleft()));
        uint256 requiredGas = startGas - gasleft();
        // Convert response to string and return via error message
        revert(string(abi.encodePacked(requiredGas)));
    }

    /**
    * @dev Marks a hash as approved. This can be used to validate a hash that is used by a signature.
    * @param hashToApprove The hash that should be marked as approved for signatures that are verified by this contract.
    */
    function approveHash(bytes32 hashToApprove) 
        public
    {
        approvedHashes[msg.sender][hashToApprove] = 1;
    }

    /**
    * @dev Marks a message as signed
    * @param _data Arbitrary length data that should be marked as signed on the behalf of address(this)
    */ 
    function signMessage(bytes _data) 
        public
        authorized
    {
        signedMessage[getMessageHash(_data)] = 1;
    }

    /**
    * @dev Should return whether the signature provided is valid for the provided data
    * @param _data Arbitrary length data signed on the behalf of address(this)
    * @param _signature Signature byte array associated with _data
    * @return a bool upon valid or invalid signature with corresponding _data
    */ 
    function isValidSignature(bytes _data, bytes _signature)
        public
        view 
        returns (bool isValid)
    {
        bytes32 messageHash = getMessageHash(_data);
        if (_signature.length == 0) {
            isValid = signedMessage[messageHash] != 0;
        } else {
            isValid = checkSignatures(messageHash, _data, _signature, false);
        }
    }

    /// @dev Returns hash of a message that can be signed by owners.
    /// @param message Message that should be hashed
    /// @return Message hash.
    function getMessageHash(
        bytes message
    )
        public
        view
        returns (bytes32)
    {
        bytes32 safeMessageHash = keccak256(
            abi.encode(SAFE_MSG_TYPEHASH, keccak256(message))
        );
        return keccak256(
            abi.encodePacked(byte(0x19), byte(1), domainSeperator, safeMessageHash)
        );
    }

    /// @dev Returns the bytes that are hashed to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Fas that should be used for the safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction.
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash bytes.
    function encodeTransactionData(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 safeTxGas, 
        uint256 dataGas, 
        uint256 gasPrice, 
        address gasToken,
        uint256 _nonce
    )
        public
        view
        returns (bytes)
    {
        bytes32 safeTxHash = keccak256(
            abi.encode(SAFE_TX_TYPEHASH, to, value, keccak256(data), operation, safeTxGas, dataGas, gasPrice, gasToken, _nonce)
        );
        return abi.encodePacked(byte(0x19), byte(1), domainSeperator, safeTxHash);
    }

    /// @dev Returns hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Fas that should be used for the safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction.
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 safeTxGas, 
        uint256 dataGas, 
        uint256 gasPrice, 
        address gasToken,
        uint256 _nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(encodeTransactionData(to, value, data, operation, safeTxGas, dataGas, gasPrice, gasToken, _nonce));
    }
}
