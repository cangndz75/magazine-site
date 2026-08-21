const url = process.env.DATABASE_URL ?? "";

if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
  console.error(
    "DATABASE_URL is required to apply migrations. Set a postgres:// or postgresql:// URL for the intended target. Do not use drizzle-kit push.",
  );
  process.exit(1);
}
