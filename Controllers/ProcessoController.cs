using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using versaoCsharp.Data;
using versaoCsharp.Models;
using versaoCsharp.Services;

namespace versaoCsharp.Controllers
{
    [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
    public class ProcessoController : Controller
    {
        private readonly ProcessoService _processoService;
        private readonly AppDbContext _db;
        private readonly ILogger<ProcessoController> _logger;

        public ProcessoController(ProcessoService processoService, AppDbContext db, ILogger<ProcessoController> logger)
        {
            _processoService = processoService;
            _db = db;
            _logger = logger;
        }

        [HttpGet("/")]
        public IActionResult Index()
        {
            return View("~/Views/Dashboard/DASHBOARD-CONF.cshtml");
        }

        [HttpGet("/api/processos/areas")]
        public IActionResult ListarAreasOficiais()
        {
            return Json(new
            {
                success = true,
                areas = AreaOrganogramaCatalog.ListarAreas()
            });
        }

        [HttpPost("/novo-processo")]
        public async Task<IActionResult> NovoProcesso([FromBody] Dictionary<string, string?> dados)
        {
            try
            {
                var processo = await _processoService.CriarProcessoAsync(dados);
                return Json(new { success = true, message = "Processo criado com sucesso", processo_id = processo.Id });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao criar processo");
                if (IsDuplicateNumeroProcesso(e))
                {
                    Response.StatusCode = 409;
                    return Json(new { success = false, message = "Não foi possível cadastrar o processo: número já cadastrado." });
                }
                if (e is InvalidOperationException)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = e.Message });
                }
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao criar processo" });
            }
        }

        [HttpGet("/api/processos")]
        public async Task<IActionResult> ListarProcessos()
        {
            Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            Response.Headers["Pragma"] = "no-cache";
            Response.Headers["Expires"] = "0";

            try
            {
                var processos = await _db.Processos
                    .AsNoTracking()
                    .OrderByDescending(p => p.DataAbertura)
                    .ThenByDescending(p => p.Id)
                    .ToListAsync();
                return Json(processos.Select(p => new
                {
                    id = p.Id,
                    numero_processo = p.Numero,
                    objeto = p.Objeto,
                    modalidade = p.Modalidade,
                    data_abertura = p.DataAbertura,
                    competencia = p.Competencia,
                    area = AreaOrganogramaCatalog.NormalizarAreaOuOriginal(p.Area),
                    gestor = p.Gestor,
                    status = "Em andamento"
                }));
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao listar processos");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/processos/{id:int}")]
        public async Task<IActionResult> ObterProcesso(int id)
        {
            try
            {
                var processo = await _db.Processos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
                if (processo == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { error = "Processo não encontrado" });
                }

                return Json(new
                {
                    id = processo.Id,
                    numero_processo = processo.Numero,
                    objeto = processo.Objeto,
                    modalidade = processo.Modalidade,
                    status = "Em andamento",
                    area = AreaOrganogramaCatalog.NormalizarAreaOuOriginal(processo.Area),
                    gestor = processo.Gestor
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter processo {ProcessoId}", id);
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpPost("/api/salvar-processo")]
        public async Task<IActionResult> SalvarProcesso([FromBody] CriarProcessoRequest dados)
        {
            if (!ModelState.IsValid)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Os dados do processo são inválidos." });
            }

            var payload = new Dictionary<string, string?>
            {
                ["numero"] = dados.Numero.Trim(),
                ["objeto"] = dados.Objeto.Trim(),
                ["data_abertura"] = dados.DataAbertura.Trim(),
                ["modalidade"] = dados.Modalidade.Trim(),
                ["competencia"] = dados.Competencia.Trim(),
                ["area"] = dados.Area.Trim(),
                ["gestor"] = dados.Gestor?.Trim()
            };

            try
            {
                var processo = await _processoService.CriarProcessoAsync(payload);
                Response.StatusCode = 201;
                return Json(new { success = true, id = processo.Id });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao salvar processo");
                if (IsDuplicateNumeroProcesso(e))
                {
                    Response.StatusCode = 409;
                    return Json(new { success = false, message = "Não foi possível cadastrar o processo: número já cadastrado." });
                }
                if (e is InvalidOperationException)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = e.Message });
                }
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao salvar processo" });
            }
        }

        [HttpGet("/api/detalhes-processo/{id:int}")]
        public async Task<IActionResult> DetalhesProcesso(int id)
        {
            try
            {
                var processo = await _processoService.BuscarPorIdAsync(id);
                return Json(new
                {
                    success = true,
                    processo = new
                    {
                        id = processo.Id,
                        numero = processo.Numero,
                        objeto = processo.Objeto,
                        data_abertura = processo.DataAbertura,
                        modalidade = processo.Modalidade,
                        competencia = processo.Competencia,
                        area = AreaOrganogramaCatalog.NormalizarAreaOuOriginal(processo.Area),
                        gestor = processo.Gestor,
                        checklists = processo.Checklists.Select(c => new
                        {
                            id = c.Id,
                            modalidade = c.Modalidade,
                            tipo = c.Tipo,
                            status = c.Status,
                    data_criacao = c.DataCriacao.HasValue ? c.DataCriacao.Value.ToString("yyyy-MM-dd") : null,
                            competencia = c.Competencia
                        })
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao buscar detalhes do processo {ProcessoId}", id);
                Response.StatusCode = 404;
                return Json(new { success = false, message = "Erro ao buscar detalhes do processo" });
            }
        }

        [HttpPut("/api/editar-processo/{id:int}")]
        public async Task<IActionResult> EditarProcesso(int id, [FromBody] AtualizarProcessoRequest dados)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Os dados do processo são inválidos." });
                }

                var dadosAtualizacao = new Dictionary<string, string?>
                {
                    ["numero"] = dados.Numero,
                    ["objeto"] = dados.Objeto,
                    ["data_abertura"] = dados.DataAbertura,
                    ["modalidade"] = dados.Modalidade,
                    ["competencia"] = dados.Competencia,
                    ["area"] = dados.Area,
                    ["gestor"] = dados.Gestor
                };

                var processo = await _processoService.AtualizarProcessoAsync(id, dadosAtualizacao);
                return Json(new
                {
                    success = true,
                    message = "Processo atualizado com sucesso",
                    processo = new
                    {
                        id = processo.Id,
                        numero = processo.Numero,
                        objeto = processo.Objeto,
                        data_abertura = processo.DataAbertura,
                        modalidade = processo.Modalidade,
                        competencia = processo.Competencia,
                        area = AreaOrganogramaCatalog.NormalizarAreaOuOriginal(processo.Area),
                        gestor = processo.Gestor
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao atualizar processo {ProcessoId}", id);
                if (IsDuplicateNumeroProcesso(e))
                {
                    Response.StatusCode = 409;
                    return Json(new { success = false, message = "Não foi possível atualizar o processo: número já cadastrado." });
                }
                if (e is InvalidOperationException)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = e.Message });
                }
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao atualizar processo" });
            }
        }

        [HttpDelete("/api/deletar-processo/{id:int}")]
        public async Task<IActionResult> DeletarProcesso(int id)
        {
            try
            {
                await _processoService.DeletarProcessoAsync(id);
                return Json(new { success = true, message = "Processo deletado com sucesso" });
            }
            catch (InvalidOperationException e)
            {
                _logger.LogWarning(e, "Não foi possível deletar processo {ProcessoId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = e.Message });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao deletar processo {ProcessoId}", id);
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Erro ao deletar processo" });
            }
        }

        [HttpGet("/api/listar-processos")]
        public async Task<IActionResult> ListarProcessosSimples()
        {
            try
            {
                var processos = await _db.Processos.AsNoTracking().ToListAsync();
                return Json(processos.Select(p => new
                {
                    id = p.Id,
                    numeroProcesso = p.Numero,
                    objeto = p.Objeto,
                    modalidade = p.Modalidade,
                    competencia = p.Competencia
                }));
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao listar processos (simples)");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/buscar-processo")]
        public async Task<IActionResult> BuscarProcessoPorNumero([FromQuery] string numero)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(numero))
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, error = "Número do processo não fornecido" });
                }

                var processo = await _db.Processos.FirstOrDefaultAsync(p => p.Numero == numero);
                if (processo == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { success = false, error = "Processo não encontrado" });
                }

                return Json(new
                {
                    success = true,
                    id = processo.Id,
                    numero = processo.Numero,
                    objeto = processo.Objeto,
                    modalidade = processo.Modalidade,
                    competencia = processo.Competencia
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao buscar processo por numero");
                Response.StatusCode = 500;
                return Json(new { success = false, error = "Erro interno" });
            }
        }

        [HttpGet("/api/buscar-informacoes-processo")]
        public async Task<IActionResult> BuscarInformacoesProcesso([FromQuery] string numero)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(numero))
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, error = "Número do processo não fornecido" });
                }

                var processo = await _db.Processos.FirstOrDefaultAsync(p => p.Numero == numero);
                if (processo == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { success = false, error = "Processo não encontrado" });
                }

                return Json(new
                {
                    success = true,
                    modalidade = processo.Modalidade,
                    competencias = (processo.Competencia ?? string.Empty)
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(c => c.Trim())
                        .ToArray()
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao buscar informacoes do processo");
                Response.StatusCode = 500;
                return Json(new { success = false, error = "Erro interno" });
            }
        }

        private static bool IsDuplicateNumeroProcesso(Exception exception)
        {
            if (exception is InvalidOperationException invalidOp &&
                invalidOp.Message.Contains("já cadastrado", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (exception is DbUpdateException dbUpdate && dbUpdate.InnerException != null)
            {
                var msg = dbUpdate.InnerException.Message ?? string.Empty;
                if (msg.Contains("Duplicate entry", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
