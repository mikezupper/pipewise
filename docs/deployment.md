# Deployment

pipewise is published to npm from GitHub Actions. The workflows run on a
self-hosted runner on the maintainer's Linux machine, not on GitHub's hosts.
The runner lives in this repository and runs only during development sessions,
so CI jobs run only while it is up.

## Workflows

| Workflow                        | Trigger                                      | Does                                                   |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `.github/workflows/ci.yml`      | Push to `main`, pull requests from this repo | `pnpm check`, `pnpm test:runtimes`, `pnpm example:e2e` |
| `.github/workflows/release.yml` | Tag `v*.*.*`                                 | `pnpm check`, `pnpm publish`, GitHub release           |

Pull requests from forks never run. A self-hosted runner executes whatever a
workflow tells it to, so running a stranger's branch would hand them the machine.

## The runner

The runner lives in `.runner/` inside the repository, which git ignores. It
is not a system service. It runs only during development sessions.

```sh
pnpm runner
```

The first run downloads the runner and registers it with GitHub using your
`gh` login, with the labels `self-hosted`, `linux`, and `pipewise`. Later runs
start it straight away. It runs in the foreground; stop it with Ctrl+C. An
agent working in this repository starts it when you say "start the service".

While the runner is stopped, pushes still queue CI jobs, which start the next
time it runs. GitHub cancels jobs queued for more than 24 hours; restart them
with **Re-run jobs**. Start the runner before pushing a release tag.

The workflows install Node and pnpm themselves. Playwright's browsers are
cached in `~/.cache/ms-playwright` after the first run. If WebKit fails to
launch, run `pnpm exec playwright install-deps webkit` once with sudo.

To remove the runner, unregister it on **Settings → Actions → Runners**, then
delete `.runner/`.

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
