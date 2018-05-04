pragma solidity 0.4.23;
import "./GnosisSafe.sol";
import "./MasterCopy.sol";
import "./PersonalEditionBase.sol";


/// @title Gnosis Safe - A multisignature wallet with support for confirmations using signed messages based on ERC191.
/// @author Stefan George - <stefan@gnosis.pm>
/// @author Richard Meissner - <richard@gnosis.pm>
contract GnosisSafePersonalEdition is MasterCopy, PersonalEditionBase, GnosisSafe {
  function setup(address[] _owners, uint8 _threshold, address to, bytes data)
      public
  {
      setupPersonalEdition();
      super.setup(_owners, _threshold, to, data);
  }

  function transfer(address to, uint256 value)
      internal
  {
      tx.origin.transfer(value);
  }
}
