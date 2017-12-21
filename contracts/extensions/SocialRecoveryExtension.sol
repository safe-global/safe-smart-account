pragma solidity 0.4.19;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Social Recovery Extension - Allows to replace an owner without if friends approve the replacement.
/// @author Stefan George - <stefan@gnosis.pm>
contract SocialRecoveryExtension is Extension {

    string public constant NAME = "Social Recovery Extension";
    string public constant VERSION = "0.0.1";
    bytes4 public constant REPLACE_OWNER_FUNCTION_IDENTIFIER = hex"65098b86";

    SocialRecoveryExtension masterCopy;
    GnosisSafe public gnosisSafe;
    uint8 public threshold;
    address[] public friends;
    mapping (address => bool) public isFriend;
    mapping (bytes32 => bool) public isExecuted;
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    modifier onlyFriend() {
        require(isFriend[msg.sender]);
        _;
    }

    function SocialRecoveryExtension(address[] _friends, uint8 _threshold)
        public
    {
        setup(_friends, _threshold);
    }

    function setup(address[] _friends, uint8 _threshold)
        public
    {
        require(address(gnosisSafe) == 0);
        gnosisSafe = GnosisSafe(msg.sender);
        require(_threshold <= _friends.length);
        require(_threshold >= 2);
        for (uint256 i = 0; i < _friends.length; i++) {
            require(_friends[i] != 0);
            require(!isFriend[_friends[i]]);
            isFriend[_friends[i]] = true;
        }
        friends = _friends;
        threshold = _threshold;
    }

    function changeMasterCopy(SocialRecoveryExtension _masterCopy)
        public
        onlyGnosisSafe
    {
        require(address(_masterCopy) != 0);
        masterCopy = _masterCopy;
    }

    function confirmTransaction(bytes32 transactionHash)
        public
        onlyFriend
    {
        require(!isExecuted[transactionHash]);
        require(!isConfirmed[transactionHash][msg.sender]);
        isConfirmed[transactionHash][msg.sender] = true;
    }

    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        require(to == address(gnosisSafe));
        require(value == 0);
        require(operation == GnosisSafe.Operation.Call);
        bytes4 functionIdentifier;
        assembly {
            functionIdentifier := mload(add(data, 0x20))
        }
        require(functionIdentifier == REPLACE_OWNER_FUNCTION_IDENTIFIER);
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
        uint256 confirmationCount;
        for (uint256 i = 0; i < friends.length; i++) {
            if (isConfirmed[transactionHash][friends[i]])
                confirmationCount++;
            if (confirmationCount == threshold)
                return true;
        }
        return false;
    }

    function getTransactionHash(address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        view
        returns (bytes32)
    {
        return keccak256(to, value, data, operation);
    }
}
