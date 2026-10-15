# Real Atlas verification

Run from backend with the existing private server-side environment:

```powershell
npm run build
node test/atlas-verification.mjs
$env:VERIFY_HTTP='1'
npm run test:atlas
```

The first script prints only sanitized environment checks, versions, connectivity outcomes and role names. It uses the configured database and a unique temporary collection to test CRUD, indexes, commit and rollback, then removes that collection. It never displays URI, password, username or cluster hostname.

The API suite runs the real Fastify server against Atlas in an isolated, uniquely named database, sends HTTP requests when VERIFY_HTTP=1, verifies all current endpoints and concurrent transactional behavior, and drops only that test database. The test identity must have permissions for that database; production identities should not be given broad admin permissions just to run this suite.

The successful run and remaining access-scope work are recorded in ../VERIFICATION.md. No frontend or backend architecture changes were made during verification.
