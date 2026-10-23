# Built-in editor-format replica tracks

This read-only library contains 28 programmatically reconstructed editor-format
replicas: A01–A09, B01–B09, R01–R09 and The Champions Trial. The operator explicitly
approved this replica bundle for inclusion. The files are not editor-authored,
clean-room creations or the original packaged track files. Original layout data
was used; a new file format/serialization is not a claim of independent origin.

Source schema: ald-editor-format-replicas-v1, run-r2-dummy-stars. The shipped
catalog declares the method and editor_authored=false / clean_room=false, and
contains each file's SHA-256 and byte count. Private provenance paths, original
packaged files, artwork, textures, opponents/controllers, original race parameters
and the native geometry catalog are not part of this library.

Training-track numeric challenge conditions were preserved. After each run the
worker checks supported conditions in a fresh fixed-weight replay of the primary
result. This predicts this network's performance only; it grants no campaign
stars and carries no progression between runs. Race replicas contain dummy lap
conditions in their editor files. The star checker recognizes those built-in
files and reports their original opponent races as not checked, rather than
counting placeholder laps as original-game stars. Availability
in this selector is not a claim of official game approval, legal clearance,
game-editor load verification, physics parity or leaderboard qualification.

Track selection and Training track are synchronized controls for one active
input. Upload a custom track remains available. Selecting a built-in clears the
custom file selection; choosing an upload switches back to upload mode. Built-in
selection survives completed runs in this page, but is not written to cookies,
localStorage, recipes, or account storage. Network selection is still explicit.
The canvas preview shows tile layout and asphalt, dirt, and ice terrain. It does
not show collision geometry or prove that the replica matches native physics.

The public app exposes only catalog-listed IDs and hash-checked replica bytes.
No directory browsing, caller-selected paths, remote track URLs or extraction
from game binaries is supported. CPU and GPU use the same existing bounded input
contract. Client and server both check reference-file size/SHA-256.

These reusable reference tracks are intentionally part of the app package, not
private job data. Job deletion removes the submitted copies, temporary work and
stored result, not this shared library. Built-in files are retrievable by app
visitors even while HF source visibility remains Protected. User-uploaded
tracks/networks never enter this catalog and retain the existing deletion rules.
