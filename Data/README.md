# Runtime Data

`Data/` is the root runtime resource directory for local and packaged StartDeck runs.

- `Data/data`: SQLite database, JSON state, cache, and user records.
- `Data/public`: frontend build output exposed by the backend.
- `Data/music`: uploaded or mounted music files.
- `Data/PC`: desktop background images.
- `Data/APP`: mobile background images.
- `Data/doc`: transferred documents and uploads.

Most files under this directory are generated or user-owned runtime data and should not be committed.
