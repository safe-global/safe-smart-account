pragma solidity 0.4.21;
import "../Extension.sol";
import "../GnosisSafe.sol";


/// @title Pay Gas Extension
/// @author Richard Meissner - <richard@gnosis.pm>
contract PayGasExtension is Extension {
    event DebugEvent(address _executor, address _approver);

    string public constant NAME = "Pay Gas Extension";
    string public constant VERSION = "0.0.1";

    PayGasExtension masterCopy;
    GnosisSafe gnosisSafe;

    uint256 public nonce;

    modifier onlyGnosisSafe() {
        require(msg.sender == address(gnosisSafe));
        _;
    }

    /// @dev Allows to upgrade the contract. This can only be done via a Safe transaction.
    /// @param _masterCopy New contract address.
    function changeMasterCopy(PayGasExtension _masterCopy)
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

    /// @dev Setup function sets initial storage of contract.
    function setup()
        public
    {
        // gnosisSafe can only be 0 at initalization of contract.
        // Check ensures that setup function can only be called once.
        require(address(gnosisSafe) == 0);
        gnosisSafe = GnosisSafe(msg.sender);
    }

    /// @dev Allows to pay the msg.sender for executing the transaction.
    function payGas(address executor, uint256 price, uint8 v, bytes32 r, bytes32 s)
        public
    {
        bytes32 priceHash = getPriceHash(executor, price, nonce);
        address priceApprover = ecrecover(priceHash, v, r, s);
        require(gnosisSafe.isOwner(priceApprover));
        nonce += 1;
        gnosisSafe.executeExtension(executor, price, "", GnosisSafe.Operation.Call);
    }

    /// @dev Returns transactions hash to be signed by owners.
    /// @param _nonce Transaction nonce.
    /// @return Price hash.
    function getPriceHash(address executor, uint256 price, uint256 _nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(byte(0x19), byte(0), this, gnosisSafe, executor, price, _nonce);
    }
}
