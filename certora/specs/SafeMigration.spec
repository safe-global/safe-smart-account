// All rules of SafeMigration without sanity check
// https://prover.certora.com/output/80942/a605a79662e64835a18e0c3484d5dd73?anonymousKey=2c68ffc746039f9c286ac4a316d1c94afc00c610

// All rules of SafeMigration with sanity check
// https://prover.certora.com/output/80942/19f6446a292242d4ae7448da7eb3a5ec?anonymousKey=8dba0d1d6a0028d5faa80e7b38bbdb80e1d373f2

using SafeMigration as SafeMigration;
using SafeMock as SafeMock;

methods {
    function _.setFallbackHandler(address) external => DISPATCHER(true);
}

// MIGRATION_SINGLETON is always the current contract
// passes - https://prover.certora.com/output/80942/1f393e4a9f464500b6ab07e4f1670c70?anonymousKey=cae79ff7b651cc8da032d6cfba5597eacd0918e5
invariant MIGRATION_SINGLETONisAlwaysCurrentContract()
    SafeMigration.MIGRATION_SINGLETON == SafeMigration;


// all the function that are not view function will revert (if it is not delegateCall)
// passes - https://prover.certora.com/output/80942/1f393e4a9f464500b6ab07e4f1670c70?anonymousKey=cae79ff7b651cc8da032d6cfba5597eacd0918e5
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant MIGRATION_SINGLETONisAlwaysCurrentContract;
    SafeMigration.f@withrevert(e,args);
    assert lastReverted;
}


// Safe's singleton address update integrity (parametric version)
// passes - https://prover.certora.com/output/80942/3518444596b84ae6ae47bd08d8ebfb60?anonymousKey=bc02b2447d81d7762d0b34b2d98a31a8dc225ca6
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
// passes - https://prover.certora.com/output/80942/7fcd95ecf2574139a1ee490f9b6b68c9?anonymousKey=fefdae9e8e8a0aebdd99d5ebd6288b2555b6a86e
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