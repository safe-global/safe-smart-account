pragma solidity 0.4.23;
import "./SelfAuthorized.sol";

/// @title OwnerManager - Manages a set of owners and a threshold to perform actions.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract OwnerManager is SelfAuthorized {

    address public constant OWNERS_SENTINEL = address(0x1);

    mapping(address => address) public owners;
    uint256 ownerCount;
    uint8 public threshold;

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    function setupOwners(address[] _owners, uint8 _threshold)
        internal
    {
        // Threshold can only be 0 at initialization.
        // Check ensures that setup function can only be called once.
        require(threshold == 0);
        // Validate that threshold is smaller than number of added owners.
        require(_threshold <= _owners.length);
        // There has to be at least one Safe owner.
        require(_threshold >= 1);
        // Initializing Safe owners.
        address currentOwner = OWNERS_SENTINEL;
        for (uint256 i = 0; i < _owners.length; i++) {
            // Owner address cannot be null.
            address owner = _owners[i];
            require(owner != 0 && owner != OWNERS_SENTINEL);
            // No duplicate owners allowed.
            require(owners[owner] == 0);
            owners[currentOwner] = owner;
            currentOwner = owner;
        }
        owners[currentOwner] = OWNERS_SENTINEL;
        ownerCount = _owners.length;
        threshold = _threshold;
    }

    /// @dev Allows to add a new owner to the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param owner New owner address.
    /// @param _threshold New threshold.
    function addOwner(address owner, uint8 _threshold)
        public
        authorized
    {
        // Owner address cannot be null.
        require(owner != 0 && owner != OWNERS_SENTINEL);
        // No duplicate owners allowed.
        require(owners[owner] == 0);
        owners[owner] = owners[OWNERS_SENTINEL];
        owners[OWNERS_SENTINEL] = owner;
        ownerCount++;
        // Change threshold if threshold was changed.
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to remove an owner from the Safe and update the threshold at the same time.
    ///      This can only be done via a Safe transaction.
    /// @param prevOwner Owner that pointed to the owner to be removed in the linked list
    /// @param owner Owner address to be removed.
    /// @param _threshold New threshold.
    function removeOwner(address prevOwner, address owner, uint8 _threshold)
        public
        authorized
    {
        // Only allow to remove an owner, if threshold can still be reached.
        require(ownerCount - 1 >= _threshold);
        // Validate owner address corresponds to owner index.
        require(owners[prevOwner] == owner);
        owners[prevOwner] = owners[owner];
        owners[owner] = 0;
        ownerCount--;
        // Change threshold if threshold was changed.
        if (threshold != _threshold)
            changeThreshold(_threshold);
    }

    /// @dev Allows to swap/replace an owner from the Safe with another address.
    ///      This can only be done via a Safe transaction.
    /// @param prevOwner Owner that pointed to the owner to be replaced in the linked list
    /// @param oldOwner Owner address to be replaced.
    /// @param newOwner New owner address.
    function swapOwner(address prevOwner, address oldOwner, address newOwner)
        public
        authorized
    {
        // Owner address cannot be null.
        require(newOwner != 0 && newOwner != OWNERS_SENTINEL);
        // No duplicate owners allowed.
        require(owners[newOwner] == 0);
        // Validate owner address corresponds to owner index.
        require(owners[prevOwner] == oldOwner);
        owners[newOwner] = owners[oldOwner];
        owners[prevOwner] = newOwner;
        owners[oldOwner] = 0;
    }

    /// @dev Allows to update the number of required confirmations by Safe owners.
    ///      This can only be done via a Safe transaction.
    /// @param _threshold New threshold.
    function changeThreshold(uint8 _threshold)
        public
        authorized
    {
        // Validate that threshold is smaller than number of owners.
        require(_threshold <= ownerCount);
        // There has to be at least one Safe owner.
        require(_threshold >= 1);
        threshold = _threshold;
    }

    function threshold()
        public
        view
        returns (uint8)
    {
        return threshold;
    }

    function isOwner(address owner)
        public
        view
        returns (bool)
    {
        return owners[owner] != 0;
    }

    /// @dev Returns array of owners.
    /// @return Array of Safe owners.
    function getOwners()
        public
        view
        returns (address[])
    {
        address[] memory array = new address[](ownerCount);

        // populate return array
        uint256 index = 0;
        address currentOwner = owners[OWNERS_SENTINEL];
        while(currentOwner != OWNERS_SENTINEL) {
            array[index] = currentOwner;
            currentOwner = owners[currentOwner];
            index ++;
        }
        return array;
    }
}
