pragma solidity 0.4.21;
import "./Extension.sol";


/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafe {

    event ContractCreation(address newContract);

    string public constant NAME = "Gnosis Safe";
    string public constant VERSION = "0.0.1";

    // masterCopy always needs to be first declared variable, to ensure that it is at the same location as in the Proxy contract.
    // It should also always be ensured that the address is stored alone (uses a full word)
    GnosisSafe public masterCopy;

    uint256 public nonce;
    uint8 public threshold;
    address[] public owners;
    Extension[] public extensions;

    // isOwner mapping allows to check if an address is a Safe owner.
    mapping (address => bool) public isOwner;
    // isExtension mapping allows to check if an extension was whitelisted.
    mapping (address => bool) public isExtension;

    enum Operation {
        Call,
        DelegateCall,
        Create
    }

    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    /// @dev Fallback function accepts Ether transactions.
    function ()
        external
        payable
    {

    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setup(address[] _owners, uint8 _threshold, address to, bytes data)
        public
    {
        // Threshold can only be 0 at initialization.
        // Check ensures that setup function can only be called once.
        require(threshold == 0);
        // Validate that threshold is smaller than numbr of added owners.
        require(_threshold <= _owners.length);
        // There has to be at least one Safe owner.
        require(_threshold >= 1);
        // Initializing Safe owners.
        for (uint256 i = 0; i < _owners.length; i++) {
            // Owner address cannot be null.
            require(_owners[i] != 0);
            // No duplicate owners allowed.
            require(!isOwner[_owners[i]]);
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        threshold = _threshold;
        // If a to address is set, an additional delegate call is executed.
        // This call allows further contract setup steps, like adding an extension.
        if (to != 0)
            // Setup has to complete successfully or transaction fails.
            require(executeDelegateCall(to, data));
    }

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract address.
    function changeMasterCopy(GnosisSafe _masterCopy)
        public
        onlyWallet
    {
        // Master copy address cannot be null.
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    /// @dev Allows to add a new owner to the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param owner New owner address.
    /// @param _threshold New threshold.
    function addOwner(address owner, uint8 _threshold)
        public
        onlyWallet
    {
        // Owner address cannot be null.
        require(owner != 0);
        // No duplicate owners allowed.
        require(!isOwner[owner]);
        owners.push(owner);
        isOwner[owner] = true;
        // Change threshold if threshold was changed.
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to remove an owner from the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param ownerIndex Array index position of owner address to be removed.
    /// @param owner Owner address to be removed.
    /// @param _threshold New threshold.
    function removeOwner(uint256 ownerIndex, address owner, uint8 _threshold)
        public
        onlyWallet
    {
        // Only allow to remove an owner, if threshold can still be reached.
        require(owners.length - 1 >= _threshold);
        // Validate owner address corresponds to owner index.
        require(owners[ownerIndex] == owner);
        isOwner[owner] = false;
        owners[ownerIndex] = owners[owners.length - 1];
        owners.length--;
        // Change threshold if threshold was changed.
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to replace an owner from the Safe with another address.
    ///      This can only be done via a Safe transaction.
    /// @param oldOwnerIndex Array index position of owner address to be replaced.
    /// @param oldOwner Owner address to be replaced.
    /// @param newOwner New owner address.
    function replaceOwner(uint256 oldOwnerIndex, address oldOwner, address newOwner)
        public
        onlyWallet
    {
        // Owner address cannot be null.
        require(newOwner != 0);
        // No duplicate owners allowed.
        require(!isOwner[newOwner]);
        // Validate owner address corresponds to owner index.
        require(owners[oldOwnerIndex] == oldOwner);
        isOwner[oldOwner] = false;
        isOwner[newOwner] =  true;
        owners[oldOwnerIndex] = newOwner;
    }

    /// @dev Allows to update the number of required confirmations by Safe owners.
    ///      This can only be done via a Safe transaction.
    /// @param _threshold New threshold.
    function changeThreshold(uint8 _threshold)
        public
        onlyWallet
    {
        // Validate that threshold is smaller than numbr of owners.
        require(_threshold <= owners.length);
        // There has to be at least one Safe owner.
        require(_threshold >= 1);
        threshold = _threshold;
    }

    /// @dev Allows to add an extension to the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param extension Extension to be whitelisted.
    function addExtension(Extension extension)
        public
        onlyWallet
    {
        // Extension address cannot be null.
        require(address(extension) != 0);
        // Extension cannot be added twice.
        require(!isExtension[extension]);
        extensions.push(extension);
        isExtension[extension] = true;
    }

    /// @dev Allows to remove an extension from the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param extensionIndex Array index position of extension to be removed from whitelist.
    /// @param extension Extension to be removed.
    function removeExtension(uint256 extensionIndex, Extension extension)
        public
        onlyWallet
    {
        // Validate extension address corresponds to extension index.
        require(extensions[extensionIndex] == extension);
        isExtension[extension] = false;
        extensions[extensionIndex] = extensions[extensions.length - 1];
        extensions.length--;
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
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint256 i;
        // Validate threshold is reached.
        for (i = 0; i < threshold; i++) {
            currentOwner = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(isOwner[currentOwner]);
            require(currentOwner > lastOwner);
            lastOwner = currentOwner;
        }
        // Increase nonce and execute transaction.
        nonce += 1;
        execute(to, value, data, operation);
    }

    /// @dev Allows an Extension to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of extension transaction.
    /// @param value Ether value of extension transaction.
    /// @param data Data payload of extension transaction.
    /// @param operation Operation type of extension transaction.
    function executeExtension(address to, uint256 value, bytes data, Operation operation)
        public
    {
        // Only whitelisted extensions are allowed.
        require(isExtension[msg.sender]);
        // Execute transaction without further confirmations.
        execute(to, value, data, operation);
    }

    function execute(address to, uint256 value, bytes data, Operation operation)
        internal
    {
        if (operation == Operation.Call)
            require(executeCall(to, value, data));
        else if (operation == Operation.DelegateCall)
            require(executeDelegateCall(to, data));
        else {
            address newContract = executeCreate(data);
            require(newContract != 0);
            ContractCreation(newContract);
        }
    }

    function executeCall(address to, uint256 value, bytes data)
        internal
        returns (bool success)
    {
        assembly {
            success := call(not(0), to, value, add(data, 0x20), mload(data), 0, 0)
        }
    }

    function executeDelegateCall(address to, bytes data)
        internal
        returns (bool success)
    {
        assembly {
            success := delegatecall(not(0), to, add(data, 0x20), mload(data), 0, 0)
        }
    }

    function executeCreate(bytes data)
        internal
        returns (address newContract)
    {
        assembly {
            newContract := create(0, add(data, 0x20), mload(data))
        }
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(address to, uint256 value, bytes data, Operation operation, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, to, value, data, operation, _nonce);
    }

    /// @dev Returns array of owners.
    /// @return Array of Safe owners.
    function getOwners()
        public
        view
        returns (address[])
    {
        return owners;
    }

    /// @dev Returns array of extensions.
    /// @return Array of extensions.
    function getExtensions()
        public
        view
        returns (Extension[])
    {
        return extensions;
    }
}
