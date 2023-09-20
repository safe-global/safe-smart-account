#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun certora/conf/owner.conf \
    "${params[@]}" \
    --msg "Safe $1 "