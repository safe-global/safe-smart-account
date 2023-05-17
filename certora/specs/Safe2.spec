methods {
    // 
    function getThreshold() external returns (uint256) envfree;
    function disableModule(address,address) external;
    function nonce() external returns (uint256) envfree;

    // harnessed
    function getModule(address) external returns (address) envfree;
    function getOwnersCount() external returns (uint256) envfree;
    function getOwnersCountFromArray() external returns (uint256) envfree;

    // optional
    function execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation) external returns (bool, bytes memory);
    function execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation) external returns (bool);
    function execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes) external returns (bool);

}

definition noHavoc(method f) returns bool =
    f.selector != sig:execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation).selector
    && f.selector != sig:execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation).selector 
    && f.selector != sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector;

definition reachableOnly(method f) returns bool =
    f.selector != sig:setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != sig:simulateAndRevert(address,bytes).selector;

definition ownerUpdatingFunctions(method f) returns bool = 
    f.selector != sig:addOwnerWithThreshold(address,uint256).selector
        && f.selector != sig:removeOwner(address,address,uint256).selector;


invariant safeIsSetup() getThreshold() > 0;

invariant safeOwnerCountConsistency() getOwnersCount() == getOwnersCountFromArray();

invariant threholdShouldBeLessThanOwners() getOwnersCount() >= getThreshold();

invariant safeOwnerCannotBeItself(env e) !isOwner(e, currentContract);

invariant safeOwnerCannotBeSentinelAddress(env e) !isOwner(e, 1);

rule safeOwnerCountCannotBeUpdatedByNonOwnerUpdatingFunctions(method f) filtered {
  f -> ownerUpdatingFunctions(f)
}
{
    requireInvariant safeIsSetup;
    uint256 ownerCountBefore = getOwnersCount();
    calldataarg args; env e;
    f(e, args);
    uint256 ownerCountAfter = getOwnersCount();
    assert ownerCountAfter == ownerCountBefore;
}

