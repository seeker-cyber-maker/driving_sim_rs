# Storage boundaries for the runner adaptation

The UI must not decide that public or private hosting implies persistence. The
same settings contract is used independently of the selected storage policy.

| Layer | Current implementation | Lifetime / deletion |
|---|---|---|
| Recipe library | Browser localStorage by default; optional explicit private-bucket adapter | Settings, names, and batch references only; bucket actions are separate from run autosave |
| Track / network editor | Browser File/Blob objects | Page memory; selected for upload only on Start |
| Built-in replica library | Read-only, allow-listed release files; anonymous catalog/file endpoints | Intentionally persistent shared references; not erased by job deletion; user uploads never enter the catalog |
| Selected built-in track | Synchronized selectors and one verified Blob | Page memory across runs; no cookie, recipe or localStorage persistence |
| Worker inputs / intermediate files | Temporary directory | Removed before successful result publication |
| GPU pending inputs | Opaque single-use ticket plus memory store | Dispatch, confirmed quota-rejection discard, fixed 120-second expiry, or shutdown |
| Single-run network and analysis | One memory result record and random job key; both payloads share expiry and deletion | Default receipt ACK; opt-in repeat download until fixed five-minute expiry; manual delete or shutdown |
| Batch intermediates | Same job contract, always automatic | Verified size/hash and deletion ACK before advancement |
| Received candidate, winner networks, descriptors and receipt | Browser page memory | Explicit discard, replacement, page reload/close; download to disk or optional connected-bucket autosave |
| Optional HF identity / token | Browser page memory, separate from job/recipe storage | Sign out, expiry, or page reload/close; no app auth cookie or server session database |
| Optional HF bucket OAuth grant | Separate explicit `openid profile write-repos` authorization; shared in memory with identity when granted together | Disconnect, observed expiry/denial, or page reload/close; no token in URL, localStorage, recipes or bundles |
| One-use HF PKCE verifier/nonce | Tab-local sessionStorage for the sign-in redirect only | Five-minute acceptance limit; removed on return/error/fresh app load or tab close; never stores access tokens or files |
| User private bucket | Separate optional connection; autosave is on by default after connection and can be disabled; explicit Save, Refresh and Restore remain available | Verified run output is sent through the app server only after result deletion is confirmed; a failed save keeps the local candidate; bucket objects remain until managed elsewhere |

`recipes.cjs` has no host/network dependency. Its `createStore(storage)` receives
only getItem/setItem/removeItem capabilities. The optional bucket adapter is
separate from the browser recipe store and run-artifact store. It moves only the
validated settings-only recipe library after an explicit user action; it does
not add credentials or file bytes to recipe JSON. Bucket import asks before
replacing the browser library and never starts a run. Server cleanup must never
clear the recipe library; clearing recipes must never delete a server job,
bucket, or downloaded file.

The app has no persistent HF identity or bucket credential storage or telemetry. Recipe uploads are never automatic. Optional bucket authorization requests `write-repos`, which HF describes as read/write access to personal repositories; that scope is broader than one selected bucket, and a bucket-only minimum permission has not been confirmed. Explicit bucket operations and connected run autosave send the selected bundle or settings-only recipe library and page-memory OAuth token through this app server. Application-level cleanup does not make provider-wide retention claims. Browser-local storage is site-specific and may be
blocked by browser privacy settings. A local runner and an HF iframe do not
automatically share their library; explicit JSON export/import is the bridge.

These are application lifecycle rules, not provider-wide erasure or a network
sandbox. Hosted qualification must be repeated for each deployed build.

Analysis is saved only with the user-selected local download or connected private bucket. The complete per-car measurements and immutable winner networks use the same temporary job lifecycle as the primary network. Frozen evaluation changes no network weights and does not start training when a bundle is restored.
