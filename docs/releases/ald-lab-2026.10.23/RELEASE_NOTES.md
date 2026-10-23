# ALD Training Lab 2026.10.23

This release publishes the verified ALD GPU/CPU lab, native replay and car black box, together with a portable agent experiment skill.

- [Hosted app](https://tiga-rce-ald-tao-gpu.hf.space/)
- [Exact HF source snapshot](https://github.com/seeker-cyber-maker/driving_sim_rs/tree/ald-lab-2026.10.23/hf-space)
- [Usage and hosting guide](https://github.com/seeker-cyber-maker/driving_sim_rs/blob/ald-lab-2026.10.23/docs/HF_LAB.md)
- [Portable agent skill](https://github.com/seeker-cyber-maker/driving_sim_rs/tree/ald-lab-2026.10.23/skills/ald-run-experiment)

HF revision: `6556847acbf7c98dce628615ece854bbcdec2000`.

Build: `ald-winners-aa62e54f4ff7219c41192dace93668cd79194beda1fe75920ac9b7aa3cf22ad3`.

The 100-file snapshot, including all 99 release-manifest members, is byte-identical to the deployed package qualified on October 23, 2026. The `ald-lab-2026.10.23` tag identifies this hosted-app release separately from upstream simulator versions.

## What is included

- Formula, Rally, Snowmobile and Truck policies, anonymous CPU execution and optional Hugging Face allowance-backed GPU execution.
- Built-in replica tracks, frozen-policy evaluation, configurable evolutionary training, up to fourteen reward metrics, selective freezing, recipes, batches and network inspection/editing.
- Native replay with measured vehicle state, raw and applied control commands, and the sensor inputs actually consumed by the policy.
- Downloads for drivers, paired analysis, run receipts, player reports, generation history and native recordings.
- A self-contained `ald-run-experiment` skill for agents operating this app or another user-specified ALD deployment.

The skill chooses bounded experiments, discovers current agent actions, checks current quota before GPU calls, uses normal visible run/account/download controls, preserves the baseline, and keeps comparison and cleanup claims tied to evidence. It has no machine-specific paths, account names, hardcoded tool IDs or dependency on other installed skills. Its example requests use 60 Hz decisions; other supported decision rates remain explicit choices.

## Interface improvements

- Latest run appears first with the backend, confirmed outcome, selected replay driver and server-copy status. Driver, report and additional artifact downloads are grouped there.
- The replay map and transport stay together, with the black box alongside the viewer. Camera, speed and event options remain available in a disclosure.
- Validated recordings remain identified by filename, duration, measured sample count and matching driver.
- Quick start, About and Agent tools take less space while keeping their controls available.
- Navigation and replay offsets adapt to the rendered tab height, including wrapped tabs on narrow displays.

## Verified coverage

| Vehicle | CPU frozen evaluation + native replay | Frozen GPU versus CPU | Short GPU training | Visual inspection |
| --- | --- | --- | --- | --- |
| Formula | A01, A05, A06: pass | A01: exact match | 3/3 generations: pass | Driver, replay, black box: pass |
| Rally | A01, A05, A06: pass | A05: exact match | 3/3 generations: pass | Driver, replay, black box: pass |
| Snowmobile | A01, A05, A06: pass | A06: exact match | 3/3 generations: pass | Output legality, replay, black box: pass |
| Truck | A01, A05, A06: pass | A05: exact match | 3/3 generations: pass | Driver, replay, black box: pass |

A01 is Replica A01 Beginner, A05 is Replica A05 Two Terrains, and A06 is Replica A06 Ice. The matrix contains 12 CPU frozen evaluations, 12 native recordings, four GPU frozen evaluations and four GPU training runs. Evaluations used 900 configured ticks at 60 Hz decisions with one worker. Each training fixture used eight cars × three generations × 900 ticks and produced 24 validated descriptor rows.

All four CPU/GPU comparisons matched their complete frozen measurement descriptors exactly, with no tolerance widening. Frozen output bytes stayed unchanged. Training primary bytes matched the declared fitness winner; vehicle, sensor and output interfaces remained valid, including Snowmobile's unavailable Handbrake output.

A01 recordings contain 51 measured samples across five seconds; A05/A06 recordings contain 151 samples across fifteen seconds. All recordings passed the current viewer validator. An independent f64 forward calculation reproduced native controls with maximum absolute error `2.22e-16`, below the predeclared `1e-12` tolerance.

The browser verified paired driver/analysis receipt before confirming default server-copy deletion for all eight GPU jobs. The 12 CPU jobs separately passed direct post-delete HTTP 404 probes for status, driver and analysis. GPU deletion has UI/service confirmation; those jobs were not independently probed for post-delete HTTP 404. App-level cleanup is not a physical-media erasure or provider-wide zero-retention claim.

Quota was checked before every GPU call, using included allowance only. No paid overage was authorized. GPU acceptance covers the ordinary signed-in app route; a separate CLI identity preflight stopped before compute and is not qualified by these results.

The final publication checks verify snapshot identity, native artifact hashes, source/archive contents, the portable skill and release asset round trips. The existing root Rust workflows are unchanged; the packaging-only sync deliberately skips their unrelated nightly pipeline rather than claiming a new root-crate CI pass.

## Source, attribution and platform scope

This lab uses the MIT-licensed [Zorro909/driving_sim_rs simulator](https://github.com/Zorro909/driving_sim_rs), with TiGa's hosted interface, bounded worker integration and native replay/black-box additions. Native provenance records upstream base `b90b8af06ffc4ea4e4fd703becd1107a48b8e5e0`, the retained `ald-parity-20261017` physics branch, selected release/build changes, source archives and binary build receipts.

The [TiGa fork](https://github.com/seeker-cyber-maker/driving_sim_rs) now publishes the complete verified HF snapshot under `hf-space/`. Its existing root Rust source tree is preserved separately. The upstream `v1.3.0` version is not a byte-identity claim for this custom HF package. Publishing this copy does not change HF Space visibility or replace the deployed build.

The bundled native artifacts target Linux x86-64. This is not a new macOS, iOS or Windows application release. Historical native build receipts retain their original non-secret build-host paths for provenance; portable usage does not depend on those locations. Licenses and vendor notices remain included.

Godot and Swift remain intact, and the retained parent policy is unchanged and unpromoted. All driving checks used disposable deterministic synthetic controllers. This release qualifies the tested workflows; it does not establish clean laps, learning superiority, exhaustive track/browser coverage, original-game physics parity or new Godot/Swift runtime qualification.

## Downloads and verification

- `ald-lab-2026.10.23-hf-space.tar.gz`: exact HF package, source identity, usage guide, portable verifier, release notes and qualification record.
- `ald-run-experiment-2026.10.23.zip`: the standalone portable agent skill folder and its references.
- `ald-lab-2026.10.23-verification.json`: compact functional qualification record without private account data or local preservation inventories.
- `SHA256SUMS`: SHA-256 checksums for the downloadable assets.

After extracting the HF archive, run `python3 scripts/verify_hf_snapshot.py` from its root. It verifies package bytes and build identity using Python's standard library; it does not start simulation, request GPU time or promise a bit-for-bit native rebuild.

See the [source record](https://github.com/seeker-cyber-maker/driving_sim_rs/blob/ald-lab-2026.10.23/docs/releases/ald-lab-2026.10.23/SOURCE.json) and [qualification record](https://github.com/seeker-cyber-maker/driving_sim_rs/blob/ald-lab-2026.10.23/docs/releases/ald-lab-2026.10.23/verification.json) for exact identities and the finite coverage boundary.
