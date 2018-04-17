pragma solidity 0.4.21;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Social Recovery Extension - Allows to replace an owner without Safe confirmations if friends approve the replacement.
/// @author Stefan George - <stefan@gnosis.pm>
contract SocialRecoveryExtension is Extension {

    string public constant NAME = "Social Recovery Extension";
    string public constant VERSION = "0.0.1";
    bytes4 public constant REPLACE_OWNER_FUNCTION_IDENTIFIER = hex"54e99c6e";

    SocialRecoveryExtension masterCopy;
    GnosisSafe gnosisSafe;

    uint8 public threshold;
    address[] public friends;

    // isFriend mapping maps friend's address to friend status.
    mapping (address => bool) public isFriend;
    // isExecuted mapping maps data hash to execution status.
    mapping (bytes32 => bool) public isExecuted;
    // isConfirmed mapping maps data hash to friend's address to confirmation status.
    mapping (bytes32 => mapping (address => bool)) public isConfirmed;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

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
        // gnosisSafe can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(gnosisSafe) == 0);
        require(_threshold <= _friends.length);
        require(_threshold >= 2);
        gnosisSafe = GnosisSafe(msg.sender);
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

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract address.
    function changeMasterCopy(SocialRecoveryExtension _masterCopy)
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
        assembly {
            functionIdentifier := mload(add(data, 0x20))
        }
        require(functionIdentifier == REPLACE_OWNER_FUNCTION_IDENTIFIER);
        bytes32 dataHash = getDataHash(data);
        require(!isExecuted[dataHash]);
        require(isConfirmedByRequiredFriends(dataHash));
        isExecuted[dataHash] = true;
        gnosisSafe.executeExtension(address(gnosisSafe), 0, data, GnosisSafe.Operation.Call);
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
