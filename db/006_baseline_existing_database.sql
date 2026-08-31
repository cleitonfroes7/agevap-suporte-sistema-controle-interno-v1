-- Baseline para o banco existente.
-- Nao recria tabelas e nao altera registros de negocio.
-- Execute apenas depois de validar o backup e o schema.

INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
SELECT '20260824120000_InitialSchema', '8.0.10'
WHERE NOT EXISTS (
    SELECT 1 FROM __EFMigrationsHistory
    WHERE MigrationId = '20260824120000_InitialSchema'
);

INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
SELECT '20260828120000_AddEmpresaToUsuario', '8.0.10'
WHERE NOT EXISTS (
    SELECT 1 FROM __EFMigrationsHistory
    WHERE MigrationId = '20260828120000_AddEmpresaToUsuario'
);
