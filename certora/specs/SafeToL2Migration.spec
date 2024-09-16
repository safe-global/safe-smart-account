using SafeToL2Migration as SafeToL2Migration;
using SafeMock as SafeMock;

methods {
    function _.setFallbackHandler(address) external => DISPATCHER(true);
}

// MIGRATION_SINGLETON is always the current contract
invariant MIGRATION_SINGLETONisAlwaysCurrentContract()
    SafeToL2Migration.MIGRATION_SINGLETON == SafeToL2Migration;


// All the function that are not view function will revert (if it is not delegateCall)
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant MIGRATION_SINGLETONisAlwaysCurrentContract;
    SafeToL2Migration.f@withrevert(e,args);
    assert lastReverted;
}

// Calls to migrateToL2() and migrateFromV111() can succeed only if Safe's nonce is correct
rule nonceMustBeCorrect(env e, method f, calldataarg args) filtered {
    f -> f.selector == sig:SafeMock.delegateMigrateToL2(address).selector
      || f.selector == sig:SafeMock.delegateMigrateFromV111(address,address).selector
    } {
    // get current nonce of the Safe contract
    uint256 currentNonce = SafeMock.getNonce(e);

    SafeMock.f@withrevert(e, args);
    bool callReverted = lastReverted;

    assert !callReverted => currentNonce == 1;
}

// Correct update of Safe's singleton address by migrateToL2()
rule singletonMigrateToL2Integrity(env e, address l2Singleton) {
    address singletonBefore = SafeMock.getSingleton(e);

    SafeMock.delegateMigrateToL2@withrevert(e, l2Singleton);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    
    assert !callReverted => singletonAfter == l2Singleton;
    assert callReverted => singletonAfter == singletonBefore;
}


// Correct update of Safe's singleton address and fallbackHandler address by migrateFromV111()
rule singletonMigrateFromV111Integrity(env e, address l2Singleton, address fallbackHandlerAddr) {
    address singletonBefore = SafeMock.getSingleton(e);
    address fallbackHandlerBefore = SafeMock.getFallbackHandler(e);

    SafeMock.delegateMigrateFromV111@withrevert(e, l2Singleton, fallbackHandlerAddr);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    address fallbackHandlerAfter = SafeMock.getFallbackHandler(e);
    
    assert !callReverted => singletonAfter == l2Singleton;
    assert !callReverted => fallbackHandlerAfter == fallbackHandlerAddr;

    assert callReverted => singletonAfter == singletonBefore;
    assert callReverted => fallbackHandlerAfter == fallbackHandlerBefore;
}
