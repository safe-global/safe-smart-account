#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun  certora/harnesses/SafeHarness.sol \
    --verify SafeHarness:certora/specs/OwnerReach.spec \
    --solc solc7.6 \
    --optimistic_loop \
    --prover_args '-smt_groundQuantifiers false -mediumTimeout 2000' \
    --loop_iter 3 \
    --optimistic_hashing \
    --hashing_length_bound 352 \
    "${params[@]}" \
    --msg "Safe $1 "