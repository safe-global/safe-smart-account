pragma solidity 0.4.24;
import "../Module.sol";


/// @title Modifier - modifie all functions of the gnosis safe - made to test
/// @author clem
contract Filter is Module {

    address private constant qaxh = 0xeA41A27F8545d091ED604ac99CE46002eDA3E360;
    address private owner;
    address tokenAddress = 0x2414B35612cC7C4f2d49bf674651c9204a8164e4;

    modifier filterQaxh()
    {
        emit Event(msg.sender);
        require(msg.sender == qaxh, "This method can only be called by the qaxh address");
        _;
    }

    modifier filterOwner()
    {
        emit Event(msg.sender);
        require(msg.sender == owner, "This method can only be called by the owner of the safe");
        _;
    }

    event Event(
        address _address
    );

    event Log(
        uint256 _value
    );

    function loadAccount()
    filterOwner
    payable
    public
    {
        //transfert the money to the safe
        emit Log(msg.value);
    }

    function sendTo(address to, uint256 amount)
    filterOwner
    public
    {
        require(to != 0, "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");
        require(manager.execTransactionFromModule(to, amount, "", Enum.Operation.Call), "Could not execute ether transfer");
    }

    function transferToken(address to , uint256 amount)
    filterOwner
    public
    {
        require(to != 0, "Invalid to address provided");
        require(amount > 0, "Invalid amount provided");
        //require(manager.execTransactionAndPaySubmitter(to, amount, "Ox", Enum.Operation.Call, 50000, 50000, 1, tokenAddress ,"Ox"));
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

    bool public test = false;

}
