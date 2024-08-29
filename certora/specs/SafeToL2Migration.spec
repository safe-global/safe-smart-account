// All rules of SafeToL2Migration without sanity check
// https://prover.certora.com/output/80942/eed425ec3f20443587f0649bfbaf6bbf?anonymousKey=d30c9b2608857e318a0f41e1f94132381384fdf9

// All rules of SafeToL2Migration with sanity check
// https://prover.certora.com/output/80942/a95f00eed26c4aa89c3e24fc07c1c574?anonymousKey=a63ab3672b3ae8e42a5af1e6b1f36251227d9ce8

using SafeToL2Migration as SafeToL2Migration;
using SafeMock as SafeMock;

methods {
    function _.setFallbackHandler(address) external => DISPATCHER(true);
}

// MIGRATION_SINGLETON is always the current contract
// passes - https://prover.certora.com/output/80942/3087ca5a9a27481891e7f84736ec6aaf?anonymousKey=f867049529614ee37a9c573ff1e479834e34ad52
invariant MIGRATION_SINGLETONisAlwaysCurrentContract()
    SafeToL2Migration.MIGRATION_SINGLETON == SafeToL2Migration;


// all the function that are not view function will revert (if it is not delegateCall)
// passes - https://prover.certora.com/output/80942/3349cd8b7e9645c1ba89bf874580649c?anonymousKey=5375971a67985c430f00936755857d20e61d3f5f
rule allNonViewFunctionRevert(env e, method f, calldataarg args) filtered { f -> !f.isView } {
    requireInvariant MIGRATION_SINGLETONisAlwaysCurrentContract;
    SafeToL2Migration.f@withrevert(e,args);
    assert lastReverted;
}

// calls to migrateToL2() and migrateFromV111() can succeed only if Safe's nonce is correct
// passes - https://prover.certora.com/output/80942/a809db0dd61140bbbbf2b8df6318491c?anonymousKey=71b8fdfdedc8523bda752739c743b8e3202f05a2
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

// correct update of Safe's singleton address by migrateToL2()
// passes - https://prover.certora.com/output/80942/2eec3578aa6a434686e6af3c2e08768f?anonymousKey=7df843e6bab53765efa0d2c29597ac1b2474930e
rule singletonMigrateToL2Integrity(env e, address l2Singleton) {
    address singletonBefore = SafeMock.getSingleton(e);

    SafeMock.delegateMigrateToL2@withrevert(e, l2Singleton);
    bool callReverted = lastReverted;

    address singletonAfter = SafeMock.getSingleton(e);
    
    assert !callReverted => singletonAfter == l2Singleton;
    assert callReverted => singletonAfter == singletonBefore;
}


// correct update of Safe's singleton address and fallbackHandler address by migrateFromV111()
// running (extended check) - https://prover.certora.com/output/80942/01b4a45695cb4f83bee86a0f4e9110e0?anonymousKey=b0d04846f6eb35c3037f0983da75aef8980dad28
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