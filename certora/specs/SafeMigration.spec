using SafeMigration as SafeMigration;
using SafeMock as SafeMock;

methods {
    function _.setFallbackHandler(address) external => DISPATCHER(true);
}

// MIGRATION_SINGLETON is always the current contract
invariant MIGRATION_SINGLETONisAlwaysCurrentContract()
    SafeMigration.MIGRATION_SINGLETON == SafeMigration;


// All the function that are not view function will revert (if it is not delegateCall)
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant MIGRATION_SINGLETONisAlwaysCurrentContract;
    SafeMigration.f@withrevert(e,args);
    assert lastReverted;
}


// Safe's singleton address update integrity (parametric version)
rule singletonMigrationIntegrityParametric(env e, method f, calldataarg args) filtered {
    f -> f.selector == sig:SafeMock.delegateMigrateSingleton().selector
      || f.selector == sig:SafeMock.delegateMigrateWithFallbackHandler().selector
      || f.selector == sig:SafeMock.delegateMigrateL2Singleton().selector
      || f.selector == sig:SafeMock.delegateMigrateL2WithFallbackHandler().selector
    } {
    address singletonBefore = SafeMock.getSingleton(e);

    SafeMock.f@withrevert(e, args);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    
    assert !callReverted && 
           (f.selector == sig:SafeMock.delegateMigrateSingleton().selector || 
            f.selector == sig:SafeMock.delegateMigrateWithFallbackHandler().selector) =>
                                                singletonAfter == SafeMigration.SAFE_SINGLETON(e);
    
    assert !callReverted && 
           (f.selector == sig:SafeMock.delegateMigrateL2Singleton().selector || 
            f.selector == sig:SafeMock.delegateMigrateL2WithFallbackHandler().selector) =>
                                                singletonAfter == SafeMigration.SAFE_L2_SINGLETON(e);
    
    assert callReverted => singletonAfter == singletonBefore;
}


// Safe's fallbackHandler address update integrity (parametric version)
rule fallbackHandlerMigrationIntegrityParametric(env e, method f, calldataarg args) filtered {
    f -> f.selector == sig:SafeMock.delegateMigrateSingleton().selector
      || f.selector == sig:SafeMock.delegateMigrateWithFallbackHandler().selector
      || f.selector == sig:SafeMock.delegateMigrateL2Singleton().selector
      || f.selector == sig:SafeMock.delegateMigrateL2WithFallbackHandler().selector
    } {
    address fallbackHandlerBefore = SafeMock.getFallbackHandler(e);

    SafeMock.f@withrevert(e, args);
    bool callReverted = lastReverted;

    address fallbackHandlerAfter = SafeMock.getFallbackHandler(e);
    
    assert !callReverted && 
           (f.selector == sig:SafeMock.delegateMigrateWithFallbackHandler().selector || 
            f.selector == sig:SafeMock.delegateMigrateL2WithFallbackHandler().selector) =>
                                                fallbackHandlerAfter == SafeMigration.SAFE_FALLBACK_HANDLER(e);
    
    assert !callReverted && 
           (f.selector == sig:SafeMock.delegateMigrateSingleton().selector || 
            f.selector == sig:SafeMock.delegateMigrateL2Singleton().selector) =>
                                                fallbackHandlerAfter == fallbackHandlerBefore;
    
    assert callReverted => fallbackHandlerAfter == fallbackHandlerBefore;
}
