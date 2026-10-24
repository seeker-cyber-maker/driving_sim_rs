---
title: "AI Training Story: Driving Around"
sdk: gradio
sdk_version: 6.29.1
python_version: "3.10"
app_file: app.py
hf_oauth: true
hf_oauth_expiration_minutes: 60
hf_oauth_scopes:
  - write-repos
---

This package is the public GPU app at https://tiga-rce-ald-tao-gpu.hf.space/. The HF Space and its source are public at https://huggingface.co/spaces/TiGa-RCE/ald-tao-gpu, with a matching source copy at https://github.com/seeker-cyber-maker/driving_sim_rs/tree/main/hf-space. The standalone CPU Space remains private. The app also offers an anonymous CPU route. Build-specific deployment and qualification status belong in the release receipt.

# AI Training Story: Driving Around

**Can you train a neural network to drive better than an agent?**

Train a driver. Replay its decisions. Compare the evidence under matching conditions.

## Start here

Driving Around lets you experiment with small driving controllers in a packaged simulator. You can make a controller in the browser or load a compatible `.evolution` file, then ask the simulator to evaluate it or train a group of candidates. You do not need the original game installed to try the 28 built-in replica tracks and browser editor.

The app is a separate, bounded experiment. It does not control the original game, reproduce its full campaign, or grant official stars or progression. Its track map shows static walls and a calculated suggested route; saved native recordings animate the measured car motion. It does not stream a running training population. The built-in tracks are reconstructed replicas, and a successful simulation run is not proof of original-game physics parity.

## A first run

1. Under **Choose your driver**, use **From this device** to load a compatible `.evolution` file, or **Saved in bucket** to restore an existing private-bucket bundle. Check the selected driver name. If you need a fresh network, expand **Create a new driver instead**; creating one does not start a run.
2. Under **Choose a track**, select one of the built-in replicas or expand **Use a custom .track file**. Use **Calculate suggested route** for a rough geometric reference. Toggle **Show suggested route** and **Recorded path** independently to compare it with the car’s actual trajectory.
3. Click **Review training settings & recipes**. The starter recipe is 32 candidates × 20 generations × 900 ticks per generation (15 simulated seconds per car per generation), mutation 0.3, decay 0, and a distance-only reward of +100. Collision and idle elimination are off; selection uses one parent and keeps one elite candidate. These are a starting point, not a promise of a fast or clean lap. Use **Apply first-run settings to this form** only if you want to reset the current form; saved recipes remain unchanged.
4. CPU runs without an HF account. Under **Action**, choose **Train a population** or **Frozen evaluation · one policy, unchanged weights**, then click the run button to begin. Training evolves a group of candidate controllers; a generation is one round of simulation and selection. Reward settings tell the trainer which measured outcomes to favor.
5. Click **Download result** to receive the result and reveal its winner, measurements, and supported challenge checks. Connected bucket autosave handles delivery instead. A challenge check replays the named network with fixed weights; it predicts conditions for the replica track and does not award stars in the original game.
6. Download a controller or portable bundle to keep it locally. You can also connect an existing private Hugging Face bucket for optional saves. Read the storage note below before authorizing bucket access.

## Compute and storage

On the public GPU app, **CPU** is the anonymous option and does not use GPU allowance. **GPU** runs are subject to Hugging Face's GPU allowance; anonymous allowance may be limited. Optional HF sign-in associates a request with your account but does not guarantee available quota. Sign-in can reload the page and clear selected files, so sign in before choosing files if you want to use it. The standalone CPU Space is private.

Your input files stay in the browser until you start a run or explicitly include them in a local export or bucket save. The app holds processing copies and results temporarily; by default it deletes a result after the browser verifies receipt, and all results expire within five minutes. This is an application-level retention design, not a provider-wide zero-data-retention guarantee. The full handling rules are in [DATA_POLICY.md](DATA_POLICY.md).

Recipes and batches are saved in this browser by default. After connecting an existing private bucket, automatic run saving is on by default and can be turned off. Recipe-library Save, Refresh, and Import remain separate explicit actions; they transfer settings only and never start a run. Bucket authorization uses HF OAuth, not a personal access token. It requests HF's `write-repos` permission, which HF describes as read/write access to personal repositories. That permission is broader than one bucket and is not a bucket-only grant. The app only operates on the existing private bucket you enter. See [BUCKET_BUNDLE.md](BUCKET_BUNDLE.md) before connecting.

## Network limits

The packaged worker supports Formula, Rally, Snowmobile, and Truck. Networks can use up to 20 inputs (13 raycasts plus 7 other sensors), 12 total layers, and 16 neurons per hidden layer. Formula, Rally, and Truck support up to five outputs; Snowmobile supports up to four and cannot use Handbrake. Fresh networks for every vehicle require Steering and Acceleration. Formula imports retain previously supported ordered output subsets; Rally, Snowmobile, and Truck imports must include Steering and Acceleration and follow their vehicle-specific output rules. Supported sensors use original-game defaults when optional parameters are omitted. These are the vanilla worker limits, not support for arbitrary modified-game networks. See [TRACK_LIBRARY.md](TRACK_LIBRARY.md) for track scope and provenance, and [WINNERS_AND_EVALUATION.md](WINNERS_AND_EVALUATION.md) for result interpretation.

## Visual replay and debugging

Record a selected policy for 5 or 15 seconds, then play, pause, scrub, or step through actual native samples. The car black box shows measured motion, contacts, boost, raw/applied controls and the sensor inputs consumed by the policy at its recorded decision tick. Playback starts paused, the camera is manual, and optional pose smoothing does not interpolate telemetry. Recordings can be downloaded and reopened. A GPU-trained policy is replayed in a fresh CPU evaluation; this is separate from its original training generation. See [REPLAY_BLACKBOX.md](REPLAY_BLACKBOX.md) for capture phases and limits.

## Results and evaluation

A training result can include the final-generation fitness winner, the fastest completed-lap controller, and a clean-lap controller when one qualifies. A controller may fill more than one role; unavailable roles are labeled. Per-car records cover supported reward channels, but population-relative ranks are not absolute scores across separate runs. Frozen evaluation uses one controller with unchanged weights. See [WINNERS_AND_EVALUATION.md](WINNERS_AND_EVALUATION.md) for the exact rules and comparison limits.

The app can check supported track conditions after a run by replaying the named controller with fixed weights. This may add time to the run. The result is a bounded prediction for the reconstructed track. It does not award or accumulate original-game stars; opponent races and unsupported conditions remain unchecked.

The simulator is based on [driving_sim_rs](https://github.com/Zorro909/driving_sim_rs), upstream revision `b90b8af06ffc4ea4e4fd703becd1107a48b8e5e0`; the release receipt records the packaged build and local changes. The package includes the upstream [MIT license](LICENSE). Upstream pull requests 19 and 21 are not included. Feedback: [open an editable issue draft](https://github.com/seeker-cyber-maker/driving_sim_rs/issues/new). It is not submitted automatically. Review the draft and remove private names or data before posting. Never attach tokens, job keys, private networks, proprietary tracks, or unrelated logs.


## Driver-first / 60 Hz

Load an existing `.evolution` driver or saved bucket bundle first. Creating a new driver is secondary. The Run button follows the driver, track, action and compute settings. New training and frozen evaluations require **60 Hz physics and 60 Hz controller decisions** (`batch_count=1`) on CPU and GPU.

Historical 30/15 Hz recipes and receipts remain readable and retain their recorded timing. They cannot start a new run. Use **Make a 60 Hz copy** in Training & recipes to create a new recipe in an empty slot; the original recipe and batches stay unchanged. Restoring an older bundle loads its driver but does not apply its non-60 Hz recipe. Replay sampling and playback speed are unchanged.

Build-specific bucket, CPU/GPU and deployment qualification is recorded in the release acceptance receipt. The interface does not automatically promote a trained policy. See `UI_CADENCE_CHANGE.json`.

## Suggested route

The optional route is for general orientation. **Show suggested route** and **Recorded path** are independent layers; green shows actual positions from the native recording.

The preview renders road geometry directly from the native part polygons and calculates a guide using conservative part masks, shared opening components and clearance-weighted search. Split-lane choices stay connected through neighboring pieces. Every displayed guide segment is checked continuously for a 32-unit static margin and the saved piece order. The replay readout measures distance from the selected native position to that line. See `REPLAY_BLACKBOX.md` for its bounded search, static-clearance checks and vehicle-dynamics limitations. This is not an optimal-lap solver or a policy promotion.
