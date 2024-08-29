// All rules of SafeToL2Setup without sanity check
// https://prover.certora.com/output/80942/a9e5af4904e44469b444af673d6c269c?anonymousKey=9e332637f5c2c07cabb080f8043bfd99e33d7bbe

// All rules of SafeToL2Setup with sanity check
// https://prover.certora.com/output/80942/3cbb0c40489045488279deda0cfa9a4a?anonymousKey=f7fd8636ff12c6d589a46ac56d312e394a382004

using SafeToL2Setup as SafeToL2Setup;
using SafeMock as SafeMock;

// _SELF is always the current contract
// if the "rule_sanity": "basic" flag is enabled this rule would fail sanity check
// passes - https://prover.certora.com/output/80942/a2558c3b8fcf46a8bf3df94600026345?anonymousKey=c168a08554d2c1d9226269a72567e82e0dc1805a
invariant _SELFisAlwaysCurrentContract()
    SafeToL2Setup._SELF == SafeToL2Setup;


// all the non-view functions will revert when called directly (only delegateCall is allowed)
// passes - https://prover.certora.com/output/80942/a2558c3b8fcf46a8bf3df94600026345?anonymousKey=c168a08554d2c1d9226269a72567e82e0dc1805a
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant _SELFisAlwaysCurrentContract;
    SafeToL2Setup.f@withrevert(e,args);
    assert lastReverted;
}

// delegateCall to setupToL2() can succeed only if Safe's nonce is zero
// passes - https://prover.certora.com/output/80942/35c91add2768483d92deb5d864e7e5e4?anonymousKey=02d1291b5b390f7ff332b44d9f8465e7d0991651
rule nonceMustBeZero(env e) {
    // get current nonce of the Safe contract
    uint256 currentNonce = SafeMock.getNonce(e);
    address singletonContract;

    SafeMock.delegateCallSetupToL2@withrevert(e, singletonContract);
    bool callReverted = lastReverted;

    assert !callReverted => currentNonce == 0;
}


// the singleton contract can be updated only if the chainId is not 1
// passes - https://prover.certora.com/output/80942/7dc165e79c724608b79edb5f4b3a8cc3?anonymousKey=d99b351a5d6b09831496ed245f31b54bb8902a16
rule theSingletonContractIsUpdatedCorrectly(env e) {
    address newSingletonContract;  // the singleton we try to assign to the Safe contract

    address singletonBefore = SafeMock.getSingleton(e);
    uint256 chainId = SafeMock.getChainId(e);

    SafeMock.delegateCallSetupToL2@withrevert(e, newSingletonContract);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    
    assert !callReverted && chainId != 1 => singletonAfter == newSingletonContract;
    assert !callReverted && chainId == 1 => singletonAfter == singletonBefore;
}

