pragma solidity >=0.5.0 <0.7.0;
import "../base/Module.sol";
import "../base/ModuleManager.sol";
import "../base/OwnerManager.sol";
import "../common/Enum.sol";


/// @title Bequest Module - Allows to bequest all funds on the wallet to be withdrawn after a given time.
/// @author Victor Porton - <porton@narod.ru>
/// Moreover, after the given time the heir can execute any transaction on the inherited wallet.
/// TODO: Test.
contract DailyLimitModule is Module {

    string public constant NAME = "Bequest Module";
    string public constant VERSION = "0.0.1";

    event SetBequestDate(address wallet, address heir, uint time);

    /// Who inherits control over the wallet.
    address public heir;
    /// Funds can be withdrawn after this point of time.
    uint public bequestDate;

    /// @dev Setup function sets initial storage of contract.
    /// @param _heir Who inherits control over the wallet (you can set to 0 to avoid inheriting).
    /// @param _bequestDate Funds can be withdrawn after this point of time.
    function setup(address _heir, uint _bequestDate)
        public
    {
        setManager();
        heir = _heir;
        bequestDate = _bequestDate;
    }

    /// @dev Changes bequest settings.
    /// @param _heir Who inherits control over the wallet (you can set to 0 to avoid inheriting).
    /// @param _bequestDate Funds can be withdrawn after this point of time.
    function changeHeirAndDate(address _heir, uint _bequestDate)
        public
        authorized
    {
        heir = _heir;
        bequestDate = _bequestDate;
        emit SetBequestDate(address(this), _heir, _bequestDate);
    }

    function execute(address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights
    {
        require(manager.execTransactionFromModule(to, value, data, operation), "Could not execute transaction");
    }

    function executeReturnData(address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights
        returns (bytes memory returnData)
    {
        (bool success, bytes memory _returnData) = manager.execTransactionFromModuleReturnData(to, value, data, operation);
        require(success, "Could not execute transaction");
        returnData = _returnData;
    }

    modifier enteredIntoInheritanceRights() {
        require(msg.sender == heir && block.timestamp >= bequestDate, "No rights to take");
        _;
    }
}
