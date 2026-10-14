# Spot the Bug

Scan the Solidity files changed in a pull request with [Slither](https://github.com/crytic/slither) and get one sticky summary comment on the PR.

## Usage

```yaml
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  spot-the-bug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: wkalidev/spot-the-bug-action@v1
        with:
          working-directory: .
          fail-on: high
```

On `pull_request` / `pull_request_target`, only findings located in added, modified or renamed `.sol` files are reported. If no Solidity file changed, the action exits successfully without commenting. On other events (`push`, `workflow_dispatch`, …) every finding is in scope and the summary is written to the job summary.

The comment is updated in place on every run, so the PR keeps a single Spot the Bug comment. Informational and optimization findings are counted but not listed.

Foundry and Hardhat projects must be compilable by Slither on the runner. Install their dependencies (for example `forge install` or `npm ci`) before this step if needed.

## Inputs

| Name                | Default               | Description                                                                                                     |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `github-token`      | `${{ github.token }}` | Token used to list PR files and post the comment.                                                               |
| `working-directory` | `.`                   | Root of the Solidity project (Foundry or Hardhat), relative to the repository root.                             |
| `solc-version`      | `0.8.24`              | Compiler version installed with `solc-select`.                                                                  |
| `fail-on`           | `high`                | Fail the job if a finding at or above this severity exists in changed files: `high`, `medium`, `low` or `none`. |
| `slither-args`      | `""`                  | Extra arguments passed to `slither`.                                                                            |

## Outputs

| Name             | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `findings-count` | Number of High, Medium and Low findings in changed files. |
| `high-count`     | Number of High findings in changed files.                 |

## Roadmap

- Custom rules from the Spot the Bug video series.

## License

[MIT](LICENSE) © wkalidev
