pragma solidity 0.4.24;

contract ISignatureValidator {
    /**
    * @dev Should return whether the signature provided is valid for the provided data
    * @param _data Arbitrary length data signed on the behalf of address(this)
    * @param _signature Signature byte array associated with _data
    *
    * MUST return a bool upon valid or invalid signature with corresponding _data
    * MUST take (bytes, bytes) as arguments
    */ 
    function isValidSignature(
        bytes _data, 
        bytes _signature)
        public
        returns (bool isValid); 
}