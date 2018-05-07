pragma solidity 0.4.23;
import "./SelfAuthorized.sol";

/// @title OwnerManager - Manages a set of owners and a threshold to perform actions.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract OwnerManager is SelfAuthorized {

    address[] public owners;
    uint8 public threshold;

    // isOwner mapping allows to check if an address is a Safe owner.
    mapping (address => bool) public isOwner;

    /// @dev Setup function sets initial storage of contract.
    /// @param _owners List of Safe owners.
    /// @param _threshold Number of required confirmations for a Safe transaction.
    function setupOwners(address[] _owners, uint8 _threshold)
        public
    {
        // Threshold can only be 0 at initialization.
        // Check ensures that setup function can only be called once.
        require(threshold == 0);
        // Validate that threshold is smaller than number of added owners.
        require(_threshold <= _owners.length);
        // There has to be at least one Safe owner.
        require(_threshold >= 1);
        // Initializing Safe owners.
        for (uint256 i = 0; i < _owners.length; i++) {
            // Owner address cannot be null.
            address owner = _owners[i];
            require(owner != 0);
            // No duplicate owners allowed.
            require(!isOwner[owner]);
            isOwner[owner] = true;
        }
        owners = _owners;
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
        authorized
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
        authorized
    {
        // Owner address cannot be null.
        require(newOwner != 0);
        // No duplicate owners allowed.
        require(!isOwner[newOwner]);
        // Validate owner address corresponds to owner index.
        require(owners[oldOwnerIndex] == oldOwner);
        isOwner[oldOwner] = false;
        isOwner[newOwner] = true;
        owners[oldOwnerIndex] = newOwner;
    }

    /// @dev Allows to update the number of required confirmations by Safe owners.
    ///      This can only be done via a Safe transaction.
    /// @param _threshold New threshold.
    function changeThreshold(uint8 _threshold)
        public
        authorized
    {
        // Validate that threshold is smaller than number of owners.
        require(_threshold <= owners.length);
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
        return isOwner[owner];
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
}
