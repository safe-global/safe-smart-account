

methods {
  function nonce() external returns (uint256) envfree;
  // function checkSignatures(bytes32 dataHash, bytes, bytes signatures) external envfree => CVLcheckSignatures(dataHash, signatures);
  function getTransactionHash(address,uint256,Enum.Operation,uint256,uint256,uint256,address,address,uint256) external returns (bytes32) envfree;
  function checkSignatures(bytes32,bytes,bytes) external;

  function call_keccak256(bytes) external returns (bytes32) envfree;

  function getTransactionHash(
        address to,
        uint256 value,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) internal returns (bytes32) =>  transactionHashGhost(to, value, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, _nonce) ;

    // function SignatureDecoder.signatureSplit(bytes memory signatures, uint256 pos)  internal returns (uint8, bytes32, bytes32) =>
    //     signatureSplitCVL(call_keccak256(signatures), pos);

    function _.isValidSignature(bytes32 dataHash, bytes signatures) external =>
        isValidSignatureCVL(dataHash, call_keccak256(signatures)) expect bytes4;
}

// ghost v_part(bytes32, uint256) returns uint8;
// ghost r_part(bytes32, uint256) returns bytes32;
// ghost s_part(bytes32, uint256) returns bytes32;

// function signatureSplitCVL(bytes32 signatures, uint256 pos) returns (uint8, bytes32, bytes32)  {
//     return (v_part(signatures, pos) , r_part(signatures, pos) , s_part(signatures, pos)) ;
// }

// 0x1626ba7e

ghost isValidSignatureCVL(bytes32, bytes32) returns bytes4;


ghost transactionHashGhost(address /*to */, uint256 /*value */, Enum.Operation /*operation*/, uint256 /*safeTxGas */,
        uint256 /*baseGas*/,
        uint256 /*gasPrice*/,
        address /*gasToken*/,
        address /*refundReceiver*/,
        uint256 /*_nonce*/ ) returns bytes32 ; 


rule ownerSignaturesAreProvidedForExecTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas, 
        uint256 gasPrice, 
        address gasToken, 
        address refundReceiver, 
        bytes signatures
    ) {
    uint256 nonce = nonce();
    bytes32 transactionHash = getTransactionHash(
        to,
        value,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        nonce
    );
    
    env e;
    require e.msg.value == 0;
    bytes encodedTransactionData;
    require encodedTransactionData.length <= 66;
    checkSignatures@withrevert(e, transactionHash, encodedTransactionData, signatures);
    bool checkSignaturesOk = !lastReverted;

    execTransaction(e, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

    assert checkSignaturesOk, "transaction executed without valid signatures";
}