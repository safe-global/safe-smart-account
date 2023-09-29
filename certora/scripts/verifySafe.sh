#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun certora/conf/safe.conf \
    "${params[@]}" \
    --msg "Safe $*" \
    "$@"
