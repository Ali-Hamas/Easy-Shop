# Health API

## `GET /api/v1/health`

Purpose:
- Confirms API process is alive.

Auth:
- Public.

Request:
- No body.
- Optional `x-request-id` header.

Response:

```json
{
  "status": "ok"
}
```

Side effects:
- Adds/echoes `x-request-id` response header.

Audit/timeline:
- None. Health checks do not write audit rows.

Cache:
- Do not cache.

Errors:
- `500` if process cannot handle request.


## GET /api/v1/health/ready
Public database readiness probe. Returns 200 with status ok/database connected, or 503 with status unavailable/database unavailable. Pings MongoDB; no writes, audit or cache. No connection details exposed.
