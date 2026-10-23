# Winners, measurements and frozen comparisons

Training still uses the recipe you select. This app adds records you can inspect afterwards; it does not choose a curriculum or change your rewards automatically.

## Continue a winner or evaluate it unchanged

After **Download result** receives the run (or connected bucket autosave finishes), the result panel lists the available winners. Select a role in **Winner to continue or evaluate**, then choose what to do with it:

- **Continue training** stages that winner's weights as the next training input and returns the run mode to training. It does not start a run. The selected track is retained unless you choose another one.
- **Evaluate unchanged** stages the same weights for frozen evaluation. It does not start a run or mutate the controller.

In either case, review the track and settings, then click the run button when you are ready. It reads **Run training** in training mode and **Evaluate policy (weights frozen)** in frozen mode. The winner action only prepares the next run; it does not start it or reuse the previous run's measurements as new evidence.

## What a training result preserves

- **Fitness winner:** the best car under your selected reward recipe in the final evaluated population. This is the usual primary network download.
- **Fastest lap:** the car with the fastest completed forward lap observed during the run, even if it was not the final fitness winner.
- **Clean laps:** the fastest qualifying car that completed the required number of forward laps without physical wall contact. The default is two clean laps.

A single car can qualify for several categories. A category without a qualifying car is marked unavailable. Saving a winner preserves the exact policy evaluated for that result; later mutations do not replace its weights.

Every evaluated car has a measurement row, including the reward metrics you did not select. The archive contains raw measurements, update counts, reward-channel values, within-population ranks, the selected fitness score, completed laps, distance, and contact counts. A reward-channel rank depends on the population it was measured against. It is not an absolute score you can compare across unrelated runs. Missing measurements remain missing.

Saving a result to your connected private bucket also preserves the available winner networks and analysis. Names distinguish the run and winner category. Existing saves are not overwritten. You can also download the analysis for local use. Earlier bundle files remain readable; they cannot acquire measurements that were never recorded.

## Recipe libraries in your bucket

Recipe import and export offer both local JSON files and your connected private bucket. Bucket exports save the current browser library of named recipes and batches under a new dated entry. They include settings only; networks, tracks, run results and credentials are not part of a recipe library.

Refresh saved recipes to list bucket entries and select the latest. Importing a selected library asks before replacing this browser's saved recipes and batches. It does not start training or automatically apply a different training strategy. Existing bucket exports are not overwritten. The same 32-KiB library limit applies to files and buckets.

## Frozen evaluation

Choose evaluation to drive a network without training it. The evaluator starts with a fresh car and keeps the uploaded network unchanged: no mutation, weight decay, crossover or reproduction. Evaluation does not create a new winner population.

Select the winners you want to compare, choose the evaluation conditions, and start the comparison. Each distinct policy runs in sequence with its weights frozen. The evaluation may be longer than the original training run. Compare saved winners under one set of conditions: track, vehicle, run duration, controller frequency, collision elimination and idle elimination. Use the same engine build and backend for a direct comparison. Each policy retains its own identity. Different conditions are shown as incompatible rather than silently converted.

Look at completed laps, clean-lap eligibility, contacts, distance and lap time together. A short evaluation that ends before the second lap cannot establish two-lap reliability. A fast lap with contacts is not a clean-lap result. Replica lap times remain simulator measurements; they do not establish an official Steam leaderboard result.

## Data lifetime

Primary network and analysis are one temporary server result. The browser checks both before acknowledging deletion. Bucket saving then uses the verified bytes held in the browser. If a bucket save fails, the local result remains available for retry or download. Closing the page can lose an unsaved local result.

Analysis can be much larger than a network. Bounded size limits protect the service and browser. The app must report an oversized or incomplete result explicitly; it must not silently drop cars, generations or reward channels and call the archive complete.

The bucket is user-owned storage. Application cleanup applies to temporary processing copies, not the files you have chosen to save in that bucket. Provider-wide retention is outside this app's guarantee. Recipes remain under your control; this feature does not choose or adapt them for you.
