# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Removed the hard-coded internal word list from the public sources. `app.data.js`
  and `tools/data-check.mjs` now read it from the optional
  `tools/internal-words.local.json` (git-ignored) or the `KHUB_INTERNAL_WORDS`
  environment variable; only a placeholder `tools/internal-words.example.json`
  ships in the repository.
- Reduced the page-side redaction comments to a neutral one-liner. The publishing
  rules themselves stay structural (`scope` / `type`); the policy lives in the
  private ops repository.
- `tools/data-check.mjs` no longer prints matched words, note identifiers,
  taxonomy names or pipeline values — GitHub Actions logs are public on a public
  repository, so findings are reported as an index plus a hit count.
- Added the leak gate to CI: both `deploy.yml` and `pr-check.yml` now run
  `node tools/data-check.mjs`. In `deploy.yml` it runs before anything is
  uploaded, so a failure aborts the release. Without the `KHUB_INTERNAL_WORDS`
  secret the word-based part is skipped with a warning instead of failing.
- Pinned every GitHub Action to a commit SHA (with the version in a trailing
  comment) instead of a moving tag.

### Changed

- `deploy.yml` reads the target bucket and CloudFront distribution from the
  repository variables `KHUB_BUCKET` and `KHUB_DISTRIBUTION_ID` instead of
  hard-coded values, and fails with a clear message when either is unset.
- `README.md` documents how to run `tools/*.mjs` locally, the data update flow,
  and the secrets / variables the workflows require.

### Added

- This changelog.
- `tools/internal-words.example.json` — placeholder format for the redaction list.
