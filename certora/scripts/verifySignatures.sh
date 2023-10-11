#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun certora/conf/signatures.conf \
    "${params[@]}" \
    --msg "Safe $*" \
    "$@"
