pragma solidity 0.4.21;
import "./Enum.sol";
import "./SelfAuthorized.sol";

/// @title Personal Edition Base - Base logic for personal safe edition
/// @author Richard Meissner - <richard@gnosis.pm>
contract PersonalEditionBase is SelfAuthorized {

    event ExecutionFailed();
    event GasLeft(uint256 gas);

    uint256 public nonce;
    uint256 public maxGasPrice;

    /// @dev Allows to change the maximum gas price accepted for payment
    function changeMaxGasPrice(uint256 _maxGasPrice)
        public
        authorized
    {
        maxGasPrice = _maxGasPrice;
    }

    function setupPersonalEdition()
        public
    {
        require(maxGasPrice == 0);
        maxGasPrice = 100000000000; // 100 GWei
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    /// @param overrideGasCosts Allows the sender to override the costs that are paid by the safe for the tx (can only be lowered and not 0).
    function payAndExecuteTransaction(address to, uint256 value, bytes data, Enum.Operation operation, uint256 txGas, uint8[] v, bytes32[] r, bytes32[] s, uint256 overrideGasCosts)
        public
    {
        require(tx.gasprice <= maxGasPrice);
        uint256 startGas = gasleft();
        checkHash(getTransactionHash(to, value, data, operation, txGas, nonce), v, r, s);
        // Increase nonce and execute transaction.
        nonce++;
        require(gasleft() - 12000 >= txGas);
        if (!execute(to, value, data, operation, 12000)) {
          emit ExecutionFailed();
        }
        // 10000 = execution costs for transfer to origin -> this is higher if we a do a call
        // 21000 = base transaction costs
        // msg.data.length * 27 = price for data payload
        // => 27 because 68 for non-zero and 4 for zero, we go with the worst case
        uint256 gasCosts = startGas - gasleft() + 10000 + 21000 + msg.data.length * 68;
        if (overrideGasCosts < gasCosts) {
          gasCosts = overrideGasCosts;
        }
        transfer(tx.origin, gasCosts * tx.gasprice);
    }

    function executeTransaction(address to, uint256 value, bytes data, Enum.Operation operation, uint8[] v, bytes32[] r, bytes32[] s)
      public
    {
      payAndExecuteTransaction(to, value, data, operation, 0, v, r, s, 0);
    }

    function estimate(address to, uint256 value, bytes data, Enum.Operation operation)
        public
        authorized
        returns (uint256)
    {
        uint256 startGas = gasleft();
        require(execute(to, value, data, operation, 0));
        return startGas - gasleft();
    }

    function checkHash(bytes32 hash, uint8[] v, bytes32[] r, bytes32[] s)
      public
      view
    {
      // There cannot be an owner with address 0.
      address lastOwner = address(0);
      address currentOwner;
      uint256 i;
      // Validate threshold is reached.
      for (i = 0; i < threshold(); i++) {
          currentOwner = ecrecover(hash, v[i], r[i], s[i]);
          require(isOwner(currentOwner));
          require(currentOwner > lastOwner);
          lastOwner = currentOwner;
      }
    }

    /// @dev Returns hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param minTxGas Minimum gas that should be available for user transaction
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(address to, uint256 value, bytes data, Enum.Operation operation, uint256 minTxGas, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, minTxGas, _nonce);
    }

    function threshold()
        public
        view
        returns (uint8);

    function isOwner(address owner)
        public
        view
        returns (bool);

    function execute(address to, uint256 value, bytes data, Enum.Operation operation, uint256 gasAdjustment)
        internal
        returns (bool success);

    function transfer(address to, uint256 value)
        internal;
}
