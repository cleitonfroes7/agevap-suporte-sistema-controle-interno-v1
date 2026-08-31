# Deploy Seguro com Dockploy

Este projeto esta pronto para ser publicado via `docker-compose` no Dockploy sem versionar segredos reais no Git.

## Principios adotados

- Nenhuma senha real deve ficar em `appsettings*.json` ou `docker-compose.yml`.
- O ambiente de producao deve rodar com `ASPNETCORE_ENVIRONMENT=Production`.
- As chaves de protecao de dados devem persistir em volume para manter sessoes validas apos reinicio.
- Os logs da aplicacao devem persistir em volume proprio.

## Variaveis obrigatorias no Dockploy

Cadastre estas variaveis de ambiente antes do primeiro deploy:

```env
MYSQL_ROOT_PASSWORD=defina_uma_senha_forte
MYSQL_DATABASE=app5p
ASPNETCORE_ENVIRONMENT=Production
APP_HTTP_PORT=5015
DB_HOST=db
DB_PORT=3306
DB_NAME=app5p
DB_USER=app_ci_user
DB_PASSWORD=defina_a_senha_do_usuario_dedicado
DATA_PROTECTION_KEYS_PATH=/root/.aspnet/DataProtection-Keys
```

Se voce ja tem essas variaveis configuradas no Dockploy, mantenha as mesmas.  
O objetivo aqui e preparar a producao com mais seguranca sem quebrar seu fluxo atual.

Para testes locais com `docker compose up`, se nenhuma variavel estiver definida, o compose usa fallback compativel com o projeto atual:

- `MYSQL_ROOT_PASSWORD=admin`
- `DB_USER=root`
- `DB_PASSWORD=admin`

## Variaveis do usuario dedicado da aplicacao

Estas variaveis sao obrigatorias ao usar `docker-compose.production.yml`:

```env
MYSQL_APP_USER=app_ci_user
MYSQL_APP_PASSWORD=defina_uma_senha_forte_para_a_aplicacao
```

## Como o compose ficou protegido

- O MySQL usa `MYSQL_ROOT_PASSWORD` vindo do ambiente.
- Em bases novas, o script `db/003_create_app_user.sh` pode criar automaticamente um usuario dedicado da aplicacao se `MYSQL_APP_USER` e `MYSQL_APP_PASSWORD` forem informados.
- A aplicacao recebe a `ConnectionStrings__DefaultConnection` por variavel de ambiente.
- O `healthcheck` do MySQL nao possui senha fixa no arquivo.
- O volume `app_ci_v2_keys` preserva as chaves de autenticacao.
- O volume `app_ci_v2_logs` preserva os logs da aplicacao.

## Melhorias operacionais desta fase

- O EF Core foi configurado com `EnableRetryOnFailure` para lidar melhor com falhas transitórias de conexao.
- O contexto passou a usar `NoTracking` por padrao, reduzindo custo em leituras.
- A listagem de checklists foi otimizada para projetar apenas os campos necessarios.

## Observacoes importantes

- O compose de desenvolvimento ainda aceita `DB_USER=root` e `DB_PASSWORD=admin` por compatibilidade local.
- Em producao, use `DB_USER=MYSQL_APP_USER` e `DB_PASSWORD=MYSQL_APP_PASSWORD`.
- Em ambiente ja existente com volume do MySQL inicializado, os scripts de `docker-entrypoint-initdb.d` nao rodam novamente. Nesse caso, crie o usuario manualmente antes de trocar `DB_USER` e `DB_PASSWORD`.
- Os valores `CHANGE_ME` em `appsettings*.json` sao placeholders e nao devem ser usados em producao.

## Migracao segura para ambiente ja existente

Se o banco ja foi inicializado anteriormente, mantenha a aplicacao conectando com `root` ate executar a criacao do usuario dedicado.

1. Acesse o MySQL do container.
2. Execute:

```sql
CREATE USER IF NOT EXISTS 'app_ci_user'@'%' IDENTIFIED BY 'defina_uma_senha_forte_para_a_aplicacao';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON `app5p`.* TO 'app_ci_user'@'%';
FLUSH PRIVILEGES;
```

3. Atualize no Dockploy apenas quando decidir trocar a aplicacao para o usuario dedicado:

```env
DB_USER=app_ci_user
DB_PASSWORD=defina_uma_senha_forte_para_a_aplicacao
MYSQL_APP_USER=app_ci_user
MYSQL_APP_PASSWORD=defina_uma_senha_forte_para_a_aplicacao
```

4. Refaça o deploy.

Se quiser uma transicao ainda mais conservadora, primeiro crie o usuario e teste o acesso ao banco; so depois altere o `DB_USER` da aplicacao.

## Testes locais

Para testes locais, voce pode continuar de duas formas:

1. Rodar com Docker usando `DB_USER=root` e `DB_PASSWORD` igual ao `MYSQL_ROOT_PASSWORD`.
2. Rodar fora do Docker usando `appsettings.Development.json` ou secrets/variaveis locais.

Nada nesta fase exige que voce troque seu fluxo de teste atual.

## Bootstrap de administrador

O projeto agora suporta dois modos:

1. legado, para manter compatibilidade com o ambiente atual;
2. configurado, para promover um admin por e-mail sem depender de regra fixa no codigo.

Configuracao atual padrao:

```json
"AdminBootstrap": {
  "EnableLegacyAdminSeed": true,
  "EnableConfiguredAdminPromotion": false,
  "ConfiguredAdminEmail": ""
}
```

### Modo legado

- Mantem o comportamento atual.
- Preserva o acesso existente.
- Nao deve ser removido antes de validar o novo fluxo.

### Modo configurado

Quando voce quiser migrar com seguranca:

```json
"AdminBootstrap": {
  "EnableLegacyAdminSeed": false,
  "EnableConfiguredAdminPromotion": true,
  "ConfiguredAdminEmail": "seu-admin@dominio.com"
}
```

Em deploy por Dockploy, isso tambem pode ser feito por variaveis de ambiente:

```env
AdminBootstrap__EnableLegacyAdminSeed=false
AdminBootstrap__EnableConfiguredAdminPromotion=true
AdminBootstrap__ConfiguredAdminEmail=seu-admin@dominio.com
```

Recomendacao:

1. primeiro confirme que o usuario alvo ja existe no sistema;
2. depois habilite a promocao configurada;
3. so depois desligue o modo legado, se quiser.

## Recomendacao de proxima fase

Depois deste endurecimento inicial, a proxima etapa mais importante e:

1. criar um usuario proprio da aplicacao no MySQL em vez de usar `root`;
2. migrar a evolucao de schema para `EF Migrations`;
3. revisar o bootstrap do usuario administrador para remover dependencia de usuario fixo no banco.

## Compose de producao com usuario dedicado

Para uma instalacao nova, use o compose base junto com o override de producao:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

Defina `MYSQL_APP_USER` e `MYSQL_APP_PASSWORD` antes do primeiro start. O override obriga a aplicacao a usar esse usuario em vez de `root`. Em um volume MySQL ja existente, crie o usuario dedicado e conceda as permissoes antes de trocar o compose.

## Estado atual das migrations

O projeto agora possui:

- `Data/AppDbContextFactory.cs` para suportar operacoes de design-time do EF;
- `DatabaseInitialization` em `appsettings*.json` para controlar a inicializacao do banco;
- migration base em `Migrations/`.

Padrao atual:

- `ApplyMigrations=true` em `appsettings.json` como configuracao base do projeto.
- `EnsureCreatedIfNoTables=false` em `appsettings.json`, evitando criacao fora do historico do EF.
- `RunCompatibilityPatches=true`
- `docker-compose.production.yml` sobrescreve para `ApplyMigrations=false`, `EnsureCreatedIfNoTables=false` e `RunCompatibilityPatches=true`, deixando a publicacao mais conservadora para banco existente.

O ambiente de desenvolvimento em `appsettings.Development.json` ainda preserva o fluxo anterior ate a validacao do baseline local.

## Quando ativar migrations

Ative `DatabaseInitialization:ApplyMigrations=true` apenas quando:

1. o banco novo puder nascer direto por migrations; ou
2. um banco existente ja tiver sido validado e baselined para o EF.

Em ambiente atual, mantenha o modo padrao ate concluir a validacao do schema existente.

## Baseline para banco existente

Para um banco que ja existe e ja esta em uso, o caminho seguro e:

1. Fazer backup completo.
2. Validar que o schema atual esta compativel com a migration base.
3. Criar a tabela `__EFMigrationsHistory` caso ainda nao exista.
4. Inserir o registro da migration base `20260824120000_InitialSchema`.
5. So depois considerar `ApplyMigrations=true`.

Esse passo deve ser feito com bastante cuidado e, idealmente, primeiro em homologacao.
