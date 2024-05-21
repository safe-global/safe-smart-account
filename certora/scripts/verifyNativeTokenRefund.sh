#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun  certora/conf/nativeTokenRefund.conf \
    "${params[@]}" \
    --msg "Safe $1 "