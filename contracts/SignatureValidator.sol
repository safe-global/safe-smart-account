pragma solidity 0.4.24;


/// @title SignatureValidator - recovers a sender from a signature 
/// @author Ricardo Guilherme Schmidt (Status Research & Development GmbH) 
/// @author Richard Meissner - <richard@gnosis.pm>
contract SignatureValidator {
    
    /// @dev Recovers address who signed the message 
    /// @param txHash operation ethereum signed message hash
    /// @param messageSignature message `txHash` signature
    /// @param pos which signature to read
    function recoverKey (
        bytes32 txHash, 
        bytes messageSignature,
        uint256 pos
    )
        pure
        public
        returns (address) 
    {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = signatureSplit(messageSignature, pos);
        return ecrecover(txHash, v, r, s);
    }

    /// @dev divides bytes signature into `uint8 v, bytes32 r, bytes32 s`
    /// @param pos which signature to read
    /// @param signatures concatenated rsv signatures
    function signatureSplit(bytes signatures, uint256 pos)
        pure
        public
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(signatures, add(signaturePos, 0x41))), 0xff)
        }
    }
}
