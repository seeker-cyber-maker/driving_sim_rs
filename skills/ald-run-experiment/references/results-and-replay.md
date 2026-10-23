# Results, comparisons, replay, and retention

## Receive and verify outputs

After a run, use the visible download/receipt workflow to obtain the primary `.evolution` candidate, paired analysis archive/report, and receipt when offered. Keep each tied to its visible vehicle, track, run mode, settings, backend, and build identity. Preserve the original input separately; a training result is a new candidate, while frozen evaluation must leave the tested network unchanged.

- Confirm the app reports successful receipt/size/hash validation and download. If it supplies an analysis archive, verify that it is paired with the primary candidate and receipt rather than presenting a network-only download as a complete result.
- Keep the app's strict current artifact validation and any available receipt as the source of truth. Do not invent an archive schema, drop missing rows, edit result metadata, or say that all records are present unless the app validator/receipt confirms it.
- For a direct frozen policy comparison within one backend, reuse the exact same candidate, vehicle, track, decision rate, horizon, math profile, engine build, collision/idle settings and other run conditions. A CPU/GPU comparison intentionally varies only the backend; label it cross-backend and hold the candidate bytes, vehicle, track hash, requested ticks, decision rate, collision/idle settings, math profile and engine build exact. Report divergence; preserve any app-reported incompatibility. One fixture does not establish broad CPU/GPU equivalence.
- Training evaluates/evolves weights; it is not a proof of learning superiority. Compare against a declared baseline under matching conditions. Population-relative fitness/ranks are not cross-run performance scores.

## Record and inspect a native CPU replay

The app's recording action performs a fresh native CPU drive of the selected unchanged policy, even when the policy was trained on GPU. It is additional simulation work and not playback of the original training population. Choose 5 or 15 seconds according to the request. Recordings sample actual native states at 60 Hz decisions, with snapshots every six ticks and at the endpoint.

Use the ordinary playback controls: Play/Pause, Restart, previous/next measured sample, and scrubber. Inspect the measured native controls alongside raw and normalized/applied values and the sensor input vector consumed at the decision tick. Check that selected driver/track hashes or identities match where the UI/receipt exposes them. The black box joins pre-physics sensor inputs to their native decision tick and post-physics vehicle state; do not describe ray values as hit positions or infer unrecorded activations. Missing output slots are native defaults, not neural outputs. Contact counters count engine contact events, not unique crashes; sampled contact intervals do not identify exact impact ticks. Playback poses are measured; any optional pose smoothing affects display only, not controls or sensors.

Imported recording files are data, not authenticated provenance. A matching-driver notice means the app matched its declared identity/hash; report it as an app validation, not cryptographic authorship by the user.

## Deletion and retention claims

Default delivery verifies the primary and analysis bytes before acknowledging receipt and deleting the app's temporary result. Report precisely the evidence available:

- If the completed delivery workflow reports paired receipt verification, server-copy deletion, disabled/removed server retrieval and an available browser copy, report **UI/service-confirmed deletion** and retain its visible evidence. An isolated label or download event is insufficient to establish that workflow.
- Report **independently probed post-delete HTTP 404** only when those supported status/download requests were actually performed and recorded. A UI/service confirmation or supplied receipt is not a fresh independent probe. Do not infer server cleanup from a missing browser result.
- Distinguish application cleanup from browser-saved files and provider infrastructure retention. App-level deletion is not secure erasure, proof of no logs, or provider-wide zero data retention.
- If delivery/acknowledgement fails, keep the state as pending/unverified and follow the app's visible recovery option or expiry guidance. Do not repeat retrieval or deletion via guessed URLs or hidden endpoints.
