pragma solidity 0.4.24;
import "../Module.sol";


/// @title Modifier - modifie all functions of the gnosis safe - made to test
/// @author clem
contract Filter is Module {

    address private constant qaxh = 0xeA41A27F8545d091ED604ac99CE46002eDA3E360;
    address private owner;

    modifier filterQaxh() {
        emit Event(msg.sender);
        require(msg.sender == qaxh, "Method can only be called by the qaxh address");
        _;
    }

    modifier filterOwner() {
        emit Event(msg.sender);
        require(msg.sender == owner, "Method can only be called by the owner of the safe");
        _;
    }

    event Event(
        address _address
    );

    function executeFilter(address to, uint256 amount)
    filterOwner
    public
    {
        // Only Safe owners are allowed to execute daily limit transactions.
        //require(OwnerManager(manager).isOwner(msg.sender), "Method can only be called by an owner");
        require(to != 0, "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");
        require(manager.execTransactionFromModule(to, amount, "", Enum.Operation.Call), "Could not execute ether transfer");
    }

    function replaceOwner(address newOwner)
    filterQaxh
    public
    {
        owner = newOwner;
    }

    function getOwner()
    public
    view
    returns (address _owner)
    {
        return owner;
    }

    /// @dev Setup function sets manager
    function setup()
    public
    {
        setManager();
        //owner = _owner;
    }
}
