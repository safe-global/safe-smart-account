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
    GnosisSafe public gnosisSafe;
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

    /// @dev Constructor function triggers setup function.
    /// @param _friends List of friends' addresses.
    /// @param _threshold Required number of friends to confirm replacement.
    function SocialRecoveryExtension(address[] _friends, uint8 _threshold)
        public
    {
        setup(_friends, _threshold);
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
            require(_friends[i] != 0);
            require(!isFriend[_friends[i]]);
            isFriend[_friends[i]] = true;
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
    /// @param sender Friend's address.
    /// @param to Gnosis Safe address.
    /// @param value No Ether should be send.
    /// @param data Encoded owner replacement transaction.
    /// @param operation Only Call operations are allowed.
    /// @return Returns if transaction can be executed.
    function isExecutable(address sender, address to, uint256 value, bytes data, GnosisSafe.Operation operation)
        public
        onlyGnosisSafe
        returns (bool)
    {
        // Only friends are allowed to execute the replacement.
        require(isFriend[sender]);
        require(to == address(gnosisSafe));
        require(value == 0);
        require(operation == GnosisSafe.Operation.Call);
        // Validate that transaction is a owner replacement transaction.
        bytes4 functionIdentifier;
        assembly {
            functionIdentifier := mload(add(data, 0x20))
        }
        require(functionIdentifier == REPLACE_OWNER_FUNCTION_IDENTIFIER);
        bytes32 dataHash = getDataHash(data);
        if (   !isExecuted[dataHash]
            && isConfirmedByRequiredFriends(dataHash)) {
            isExecuted[dataHash] = true;
            return true;
        }
        return false;
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
