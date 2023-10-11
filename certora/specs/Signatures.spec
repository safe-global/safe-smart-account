methods {
    function getThreshold() external returns (uint256) envfree;
    function nonce() external returns (uint256) envfree;
    function isOwner(address) external returns (bool) envfree;

    // harnessed
    function signatureSplitPublic(bytes,uint256) external returns (uint8,bytes32,bytes32) envfree;
    function getCurrentOwner(bytes32, uint8, bytes32, bytes32) external returns (address) envfree;
    // needed for the getTransactionHash ghost for the execTransaction <> signatures rule
    // function callKeccak256(bytes) external returns (bytes32) envfree;

    // summaries
    function SignatureDecoder.signatureSplit(bytes memory signatures, uint256 pos) internal returns (uint8,bytes32,bytes32) => signatureSplitGhost(signatures,pos);
    function Safe.checkContractSignature(address, bytes32, bytes memory, uint256) internal => NONDET;
    // needed for the execTransaction <> signatures rule
    // function getTransactionHash(
    //     address to,
    //     uint256 value,
    //     bytes data,
    //     Enum.Operation operation,
    //     uint256 safeTxGas,
    //     uint256 baseGas,
    //     uint256 gasPrice,
    //     address gasToken,
    //     address refundReceiver,
    //     uint256 _nonce
    // ) external returns (bytes32) => transactionHashGhost(to, value, callKeccak256(data), operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, _nonce) ;

    // optional
    function checkSignatures(bytes32,bytes,bytes) external;
    function execTransaction(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,bytes) external returns (bool);
}

definition MAX_UINT256() returns uint256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

ghost mapping(bytes => mapping(uint256 => uint8)) mySigSplitV;
ghost mapping(bytes => mapping(uint256 => bytes32)) mySigSplitR;
ghost mapping(bytes => mapping(uint256 => bytes32)) mySigSplitS;

// This is needed for the execTransaction <> signatures rule
// ghost transactionHashGhost(
//         address /*to */, 
//         uint256 /*value */, 
//         bytes32, 
//         Enum.Operation /*operation*/,
//         uint256 /*safeTxGas */,
//         uint256 /*baseGas*/,
//         uint256 /*gasPrice*/,
//         address /*gasToken*/,
//         address /*refundReceiver*/,
//         uint256 /*_nonce*/ ) returns bytes32 ; 

function signatureSplitGhost(bytes signatures, uint256 pos) returns (uint8,bytes32,bytes32) {
    return (mySigSplitV[signatures][pos], mySigSplitR[signatures][pos], mySigSplitS[signatures][pos]);
}

// checkNSignatures called once for each signature is equivalent to calling checkSignatures with
// both signatures concatenated
rule checkSignatures() {
    bytes32 dataHash;
    bytes data;
    address executor;
    env e;
    bytes signaturesAB;
    bytes signaturesA;
    bytes signaturesB;
    uint8 vA; bytes32 rA; bytes32 sA;
    uint8 vB; bytes32 rB; bytes32 sB;
    uint8 vAB1; bytes32 rAB1; bytes32 sAB1;
    uint8 vAB2; bytes32 rAB2; bytes32 sAB2;
    vA, rA, sA = signatureSplitPublic(signaturesA, 0);
    vB, rB, sB = signatureSplitPublic(signaturesB, 0);
    vAB1, rAB1, sAB1 = signatureSplitPublic(signaturesAB, 0);
    vAB2, rAB2, sAB2 = signatureSplitPublic(signaturesAB, 1);
    require to_mathint(signaturesAB.length) == signaturesA.length + signaturesB.length;

    require vA == vAB1 && rA == rAB1 && sA == sAB1;
    require vB == vAB2 && rB == rAB2 && sB == sAB2;
    require vA != 0 && vB != 0;
    require data.length == 0;
    require !isOwner(currentContract);
    require getThreshold() == 2;
    require getCurrentOwner(dataHash, vA, rA, sA) < getCurrentOwner(dataHash, vB, rB, sB);
    require executor == e.msg.sender;

    checkNSignatures@withrevert(e, executor, dataHash, data, signaturesA, 1);
    bool successA = !lastReverted;
    checkNSignatures@withrevert(e, executor, dataHash, data, signaturesB, 1);
    bool successB = !lastReverted;

    checkSignatures@withrevert(e, dataHash, data, signaturesAB);
    bool successAB = !lastReverted;

    assert (successA && successB) <=> successAB, "checkNSignatures called twice separately must be equivalent to checkSignatures";
}

// This rule doesn't run because of a prover error at the moment.
// rule ownerSignaturesAreProvidedForExecTransaction(
//         address to,
//         uint256 value,
//         bytes data,
//         Enum.Operation operation,
//         uint256 safeTxGas,
//         uint256 baseGas,
//         uint256 gasPrice,
//         address gasToken,
//         address refundReceiver,
//         bytes signatures
//     ) {
//     uint256 nonce = nonce();
//     bytes32 transactionHash = getTransactionHash(
//         to,
//         value,
//         data,
//         operation,
//         safeTxGas,
//         baseGas,
//         gasPrice,
//         gasToken,
//         refundReceiver,
//         nonce
//     );

//     env e;
//     require e.msg.value == 0;
//     bytes encodedTransactionData;
//     require encodedTransactionData.length <= 66;
//     checkSignatures@withrevert(e, transactionHash, encodedTransactionData, signatures);
//     bool checkSignaturesOk = !lastReverted;

//     execTransaction(e, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

//     assert checkSignaturesOk, "transaction executed without valid signatures";
// }
