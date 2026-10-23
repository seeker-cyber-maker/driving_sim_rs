# Data handling & deletion policy — public-release candidate

Operator: TiGa (seeker-cyber-maker). Candidate version: 2026-10-13. This package is not a receipt that a hosted deployment or publication has occurred.

Files are processed only for the requested job, not collected for our own
training, analytics or public examples. Inputs remain in the browser until Run or an explicit bucket action.
The interface supports native CPU and, on a ZeroGPU deployment, an explicitly
selected GPU job. CPU requests do not acquire a GPU lease.

The built-in replica track library is a separate, intentionally reusable public
reference collection shipped with the app. Visitors can retrieve these listed,
hash-checked files. They are programmatically reconstructed editor-format
replicas, not editor-authored or official packaged track files. Job deletion does
not erase this reference library; it erases only submitted job copies and job
results under the rules below. Custom uploaded tracks/networks are never added
to the library. Track selection and reference bytes may remain in this page's
memory across runs, but are not saved in cookies, localStorage or recipes.
See TRACK_LIBRARY.md in the release package for provenance and limitations.

GPU inputs await dispatch in application memory for at most 120 seconds. The
queue receives a random one-use ticket, not the uploaded track or network bytes.
Inputs are released from the pending store on dispatch, expiry or shutdown. When
HF explicitly rejects a request for exhausted GPU allowance, the browser asks
the app to discard that pending ticket immediately and reports whether deletion
was confirmed or the ticket was already consumed. If that request fails, the
fixed 120-second expiry still applies to any ticket that remains pending.
The framework may retain ticket and result metadata in its transient queue/session
buffers; result metadata includes the temporary job access key. Framework file
uploads and run history are disabled. These restrictions are not secure RAM erasure.

Each job uses temporary files removed before a successful result is published.
The application result store is memory-only. No public file URL is created.
The browser holds a random job access key in memory, independently of optional HF sign-in.
Anyone who obtains that key can access the job; do not share it. Reloading the
page loses access. Expiry is fixed at five minutes from result publication.

Automatic deletion is the default. New results contain a primary network and a
complete analysis archive. The browser verifies the size and hash of both before
acknowledging receipt; that acknowledgment deletes both stored payloads together.
Both remain retryable under the same job key until acknowledgment or the fixed
five-minute expiry. Retrying does not extend expiry. Older primary-only result
paths retain their one-attempt automatic delivery rule. We cannot verify that the
browser saved to disk. Delete now removes the entire result immediately.
Visitors can opt in for each single run to keep its result in application memory
until the same deadline when bucket autosave is disconnected or off. The checkbox
resets after every run. Batch and comparison runs use automatic deletion.
The browser can save received networks and analysis again from page memory.

Access is refused at the deadline. While the server is running, the expiry loop
releases expired stored data within approximately one second, subject to runtime
scheduling. Shutdown clears the store; a restart has no saved job data to reload.
This is deletion of application-controlled files and stored results, not a claim
of physical RAM/disk erasure, prevention of swap, or deletion of response buffers.
No claim is made about hosting-provider logs or infrastructure retention.

Optional HF identity sign-in uses the official OAuth authorization-code/PKCE flow
with openid/profile scopes. It identifies account GPU requests and is independent
of CPU access. Access tokens and basic profile details live in browser page memory,
not cookies, localStorage, recipes, or a server session database. Only the one-use
PKCE verifier/nonce, purpose and start time are temporarily saved in tab-local
sessionStorage to survive the full-page redirect, with a five-minute acceptance
limit; they are removed on return, error, or a fresh app load. Closing the tab loses
them. HF handles password entry and authorization. The callback briefly carries a
one-use authorization code and state in its URL; the app clears that URL before
loading the OAuth helper. HF/proxy infrastructure handling is outside this
application's deletion guarantee.

A non-GPU queue check forwards the visitor bearer credential to HF's fixed
userinfo endpoint and returns only the username, PRO flag, and authentication
path. The queue also receives that visitor credential for GPU calls. Credentials
are never sent to the native simulator or written to application logs/results.
HF and framework transient request buffers remain outside secure-erasure claims.
Sign out clears this page's credential; expiry or closing/reloading the page also
loses it. Sign out does not revoke the HF OAuth grant or sign out of HF itself;
users may revoke the grant in HF account settings. CPU does not require sign-in.

Results received by the browser and files saved locally are the user's to manage.
The browser retains its received result in page memory so Save received result
again can retry a local save without another server retrieval. Discard browser
result clears the app's reference; closing or refreshing the page loses it.
The service uses one result-owning process. HF framework and proxy behavior may have retention outside this app, so this is
an application-level near-zero-retention design, not a provider-wide ZDR claim.

The runner candidate has a separate browser-local recipe library. Saving is
explicit; settings and reward mixes, recipe names, and batch recipe references
are stored under the app's single `tiga.ald.recipes.v1` localStorage key. The
application does not put track/network bytes, job keys, run results, HF identity
or credentials in this library. It does not use cookies for recipes. By default,
the library stays in this browser and is not sent to the server. Separate explicit
actions can save, list, and restore the settings-only library in an existing
private bucket; those actions require the optional HF bucket authorization and
send the library through this app server. Import asks before replacing the browser
library and never starts a run. A run sends only its selected settings and input
files. Recipes persist across page reloads; they are site/browser-specific and
clearing site data removes them. Local-file export/import also transfers a
settings-only JSON library.
Clear saved recipes removes only this app's recipe key, independently of server
result deletion and browser result discard.

Batch execution freezes the selected recipes when Start is pressed. It runs
sequentially, using either the original network each time or the preceding
candidate. Each intermediate result is downloaded to browser memory, checked by
size and SHA-256, and acknowledged for server deletion before the next run. Batch results always use automatic deletion, regardless of the single-run retention choice. Only the last received candidate is retained in page memory for saving.
Stop batch prevents the next run; it does not interrupt the current server job.
Closing/reloading the page does not prove cancellation of an in-flight job.
Failure to acknowledge a received result stops the batch and leaves Delete now
and fixed expiry available. Batch receipts stay in page memory unless explicitly
exported; they are not added to recipe storage.

Network inspection, creation and editing take place in browser memory. Applying
an edited network selects it as the next run's input; this alone sends nothing
to the server. Exporting saves a new file, not the original source. No training
history is attributed to freshly created or edited weights. 


## Optional public Steam leaderboard check

The “After a completed lap” checkbox is off by default. With it off, or when a run reports no completed lap, the browser makes no leaderboard request. When enabled, the browser sends only the built-in track ID and hash, reported vehicle type (Formula, Rally, Snowmobile or Truck), and best-lap seconds to this app's same-origin server. Custom or unidentified tracks are not sent. HF does not forward the lap, network, Steam ID, account credential, file name or other run data to Steam.

The app reads the public Steam Community track index and matching board XML without a Steam login or publisher key. It resolves exact catalog reference labels against that live index; an absent or ambiguous mapping is unavailable. The app retains only a short-lived in-process cache of public board rank/time rows (up to 60 seconds) and the public index mapping (up to five minutes). Player names, Steam IDs and raw XML are discarded after parsing. The comparison request and result are not stored in the job result store or recipe library.

The displayed value is an insertion-position estimate against the fetched raw global board, at millisecond precision. The board may contain entries for different vehicle types; the estimate is not vehicle-filtered, an official rank, a submitted score, or proof that replica timing matches the Steam game. The check runs in the background with an eight-second browser deadline. It cannot delay result availability or download; a timeout leaves the completed result intact. Steam's community page may change or become unavailable, in which case the app reports the check as unavailable.


## Optional private bucket storage

Bucket storage starts disconnected. After an explicit HF OAuth authorization and connection to an existing private bucket, automatic saving is on by default and can be turned off for manual saves. With no connection or autosave turned off, completed runs make no bucket storage calls. With autosave enabled, each completed run is downloaded and hash-verified in the browser, then the application confirms deletion of both server payloads before it sends the resulting network, available winner networks, complete per-car measurements and sanitized run report to the bucket. Each batch result is saved before the next run starts; a save failure stops the batch. A failed receive has no verified local copy; a deletion-acknowledgment failure skips bucket saving; after confirmed deletion, an unconfirmed bucket save leaves the verified local candidate available for download or manual retry. A remote save might have completed if its response could not be verified.

HF describes the requested `write-repos` scope as read/write access to personal repositories. This grant is broader than one selected bucket and has not been confirmed as bucket-only or the minimum required scope. The token and bundle pass through this app server during storage operations; the app keeps the token in page memory only and removes temporary storage files after operations. It does not save tokens in URLs, browser storage, receipts or bundles. Disconnect, observed authorization denial/expiry, and page close clear the app's connection. The app has no bucket create, delete, overwrite or visibility controls; saved objects remain in the user's bucket until managed elsewhere. Provider-side logs and retention are outside app cleanup guarantees, which do not establish provider-wide zero data retention or secure physical erasure.

Connecting checks the listed bundles and selects the newest compatible entry among those returned. It restores the entry in this page only when there is no existing network, track, result or editor draft; otherwise it only selects it. The list is bounded, so an incomplete scan may omit a newer bundle. No run starts automatically. Reports contain fields returned by the engine, including generation history and configured settings. New result archives also include all supported per-car reward measurements, update counts and within-population ranks. These ranks and configured reward weights are labeled separately; they are not absolute cross-run performance scores. Frozen evaluation preserves the input network and records a separate fresh driving result.
