-- Ajustes nao destrutivos para bancos existentes.
-- Execute somente depois de backup e validacao do ambiente.

ALTER TABLE processo
    MODIFY COLUMN area VARCHAR(100) NULL,
    MODIFY COLUMN gestor VARCHAR(100) NULL;

ALTER TABLE processo
    ADD INDEX ix_processo_area (area),
    ADD INDEX ix_processo_modalidade (modalidade),
    ADD INDEX ix_processo_numero (numero);

ALTER TABLE checklist
    ADD INDEX ix_checklist_data_criacao (data_criacao),
    ADD INDEX ix_checklist_modalidade (modalidade),
    ADD INDEX ix_checklist_status (status);

-- analise e maior que o limite de uma chave utf8mb4 completa; use prefixo.
ALTER TABLE item
    ADD INDEX ix_item_analise (analise(191)),
    ADD INDEX ix_item_categoria (categoria);

ALTER TABLE crono_analise
    ADD INDEX ix_crono_analise_fase (fase);
