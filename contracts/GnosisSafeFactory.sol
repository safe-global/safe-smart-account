pragma solidity 0.4.17;
import "./GnosisSafe.sol";


contract GnosisSafeFactory {

    event GnosisSafeCreation(address indexed creator, GnosisSafe gnosisSafe, address[] owners, uint8 required);

    function create(address[] owners, uint8 required)
        public
        returns (GnosisSafe gnosisSafe)
    {
        gnosisSafe = new GnosisSafe(owners, required);
        GnosisSafeCreation(msg.sender, gnosisSafe, owners, required);
    }
}
