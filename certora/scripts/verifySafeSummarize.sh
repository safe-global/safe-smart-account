#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun  certora/harnesses/SafeHarness.sol \
    --verify SafeHarness:certora/specs/SafeSummarize.spec \
    --solc solc7.6 \
    --optimistic_loop \
    --prover_args '-optimisticFallback true -s z3 -copyLoopUnroll 5 -mediumTimeout 5 -depth 30' \
    --loop_iter 2 \
    --rule ownerSignaturesAreProvidedForExecTransaction \
    --optimistic_hashing \
    --hashing_length_bound 352 \
    --rule_sanity \
    "${params[@]}" \
    --msg "Safe $1 "