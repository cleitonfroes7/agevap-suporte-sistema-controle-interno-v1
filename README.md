# APP-CI-ATUALIZADO (versaoCsharp)

Aplicacao web para controle interno de processos e checklists, com dashboards e relatorios.

## Stack

- .NET 8 (ASP.NET Core MVC)
- Entity Framework Core + Pomelo (MySQL)
- Autenticacao por cookie
- Antiforgery (CSRF)
- Logger em arquivo (Logs/)

## Funcionalidades

- Login e cadastro inicial de usuario
- Cadastro e listagem de processos
- Criacao e edicao de checklists
- Cronoanalise por fase
- Dashboards de conformidade e estatisticas
- Impressao de relatorios

## Requisitos

- .NET SDK 8
- MySQL

## Configuracao

1) Para ambiente local, ajuste a connection string em `appsettings.Development.json` ou use variaveis de ambiente.
2) Para producao com Docker/Dockploy, use variaveis de ambiente e siga `DEPLOY.md`.
3) Garanta que o schema do banco exista e esteja alinhado com os modelos (tabelas usuario, processo, checklist, elemento, item, crono_analise).

## Executar

No diretorio do projeto:

```bash
dotnet restore
dotnet run
```

O console informara a URL. Por padrao (launchSettings), usa:
- http://localhost:5014
- https://localhost:7281

## Docker / Dockploy

- O arquivo `docker-compose.yml` esta preparado para receber segredos por variaveis de ambiente.
- Para ambientes novos, ele tambem consegue criar automaticamente um usuario proprio da aplicacao no MySQL se as variaveis opcionais forem informadas.
- Antes de publicar no Dockploy, defina as variaveis obrigatorias descritas em `DEPLOY.md`.
- Use `.env.example` apenas como referencia; nao versione `.env` real com credenciais.
- O bootstrap de administrador agora pode ser controlado por configuracao, mantendo compatibilidade com o modo legado atual.

## Fluxo inicial

1) Acesse `/novo-usuario` para criar o primeiro usuario.
2) Faça login em `/login`.
3) Navegue nas telas:
   - `/TELA-LISTA-PROCESSO`
   - `/TELA-LISTA-CHECKLIST`
   - `/DASHBOARD-CONF`
   - `/DASHBOARD-CRONO`

## Estrutura de pastas

- `Controllers/` rotas MVC e APIs
- `Services/` regras de negocio
- `Data/` DbContext
- `Models/` entidades
- `Views/` telas
- `wwwroot/` assets estaticos
- `Logging/` logger de arquivo

## Logs

Os logs em arquivo ficam em `Logs/` (configuracao em `appsettings*.json`).


docker compose -f docker-compose.yml up -d --build
