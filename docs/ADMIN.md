# Administration

## Granting admin access

The admin console (`/admin`) is gated by the RBAC role `platform_admin` or `super_admin` (Spec §6, §37). Roles live in the `user_roles` table.

Until a dedicated admin-bootstrap CLI lands, grant a super-admin role manually after the user has registered:

```sql
-- Replace with the target user's email
INSERT INTO user_roles (id, user_id, role, scope_type, created_at)
SELECT gen_random_uuid(), u.id, 'super_admin', 'global', now()
FROM users u
WHERE u.email = 'you@example.org';
```

(Requires the `pgcrypto` extension for `gen_random_uuid()`, or substitute any UUID.)

The session picks up the new role on next request (roles are read per request). Sign out/in if needed.

## Admin surfaces

- `/admin` — overview counts.
- `/admin/ojs` — OJS sources, probe results, sync triggers, recent jobs. See [`OJS-INTEGRATION.md`](./OJS-INTEGRATION.md).
- `/admin/researchers`, `/admin/publications` — record lists.

More admin tooling (verification approval, moderation, integration health, RVM config, Google Scholar compliance checker) arrives in later phases per the [roadmap](./ROADMAP.md).
