#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun certora/conf/module.conf \
    "${params[@]}" \
    --msg "Safe $1 "