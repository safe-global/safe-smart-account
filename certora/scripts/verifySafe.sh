#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun  certora/harnesses/SafeHarness.sol \
    --verify SafeHarness:certora/specs/Safe.spec \
    --solc solc7.6 \
    --optimistic_loop \
    --prover_args "-optimisticFallback true" \
    --loop_iter 3 \
    --optimistic_hashing \
    --hashing_length_bound 352 \
    --rule_sanity \
    "${params[@]}" \
    --msg "Safe $1 "