#!/usr/bin/env bash
# Runs on the Tessl cloud machine before each agent run.
# Ubuntu, Node 24, no root: keep this to npm.
set -euo pipefail

npm ci
