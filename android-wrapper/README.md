# Shahrjo Android wrapper

This module wraps https://shahrju.ir and exposes the `window.ShahrjoBazaar.purchase({productId, packageName})` bridge used by the website. Subscriptions are launched with Cafe Bazaar Poolakey; the server must verify the returned purchase token before activating a plan.

## Product IDs

The native bridge only accepts these six IDs from the Bazaar developer console:
- `SILVER_1M`, `SILVER_6M`, `SILVER_12M`
- `GOLD_1M`, `GOLD_6M`, `GOLD_12M`

## Build

The GitHub Actions workflow builds a **debug-signed test APK** and uploads it as an artifact. It is for installation/testing only, not a release-ready APK. A release build must be signed with a persistent release keystore, stored as protected GitHub Actions secrets; do not commit a keystore or passwords into this repository.

Before publishing, verify the package name, the existing Bazaar app signing/update policy, and the backend subscription-validation flow. Keep the server-side Bazaar access token out of this Android project.
