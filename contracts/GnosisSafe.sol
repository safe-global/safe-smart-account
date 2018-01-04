pragma solidity 0.4.19;
import "./Extension.sol";


/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafe {

    event ContractCreation(address newContract);

    string public constant NAME = "Gnosis Safe";
    string public constant VERSION = "0.0.1";

    GnosisSafe masterCopy;
    uint8 public threshold;
    uint256 public nonce;
    address[] public owners;
    Extension[] public extensions;
    // isOwner mapping allows to check if an address is a Safe owner
    mapping (address => bool) public isOwner;
    // isExtension mapping allows to check if an extension was whitelisted
    mapping (address => bool) public isExtension;
    // isConfirmed mapping allows to check if a transaction was confirmed by an owner via a confirm transaction
    mapping (address => mapping (bytes32 => bool)) public isConfirmed;

    enum Operation {
        Call,
        DelegateCall,
        Create
    }

    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    function ()
        external
        payable
    {

    }

    /// @dev Constructor function
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function GnosisSafe(address[] _owners, uint8 _threshold, address to, bytes data)
        public
    {
        setup(_owners, _threshold, to, data);
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    /// @param to Contract address for optional delegate call.
    /// @param data Data payload for optional delegate call.
    function setup(address[] _owners, uint8 _threshold, address to, bytes data)
        public
    {
        // threshold can only be 0 at initialization.
        // Check ensures that setup function can only be called once.
        require(threshold == 0);
        require(_threshold <= _owners.length);
        require(_threshold >= 1);
        // Initializing Safe owners
        for (uint256 i = 0; i < _owners.length; i++) {
            require(_owners[i] != 0);
            require(!isOwner[_owners[i]]);
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        threshold = _threshold;
        // If a to address is set, an additional delegate call is executed.
        // This call allows further contract setup steps, like adding an extension.
        if (to != 0)
            require(executeDelegateCall(to, data));
    }

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract
    function changeMasterCopy(GnosisSafe _masterCopy)
        public
        onlyWallet
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    /// @dev Allows to add a new owner to the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param owner New owner address
    /// @param _threshold New threshold
    function addOwner(address owner, uint8 _threshold)
        public
        onlyWallet
    {
        require(owner != 0);
        require(!isOwner[owner]);
        owners.push(owner);
        isOwner[owner] = true;
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to remove an owner from the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param ownerIndex Array index position of owner address to be removed.
    /// @param _threshold New threshold
    function removeOwner(uint256 ownerIndex, uint8 _threshold)
        public
        onlyWallet
    {
        require(owners.length - 1 >= _threshold);
        isOwner[owners[ownerIndex]] = false;
        owners[ownerIndex] = owners[owners.length - 1];
        owners.length--;
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to replace an owner from the Safe with another address.
    ///      This can only be done via a Safe transaction.
    /// @param oldOwnerIndex Array index position of owner address to be replaced.
    /// @param newOwner New owner address
    function replaceOwner(uint256 oldOwnerIndex, address newOwner)
        public
        onlyWallet
    {
        require(newOwner != 0);
        require(!isOwner[newOwner]);
        isOwner[owners[oldOwnerIndex]] = false;
        isOwner[newOwner] =  true;
        owners[oldOwnerIndex] = newOwner;
    }

    /// @dev Allows to update the number of required confirmations by Safe owners.
    ///      This can only be done via a Safe transaction.
    /// @param _threshold New threshold
    function changeThreshold(uint8 _threshold)
        public
        onlyWallet
    {
        require(_threshold <= owners.length);
        require(_threshold >= 1);
        threshold = _threshold;
    }

    /// @dev Allows to add an extension to the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param extension Extension to be whitelisted
    function addExtension(Extension extension)
        public
        onlyWallet
    {
        require(address(extension) != 0);
        require(!isExtension[extension]);
        extensions.push(extension);
        isExtension[extension] = true;
    }

    /// @dev Allows to remove an extension from the whitelist.
    ///      This can only be done via a Safe transaction.
    /// @param extensionIndex Array index position of extension to be removed from whitelist
    function removeExtension(uint256 extensionIndex)
        public
        onlyWallet
    {
        isExtension[extensions[extensionIndex]] = false;
        extensions[extensionIndex] = extensions[extensions.length - 1];
        extensions.length--;
    }

    /// @dev Allows to confirm a Safe transaction with a regular transaction.
    ///      This can only be done from an owner address.
    /// @param transactionHash Hash of Safe transaction
    function confirmTransaction(bytes32 transactionHash)
        public
    {
        require(isOwner[msg.sender]);
        require(!isConfirmed[msg.sender][transactionHash]);
        isConfirmed[msg.sender][transactionHash] = true;
    }

    /// @dev Allows to execute a Safe transaction confrimed by required number of owners.
    /// @param to Destination address
    /// @param value Ether value
    /// @param data Data payload
    /// @param operation Operation type
    /// @param v Array of signature V values
    /// @param r Array of signature R values
    /// @param s Array of signature S values
    /// @param _owners List of Safe owners confirming via regular transactions
    /// @param indices List of indeces of Safe owners confirming via regular transactions
    function executeTransaction(address to, uint256 value, bytes data, Operation operation, uint8[] v, bytes32[] r, bytes32[] s, address[] _owners, uint256[] indices)
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        address lastOwner = address(0);
        address validatedOwner;
        uint256 i = 0;
        uint256 j;
        for (j = 0; j < threshold; j++) {
            if (indices.length > i && j == indices[i]) {
                require(msg.sender == _owners[i] || isConfirmed[_owners[i]][transactionHash]);
                validatedOwner = _owners[i];
                i += 1;
            }
            else
                validatedOwner = ecrecover(transactionHash, v[j-i], r[j-i], s[j-i]);  
            require(isOwner[validatedOwner]);
            require(validatedOwner > lastOwner);
            lastOwner = validatedOwner;
        }
        // Delete storage to receive refunds
        if (_owners.length > 0) {
            for (j = 0; j < _owners.length; j++) {
                if (msg.sender != _owners[j])
                    isConfirmed[_owners[j]][transactionHash] = false;
            }
        }
        nonce += 1;
        execute(to, value, data, operation);
    }

    /// @dev Allows to execute a Safe transaction via an extension without any further confirmations.
    /// @param to Destination address
    /// @param value Ether value
    /// @param data Data payload
    /// @param operation Operation type
    /// @param extension Extension address
    function executeExtension(address to, uint256 value, bytes data, Operation operation, Extension extension)
        public
    {
        require(isExtension[extension]);
        require(extension.isExecutable(msg.sender, to, value, data, operation));
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
    /// @param to Destination address
    /// @param value Ether value
    /// @param data Data payload
    /// @param operation Operation type
    /// @param _nonce Transaction nonce
    function getTransactionHash(address to, uint256 value, bytes data, Operation operation, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), this, to, value, data, operation, _nonce);
    }

    /// @dev Returns array of owners.
    function getOwners()
        public
        view
        returns (address[])
    {
        return owners;
    }

    /// @dev Returns array of extensions.
    function getExtensions()
        public
        view
        returns (Extension[])
    {
        return extensions;
    }
}
