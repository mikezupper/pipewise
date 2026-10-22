# Deployment

pipewise is published to npm from GitHub Actions. Both workflows use label `xode-linux-x64`
through this personal repository's registration on the existing Xode US and EU hosts. There is
no GitHub-hosted fallback and no runner on the development machine.

## Workflows

| Workflow                        | Trigger                         | Does                                                   |
| ------------------------------- | ------------------------------- | ------------------------------------------------------ |
| `.github/workflows/ci.yml`      | Push to `main`, manual dispatch | `pnpm check`, `pnpm test:runtimes`, `pnpm example:e2e` |
| `.github/workflows/release.yml` | Tag `v*.*.*`                    | `pnpm check`, `pnpm publish`, GitHub release           |

Pull-request events are rejected by the fleet's mandatory job-start hook. Review outside
contributions before executing their code. Only trusted users may push branches or tags that
reach these workers. Release permissions and the `npm` environment remain unchanged.

## The runners

The private `mikezupper/xode-actions-runners` repository owns fleet enrollment and operations.
Each host has two slots, each with its own bounded workspace and Docker daemon. Workers install
Node, pnpm, Bun and browser system dependencies afresh. The fleet removes their workspace, images,
volumes and build cache after the runner process exits. No Actions dependency cache is uploaded.

The old `.runner/` installation and `pnpm runner` bootstrap were retired on 2026-10-22. Do not
restore those credentials or reinstall a local runner. If a job stays queued, inspect GitHub's
run and the Xode controller status using the infrastructure operations guide; starting a runner
on the workstation is not part of recovery.

## Configure publishing (once)

1. Create an npm **granular access token** with publish rights to `pipewise`.
2. On GitHub: **Settings → Environments → New environment** named `npm`. Add
   the token as the secret `NPM_TOKEN`. Optionally require your approval
   before each release.

npm provenance and trusted publishing need GitHub-hosted runners, so packages
from this setup are published without a provenance attestation.

## Release

1. Update `version` in `package.json`, run `pnpm check`, and commit.
2. Tag and push:

   ```sh
   git tag v1.0.0 && git push origin main v1.0.0
   ```

3. The release workflow stops if the tag does not match `package.json`.
   Otherwise it publishes to npm and creates a GitHub release with
   generated notes.
