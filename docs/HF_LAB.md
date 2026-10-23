# AI Coaching Story: Driving Grounds

Hosted package and agent experiments.

Open the [hosted app](https://tiga-rce-ald-tao-gpu.hf.space/) to run a CPU experiment without installing the simulator. GPU experiments use Hugging Face ZeroGPU and its current allowance. This app is separate from the original game and from the root Rust command-line release.

## Source layout and identity

`hf-space/` contains the current 100-file hosted package, including the Driving Grounds presentation update. Its [current source record](HF_SOURCE.json) identifies the exact HF revision and build. All 99 members of its release manifest are verified. The original snapshot and qualification remain available at the immutable `ald-lab-2026.10.23` tag. The Python, browser code, vendored dependencies, three Linux native artifacts, replica tracks, native source archives, licenses and build provenance are included.

The repository's root Rust tree retains its previous state. Its `Cargo.toml` version and build instructions do not identify the hosted binary. Use `hf-space/UPSTREAM.json`, `hf-space/BINARY_PROVENANCE.json` and the native archives for the hosted package's custom source lineage. Historical build receipts contain the original build host's paths; they are provenance, not required runtime locations. The branding update changes presentation and its content-derived build identity. Native binaries, worker settings, tracks, service routes, OAuth scope and HF visibility retain their qualified values.

From the repository or release archive root, verify the source with Python 3.10 or newer:

```sh
python3 scripts/verify_hf_snapshot.py
```

This checks file bytes, the release manifest, native artifact identities and the content-derived build ID. It does not execute the simulator or rebuild the binaries. The default verifier uses the [current source record](HF_SOURCE.json). The [original source record](releases/ald-lab-2026.10.23/SOURCE.json) and published release assets remain unchanged; run the verifier from that tag or extracted release archive to check that historical package.

## Run one experiment

1. Select a replica track and create a starter driver, or upload a compatible `.evolution` network. Imported networks keep their own vehicle type.
2. Choose **Frozen evaluation** to measure unchanged weights or **Train a population** to create candidates. A small workflow check is eight cars × three generations × 900 ticks, with 60 decisions per second. These settings demonstrate operation; they are not a training optimum or clean-lap guarantee.
3. Review **Training & recipes**, including rewards, timing and elimination. Keep the original network separately.
4. Start the run, then receive the driver in **Latest run**. Save the driver, full analysis archive and run receipt. Default delivery deletes the server result only after the browser verifies paired receipt.
5. Select the policy to inspect and record a five- or fifteen-second CPU drive. Playback exposes actual native controls and consumed sensor inputs. A GPU-trained driver's recording is a fresh CPU drive, not its original training trajectory.

For GPU, sign in before selecting files, check live included allowance before each run and avoid paid overage unless separately authorized. Account GPU sign-in and optional bucket/repository access are separate decisions; bucket access is not needed to train. See the snapshot's [data policy](../hf-space/DATA_POLICY.md) and [replay contract](../hf-space/REPLAY_BLACKBOX.md).

## Portable agent skill

The release includes [skills/ald-run-experiment/SKILL.md](../skills/ald-run-experiment/SKILL.md) and a standalone `ald-run-experiment-2026.10.23.zip`. Unpack it into the skill location supported by your agent, or give the agent the entrypoint directly. The folder includes its own references and has no dependency on a particular computer, account or other installed skill.

Example request:

> Use `$ald-run-experiment` on this ALD deployment to run one bounded CPU experiment on Replica A01 Beginner. Keep my input driver as the baseline, use 60 Hz decisions, save the driver, analysis and receipt, and inspect a five-second native replay. Retain the baseline unless my driving gates pass.

The app exposes discoverable agent actions for status, navigation, starter creation and selected-network inspection. The skill discovers current actions instead of storing IDs, and uses normal visible controls for remote runs, downloads and account operations. It can use a user-specified ALD deployment instead of the default hosted URL.

## Hosting and platform scope

The `hf-space/` directory is the HF application root: its README declares the Gradio SDK version and entrypoint, and `requirements.txt` pins its Python packages. Hosting GPU execution additionally requires the provider's ZeroGPU configuration and ordinary OAuth setup. This release does not create a new Space, supply credentials or grant storage permissions.

The bundled native binaries are Linux x86-64 artifacts. They are not macOS, iOS or Windows applications. On a compatible Linux environment with the pinned dependencies installed, `python3 app_release.py` from `hf-space/` starts the CPU entrypoint on port 7860. Use the hosted app from other platforms. Rebuilding the custom native snapshot is a separate build task; this release verifies the packaged binary bytes rather than promising a bit-for-bit native rebuild on every host.

## Release and evidence

- [Release notes](releases/ald-lab-2026.10.23/RELEASE_NOTES.md)
- [Bounded functional qualification](releases/ald-lab-2026.10.23/verification.json)
- [Source identity](releases/ald-lab-2026.10.23/SOURCE.json)

The ALD tag uses `ald-lab-2026.10.23`, distinct from upstream `v*` simulator tags. This packaging-only sync preserves the existing Rust workflows and uses GitHub's documented `[skip ci]` commit instruction to avoid publishing an unrelated Rust nightly. The fresh publication checks verify the HF package and skill; they do not claim a new root-crate CI run. See [GitHub's skip instruction](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs).
