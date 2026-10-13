-- Role aplikasi & audit log append-only (ARCHITECTURE §9.10, spec 08 ACC-212).
-- `platform_app` = role grup NOLOGIN untuk koneksi aplikasi (api/worker/realtime); login role production menjadi
-- anggotanya. Migration tetap dijalankan role pemilik schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO platform_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO platform_app;
--> statement-breakpoint
-- Tabel yang dibuat migration berikutnya otomatis dapat hak yang sama; tabel append-only baru wajib REVOKE sendiri.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO platform_app;
--> statement-breakpoint
-- Lapis 1: aplikasi hanya boleh SELECT & INSERT audit log.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM platform_app;
--> statement-breakpoint
-- Lapis 2: trigger menolak UPDATE/DELETE/TRUNCATE dari role mana pun (termasuk superuser yang tidak sengaja).
-- Purge retensi 2 tahun dilakukan job pemeliharaan yang secara eksplisit menonaktifkan trigger dalam transaksinya.
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs bersifat append-only: % ditolak', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
