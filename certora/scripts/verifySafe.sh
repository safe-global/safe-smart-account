#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun  certora/harnesses/SafeHarness.sol \
    --verify SafeHarness:certora/specs/Safe.spec \
    --solc solc7.6 \
    --optimistic_loop \
    --prover_args '-optimisticFallback true -s z3 -copyLoopUnroll 5 -mediumTimeout 3 -depth 20' \
    --smt_timeout 500 \
    --loop_iter 2 \
    --rule checkSignatures \
    --optimistic_hashing \
    --hashing_length_bound 352 \
    --rule_sanity \
    "${params[@]}" \
    --msg "Safe $1 "