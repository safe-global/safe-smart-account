pragma solidity 0.4.24;
import "./GnosisSafe.sol";
import "./MasterCopy.sol";
import "./SignatureValidator.sol";
import "./SecuredTokenTransfer.sol";


/// @title Gnosis Safe Personal Edition - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
/// @author Ricardo Guilherme Schmidt - (Status Research & Development GmbH) - Gas Token Payment
contract GnosisSafePersonalEdition is MasterCopy, GnosisSafe, SignatureValidator, SecuredTokenTransfer {

    string public constant NAME = "Gnosis Safe Personal Edition";
    string public constant VERSION = "0.0.1";
    //keccak256(
    //    "PersonalSafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 dataGas,uint256 gasPrice,address gasToken,uint256 nonce)"
    //);
    bytes32 public constant SAFE_TX_TYPEHASH = 0x068c3b33cc9bff6dde08209527b62abfb1d4ed576706e2078229623d72374b5b;
    
    event ExecutionFailed(bytes32 txHash);

    uint256 public nonce;

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
        bytes32 txHash = getTransactionHash(to, value, data, operation, safeTxGas, dataGas, gasPrice, gasToken, nonce);
        checkHash(txHash, signatures);
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() >= safeTxGas, "Not enough gas to execute safe transaction");
        success = execute(to, value, data, operation, safeTxGas);
        if (!success) {
            emit ExecutionFailed(txHash);
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
        require(execute(to, value, data, operation, gasleft()));
        uint256 requiredGas = startGas - gasleft();
        // Convert response to string and return via error message
        revert(string(abi.encodePacked(requiredGas)));
    }

    function checkHash(bytes32 txHash, bytes signatures)
        internal
        view
    {
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = recoverKey(txHash, signatures, i);
            require(owners[currentOwner] != 0, "Signature not provided by owner");
            require(currentOwner > lastOwner, "Signatures are not ordered by owner address");
            lastOwner = currentOwner;
        }
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
        bytes32 safeTxHash = keccak256(
            abi.encode(SAFE_TX_TYPEHASH, to, value, keccak256(data), operation, safeTxGas, dataGas, gasPrice, gasToken, _nonce)
        );
        return keccak256(
            abi.encodePacked(byte(0x19), byte(1), domainSeperator, safeTxHash)
        );
    }
}
