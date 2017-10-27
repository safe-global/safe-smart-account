pragma solidity 0.4.17;
import "../Exception.sol";
import "../GnosisSafe.sol";


/// @title Social Recovery Exception - Allows to replace an owner without confirmations in case friends confirm the exceptional execution.
/// @author Stefan George - <stefan@gnosis.pm>
contract SocialRecoveryException is Exception {

    event Confirmation(address indexed friend, bytes32 transactionHash);

    string public constant NAME = "Social Recovery Exception";
    string public constant VERSION = "0.0.1";
    uint8 public constant MAX_OWNERS = 64;

    GnosisSafe public gnosisSafe;
    uint8 public required;
    address[] public friends;
    mapping (address => bool) public isFriend;
    mapping (bytes32 => bool) public isExecuted;
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;

    modifier onlyFriend() {
        require(isFriend[msg.sender]);
        _;
    }

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    function SocialRecoveryException(address[] _friends, uint8 _required)
        public
    {
        require(   MAX_OWNERS >= _friends.length
                && _required <= _friends.length
                && _required >= 1);
        for (uint i = 0; i < _friends.length; i++) {
            require(   _friends[i] != 0
                    && !isFriend[_friends[i]]);
            isFriend[_friends[i]] = true;
        }
        friends = _friends;
        required = _required;
        gnosisSafe = GnosisSafe(msg.sender);
    }

    function confirmTransaction(bytes32 transactionHash)
        public
        onlyFriend
    {
        require(   !isExecuted[transactionHash]
                && !isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = true;
        Confirmation(msg.sender, transactionHash);
    }

    function isExecutable(address sender, address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        bytes32 transactionHash = getTransactionHash(to, value, data, operation);
        if (   !isExecuted[transactionHash]
            && isConfirmedByRequiredFriends(transactionHash)) {
            isExecuted[transactionHash] = true;
            return true;
        }
        return false;
    }

    function isConfirmedByRequiredFriends(bytes32 transactionHash)
        public
        view
        returns (bool)
    {
        uint confirmationCount;
        for (uint i = 0; i < friends.length; i++) {
            if (isConfirmed[transactionHash][friends[i]])
                confirmationCount++;
            if (confirmationCount == required)
                return true;
        }
        return false;
    }

    function getTransactionHash(address to, uint value, bytes data, GnosisSafe.Operation operation)
        public
        view
        returns (bytes32)
    {
        return keccak256(to, value, data, operation);
    }
}
