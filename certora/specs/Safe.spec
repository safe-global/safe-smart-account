methods {
    function getThreshold() external returns (uint256) envfree;
    function disableModule(address,address) external;
    function nonce() external returns (uint256) envfree;
    function isOwner(address) external returns (bool) envfree;
    function signedMessages(bytes32) external returns (uint256) envfree;
    function signatureSplitPublic(bytes,uint256) external returns (uint8,bytes32,bytes32) envfree;
    function getTransactionHash(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,uint256) external returns (bytes32) envfree;

    // harnessed
    function getModule(address) external returns (address) envfree;
    function getSafeGuard() external returns (address) envfree;
    function getNativeTokenBalance() external returns (uint256) envfree;
    function getOwnersCount() external returns (uint256) envfree;
    function getOwnersCountFromArray() external returns (uint256) envfree;
    function getCurrentOwner(bytes32, uint8, bytes32, bytes32) external returns (address) envfree;

    // summaries
    function SignatureDecoder.signatureSplit(bytes memory signatures, uint256 pos) internal returns (uint8,bytes32,bytes32) => mySignatureSplit(signatures,pos);
    function Safe.checkExternalSignature(address, bytes32, bytes memory) internal => NONDET;

    // optional
    function checkSignatures(bytes32,bytes,bytes) external envfree;
    function execTransactionFromModuleReturnData(address,uint256,bytes,Enum.Operation) external returns (bool, bytes memory);
    function execTransactionFromModule(address,uint256,bytes,Enum.Operation) external returns (bool);
    function execTransaction(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,bytes) external returns (bool);
    function _.isValidSignature(bytes32, bytes) external => NONDET;
}

definition noHavoc(method f) returns bool =
    f.selector != sig:execTransactionFromModuleReturnData(address,uint256,bytes,Enum.Operation).selector
    && f.selector != sig:execTransactionFromModule(address,uint256,bytes,Enum.Operation).selector
    && f.selector != sig:execTransaction(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,bytes).selector;

definition reachableOnly(method f) returns bool =
    f.selector != sig:setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != sig:simulateAndRevert(address,bytes).selector
    // getStorageAt cannot be used because we have a hook to sstore
    // A quote from the Certora team:
    // "If it’s called from an internal context it is fine but as a public function that can be called with any argument it cannot have hooks applied on."
    && f.selector != sig:getStorageAt(uint256,uint256).selector;

definition MAX_UINT256() returns uint256 = 0xffffffffffffffffffffffffffffffff;

ghost mapping(bytes => mapping(uint256 => uint8)) mySigSplitV;
ghost mapping(bytes => mapping(uint256 => bytes32)) mySigSplitR;
ghost mapping(bytes => mapping(uint256 => bytes32)) mySigSplitS;

function mySignatureSplit(bytes signatures, uint256 pos) returns (uint8,bytes32,bytes32) {
    return (mySigSplitV[signatures][pos], mySigSplitR[signatures][pos], mySigSplitS[signatures][pos]);
}

/// Nonce must never decrease
rule nonceMonotonicity(method f) filtered {
    f -> reachableOnly(f)
} {
    uint256 nonceBefore = nonce();

    // The nonce may overflow, but since it's increased only by 1 with each transaction, it is not realistically possible to overflow it.
    require nonceBefore < MAX_UINT256();

    calldataarg args; env e;
    f(e, args);

    uint256 nonceAfter = nonce();

    assert nonceAfter != nonceBefore =>
        to_mathint(nonceAfter) == nonceBefore + 1 && f.selector == sig:execTransaction(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,bytes).selector;
}


// The singleton is a private variable, so we need to use a ghost variable to track it.
ghost address ghostSingletonAddress {
    init_state axiom ghostSingletonAddress == 0;
}

hook Sstore SafeHarness.(slot 0) address newSingletonAddress STORAGE {
    ghostSingletonAddress = newSingletonAddress;
}

// This is EIP-1967's singleton storage slot:
// 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
// converted to decimal because certora doesn't seem to support hex yet.
hook Sstore SafeHarness.(slot 24440054405305269366569402256811496959409073762505157381672968839269610695612) address newSingletonAddress STORAGE {
    ghostSingletonAddress = newSingletonAddress;
}

invariant sigletonAddressNeverChanges()
    ghostSingletonAddress == 0
    filtered { f -> reachableOnly(f) && f.selector != sig:getStorageAt(uint256,uint256).selector }

ghost address fallbackHandlerAddress {
    init_state axiom fallbackHandlerAddress == 0;
}

// This is Safe's fallback handler storage slot:
// 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5
// converted to decimal because certora doesn't seem to support hex yet.
hook Sstore SafeHarness.(slot 49122629484629529244014240937346711770925847994644146912111677022347558721749) address newFallbackHandlerAddress STORAGE {
    fallbackHandlerAddress = newFallbackHandlerAddress;
}

rule fallbackHandlerAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address fbHandlerBefore = fallbackHandlerAddress;

    calldataarg args; env e;
    f(e, args);

    address fbHandlerAfter = fallbackHandlerAddress;

    assert fbHandlerBefore != fbHandlerAfter =>
        f.selector == sig:setup(address[],uint256,address,bytes,address,address,uint256,address).selector || f.selector == sig:setFallbackHandler(address).selector;
}


rule guardAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address guardBefore = getSafeGuard();

    calldataarg args; env e;
    f(e, args);

    address guardAfter = getSafeGuard();

    assert guardBefore != guardAfter =>
        f.selector == sig:setGuard(address).selector;
}

invariant noSignedMessages(bytes32 message)
    signedMessages(message) == 0
    filtered { f -> reachableOnly(f) }

rule nativeTokenBalanceSpending(method f) filtered {
    f -> reachableOnly(f)
} {
    uint256 balanceBefore = getNativeTokenBalance();

    calldataarg args; env e;
    f(e, args);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore =>
        f.selector == sig:execTransaction(address,uint256,bytes,Enum.Operation,uint256,uint256,uint256,address,address,bytes).selector
        || f.selector == sig:execTransactionFromModule(address,uint256,bytes,Enum.Operation).selector
        || f.selector == sig:execTransactionFromModuleReturnData(address,uint256,bytes,Enum.Operation).selector;
}

// checkSignatures called once is equivalent to checkSignatures called twice
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
    require data.length < 1000;
    require signaturesA.length < 1000;
    require signaturesB.length < 1000;
    require signaturesAB.length < 1000;
    require signaturesA.length >= 65;
    require signaturesB.length >= 65;
    require signaturesAB.length >= 130;
    require !isOwner(currentContract);
    require getThreshold() <= 2;
    require getCurrentOwner(dataHash, vA, rA, sA) < getCurrentOwner(dataHash, vB, rB, sB);

    checkNSignatures@withrevert(e, executor, dataHash, data, signaturesA, 1);
    bool successA = !lastReverted;
    checkNSignatures@withrevert(e, executor, dataHash, data, signaturesB, 1);
    bool successB = !lastReverted;

    checkNSignatures@withrevert(e, executor, dataHash, data, signaturesAB, 2);
    bool successAB = !lastReverted;

    assert (successA && successB) <=> successAB, "checkSignatures called must be equivalent to checkSignatures called twice";
}

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
        data,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        nonce
    );

    bytes encodedTransactionData;
    checkSignatures@withrevert(transactionHash, encodedTransactionData, signatures);
    bool checkSignaturesOk = !lastReverted;

    env e;
    execTransaction(e, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

    assert checkSignaturesOk, "transaction executed without valid signatures";
}


rule nativeTokenBalanceSpendingExecTransaction(
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
    uint256 balanceBefore = getNativeTokenBalance();

    env e;
    execTransaction(e, to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures);

    uint256 balanceAfter = getNativeTokenBalance();

    assert
        gasPrice == 0 => to_mathint(balanceBefore - value) <= to_mathint(balanceAfter)
        // When the gas price is non-zero and the gas token is zero (zero = native token), the refund params should also be taken into account.
        || gasPrice > 0 && gasToken == 0 => to_mathint(balanceBefore - value - (gasPrice * (baseGas + safeTxGas))) <= to_mathint(balanceAfter);
}

rule nativeTokenBalanceSpendingExecTransactionFromModule(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation
    ) {
    uint256 balanceBefore = getNativeTokenBalance();
    env e;

    execTransactionFromModule(e, to, value, data, operation);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore =>
        to_mathint(balanceBefore - value) <= to_mathint(balanceAfter);
}


rule nativeTokenBalanceSpendingExecTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation
) {
    uint256 balanceBefore = getNativeTokenBalance();
    env e;

    execTransactionFromModuleReturnData(e, to, value, data, operation);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore =>
        to_mathint(balanceBefore - value) <= to_mathint(balanceAfter);
}

rule safeOwnerCountConsistency(method f) filtered {
    f -> reachableOnly(f)
} {
    calldataarg args; env e;
    f(e, args);

    assert getOwnersCount() == getOwnersCountFromArray();
}

rule moduleOnlyAddedThroughEnableModule(method f, address module) filtered {
    f -> reachableOnly(f)
} {
    require getModule(module) == 0;

    calldataarg args; env e;
    f(e, args);

    assert getModule(module) != 0 =>
        f.selector == sig:enableModule(address).selector;
}


rule onlyModuleCanExecuteModuleThransactions(
    address to,
    uint256 value,
    bytes data,
    Enum.Operation operation
) {
    env e;

    execTransactionFromModule@withrevert(e, to, value, data, operation);
    assert !lastReverted => getModule(e.msg.sender) != 0, "Only modules can execute module transactions";
}

rule onlyModuleCanExecuteModuleThransactionsWithReturnData(
    address to,
    uint256 value,
    bytes data,
    Enum.Operation operation
) {
    env e;

    execTransactionFromModuleReturnData@withrevert(e, to, value, data, operation);
    assert !lastReverted => getModule(e.msg.sender) != 0, "Only modules can execute module transactions";
}
