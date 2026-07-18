-- Alte Jobs aus der Zeit vor dem zuverlässigen Queue-/Session-Lifecycle dürfen
-- Kampagnen- und Account-Löschungen nicht dauerhaft blockieren. Ein echter
-- Recording-/Processing-Job aktualisiert seinen Zustand deutlich vor 24 Stunden.
UPDATE "Session"
SET
  "status" = 'FAILED',
  "stoppedAt" = COALESCE("stoppedAt", "updatedAt"),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('RECORDING', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING')
  AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '24 hours';
