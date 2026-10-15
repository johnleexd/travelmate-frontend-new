# Published browser fixtures

Captured location, itinerary, scheduling and licensed photo metadata are retained
for repeatable UI checks. These files are test inputs, not live account data.

Before publication, UUID record identifiers in `gimcheon-reopened-trip.json` and
`shared-destination-schedules.json` were replaced consistently with synthetic
identifiers, including matching map references. Signed `groundingProof` strings
in those files, `generated-daily-schedules.json` and `grounded-plans.json` were
replaced with an explicitly fake, 43-character fixture marker. Those markers do
not authorize backend saves or attest a real plan. Browser specs mock the relevant
API responses; authenticated backend verification must create and sign its own
disposable fixtures.

Public geographic provider IDs, venue descriptions, coordinates, amounts and
photo credits remain unchanged. Re-running capture scripts can produce private
identifiers or fresh signatures; sanitize captures again before committing them.
