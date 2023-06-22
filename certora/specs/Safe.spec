methods {
    // 
    function getThreshold() external returns (uint256) envfree;
    function disableModule(address,address) external;
    function nonce() external returns (uint256) envfree;
    function signedMessages(bytes32) external returns (uint256) envfree;

    // harnessed
    function getModule(address) external returns (address) envfree;
    function getSafeGuard() external returns (address) envfree;
    function getNativeTokenBalance() external returns (uint256) envfree;

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
    && f.selector != sig:simulateAndRevert(address,bytes).selector
    // getStorageAt cannot be used because we have a hook to sstore
    // A quote from the Certora team:
    // "If it’s called from an internal context it is fine but as a public function that can be called with any argument it cannot have hooks applied on."
    && f.selector != sig:getStorageAt(uint256,uint256).selector;

definition MAX_UINT256() returns uint256 = 0xffffffffffffffffffffffffffffffff;

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
        to_mathint(nonceAfter) == nonceBefore + 1 && f.selector == sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector;
}


/// The sentinel must never point to the zero address.
/// @notice It should either point to itself or some nonzero value
invariant liveSentinel()
    getModule(1) != 0
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    { preserved {
        requireInvariant noDeadEnds(getModule(1), 1);
    }}

/// Threshold must always be nonzero.
invariant nonzeroThreshold()
    getThreshold() > 0
    filtered { f -> noHavoc(f) && reachableOnly(f) }

/// Two different modules must not point to the same module/
invariant uniquePrevs(address prev1, address prev2)
    prev1 != prev2 && getModule(prev1) != 0 => getModule(prev1) != getModule(prev2)
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    { 
        preserved {
            requireInvariant noDeadEnds(getModule(prev1), prev1);
            requireInvariant noDeadEnds(getModule(prev2), prev2);
            requireInvariant uniquePrevs(prev1, 1);
            requireInvariant uniquePrevs(prev2, 1);
            requireInvariant uniquePrevs(prev1, getModule(prev2));
            requireInvariant uniquePrevs(prev2, getModule(prev1));
        }
    }

/// A module that points to the zero address must not have another module pointing to it.
invariant noDeadEnds(address dead, address lost)
    dead != 0 && getModule(dead) == 0 => getModule(lost) != dead
    filtered { f -> noHavoc(f) && reachableOnly(f) }
    {
        preserved {
            requireInvariant liveSentinel();
            requireInvariant noDeadEnds(getModule(1), 1);
        }
        preserved disableModule(address prevModule, address module) with (env e) {
            requireInvariant uniquePrevs(prevModule, lost);
            requireInvariant uniquePrevs(prevModule, dead);
            requireInvariant noDeadEnds(dead, module);
            requireInvariant noDeadEnds(module, dead);
        }
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
        f.selector == sig:execTransaction(address,uint256,bytes,SafeHarness.Operation,uint256,uint256,uint256,address,address,bytes).selector
        || f.selector == sig:execTransactionFromModule(address,uint256,bytes,SafeHarness.Operation).selector
        || f.selector == sig:execTransactionFromModuleReturnData(address,uint256,bytes,SafeHarness.Operation).selector;
}

rule nativeTokenBalanceSpendingExecTransaction(
        address to,
        uint256 value,
        bytes data,
        SafeHarness.Operation operation,
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
        SafeHarness.Operation operation
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
        SafeHarness.Operation operation
) {
    uint256 balanceBefore = getNativeTokenBalance();
    env e;

    execTransactionFromModuleReturnData(e, to, value, data, operation);

    uint256 balanceAfter = getNativeTokenBalance();

    assert balanceAfter < balanceBefore => 
        to_mathint(balanceBefore - value) <= to_mathint(balanceAfter);
}
