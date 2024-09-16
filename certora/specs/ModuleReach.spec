/*
 * Spec for linked list reachability.
 * 
 * This file uses a reach predicate:
 *    ghost reach(address, address) returns bool
 * to represent the transitive relation of the next
 * relation given byt the "modules" field.
 *
 * The idea comes from the paper
 * 
 * [1] Itzhaky, S., Banerjee, A., Immerman, N., Nanevski, A., Sagiv, M. (2013). 
 *     Effectively-Propositional Reasoning about Reachability in Linked Data Structures. 
 *     In: CAV 2013. Springer, https://doi.org/10.1007/978-3-642-39799-8_53
 */


methods {
    function isModuleEnabled(address) external returns (bool) envfree;
}

definition reachableOnly(method f) returns bool =
    f.selector != sig:simulateAndRevert(address,bytes).selector;

persistent ghost reach(address, address) returns bool {
    init_state axiom forall address X. forall address Y. reach(X, Y) == (X == Y || to_mathint(Y) == 0);
}

persistent ghost mapping(address => address) ghostModules {
    init_state axiom forall address X. to_mathint(ghostModules[X]) == 0;
}

persistent ghost address SENTINEL {
    axiom to_mathint(SENTINEL) == 1;    
}

persistent ghost address NULL {
    axiom to_mathint(NULL) == 0;    
}

// every element with 0 in the modules field can only reach the null pointer and itself
invariant nextNull()
    ghostModules[NULL] == 0 &&
    (forall address X. forall address Y. ghostModules[X] == 0 && reach(X, Y) => X == Y || Y == 0)
    filtered { f -> reachableOnly(f) }
    { 
        preserved with (env e2) {
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_null();
        }
    }

// every element reaches the 0 pointer (because we replace in reach the end sentinel with null)
invariant reach_null()
    (forall address X. reach(X, NULL))
    filtered { f -> reachableOnly(f) }
    {
        preserved with (env e2) {
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
        }
    }

// every element with non-zero module field is reachable from SENTINEL (head of the list)
invariant inListReachable()
    ghostModules[SENTINEL] != 0 &&
    (forall address key. ghostModules[key] != 0 => reach(SENTINEL, key))
    filtered { f -> reachableOnly(f) }
    {
        preserved with (env e2) {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant reachableInList();
        }
    }


// every element that is reachable from another element is either the null pointer or part of the list.
invariant reachableInList()
    (forall address X. forall address Y. reach(X, Y) => X == Y || Y == 0 || ghostModules[Y] != 0)
    filtered { f -> reachableOnly(f) }
    {
        preserved with (env e2) {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reach_next();
            requireInvariant nextNull();
        }
    }

invariant reachHeadNext()
    forall address X. reach(SENTINEL, X) && X != SENTINEL && X != NULL => 
           ghostModules[SENTINEL] != SENTINEL && reach(ghostModules[SENTINEL], X)
    filtered { f -> reachableOnly(f) }
    { 
        preserved with (env e2) {
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_invariant();
            requireInvariant reach_null();
        }
    }

// reach encodes a linear order.  This axiom corresponds to Table 2 in [1].
invariant reach_invariant()
    forall address X. forall address Y. forall address Z. ( 
        reach(X, X)
        && (reach(X,Y) && reach (Y, X) => X == Y)
        && (reach(X,Y) && reach (Y, Z) => reach(X, Z))
        && (reach(X,Y) && reach (X, Z) => (reach(Y,Z) || reach(Z,Y)))
    )
    filtered { f -> reachableOnly(f) }
    { 
        preserved with (env e2) {
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reachHeadNext();
        }
    }

// every element reaches its direct successor (except for the tail-SENTINEL).
invariant reach_next()
    forall address X. reach_succ(X, ghostModules[X])
    filtered { f -> reachableOnly(f) }
    { 
        preserved with (env e2) {
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_null();
            requireInvariant reach_invariant();
        }
    }

// Express the next relation from the reach relation by stating that it is reachable and there is no other element 
// in between.
// This is equivalent to P_next from Table 3.
definition isSucc(address a, address b) returns bool = reach(a, b) && a != b && (forall address Z. reach(a, Z) && reach(Z, b) => (a == Z || b == Z));
definition next_or_null(address n) returns address = n == SENTINEL ? NULL : n;

// Invariant stating that the modules storage pointers correspond to the next relation, except for the SENTINEL tail marker.
definition reach_succ(address key, address next) returns bool =
        (isSucc(key, next_or_null(next))) ||
        (next == NULL && key == NULL);

// Update the reach relation when the next pointer of a is changed to b.
// This corresponds to the first two equations in Table 3 [1] (destructive update to break previous paths through a and
// then additionally allow the path to go through the new edge from a to b).
definition updateSucc(address a, address b) returns bool = forall address X. forall address Y. reach@new(X, Y) == 
            (X == Y ||
            (reach@old(X, Y) && !(reach@old(X, a) && a != Y && reach@old(a, Y))) ||
            (reach@old(X, a) && reach@old(b, Y)));

// hook to update the ghostModules and the reach ghost state whenever the modules field
// in storage is written. 
// This also checks that the reach_succ invariant is preserved. 
hook Sstore currentContract.modules[KEY address key] address value {
    address valueOrNull;
    address someKey;
    require reach_succ(someKey, ghostModules[someKey]);
    assert reach(value, key) => value == SENTINEL, "list is cyclic";
    ghostModules[key] = value;
    havoc reach assuming updateSucc(key, next_or_null(value));
    assert reach_succ(someKey, ghostModules[someKey]), "reach_succ violated after modules update";
}



// Hook to match ghost state and storage state when reading modules from storage. 
// This also provides the reach_succ invariant. 
hook Sload address value currentContract.modules[KEY address key] {
    require ghostModules[key] == value;
    require reach_succ(key, value);
}

invariant sentinelIsNotAmodule() isModuleEnabled(SENTINEL) == false
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_null();
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
        }
    }

rule isModuleEnabledDoesNotRevert {
    address addr;
    isModuleEnabled@withrevert(addr);
    assert !lastReverted, "isModuleEnabledShouldNotRevert";
}

rule isModuleEnabledInList {
    address addr;
    require addr != SENTINEL;

    assert isModuleEnabled(addr) == (ghostModules[addr] != NULL), "isModuleEnabled returns wrong result";
}

rule enableModuleEnablesModule {
    address other;
    address toAdd;
    env e;

    requireInvariant reach_null();
    requireInvariant reach_invariant();
    requireInvariant inListReachable();
    requireInvariant reachableInList();

    require other != toAdd;
    bool isModuleEnabledBefore = isModuleEnabled(other);
    enableModule(e, toAdd);

    assert isModuleEnabled(toAdd), "enableModule should enable module";
    assert isModuleEnabled(other) == isModuleEnabledBefore, "enableModule should not change other modules";
}

rule disableModuleDisablesModule {
    address other;
    address toRemove;
    address prevModule;
    env e;

    requireInvariant reach_null();
    requireInvariant reach_invariant();
    requireInvariant inListReachable();
    requireInvariant reachableInList();

    require other != toRemove;
    bool isModuleEnabledBefore = isModuleEnabled(other);
    disableModule(e, prevModule, toRemove);

    assert !isModuleEnabled(toRemove), "disableModule should disable module";
    assert isModuleEnabled(other) == isModuleEnabledBefore, "disableModule should not change other modules";
}
