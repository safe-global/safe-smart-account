/*
 * Spec for linked list reachability.
 *
 * This file uses a reach predicate:
 *    ghost reach(address, address) returns bool
 * to represent the transitive relation of the next
 * relation given byt the "owners" field.
 *
 * The idea comes from the paper
 *
 * [1] Itzhaky, S., Banerjee, A., Immerman, N., Nanevski, A., Sagiv, M. (2013).
 *     Effectively-Propositional Reasoning about Reachability in Linked Data Structures.
 *     In: CAV 2013. Springer, https://doi.org/10.1007/978-3-642-39799-8_53
 */


methods {
    function isOwner(address) external returns (bool) envfree;
    function getThreshold() external returns (uint256) envfree;
}

definition reachableOnly(method f) returns bool =
    f.selector != sig:simulateAndRevert(address,bytes).selector;

definition MAX_UINT256() returns uint256 = 0xffffffffffffffffffffffffffffffff;

persistent ghost reach(address, address) returns bool {
    init_state axiom forall address X. forall address Y. reach(X, Y) == (X == Y || to_mathint(Y) == 0);
}

persistent ghost mapping(address => address) ghostOwners {
    init_state axiom forall address X. to_mathint(ghostOwners[X]) == 0;
}

persistent ghost ghostSuccCount(address) returns mathint {
    init_state axiom forall address X. ghostSuccCount(X) == 0;
}

persistent ghost uint256 ghostOwnerCount;

persistent ghost address SENTINEL {
    axiom to_mathint(SENTINEL) == 1;
}

persistent ghost address NULL {
    axiom to_mathint(NULL) == 0;
}

invariant thresholdSet() getThreshold() > 0  && getThreshold() <= ghostOwnerCount
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_null();
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
        }
    }

invariant self_not_owner() currentContract != SENTINEL => ghostOwners[currentContract] == 0
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_null();
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant thresholdSet();
        }
    }

// every element with 0 in the owners field can only reach the null pointer and itself
invariant nextNull()
    ghostOwners[NULL] == 0 &&
    (forall address X. forall address Y. ghostOwners[X] == 0 && reach(X, Y) => X == Y || Y == 0)
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_null();
            requireInvariant thresholdSet();
        }
    }

// every element reaches the 0 pointer (because we replace in reach the end sentinel with null)
invariant reach_null()
    (forall address X. reach(X, NULL))
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_invariant();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant thresholdSet();
        }
    }

// every element with non-zero owner field is reachable from SENTINEL (head of the list)
invariant inListReachable()
    ghostOwners[SENTINEL] != 0 &&
    (forall address key. ghostOwners[key] != 0 => reach(SENTINEL, key))
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant thresholdSet();
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant reachableInList();
            requireInvariant thresholdSet();
        }
    }

// every element that is reachable from another element is either the null pointer or part of the list.
invariant reachableInList()
    (forall address X. forall address Y. reach(X, Y) => X == Y || Y == 0 || ghostOwners[Y] != 0)
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reach_next();
            requireInvariant nextNull();
            requireInvariant thresholdSet();
        }
    }

invariant reachHeadNext()
    forall address X. reach(SENTINEL, X) && X != SENTINEL && X != NULL =>
           ghostOwners[SENTINEL] != SENTINEL && reach(ghostOwners[SENTINEL], X)
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant thresholdSet();
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
        preserved {
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reachHeadNext();
            requireInvariant thresholdSet();
        }
    }

// every element reaches its direct successor (except for the tail-SENTINEL).
invariant reach_next()
    forall address X. reach_succ(X, ghostOwners[X])
    filtered { f -> reachableOnly(f) }
    {
        preserved {
            requireInvariant inListReachable();
            requireInvariant reachableInList();
            requireInvariant reach_null();
            requireInvariant reach_invariant();
            requireInvariant thresholdSet();
        }
    }

// Express the next relation from the reach relation by stating that it is reachable and there is no other element
// in between.
// This is equivalent to P_next from Table 3.
definition isSucc(address a, address b) returns bool = reach(a, b) && a != b && (forall address Z. reach(a, Z) && reach(Z, b) => (a == Z || b == Z));
definition next_or_null(address n) returns address = n == SENTINEL ? NULL : n;

// Invariant stating that the owners storage pointers correspond to the next relation, except for the SENTINEL tail marker.
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

definition count_expected(address key) returns mathint =
    ghostOwners[key] == NULL ? 0 : ghostOwners[key] == SENTINEL ? 1 : ghostSuccCount(ghostOwners[key]) + 1;

definition updateGhostSuccCount(address key, mathint diff) returns bool = forall address X.
    ghostSuccCount@new(X) == ghostSuccCount@old(X) + (reach(X, key) ? diff : 0);

// hook to update the ghostOwners and the reach ghost state whenever the owners field
// in storage is written.
// This also checks that the reach_succ invariant is preserved.
hook Sstore currentContract.owners[KEY address key] address value {
    address valueOrNull;
    address someKey;
    require reach_succ(someKey, ghostOwners[someKey]);
    require ghostSuccCount(someKey) == count_expected(someKey);
    assert reach(value, key) => value == SENTINEL, "list is cyclic";
    ghostOwners[key] = value;
    havoc reach assuming updateSucc(key, next_or_null(value));
    mathint countDiff = count_expected(key) - ghostSuccCount(key);
    havoc ghostSuccCount assuming updateGhostSuccCount(key, countDiff);
    assert reach_succ(someKey, ghostOwners[someKey]), "reach_succ violated after owners update";
    assert ghostSuccCount(someKey) == count_expected(someKey);
}

hook Sstore currentContract.ownerCount uint256 value {
    ghostOwnerCount = value;
}

// Hook to match ghost state and storage state when reading owners from storage.
// This also provides the reach_succ invariant.
hook Sload address value currentContract.owners[KEY address key] {
    require ghostOwners[key] == value;
    require reach_succ(key, value);
    require ghostSuccCount(key) == count_expected(key);
}

hook Sload uint256 value currentContract.ownerCount {
    // The prover found a counterexample if the owners count is max uint256,
    // but this is not a realistic scenario.
    require ghostOwnerCount < MAX_UINT256();
    require ghostOwnerCount == value;
}

invariant reachCount()
    forall address X. forall address Y. reach(X, Y) =>
        ghostSuccCount(X) >= ghostSuccCount(Y)
    {
        preserved {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reach_next();
            requireInvariant nextNull();
            requireInvariant reachableInList();
            requireInvariant reachHeadNext();
            requireInvariant thresholdSet();
            requireInvariant count_correct();
        }
    }

invariant count_correct()
    forall address X. ghostSuccCount(X) == count_expected(X)
    {
        preserved {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reach_next();
            requireInvariant nextNull();
            requireInvariant reachableInList();
            requireInvariant reachHeadNext();
            requireInvariant thresholdSet();
        }
    }

invariant ownercount_correct()
    ghostSuccCount(SENTINEL) == ghostOwnerCount + 1
    {
        preserved  {
            requireInvariant reach_invariant();
            requireInvariant reach_null();
            requireInvariant inListReachable();
            requireInvariant reach_next();
            requireInvariant nextNull();
            requireInvariant reachableInList();
            requireInvariant reachHeadNext();
            requireInvariant reachCount();
            requireInvariant thresholdSet();
        }
    }

rule isOwnerDoesNotRevert {
    address addr;
    isOwner@withrevert(addr);
    assert !lastReverted, "isOwner should not revert";
}

rule isOwnerNotSelfOrSentinel {
    address addr;
    require addr == currentContract || addr == SENTINEL;
    requireInvariant self_not_owner();
    bool result = isOwner(addr);
    assert result == false, "currentContract or SENTINEL must not be owners";
}

rule isOwnerInList {
    address addr;
    require addr != SENTINEL;
    bool result = isOwner(addr);
    assert result == (ghostOwners[addr] != NULL), "isOwner returns wrong result";
}

rule addOwnerChangesOwners {
    address other;
    address toAdd;
    uint256 threshold;
    env e;

    requireInvariant reach_null();
    requireInvariant reach_invariant();
    requireInvariant inListReachable();
    requireInvariant reachableInList();
    require other != toAdd;
    bool isOwnerOtherBefore = isOwner(other);
    addOwnerWithThreshold(e, toAdd, threshold);

    assert isOwner(toAdd), "addOwner should add the given owner";
    assert isOwner(other) == isOwnerOtherBefore, "addOwner should not remove or add other owners";
}

rule removeOwnerChangesOwners {
    address other;
    address toRemove;
    address prevOwner;
    uint256 threshold;
    env e;

    requireInvariant reach_null();
    requireInvariant reach_invariant();
    requireInvariant inListReachable();
    requireInvariant reachableInList();
    require other != toRemove;
    bool isOwnerOtherBefore = isOwner(other);
    removeOwner(e, prevOwner, toRemove, threshold);

    assert !isOwner(toRemove), "removeOwner should remove the given owner";
    assert isOwner(other) == isOwnerOtherBefore, "removeOwner should not remove or add other owners";
}

rule swapOwnerChangesOwners {
    address other;
    address oldOwner;
    address newOwner;
    address prevOwner;
    env e;

    requireInvariant reach_null();
    requireInvariant reach_invariant();
    requireInvariant inListReachable();
    requireInvariant reachableInList();
    require other != oldOwner && other != newOwner;
    bool isOwnerOtherBefore = isOwner(other);
    bool isOwnerOldBefore = isOwner(oldOwner);
    bool isOwnerNewBefore = isOwner(newOwner);
    swapOwner(e, prevOwner, oldOwner, newOwner);

    assert isOwnerOldBefore && !isOwner(oldOwner), "swapOwner should remove old owner";
    assert !isOwnerNewBefore && isOwner(newOwner), "swapOwner should add new owner";
    assert isOwner(other) == isOwnerOtherBefore, "swapOwner should not remove or add other owners";
}
