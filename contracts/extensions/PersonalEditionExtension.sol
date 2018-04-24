pragma solidity 0.4.21;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Personal Edition Extension
/// @author Richard Meissner - <richard@gnosis.pm>
contract PersonalEditionExtension is Extension {

    string public constant NAME = "Personal Edition Extension";
    string public constant VERSION = "0.0.1";

    PersonalEditionExtension masterCopy;
    GnosisSafe gnosisSafe;

    uint256 public nonce;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract address.
    function changeMasterCopy(PersonalEditionExtension _masterCopy)
        public
        onlyGnosisSafe
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    /// @dev Function to be implemented by extension. This is used to check to what Safe the Extension is attached.
    /// @return Returns the safe the Extension is attached to.
    function getGnosisSafe()
        public
        returns (GnosisSafe)
    {
        return gnosisSafe;
    }

    /// @dev Setup function sets initial storage of contract.
    function setup()
        public
    {
        // gnosisSafe can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(gnosisSafe) == 0);
        gnosisSafe = GnosisSafe(msg.sender);
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation GnosisSafe.Operation type of Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function payAndExecuteTransactionCombined(address to, uint256 value, bytes data, GnosisSafe.Operation operation, uint256 price, uint8[] v, bytes32[] r, bytes32[] s)
        public
    {
        bytes32 transactionHash = getCombinedHash(to, value, data, operation, nonce, price);
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 threshold = gnosisSafe.threshold();
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(gnosisSafe.isOwner(currentOwner));
            require(currentOwner > lastOwner);
            lastOwner = currentOwner;
        }
        // Increase nonce and execute transaction.
        nonce += 1;
        gnosisSafe.executeExtension(msg.sender, price, "", GnosisSafe.Operation.Call);
        gnosisSafe.executeExtension(to, value, data, operation);
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation GnosisSafe.Operation type of Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function payAndExecuteTransaction(address to, uint256 value, bytes data, GnosisSafe.Operation operation, uint8[] v, bytes32[] r, bytes32[] s, uint256 price, uint8 pv, bytes32 pr, bytes32 ps)
        public
    {
        bytes32 priceHash = getPriceHash(msg.sender, price, nonce);
        address priceApprover = ecrecover(priceHash, pv, pr, ps);
        require(gnosisSafe.isOwner(priceApprover));
        gnosisSafe.executeExtension(msg.sender, price, "", GnosisSafe.Operation.Call);

        executeTransaction(to, value, data, operation, v, r, s);
    }

    /// @dev Allows to execute a Safe transaction confirmed by required number of owners.
    /// @param to Destination address of Safe transaction.
    /// @param value Ether value of Safe transaction.
    /// @param data Data payload of Safe transaction.
    /// @param operation GnosisSafe.Operation type of Safe transaction.
    /// @param v Array of signature V values sorted by owner addresses.
    /// @param r Array of signature R values sorted by owner addresses.
    /// @param s Array of signature S values sorted by owner addresses.
    function executeTransaction(address to, uint256 value, bytes data, GnosisSafe.Operation operation, uint8[] v, bytes32[] r, bytes32[] s)
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 threshold = gnosisSafe.threshold();
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(gnosisSafe.isOwner(currentOwner));
            require(currentOwner > lastOwner);
            lastOwner = currentOwner;
        }
        // Increase nonce and execute transaction.
        nonce += 1;
        gnosisSafe.executeExtension(to, value, data, operation);
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param _nonce Transaction nonce.
    /// @return Price hash.
    function getPriceHash(address executor, uint256 price, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, gnosisSafe, executor, price, _nonce);
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation GnosisSafe.Operation type.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(address to, uint256 value, bytes data, GnosisSafe.Operation operation, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, gnosisSafe, to, value, data, operation, _nonce);
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation GnosisSafe.Operation type.
    /// @param _nonce Transaction nonce.
    /// @param price Price that is paid for the transaction.
    /// @return Transaction hash.
    function getCombinedHash(address to, uint256 value, bytes data, GnosisSafe.Operation operation, uint256 _nonce, uint256 price)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, gnosisSafe, to, value, data, operation, _nonce, price);
    }
}
