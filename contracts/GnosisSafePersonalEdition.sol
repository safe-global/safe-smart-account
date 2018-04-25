pragma solidity 0.4.21;
import "./GnosisSafe.sol";


/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafePersonalEdition is GnosisSafe {

    event ExecutionFailed();

    uint256 public nonce;
    uint256 public maxGasPrice;

    /// @dev Allows to change the maximum gas price accepted for payment
    function changeMaxGasPrice(uint256 _maxGasPrice)
        public
        onlyWallet
    {
        maxGasPrice = _maxGasPrice;
    }

    function setup(address[] _owners, uint8 _threshold, address to, bytes data)
        public
    {
        super.setup(_owners, _threshold, to, data);
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
    function payAndExecuteTransaction(address to, uint256 value, bytes data, Operation operation, uint8[] v, bytes32[] r, bytes32[] s, uint256 overrideGasCosts)
        public
    {
        require(tx.gasprice <= maxGasPrice);
        uint256 startGas = gasleft();
        checkHash(getExecuteHash(to, value, data, operation, nonce), v, r, s);
        // Increase nonce and execute transaction.
        nonce += 1;
        if (!execute(to, value, data, operation)) {
          emit ExecutionFailed();
        }
        // 8000 = execution costs for transfer to origin
        // 21000 = base transaction costs
        // msg.data.length * 27 = price for data payload
        uint256 gasCosts = startGas - gasleft() + 8000 + 21000 + msg.data.length * 27;
        if (overrideGasCosts > 0 && overrideGasCosts < gasCosts) {
          gasCosts = overrideGasCosts;
        }
        tx.origin.transfer(gasCosts * tx.gasprice);
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation Operation type of Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function executeTransaction(address to, uint256 value, bytes data, Operation operation, uint8[] v, bytes32[] r, bytes32[] s)
        public
    {
        checkHash(getExecuteHash(to, value, data, operation, nonce), v, r, s);
        // Increase nonce and execute transaction.
        nonce += 1;
        require(execute(to, value, data, operation));
    }

    function checkHash(bytes32 hash, uint8[] v, bytes32[] r, bytes32[] s)
      internal
    {
      // There cannot be an owner with address 0.
      address lastOwner = address(0);
      address currentOwner;
      uint256 i;
      // Validate threshold is reached.
      for (i = 0; i < threshold; i++) {
          currentOwner = ecrecover(hash, v[i], r[i], s[i]);
          require(isOwner[currentOwner]);
          require(currentOwner > lastOwner);
          lastOwner = currentOwner;
      }
    }

    /// @dev Returns hash to be signed by owners for executeTransaction.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getExecuteHash(address to, uint256 value, bytes data, Operation operation, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, _nonce);
    }

    /// @dev Returns hash to be signed by owners for payAndExecuteTransaction.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param executor Address that should be paid for the transaction.
    /// @param price Price paid to the executor.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getPayAndExecuteHash(address to, uint256 value, bytes data, Operation operation, address executor, uint256 price, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, executor, price, _nonce);
    }
}
