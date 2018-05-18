pragma solidity 0.4.24;
import "../Enum.sol";
import "../Module.sol";
import "../ModuleManager.sol";
import "../OwnerManager.sol";


/// @title Social Recovery Module - Allows to replace an owner without Safe confirmations if friends approve the replacement.
/// @author Stefan George - <stefan@gnosis.pm>
contract SocialRecoveryModule is Module {

    string public constant NAME = "Social Recovery Module";
    string public constant VERSION = "0.0.1";
    bytes4 public constant REPLACE_OWNER_FUNCTION_IDENTIFIER = bytes4(keccak256("swapOwner(address,address,address)"));

    uint8 public threshold;
    address[] public friends;

    // isFriend mapping maps friend's address to friend status.
    mapping (address => bool) public isFriend;
    // isExecuted mapping maps data hash to execution status.
    mapping (bytes32 => bool) public isExecuted;
    // isConfirmed mapping maps data hash to friend's address to confirmation status.
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;

    modifier onlyFriend() {
        require(isFriend[msg.sender]);
        _;
    }

    /// @dev Setup function sets initial storage of contract.
    /// @param _friends List of friends' addresses.
    /// @param _threshold Required number of friends to confirm replacement.
    function setup(address[] _friends, uint8 _threshold)
        public
    {
        require(_threshold <= _friends.length);
        require(_threshold >= 2);
        setManager();
        // Set allowed friends.
        for (uint256 i = 0; i < _friends.length; i++) {
            address friend = _friends[i];
            require(friend != 0);
            require(!isFriend[friend]);
            isFriend[friend] = true;
        }
        friends = _friends;
        threshold = _threshold;
    }

    /// @dev Allows a friend to confirm a Safe transaction.
    /// @param dataHash Safe transaction hash.
    function confirmTransaction(bytes32 dataHash)
        public
        onlyFriend
    {
        require(!isExecuted[dataHash]);
        isConfirmed[dataHash][msg.sender] = true;
    }

    /// @dev Returns if Safe transaction is a valid owner replacement transaction.
    /// @param data Encoded owner replacement transaction.
    /// @return Returns if transaction can be executed.
    function recoverAccess(bytes data)
        public
    {
        // Only friends are allowed to execute the replacement.
        require(isFriend[msg.sender]);
        // Validate that transaction is a owner replacement transaction.
        bytes4 functionIdentifier;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            functionIdentifier := mload(add(data, 0x20))
        }
        require(functionIdentifier == REPLACE_OWNER_FUNCTION_IDENTIFIER);
        bytes32 dataHash = getDataHash(data);
        require(!isExecuted[dataHash]);
        require(isConfirmedByRequiredFriends(dataHash));
        isExecuted[dataHash] = true;
        require(manager.execTransactionFromModule(address(manager), 0, data, Enum.Operation.Call));
    }

    /// @dev Returns if Safe transaction is a valid owner replacement transaction.
    /// @param dataHash Data hash.
    /// @return Confirmation status.
    function isConfirmedByRequiredFriends(bytes32 dataHash)
        public
        view
        returns (bool)
    {
        uint256 confirmationCount;
        for (uint256 i = 0; i < friends.length; i++) {
            if (isConfirmed[dataHash][friends[i]])
                confirmationCount++;
            if (confirmationCount == threshold)
                return true;
        }
        return false;
    }

    /// @dev Returns hash of data encoding owner replacement.
    /// @param data Data payload.
    /// @return Data hash.
    function getDataHash(bytes data)
        public
        view
        returns (bytes32)
    {
        return keccak256(data);
    }
}
