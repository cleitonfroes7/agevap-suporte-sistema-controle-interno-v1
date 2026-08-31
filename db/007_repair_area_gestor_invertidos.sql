-- Repara registros importados com area e gestor invertidos.
-- Execute uma vez no banco de producao apos validar o SELECT inicial.
-- O criterio troca somente quando gestor contem uma area oficial e area nao.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS processo_area_gestor_backup_20260831 AS
SELECT id, area, gestor
FROM processo
WHERE 1 = 0;

INSERT INTO processo_area_gestor_backup_20260831 (id, area, gestor)
SELECT p.id, p.area, p.gestor
FROM processo p
WHERE p.gestor IN (
    'Diretoria de Gestão',
    'Diretoria Administrativo-Financeira',
    'Diretoria de Obras, Projetos e Estudos',
    'Diretoria de Planejamento e Ações Estratégicas',
    'Superintendência Regional AGEVAP',
    'Superintendência Regional AGEDOCE',
    'Superintendência Regional AGEGRANDE',
    'Superintendência Regional AGEGOIÁS',
    'Gerência Administrativa',
    'Gerência Financeira',
    'Gerência de Comunicação',
    'Gerência CEIVAP',
    'Gerência CBHs',
    'Gerência Guandu-BIG',
    'Gerência BG',
    'Gerência PS1/PS2',
    'Gerência de Atendimento aos Comitês',
    'Gerência de Fundos e Recursos Hídricos',
    'Gerência de Fundos Ambientais',
    'Gerência de Recursos Hídricos',
    'Gerência de Meio Ambiente',
    'Gerência de Obras',
    'Gerência de Projetos',
    'Gerência de Planejamento',
    'Gerência de Ações Estratégicas',
    'Administrativa',
    'Gerencia Administrativa',
    'BG',
    'Gerencia BG',
    'CEIVAP',
    'Gerencia CEIVAP',
    'CBHS',
    'CBH''S',
    'CBHS - UD01',
    'CBHS - UD02',
    'Gerencia CBHS',
    'Gerencia CBH''S',
    'CBH-BPSI',
    'CBH- MPS',
    'GUANDU-BIG',
    'Guandu-BIG',
    'GUANDU',
    'Gerencia Guandu',
    'CBH GUANDU',
    'CBH GUANDU - UD06',
    'CG INEA N 068/2022',
    'CG INEA Nº 068/2022',
    'AGEVAP',
    'AGEDOCE',
    'AGEGRANDE',
    'AGEGOIAS',
    'Planejamento e Ações Estratégicas'
)
AND (p.area IS NULL OR p.area NOT IN (
    'Diretoria de Gestão',
    'Diretoria Administrativo-Financeira',
    'Diretoria de Obras, Projetos e Estudos',
    'Diretoria de Planejamento e Ações Estratégicas',
    'Superintendência Regional AGEVAP',
    'Superintendência Regional AGEDOCE',
    'Superintendência Regional AGEGRANDE',
    'Superintendência Regional AGEGOIÁS',
    'Gerência Administrativa',
    'Gerência Financeira',
    'Gerência de Comunicação',
    'Gerência CEIVAP',
    'Gerência CBHs',
    'Gerência Guandu-BIG',
    'Gerência BG',
    'Gerência PS1/PS2',
    'Gerência de Atendimento aos Comitês',
    'Gerência de Fundos e Recursos Hídricos',
    'Gerência de Fundos Ambientais',
    'Gerência de Recursos Hídricos',
    'Gerência de Meio Ambiente',
    'Gerência de Obras',
    'Gerência de Projetos',
    'Gerência de Planejamento',
    'Gerência de Ações Estratégicas',
    'Administrativa',
    'Gerencia Administrativa',
    'BG',
    'Gerencia BG',
    'CEIVAP',
    'Gerencia CEIVAP',
    'CBHS',
    'CBH''S',
    'CBHS - UD01',
    'CBHS - UD02',
    'Gerencia CBHS',
    'Gerencia CBH''S',
    'CBH-BPSI',
    'CBH- MPS',
    'GUANDU-BIG',
    'Guandu-BIG',
    'GUANDU',
    'Gerencia Guandu',
    'CBH GUANDU',
    'CBH GUANDU - UD06',
    'CG INEA N 068/2022',
    'CG INEA Nº 068/2022',
    'AGEVAP',
    'AGEDOCE',
    'AGEGRANDE',
    'AGEGOIAS',
    'Planejamento e Ações Estratégicas'
));

UPDATE processo p
JOIN processo_area_gestor_backup_20260831 b ON b.id = p.id
SET p.area = b.gestor,
    p.gestor = b.area;

COMMIT;

SELECT COUNT(*) AS registros_corrigidos
FROM processo_area_gestor_backup_20260831;
