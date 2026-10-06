#!/usr/bin/env bash
# Runs the GitHub Actions self-hosted runner for this repo from .runner/.
# On first use it downloads the runner and registers it (labels: pipewise).
# Runs in the foreground until stopped with Ctrl+C. Needs gh, authenticated.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="mikezupper/pipewise"
DIR="$PWD/.runner"

if [ ! -x "$DIR/run.sh" ]; then
  version="$(gh api repos/actions/runner/releases/latest --jq .tag_name | sed 's/^v//')"
  echo "Downloading GitHub Actions runner ${version} into .runner/"
  mkdir -p "$DIR"
  curl -fsSL "https://github.com/actions/runner/releases/download/v${version}/actions-runner-linux-x64-${version}.tar.gz" |
    tar xz -C "$DIR"
fi

if [ ! -f "$DIR/.runner" ]; then
  token="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"
  "$DIR/config.sh" --url "https://github.com/${REPO}" --token "$token" \
    --labels pipewise --name "$(hostname)-pipewise" --unattended --replace
fi

exec "$DIR/run.sh"
