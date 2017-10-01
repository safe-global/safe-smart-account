pragma solidity 0.4.17;
import "./Exception.sol";
import "./Condition.sol";


contract GnosisSafe {

    uint8 public constant MAX_OWNERS = 64;

    event Confirmation(address indexed owner, bytes32 transactionHash);
    event Revocation(address indexed owner, bytes32 transactionHash);
    event CallExecution(address indexed owner, address to, uint value, bytes data);
    event DelegateCallExecution(address indexed owner, address to, bytes data);
    event CreateExecution(address indexed owner, bytes data, address createdContract);
    event Deposit(address indexed sender, uint value);
    event OwnerAddition(address owner);
    event OwnerRemoval(address owner);
    event OwnerReplacement(address oldOwner, address newOwner);
    event RequirementChange(uint required);
    event ConditionChange(Condition condition);
    event ExceptionAddition(Exception exception);
    event ExceptionRemoval(Exception exception);

    uint8 public required;
    Condition public condition;
    address[] public owners;
    Exception[] public exceptions;
    mapping (address => bool) public isOwner;
    mapping (address => bool) public isException;
    mapping (bytes32 => bool) public isExecuted;
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;

    enum Operation {
        Call,
        DelegateCall,
        Create
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender]);
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this));
        _;
    }

    function ()
        external
        payable
    {
        Deposit(msg.sender, msg.value);
    }

    function GnosisSafe(address[] _owners, uint8 _required)
        public
    {
        require(   MAX_OWNERS >= _owners.length
                && _required <= _owners.length
                && _required >= 1);
        for (uint i = 0; i < _owners.length; i++) {
            require(   _owners[i] != 0
                    && !isOwner[_owners[i]]);
            isOwner[_owners[i]] = true;
            OwnerAddition(_owners[i]);
        }
        owners = _owners;
        required = _required;
        RequirementChange(_required);
    }

    function addOwner(address owner, uint8 _required)
        public
        onlyWallet
    {
        require(   owner != 0
                && !isOwner[owner]
                && MAX_OWNERS > owners.length);
        owners.push(owner);
        isOwner[owner] = true;
        OwnerAddition(owner);
        if (required != _required)
            changeRequired(_required);
    }

    function removeOwner(address owner, uint8 _required)
        public
        onlyWallet
    {
        require(   isOwner[owner]
                && (owners.length - 1) >= _required);
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.length--;
                break;
            }
        }
        isOwner[owner] = false;
        OwnerRemoval(owner);
        if (required != _required)
            changeRequired(_required);
    }

    function replaceOwner(address oldOwner, address newOwner)
        public
        onlyWallet
    {
        require(   newOwner != 0
                && isOwner[oldOwner]
                && !isOwner[newOwner]);
        for (uint i = 0; i < owners.length; i++) {
            if (owners[i] == oldOwner) {
                owners[i] = newOwner;
                break;
            }
        }
        isOwner[oldOwner] = false;
        isOwner[newOwner] =  true;
        OwnerReplacement(oldOwner, newOwner);
    }

    function changeRequired(uint8 _required)
        public
        onlyWallet
    {
        require(   _required <= owners.length
                && _required >= 1);
        required = _required;
        RequirementChange(_required);
    }

    function changeCondition(Condition _condition)
        public
        onlyWallet
    {
        require(address(_condition) != 0);
        condition = _condition;
        ConditionChange(_condition);
    }

    function addException(Exception exception)
        public
        onlyWallet
    {
        require(   address(exception) != 0
                && !isException[exception]);
        exceptions.push(exception);
        isException[exception] = true;
        ExceptionAddition(exception);
    }

    function removeException(Exception exception)
        public
        onlyWallet
    {
        require(isException[exception]);
        for (uint i = 0; i < exceptions.length; i++) {
            if (exceptions[i] == exception) {
                exceptions[i] = exceptions[exceptions.length - 1];
                exceptions.length--;
                break;
            }
        }
        isException[exception] = false;
        ExceptionRemoval(exception);
    }

    function confirmTransaction(bytes32 transactionHash)
        public
        onlyOwner
    {
        require(   !isExecuted[transactionHash]
                && !isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = true;
        Confirmation(msg.sender, transactionHash);
    }

    function confirmAndExecuteTransaction(address to, uint value, bytes data, Operation operation, uint nonce)
        public
        onlyOwner
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        confirmTransaction(transactionHash);
        executeTransaction(to, value, data, operation, nonce);
    }

    function confirmTransactionWithSignatures(bytes32 transactionHash, uint8[] v, bytes32[] r, bytes32[] s)
        public
        onlyOwner
    {
        for (uint i = 0; i < v.length; i++) {
            address signer = ecrecover(transactionHash, v[i], r[i], s[i]);
            require(   isOwner[signer]
                    && !isExecuted[transactionHash]
                    && !isConfirmed[transactionHash][signer]);
            isConfirmed[transactionHash][signer] = true;
            Confirmation(signer, transactionHash);
        }
    }

    function confirmAndExecuteTransactionWithSignatures(address to, uint value, bytes data, Operation operation, uint nonce, uint8[] v, bytes32[] r, bytes32[] s)
        public
        onlyOwner
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        confirmTransactionWithSignatures(transactionHash, v, r, s);
        executeTransaction(to, value, data, operation, nonce);
    }

    function revokeConfirmation(bytes32 transactionHash)
        public
        onlyOwner
    {
        require(   !isExecuted[transactionHash]
                && isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = false;
        Revocation(msg.sender, transactionHash);
    }

    function executeTransaction(address to, uint value, bytes data, Operation operation, uint nonce)
        public
        onlyOwner
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation, nonce);
        require(   !isExecuted[transactionHash]
                && isConfirmedByRequiredOwners(transactionHash)
                && (address(condition) == 0 || condition.isExecutable(msg.sender, to, value, data, operation, nonce)));
        isExecuted[transactionHash] = true;
        execute(to, value, data, operation);
    }

    function executeException(address to, uint value, bytes data, Operation operation, Exception exception)
        public
        onlyOwner
    {
        require(   isException[exception]
                && exception.isExecutable(msg.sender, to, value, data, operation));
        execute(to, value, data, operation);
    }

    function execute(address to, uint value, bytes data, Operation operation)
        private
    {
        if (operation == Operation.Call) {
            require(to.call.value(value)(data));
            CallExecution(msg.sender, to, value, data);
        }
        else if (operation == Operation.DelegateCall) {
            require(to.delegatecall(data));
            DelegateCallExecution(msg.sender, to, data);
        }
        else {
            address createdContract;
            assembly {
                createdContract := create(0, add(data, 0x20), mload(data))
            }
            require(createdContract != 0);
            CreateExecution(msg.sender, data, createdContract);
        }
    }

    function isConfirmedByRequiredOwners(bytes32 transactionHash)
        public
        view
        returns (bool)
    {
        uint confirmationCount;
        for (uint i = 0; i < owners.length; i++) {
            if (isConfirmed[transactionHash][owners[i]])
                confirmationCount++;
            if (confirmationCount == required)
                return true;
        }
        return false;
    }

    function getTransactionHash(address to, uint value, bytes data, Operation operation, uint nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(1), this, to, value, data, operation, nonce);
    }

    function getOwners()
        public
        view
        returns (address[])
    {
        return owners;
    }

    function getExceptions()
        public
        view
        returns (Exception[])
    {
        return exceptions;
    }
}
