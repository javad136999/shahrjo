# Prisma

- `schema.prisma` — اسکیمای کامل چندشهری (Phase 1 ✅، جزئیات در `docs/database.md`)
- `migrations/` — migrationها را با `pnpm db:migrate` بسازید؛ اعمال نسخه commit‌شده: `pnpm db:deploy`
- `seed/index.ts` — seed idempotent (استان/شهر/نقش/دسته‌بندی) با `pnpm db:seed`

```bash
pnpm db:generate   # تولید Prisma Client
pnpm db:studio     # مرور دیتابیس
pnpm db:migrate    # migration جدید از تغییرات اسکیما
```
