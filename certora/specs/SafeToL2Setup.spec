using SafeToL2Setup as SafeToL2Setup;
using SafeMock as SafeMock;

// _SELF is always the current contract
// if the "rule_sanity": "basic" flag is enabled this rule would fail sanity check
invariant _SELFisAlwaysCurrentContract()
    SafeToL2Setup.SELF == SafeToL2Setup;


// All the non-view functions will revert when called directly (only delegateCall is allowed)
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant _SELFisAlwaysCurrentContract;
    SafeToL2Setup.f@withrevert(e,args);
    assert lastReverted;
}

// The delegateCall to setupToL2() can succeed only if Safe's nonce is zero
rule nonceMustBeZero(env e, address singletonContract) {
    // get current nonce of the Safe contract
    uint256 currentNonce = SafeMock.getNonce(e);

    SafeMock.delegateCallSetupToL2@withrevert(e, singletonContract);
    bool callReverted = lastReverted;

    assert !callReverted => currentNonce == 0;
}


// The singleton contract can be updated only if the chainId is not 1
rule theSingletonContractIsUpdatedCorrectly(env e, address newSingletonContract) {
    // `newSingletonContract` is the singleton we try to assign to the Safe contract

    address singletonBefore = SafeMock.getSingleton(e);
    uint256 chainId = SafeMock.getChainId(e);

    SafeMock.delegateCallSetupToL2@withrevert(e, newSingletonContract);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    
    assert !callReverted && chainId != 1 => singletonAfter == newSingletonContract;
    assert !callReverted && chainId == 1 => singletonAfter == singletonBefore;
}
