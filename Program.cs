using System.Diagnostics;
using System.IO;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using versaoCsharp.Data;
using versaoCsharp.Logging;
using versaoCsharp.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
builder.Logging.AddConsole();
builder.Services.Configure<FileLoggerOptions>(builder.Configuration.GetSection("FileLogging"));
builder.Services.AddSingleton<ILoggerProvider, FileLoggerProvider>();
builder.Services.Configure<DatabaseInitializationOptions>(builder.Configuration.GetSection("DatabaseInitialization"));
builder.Services.Configure<AdminBootstrapOptions>(builder.Configuration.GetSection("AdminBootstrap"));

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
});

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"]
    ?? "/root/.aspnet/DataProtection-Keys";
Directory.CreateDirectory(dataProtectionKeysPath);

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("app-controle-interno");

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        connectionString,
        ServerVersion.AutoDetect(connectionString),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure())
    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ProcessoService>();
builder.Services.AddScoped<ChecklistService>();
builder.Services.AddScoped<ChecklistPdfService>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/login";
        options.LogoutPath = "/logout";
        options.AccessDeniedPath = "/login";
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return context.Response.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Sua sessao expirou. Faca login novamente."
                    });
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return context.Response.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Acesso negado."
                    });
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            }
        };
    });

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        // Versioned assets can remain cached because a content change generates a new URL.
        if (context.Context.Request.Query.ContainsKey("v"))
        {
            context.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
        }
    }
});

app.UseRouting();
app.UseRateLimiter();

var requestLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Http");
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();
    var correlationId = context.Request.Headers.TryGetValue("X-Correlation-Id", out var headerId)
        ? headerId.ToString()
        : string.Empty;
    if (string.IsNullOrWhiteSpace(correlationId))
    {
        correlationId = Guid.NewGuid().ToString("N");
    }

    context.Response.Headers["X-Correlation-Id"] = correlationId;

    var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
    var scopeState = new Dictionary<string, object?>
    {
        ["CorrelationId"] = correlationId,
        ["TraceId"] = traceId,
        ["RequestId"] = context.TraceIdentifier,
        ["ClientIp"] = context.Connection.RemoteIpAddress?.ToString()
    };

    using (requestLogger.BeginScope(scopeState))
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            requestLogger.LogError(ex, "Unhandled exception");
            throw;
        }
        finally
        {
            sw.Stop();
            var userId = context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous";
            requestLogger.LogInformation(
                "HTTP {Method} {Path}{Query} => {StatusCode} in {ElapsedMs}ms (UserId={UserId})",
                context.Request.Method,
                context.Request.Path,
                context.Request.QueryString,
                context.Response.StatusCode,
                sw.ElapsedMilliseconds,
                userId);
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    if (HttpMethods.IsGet(context.Request.Method))
    {
        var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
        var tokens = antiforgery.GetAndStoreTokens(context);
        if (!string.IsNullOrEmpty(tokens.RequestToken))
        {
            context.Response.Cookies.Append(
                "XSRF-TOKEN",
                tokens.RequestToken,
                new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Strict,
                    Secure = context.Request.IsHttps
                });
        }
    }

    await next();
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Auth}/{action=Login}/{id?}");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    var initOptions = scope.ServiceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseInitializationOptions>>()
        .Value;
    var adminBootstrapOptions = scope.ServiceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<AdminBootstrapOptions>>()
        .Value;

    if (initOptions.ApplyMigrations)
    {
        db.Database.Migrate();
    }
    else if (initOptions.EnsureCreatedIfNoTables)
    {
        db.Database.EnsureCreated();
    }

    if (initOptions.RunCompatibilityPatches)
    {
        GarantirCompatibilidadeSchema(db, startupLogger, adminBootstrapOptions);
    }

    var checklistService = scope.ServiceProvider.GetRequiredService<ChecklistService>();
    var categoriasNormalizadas = await checklistService.NormalizarCategoriasNaoConformidadeAsync();
    var checklistsConcluidos = await checklistService.NormalizarChecklistsCompletosAsync();

    if (categoriasNormalizadas > 0 || checklistsConcluidos > 0)
    {
        startupLogger.LogInformation(
            "Reconciliação de checklists concluída: {CategoriasNormalizadas} categorias normalizadas e {ChecklistsConcluidos} checklists concluídos.",
            categoriasNormalizadas,
            checklistsConcluidos);
    }
}

app.Run();

static void GarantirCompatibilidadeSchema(
    AppDbContext db,
    ILogger logger,
    AdminBootstrapOptions adminBootstrapOptions)
{
    try
    {
        db.Database.OpenConnection();

        if (TabelaExiste(db, "usuario"))
        {
            if (!ColunaExiste(db, "usuario", "perfil"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `usuario` ADD COLUMN `perfil` VARCHAR(20) NOT NULL DEFAULT 'USER_CI' AFTER `senha`;");
                logger.LogInformation("Schema compat: coluna usuario.perfil criada.");
            }

            if (!ColunaExiste(db, "usuario", "ativo"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `usuario` ADD COLUMN `ativo` TINYINT(1) NOT NULL DEFAULT 1 AFTER `perfil`;");
                logger.LogInformation("Schema compat: coluna usuario.ativo criada.");
            }

            if (!ColunaExiste(db, "usuario", "empresa"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `usuario` ADD COLUMN `empresa` VARCHAR(30) NOT NULL DEFAULT 'AGEVAP' AFTER `perfil`;");
                logger.LogInformation("Schema compat: coluna usuario.empresa criada.");
            }

            db.Database.ExecuteSqlRaw(@"
UPDATE `usuario`
SET `perfil` = CASE
    WHEN `perfil` IS NULL OR `perfil` = '' OR `perfil` = 'admin' THEN 'USER_CI'
    ELSE `perfil`
END
WHERE `email` IS NOT NULL;");

            GarantirIndiceUnico(db, logger, "usuario", "ix_usuario_email", "email");
            GarantirIndiceUnico(db, logger, "usuario", "ix_usuario_login", "login");

            if (adminBootstrapOptions.EnableConfiguredAdminPromotion &&
                !string.IsNullOrWhiteSpace(adminBootstrapOptions.ConfiguredAdminEmail))
            {
                var emailNormalizado = adminBootstrapOptions.ConfiguredAdminEmail
                    .Trim()
                    .ToLowerInvariant()
                    .Replace("'", "''");

                db.Database.ExecuteSqlInterpolated($@"
UPDATE `usuario`
SET `perfil` = 'USER_ADM',
    `ativo` = 1
WHERE LOWER(TRIM(`email`)) = '{emailNormalizado}';");
                logger.LogInformation("Bootstrap configurado de administrador aplicado para o e-mail informado.");
            }

            db.Database.ExecuteSqlRaw(@"
UPDATE `usuario`
SET `perfil` = 'USER_CI'
WHERE `perfil` NOT IN ('USER_ADM', 'USER_CI', 'USER_PADRAO');");

            logger.LogInformation("Schema compat: perfis de usuario normalizados.");
        }

        if (!TabelaExiste(db, "processo"))
        {
            return;
        }

        GarantirIndiceUnico(db, logger, "processo", "ix_processo_numero", "numero");

        var tipoObjeto = ObterTexto(db, @"
SELECT DATA_TYPE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'processo'
  AND column_name = 'objeto'
LIMIT 1;");

        if (string.Equals(tipoObjeto, "varchar", StringComparison.OrdinalIgnoreCase))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE `processo` MODIFY COLUMN `objeto` TEXT NULL;");
            logger.LogInformation("Schema compat: coluna processo.objeto convertida para TEXT.");
        }

        if (!ColunaExiste(db, "processo", "area"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE `processo` ADD COLUMN `area` VARCHAR(100) NULL;");
            logger.LogInformation("Schema compat: coluna processo.area criada.");
        }

        if (!ColunaExiste(db, "processo", "gestor"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE `processo` ADD COLUMN `gestor` VARCHAR(100) NULL;");
            logger.LogInformation("Schema compat: coluna processo.gestor criada.");
        }

        var processosParaNormalizar = db.Processos
            .AsTracking()
            .Where(p => !string.IsNullOrWhiteSpace(p.Area))
            .ToList();

        var processosNormalizados = 0;
        var processosCorrigidosEncoding = 0;
        foreach (var processo in processosParaNormalizar)
        {
            var areaOriginal = processo.Area;
            var areaSaneada = AreaOrganogramaCatalog.NormalizarAreaOuOriginal(areaOriginal);
            if (!string.IsNullOrWhiteSpace(areaSaneada) &&
                !string.Equals(areaOriginal, areaSaneada, StringComparison.Ordinal))
            {
                processo.Area = areaSaneada;
                if (!string.Equals(areaOriginal?.Trim(), areaSaneada, StringComparison.Ordinal))
                {
                    processosCorrigidosEncoding++;
                }

                if (AreaOrganogramaCatalog.EhAreaOficial(areaSaneada))
                {
                    processosNormalizados++;
                }
            }
        }

        if (processosCorrigidosEncoding > 0 || processosNormalizados > 0)
        {
            db.SaveChanges();
            logger.LogInformation(
                "Schema compat: {TotalCorrigidos} processo(s) com área saneada e {TotalNormalizados} normalizado(s) para o catálogo oficial.",
                processosCorrigidosEncoding,
                processosNormalizados);
        }

        if (TabelaExiste(db, "item") && !ColunaExiste(db, "item", "categoria"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE `item` ADD COLUMN `categoria` VARCHAR(80) NULL AFTER `analise`;");
            logger.LogInformation("Schema compat: coluna item.categoria criada.");
        }

        if (TabelaExiste(db, "checklist"))
        {
            if (!ColunaExiste(db, "checklist", "criado_por_usuario_id"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `checklist` ADD COLUMN `criado_por_usuario_id` INT NULL AFTER `competencia`;");
                logger.LogInformation("Schema compat: coluna checklist.criado_por_usuario_id criada.");
            }

            if (!ColunaExiste(db, "checklist", "criado_por_nome"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `checklist` ADD COLUMN `criado_por_nome` VARCHAR(120) NULL AFTER `criado_por_usuario_id`;");
                logger.LogInformation("Schema compat: coluna checklist.criado_por_nome criada.");
            }

            if (!ColunaExiste(db, "checklist", "ajustes_confirmados"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `checklist` ADD COLUMN `ajustes_confirmados` TINYINT(1) NOT NULL DEFAULT 0 AFTER `competencia`;");
                logger.LogInformation("Schema compat: coluna checklist.ajustes_confirmados criada.");
            }

            if (!ColunaExiste(db, "checklist", "ajustes_confirmados_em"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `checklist` ADD COLUMN `ajustes_confirmados_em` DATETIME NULL AFTER `ajustes_confirmados`;");
                logger.LogInformation("Schema compat: coluna checklist.ajustes_confirmados_em criada.");
            }

            if (!ColunaExiste(db, "checklist", "ajustes_confirmados_por"))
            {
                db.Database.ExecuteSqlRaw("ALTER TABLE `checklist` ADD COLUMN `ajustes_confirmados_por` VARCHAR(120) NULL AFTER `ajustes_confirmados_em`;");
                logger.LogInformation("Schema compat: coluna checklist.ajustes_confirmados_por criada.");
            }

            var checklists = db.Checklists
                .AsTracking()
                .Include(c => c.Itens)
                .ToList();

            var saneados = 0;
            foreach (var checklist in checklists)
            {
                var itens = checklist.Itens.ToList();
                var possuiNaoConformidade = itens.Any(i => string.Equals(i.Analise, "nao_conforme", StringComparison.OrdinalIgnoreCase));

                if (string.IsNullOrWhiteSpace(checklist.CriadoPorNome))
                {
                    checklist.CriadoPorNome = "Controle Interno - SEDE";
                    saneados++;
                }

                if (!possuiNaoConformidade && checklist.AjustesConfirmados)
                {
                    checklist.AjustesConfirmados = false;
                    checklist.AjustesConfirmadosEm = null;
                    checklist.AjustesConfirmadosPor = null;
                    saneados++;
                }

                if (checklist.AjustesConfirmados &&
                    string.Equals((checklist.AjustesConfirmadosPor ?? string.Empty).Trim(), "Migração inicial do sistema", StringComparison.OrdinalIgnoreCase))
                {
                    checklist.AjustesConfirmadosPor = "Controle Interno - SEDE";
                    saneados++;
                }
            }

            if (saneados > 0)
            {
                db.SaveChanges();
                logger.LogInformation("Saneamento seguro aplicado em {TotalAjustes} ajuste(s) de status/confirmacao.", saneados);
            }
        }

        if (TabelaExiste(db, "crono_analise"))
        {
            var cronos = db.CronoAnalises
                .AsTracking()
                .Where(c => c.DataInicio.HasValue && c.DataFim.HasValue && (!c.Duracao.HasValue || c.Duracao.Value < 0))
                .ToList();

            if (cronos.Count > 0)
            {
                foreach (var crono in cronos)
                {
                    crono.Duracao = CalcularDuracaoCrono(crono.DataInicio!.Value, crono.DataFim!.Value);
                }

                db.SaveChanges();
                logger.LogInformation("Saneamento de cronoanalise aplicado em {TotalCronos} registro(s) com duracao recalculada.", cronos.Count);
            }
        }

        if (!TabelaExiste(db, "organograma_funcionario"))
        {
            db.Database.ExecuteSqlRaw(@"
CREATE TABLE `organograma_funcionario` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `unidade_id` VARCHAR(120) NOT NULL,
    `unidade_nome` VARCHAR(180) NOT NULL,
    `nome` VARCHAR(180) NOT NULL,
    `cargo` VARCHAR(180) NOT NULL,
    `telefone` VARCHAR(80) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `local` VARCHAR(180) NOT NULL,
    `observacoes` VARCHAR(1000) NOT NULL,
    `criado_em` DATETIME NOT NULL,
    `atualizado_em` DATETIME NULL,
    `criado_por_usuario_id` INT NULL,
    `criado_por_nome` VARCHAR(120) NULL,
    PRIMARY KEY (`id`),
    INDEX `ix_org_funcionario_unidade_id` (`unidade_id`),
    INDEX `ix_org_funcionario_unidade_nome` (`unidade_nome`)
);");
            logger.LogInformation("Schema compat: tabela organograma_funcionario criada.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Falha ao validar/ajustar compatibilidade de schema.");
    }
    finally
    {
        db.Database.CloseConnection();
    }
}

static bool TabelaExiste(AppDbContext db, string tabela)
{
    var total = ObterLong(db, $@"
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = '{tabela}';");
    return total > 0;
}

static bool ColunaExiste(AppDbContext db, string tabela, string coluna)
{
    var total = ObterLong(db, $@"
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '{tabela}'
  AND column_name = '{coluna}';");
    return total > 0;
}

static bool IndiceExiste(AppDbContext db, string tabela, string indice)
{
    var total = ObterLong(db, $@"
SELECT COUNT(*)
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = '{tabela}'
  AND index_name = '{indice}';");
    return total > 0;
}

static bool IndiceUnicoExiste(AppDbContext db, string tabela, string indice)
{
    var total = ObterLong(db, $@"
SELECT COUNT(*)
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = '{tabela}'
  AND index_name = '{indice}'
  AND non_unique = 0;");
    return total > 0;
}

static void GarantirIndiceUnico(AppDbContext db, ILogger logger, string tabela, string indice, string coluna)
{
    var duplicados = ObterLong(db, $@"
SELECT COUNT(*)
FROM (
    SELECT `{coluna}`
    FROM `{tabela}`
    GROUP BY `{coluna}`
    HAVING COUNT(*) > 1
) AS valores_duplicados;");

    if (duplicados > 0)
    {
        logger.LogWarning(
            "Índice único {Indice} não foi aplicado: existem {Duplicados} valor(es) duplicado(s) em {Tabela}.{Coluna}.",
            indice,
            duplicados,
            tabela,
            coluna);
        return;
    }

    if (IndiceUnicoExiste(db, tabela, indice))
    {
        return;
    }

    if (IndiceExiste(db, tabela, indice))
    {
        ExecutarComandoSchema(db, $"ALTER TABLE `{tabela}` DROP INDEX `{indice}`;");
    }

    ExecutarComandoSchema(db, $"ALTER TABLE `{tabela}` ADD UNIQUE INDEX `{indice}` (`{coluna}`);");
    logger.LogInformation("Schema compat: índice único {Indice} aplicado.", indice);
}

static void ExecutarComandoSchema(AppDbContext db, string sql)
{
    using var cmd = db.Database.GetDbConnection().CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

static long ObterLong(AppDbContext db, string sql)
{
    using var cmd = db.Database.GetDbConnection().CreateCommand();
    cmd.CommandText = sql;
    var result = cmd.ExecuteScalar();
    return result is null || result == DBNull.Value ? 0L : Convert.ToInt64(result);
}

static string? ObterTexto(AppDbContext db, string sql)
{
    using var cmd = db.Database.GetDbConnection().CreateCommand();
    cmd.CommandText = sql;
    var result = cmd.ExecuteScalar();
    return result is null || result == DBNull.Value ? null : result.ToString();
}

static int CalcularDuracaoCrono(DateTime dataInicio, DateTime dataFim)
{
    var diferenca = (int)(dataFim.Date - dataInicio.Date).TotalDays;
    return Math.Max(0, diferenca);
}
