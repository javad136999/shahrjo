# Live map audit (read-only)

Source: production public API `https://shahrju.ir/api/v1/cities` and `https://shahrju.ir/api/v1/map?city=<slug>`; checked 2026-10-21.

The cities endpoint returned 79 cities. All 79 public map endpoints were fetched successfully. The audit examined only numeric coordinate validity and whether pins differ from their city's configured center by more than 0.15 degrees in either axis; it found no invalid coordinates or such far-out pins. This does not prove the reported incident is absent: it does not inspect pending/unapproved entries, DB rows excluded by `/map`, admin audit logs, exact polygon containment, or city-specific reports.

No records or server state were changed by this audit.
