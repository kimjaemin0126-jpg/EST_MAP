Place the source CSV and Shapefile data in this directory.

Run `npm run preprocess` after updating a source file. Full generated JSON is
kept in `src/data/generated`, while compact browser-facing output is generated
in `public/data` with quarter-specific `.min` filenames. Store and market
context files are fetched lazily for the selected quarter; runtime code must
not fetch files directly from `src/data`.
