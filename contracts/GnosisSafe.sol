pragma solidity 0.4.19;
import "./Extension.sol";


/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
contract GnosisSafe {

    event ContractCreation(address newContract);

    string public constant NAME = "Gnosis Safe";
    string public constant VERSION = "0.0.1";

    uint8 public threshold;
    uint256 public nonce;
    address[] public owners;
    Extension[] public extensions;
    mapping (address => bool) public isOwner;
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

    function ()
        external
        payable
    {

    }

    function GnosisSafe(address[] _owners, uint8 _threshold, Extension extension)
        public
    {
        require(_threshold <= _owners.length);
        require(_threshold >= 1);
        for (uint256 i = 0; i < _owners.length; i++) {
            require(_owners[i] != 0);
            require(!isOwner[_owners[i]]);
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        threshold = _threshold;
        if (address(extension) != 0) {
            extensions.push(extension);
            isExtension[extension] = true;
        }
    }

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

    function removeOwner(address owner, uint8 _threshold)
        public
        onlyWallet
    {
        require(isOwner[owner]);
        require(owners.length - 1 >= _threshold);
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.length--;
                break;
            }
        }
        isOwner[owner] = false;
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    function replaceOwner(address oldOwner, address newOwner)
        public
        onlyWallet
    {
        require(newOwner != 0);
        require(isOwner[oldOwner]);
        require(!isOwner[newOwner]);
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == oldOwner) {
                owners[i] = newOwner;
                break;
            }
        }
        isOwner[oldOwner] = false;
        isOwner[newOwner] =  true;
    }

    function changeThreshold(uint8 _threshold)
        public
        onlyWallet
    {
        require(_threshold <= owners.length);
        require(_threshold >= 1);
        threshold = _threshold;
    }

    function addExtension(Extension extension)
        public
        onlyWallet
    {
        require(address(extension) != 0);
        require(!isExtension[extension]);
        extensions.push(extension);
        isExtension[extension] = true;
    }

    function removeExtension(Extension extension)
        public
        onlyWallet
    {
        require(isExtension[extension]);
        for (uint256 i = 0; i < extensions.length; i++) {
            if (extensions[i] == extension) {
                extensions[i] = extensions[extensions.length - 1];
                extensions.length--;
                break;
            }
        }
        isExtension[extension] = false;
    }

    function executeTransaction(address to, uint256 value, bytes data, Operation operation, uint8[] v, bytes32[] r, bytes32[] s)
        public
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        address lastRecoverd = address(0);
        for (uint256 i = 0; i < threshold; i++) {
            address recovered = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(recovered > lastRecoverd);
            require(isOwner[recovered]);
            lastRecoverd = recovered;
        }
        nonce += 1;
        execute(to, value, data, operation);
    }

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
        uint256 dataLength = data.length;
        assembly {
            success := call(
                sub(gas, 34710),   // 34710 is the value that solidity is currently emitting
                to,
                value,
                add(data, 32),     // First 32 bytes are the padded length of data, so exclude that
                dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
                mload(0x40),       // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
                0                  // Output is ignored, therefore the output size is zero
            )
        }
    }

    function executeDelegateCall(address to, bytes data)
        internal
        returns (bool success)
    {
        uint256 dataLength = data.length;
        assembly {
            success := delegatecall(
                sub(gas, 34710),   // 34710 is the value that solidity is currently emitting
                to,
                add(data, 32),     // First 32 bytes are the padded length of data, so exclude that
                dataLength,        // Size of the input (in bytes) - this is what fixes the padding problem
                mload(0x40),       // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
                0                  // Output is ignored, therefore the output size is zero
            )
        }
    }

    function executeCreate(bytes data)
        internal
        returns (address newContract)
    {
        assembly {
            newContract := create(
                0,
                add(data, 0x20),
                mload(data)
            )
        }
    }

    function getTransactionHash(address to, uint256 value, bytes data, Operation operation, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), this, to, value, data, operation, _nonce);
    }

    function getOwners()
        public
        view
        returns (address[])
    {
        return owners;
    }

    function getExtensions()
        public
        view
        returns (Extension[])
    {
        return extensions;
    }
}
