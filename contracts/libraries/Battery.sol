pragma solidity 0.4.23;


/// @title Battery - Very simple contract that allows to "mine" gas.
/// @author Richard Meissner - <richard@gnosis.pm>
contract Battery {

  uint256 public level = 0;
  mapping (uint256 => uint256) charges;

  function charge(uint256 amount)
      public
  {
      uint256 new_level = level + amount;
      for (uint256 i = level; i < level + amount; i++) {
          charges[i] = 1;
      }
      level = new_level;
  }

  function discharge(uint256 amount)
      public
  {
      uint256 new_level = level - amount;
      for (uint256 i = level; i > level - amount; i--) {
          delete charges[i];
      }
      level = new_level;
  }
}
