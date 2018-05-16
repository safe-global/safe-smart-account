pragma solidity 0.4.23;
import "./interfaces/ERC20Token.sol";
import "./GnosisSafe.sol";
import "./MasterCopy.sol";


/// @title Gnosis Safe Personal Edition - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
/// @author Ricardo Guilherme Schmidt - (Status Research & Development GmbH) - Gas Token Payment
contract GnosisSafePersonalEdition is MasterCopy, GnosisSafe {

    string public constant NAME = "Gnosis Safe Personal Edition";
    string public constant VERSION = "0.0.1";
    
    uint256 internal constant BASE_TX_GAS_COSTS = 21000;
    uint256 internal constant PAYMENT_GAS_COSTS = 11000;

    event ExecutionFailed();

    uint256 public nonce;

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param safeTxGas Gas that should be used for the Safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction.
    /// @param gasPrice Gas price that should be used for the payment calculation.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function execAndPayTransaction(
        address to, 
        uint256 value, 
        bytes data, 
        Enum.Operation operation, 
        uint256 safeTxGas,
        uint256 dataGas,
        uint256 gasPrice,
        address gasToken,
        uint8[] v, 
        bytes32[] r, 
        bytes32[] s
    )
        public
    {
        uint256 startGas = gasleft();
        checkHash(getTransactionHash(to, value, data, operation, safeTxGas, dataGas, gasPrice, gasToken, nonce), v, r, s);
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() - PAYMENT_GAS_COSTS >= safeTxGas);
        if (!execute(to, value, data, operation, safeTxGas)) {
            emit ExecutionFailed();
        }
        
        // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
        if (gasPrice > 0) {
            uint256 gasCosts = totalGasCosts(startGas - gasleft(), dataGas);
            uint256 amount = gasCosts * gasPrice;
            if (gasToken == address(0)) {
                 // solium-disable-next-line security/no-tx-origin
                tx.origin.transfer(amount);
            } else {
                 // solium-disable-next-line security/no-tx-origin
                ERC20Token(gasToken).transfer(tx.origin, amount);
            }
        }  
    }

    /// @dev Calculates the total gas costs for a safe transaction with the gas costs for the execution of the transaction.
    /// @param executionGas Gas costs for the execution of the safe transaction.
    /// @param dataGas Gas costs for data used to trigger the safe transaction.
    /// @return Total gas costs for the execution (this includes gas costs for the payment to tx.origin, base transaction and payload data).
    function totalGasCosts(uint256 executionGas, uint256 dataGas) 
        public 
        pure
        returns (uint256) 
    {
        return executionGas + dataGas + PAYMENT_GAS_COSTS + BASE_TX_GAS_COSTS;
    }

    /// @dev Allows to estimate a Safe transaction. 
    ///      This method is only meant for estimation purpose, therfore two different protection mechanism against execution in a transaction have been made:
    ///      1.) The method can only be called from the safe itself
    ///      2.) The response is returned with a revert (not in place yet)
    ///      When estimating set `from` to the address of the safe.
    ///      Since the `estimateGas` function includes refunds, call this method to get an estimated of the costs that are deducted from the safe with `execAndPayTransaction`
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
        require(execute(to, value, data, operation, gasleft()));
        uint256 requiredGas = startGas - gasleft();
        // Convert response to string
        return requiredGas;
        // TODO: use this if we can test it: revert(string(abi.encodePacked(requiredGas)));
    }

    function checkHash(bytes32 hash, uint8[] v, bytes32[] r, bytes32[] s)
        internal
        view
    {
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = ecrecover(hash, v[i], r[i], s[i]);
            require(owners[currentOwner] != 0);
            require(currentOwner > lastOwner);
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
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, safeTxGas, dataGas, gasPrice, gasToken, _nonce);
    }
}
