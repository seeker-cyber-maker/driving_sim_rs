# Public launch preflight

This document defines the hosted qualification checks for the release package.
Deployment status and build-specific acceptance belong in the release receipt;
results from one build do not qualify another build.

## Intended launch topology

- The GPU Space app is publicly reachable at
  https://tiga-rce-ald-tao-gpu.hf.space/.
- The GPU Space source repository remains restricted.
- The standalone CPU Space remains private. The public GPU app also offers an
  anonymous CPU route, which does not acquire a GPU lease.

App access and source-repository access are separate. Do not send users to the
restricted source repository as the app entry point.

## Required qualification for each deployed build

1. Freeze the allow-listed package and verify its file manifest after source
   and documentation changes.
2. Deploy the package in the intended topology. Record the exact Space commit,
   visibility, runtime stage, and build ID in the release receipt.
3. On the deployed build, verify CPU upload → run → download → receipt
   acknowledgement → server-side 404 using disposable generated files.
4. Check included HF allowance before one bounded GPU fixture run. Verify the
   CUDA report, candidate hash, download, and deletion; do not use paid overage.
   A quota rejection must show CPU/account guidance and report whether the
   pending ticket was discarded or already consumed.
5. Verify optional HF sign-in and account attribution separately from an
   anonymous GPU run. Do not ask users to paste personal access tokens.
6. Exercise result expiry, opt-in repeat download, manual deletion, malformed
   inputs, native failure, and temporary-file cleanup on the deployed build.
7. Confirm recipe and batch behavior in supported browsers. A successful
   artifact lifecycle check does not imply training quality or game parity.

## Supported runner contract

The worker preserves Formula (Type 0), Rally (Type 1), Snowmobile (Type 2), and Truck (Type 3) on import, in candidate exports, and in run reports. Formula imports retain legacy ordered output subsets. Fresh networks for all vehicles require Steering and Acceleration; Rally, Snowmobile and Truck imports must also retain those outputs. Snowmobile Handbrake is unavailable in the original editor. Networks allow at most 20 inputs (13 raycasts plus 7 other sensors), 12 total layers, and 16 neurons per hidden layer. The maximum is `[20]+[16]*10+[5]` (2,869 parameters) for Formula, Rally and Truck; Snowmobile has at most four outputs, `[20]+[16]*10+[4]` (2,852 parameters). All 13 game sensor types use original-game defaults for omitted parameters. These are vanilla worker limits, not support for arbitrary modified-game networks.

The map preview shows tile layout and terrain, not collision geometry or live driving. When a track has supported conditions, the app runs a bounded fresh replay of the named controller with fixed weights and reports a prediction. It does not award or accumulate original-game stars. Opponent races and unsupported conditions remain unchecked; built-in tracks are reconstructed replicas.

## CUDA reference check

Use the deterministic generated network and bundled Replica B01 Oval track
described in `CUDA_REFERENCE.md`. Keep input hashes, candidate output hash,
settings, build ID, binary hashes, and deletion receipts together. The
single fixture cannot establish general CUDA/CPU equivalence, original-game
parity, or training quality.

## Feedback

`/feedback` serves a template only; it does not submit a report. The configured
public destination is the [aits-driving-around issue tracker](https://github.com/seeker-cyber-maker/aits-driving-around/issues/new).
Reports should identify the app URL and build ID, browser and version, operating
system, CPU/GPU choice, reproduction steps, expected and observed behavior, and
a redacted receipt or screenshot. Do not attach tokens, job access keys, private
networks, proprietary tracks, or unrelated logs. Inspect receipts before
sharing; batch receipts also include recipe and batch names.
