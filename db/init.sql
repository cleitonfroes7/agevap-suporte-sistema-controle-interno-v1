CREATE DATABASE IF NOT EXISTS app5p;
USE app5p;

CREATE TABLE IF NOT EXISTS usuario (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  login VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  senha VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS processo (
  id INT NOT NULL AUTO_INCREMENT,
  numero VARCHAR(20) NOT NULL,
  objeto VARCHAR(1600) NOT NULL,
  data_abertura VARCHAR(20) NOT NULL,
  modalidade VARCHAR(20) NOT NULL,
  competencia VARCHAR(200) NOT NULL,
  gestor VARCHAR(100) NULL,
  area VARCHAR(100) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checklist (
  id INT NOT NULL AUTO_INCREMENT,
  processo_id INT NOT NULL,
  modalidade VARCHAR(20) NOT NULL,
  tipo VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  data_criacao DATETIME NULL,
  competencia VARCHAR(200) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_checklist_processo_id (processo_id),
  CONSTRAINT fk_checklist_processo
    FOREIGN KEY (processo_id) REFERENCES processo(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS elemento (
  id INT NOT NULL AUTO_INCREMENT,
  checklist_id INT NOT NULL,
  tipo VARCHAR(255) NOT NULL,
  elemento VARCHAR(200) NOT NULL,
  data_elemento DATETIME NULL,
  nup VARCHAR(100) NULL,
  PRIMARY KEY (id),
  INDEX idx_elemento_checklist_id (checklist_id),
  CONSTRAINT fk_elemento_checklist
    FOREIGN KEY (checklist_id) REFERENCES checklist(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item (
  id INT NOT NULL AUTO_INCREMENT,
  elemento_id INT NOT NULL,
  checklist_id INT NOT NULL,
  pergunta VARCHAR(200) NOT NULL,
  analise VARCHAR(20) NULL,
  categoria VARCHAR(80) NULL,
  justificativa VARCHAR(500) NULL,
  PRIMARY KEY (id),
  INDEX idx_item_elemento_id (elemento_id),
  INDEX idx_item_checklist_id (checklist_id),
  CONSTRAINT fk_item_elemento
    FOREIGN KEY (elemento_id) REFERENCES elemento(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_item_checklist
    FOREIGN KEY (checklist_id) REFERENCES checklist(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS crono_analise (
  id INT NOT NULL AUTO_INCREMENT,
  checklist_id INT NOT NULL,
  fase VARCHAR(100) NOT NULL,
  data_inicio DATETIME NULL,
  data_fim DATETIME NULL,
  duracao INT NULL,
  observacoes VARCHAR(500) NULL,
  PRIMARY KEY (id),
  INDEX idx_crono_checklist_id (checklist_id),
  CONSTRAINT fk_crono_checklist
    FOREIGN KEY (checklist_id) REFERENCES checklist(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bootstrap legado de usuario administrativo mantido apenas por compatibilidade
-- com ambientes ja existentes. Em ambientes novos, prefira promover o admin
-- via configuracao da aplicacao.
INSERT INTO usuario (name, login, email, senha)
SELECT 'Cleiton Froes', 'cleiton.froes', 'cleiton.froes@agevap.org.br', 'pbkdf2:sha256:260000$2M6C0fZ8w2R0n8I0j8QThQ==$a54dd4dd9ba93fb9d615f1b55410ffdaee82885f9509b0ca4f5ab3887b8a8220'
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario
  WHERE email = 'cleiton.froes@agevap.org.br'
);
