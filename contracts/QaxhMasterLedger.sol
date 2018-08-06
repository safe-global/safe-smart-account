pragma solidity 0.4.24;

/// @title
/// @author clem
contract QaxhMasterLedger {

    address qaxh;
    bool neverInitialized = true;

    mapping (address => bool) private isQaxhSafe;

    //////////////a supprimer////////////////////////////////
    function setQaxh(
        address _qaxh
    )
    public
    {
        require(neverInitialized);
        qaxh = _qaxh;
        neverInitialized = false;
    }

    modifier filterQaxh {
        require( msg.sender == qaxh );
        _;
    }

    //should be called when creating a qaxh safe
    function addSafe(
        address safe
    )
    public
    filterQaxh
    returns (bool success)
    {
        isQaxhSafe[safe] = true;
        return isQaxhSafe[safe];
    }

    //just in case a safe is compromised
    function removeSafe(
        address safe
    )
    public
    filterQaxh
    returns (bool success)
    {
        isQaxhSafe[safe] = false;
        return !(isQaxhSafe[safe]);
    }

    function qaxhSafe(
        address safe
    )
    public
    view
    returns (bool answer)
    {
        return isQaxhSafe[safe];
    }

}