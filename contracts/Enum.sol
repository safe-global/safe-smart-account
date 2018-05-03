pragma solidity 0.4.21;


/// @title Enum - Collection of enums
/// @author Richard Meissner - <richard@gnosis.pm>
contract Enum {
  enum Operation {
      Call,
      DelegateCall,
      Create
  }
}
