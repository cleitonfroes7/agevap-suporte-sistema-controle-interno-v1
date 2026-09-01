using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using versaoCsharp.Data;
using versaoCsharp.Models;
using versaoCsharp.Services;

namespace versaoCsharp.Controllers
{
    [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
    public class ChecklistController : Controller
    {
        private readonly ChecklistService _checklistService;
        private readonly ChecklistPdfService _checklistPdfService;
        private readonly AppDbContext _db;
        private readonly ILogger<ChecklistController> _logger;

        public ChecklistController(
            ChecklistService checklistService,
            ChecklistPdfService checklistPdfService,
            AppDbContext db,
            ILogger<ChecklistController> logger)
        {
            _checklistService = checklistService;
            _checklistPdfService = checklistPdfService;
            _db = db;
            _logger = logger;
        }

        [HttpGet("/novo-checklist")]
        public IActionResult NovoChecklist()
        {
            return View("~/Views/Dashboard/novo_checklist.cshtml");
        }

        [HttpPost("/novo-checklist")]
        public async Task<IActionResult> NovoChecklistPost([FromBody] Dictionary<string, object?> dados)
        {
            try
            {
                var processoId = ParseInt(dados.GetValueOrDefault("processo_id"));
                var usuarioId = ParseNullableInt(User.FindFirstValue(ClaimTypes.NameIdentifier));
                var usuarioNome = User.FindFirstValue(ClaimTypes.Name);
                var checklist = await _checklistService.CriarChecklistAsync(processoId, dados, usuarioId, usuarioNome);
                return Json(new { success = true, message = "Checklist criado com sucesso", checklist_id = checklist.Id });
            }
            catch (InvalidOperationException e)
            {
                _logger.LogWarning(e, "Validação ao criar checklist");
                Response.StatusCode = 400;
                return Json(new { success = false, message = e.Message });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao criar checklist");
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao criar checklist" });
            }
        }

        // Criação simples a partir da tela de lista (modal)
[HttpPost("/api/checklists")]
        public async Task<IActionResult> CriarChecklistSimples([FromBody] Dictionary<string, object?> dados)
        {
            Response.StatusCode = 400;
            return Json(new
            {
                success = false,
                message = "O cadastro rápido foi desativado. Use o fluxo completo de novo checklist para preencher itens e validações obrigatórias."
            });
        }

        [HttpGet("/api/checklists")]
        public async Task<IActionResult> ListarChecklists([FromQuery] int? page, [FromQuery] int? per_page, [FromQuery] string? busca)
        {
            try
            {
                const int defaultPageSize = 25;
                const int maxPageSize = 100;

                var pageNumber = page.GetValueOrDefault(1);
                if (pageNumber <= 0)
                    pageNumber = 1;

                var pageSize = per_page.GetValueOrDefault(defaultPageSize);
                if (pageSize <= 0)
                    pageSize = defaultPageSize;
                if (pageSize > maxPageSize)
                    pageSize = maxPageSize;

                IQueryable<Checklist> checklistsQuery = _db.Checklists;

                if (!string.IsNullOrWhiteSpace(busca))
                {
                    var termo = busca.Trim();
                    checklistsQuery = checklistsQuery.Where(c =>
                        (c.Processo != null && c.Processo.Numero.Contains(termo)) ||
                        c.Tipo.Contains(termo) ||
                        c.Modalidade.Contains(termo) ||
                        c.Competencia.Contains(termo));
                }

                var query = checklistsQuery
                    .AsNoTracking()
                    .Select(c => new
                    {
                        c.Id,
                        NumeroProcesso = c.Processo != null ? c.Processo.Numero : null,
                        c.Tipo,
                        c.Modalidade,
                        c.Status,
                        c.DataCriacao,
                        c.CriadoPorNome,
                        c.AjustesConfirmados,
                        c.AjustesConfirmadosEm,
                        c.AjustesConfirmadosPor,
                        c.Competencia,
                        TotalNaoConformidades = c.Itens.Count(i => i.Analise == "nao_conforme"),
                        TemNaoConformidade = c.Itens.Any(i => i.Analise == "nao_conforme")
                    })
                    .OrderByDescending(c => c.Id);

                Func<dynamic, object> toDict = c => new
                {
                    total_nao_conformidades = (int)c.TotalNaoConformidades,
                    id = (int)c.Id,
                    numero_processo = c.NumeroProcesso ?? "N/A",
                    tipo = (string)c.Tipo,
                    modalidade = (string)c.Modalidade,
                    status = NormalizeStatus((string)c.Status),
                    resultado = (bool)c.AjustesConfirmados && (bool)c.TemNaoConformidade
                        ? "corrigido_pelo_gestor"
                        : (bool)c.TemNaoConformidade
                            ? "com_nao_conformidades"
                            : NormalizeStatus((string)c.Status) == "concluido"
                                ? "tudo_ok"
                                : "em_analise",
                    data_criacao = c.DataCriacao is DateTime dataCriacao ? dataCriacao.ToString("yyyy-MM-dd") : null,
                    criado_por_nome = c.CriadoPorNome,
                    ajustes_confirmados = (bool)c.AjustesConfirmados && (bool)c.TemNaoConformidade,
                    ajustes_confirmados_em = (bool)c.AjustesConfirmados && (bool)c.TemNaoConformidade && c.AjustesConfirmadosEm is DateTime ajustesEm ? ajustesEm.ToString("yyyy-MM-dd HH:mm") : null,
                    ajustes_confirmados_por = (bool)c.AjustesConfirmados && (bool)c.TemNaoConformidade ? c.AjustesConfirmadosPor : null,
                    tem_nao_conformidade = (bool)c.TemNaoConformidade,
                    competencias = ((string?)c.Competencia ?? string.Empty)
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Trim())
                        .ToArray()
                };

                if (page.HasValue || per_page.HasValue)
                {
                    var total = await query.CountAsync();
                    var items = await query
                        .Skip((pageNumber - 1) * pageSize)
                        .Take(pageSize)
                        .ToListAsync();

                    var payload = new
                    {
                        items = items.Select(toDict),
                        meta = new { page = pageNumber, per_page = pageSize, total }
                    };

                    Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                    Response.Headers["Pragma"] = "no-cache";
                    Response.Headers["Expires"] = "0";
                    return Json(payload);
                }
                else
                {
                    var items = await query.ToListAsync();
                    Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                    Response.Headers["Pragma"] = "no-cache";
                    Response.Headers["Expires"] = "0";
                    return Json(items.Select(toDict));
                }
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao listar checklists");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/checklists/{id:int}")]
        public async Task<IActionResult> ObterChecklist(int id)
        {
            try
            {
                var checklist = await _db.Checklists
                    .Include(c => c.Processo)
                    .FirstOrDefaultAsync(c => c.Id == id);
                if (checklist == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { success = false, message = "Checklist não encontrado" });
                }

                var elementos = await _db.Elementos.Where(e => e.ChecklistId == id).ToListAsync();
                var itens = await _db.Itens.Where(i => i.ChecklistId == id).ToListAsync();
                var crono = await _db.CronoAnalises.Where(c => c.ChecklistId == id).ToListAsync();

                await _db.Entry(checklist).Reference(c => c.Processo).LoadAsync();

                var elementosDto = elementos.Select(e => new
                {
                    id = e.Id,
                    checklist_id = e.ChecklistId,
                    tipo = e.Tipo,
                    elemento = e.ElementoNome,
                    data_elemento = e.DataElemento.HasValue ? e.DataElemento.Value.ToString("yyyy-MM-dd") : null,
                    nup = e.Nup
                }).ToList();

                var itensDto = itens.Select(i => new
                {
                    id = i.Id,
                    elemento_id = i.ElementoId,
                    checklist_id = i.ChecklistId,
                    pergunta = i.Pergunta,
                    analise = i.Analise,
                    categoria = i.Categoria,
                    justificativa = i.Justificativa
                }).ToList();

                var cronoDto = crono.Select(c => new
                {
                    id = c.Id,
                    checklist_id = c.ChecklistId,
                    fase = c.Fase,
                    data_inicio = c.DataInicio.HasValue ? c.DataInicio.Value.ToString("yyyy-MM-dd") : null,
                    data_fim = c.DataFim.HasValue ? c.DataFim.Value.ToString("yyyy-MM-dd") : null,
                    duracao = c.Duracao ?? 0,
                    observacoes = c.Observacoes
                }).ToList();

                var possuiNaoConformidade = itens.Any(i => i.Analise == "nao_conforme");

                return Json(new
                {
                    success = true,
                    checklist = new
                    {
                        id = checklist.Id,
                         numero_processo = checklist.Processo?.Numero,
                        processo_id = checklist.ProcessoId,
                        modalidade = checklist.Modalidade,
                        tipo = checklist.Tipo,
                        status = NormalizeStatus(checklist.Status),
                        data_criacao = checklist.DataCriacao.HasValue ? checklist.DataCriacao.Value.ToString("yyyy-MM-dd") : null,
                        criado_por_nome = checklist.CriadoPorNome,
                        ajustes_confirmados = checklist.AjustesConfirmados && possuiNaoConformidade,
                        ajustes_confirmados_em = checklist.AjustesConfirmados && possuiNaoConformidade && checklist.AjustesConfirmadosEm.HasValue ? checklist.AjustesConfirmadosEm.Value.ToString("yyyy-MM-dd HH:mm") : null,
                        ajustes_confirmados_por = checklist.AjustesConfirmados && possuiNaoConformidade ? checklist.AjustesConfirmadosPor : null,
                        competencia = checklist.Competencia,
                        processo = checklist.Processo == null
                            ? null
                            : new
                            {
                                id = checklist.Processo.Id,
                                numero = checklist.Processo.Numero,
                                objeto = checklist.Processo.Objeto,
                                modalidade = checklist.Processo.Modalidade,
                                competencia = checklist.Processo.Competencia
                            },
                        elementos = elementosDto,
                        itens = itensDto,
                        crono_analises = cronoDto
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter checklist {ChecklistId}", id);
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Erro ao obter checklist" });
            }
        }

        [HttpGet("/api/checklists/{id:int}/pdf")]
        public async Task<IActionResult> BaixarChecklistPdf(int id, CancellationToken cancellationToken)
        {
            try
            {
                var checklist = await _db.Checklists
                    .Include(c => c.Processo)
                    .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

                if (checklist == null)
                {
                    return NotFound("Checklist não encontrado.");
                }

                var elementos = await _db.Elementos
                    .Where(e => e.ChecklistId == id)
                    .OrderBy(e => e.Id)
                    .ToListAsync(cancellationToken);

                var itens = await _db.Itens
                    .Where(i => i.ChecklistId == id)
                    .OrderBy(i => i.Id)
                    .ToListAsync(cancellationToken);

                var possuiNaoConformidade = itens.Any(i => i.Analise == "nao_conforme");
                var dataCriacao = checklist.DataCriacao?.ToString("dd/MM/yyyy") ?? "-";
                var baseUrl = $"{Request.Scheme}://{Request.Host}";
                var responsavelAnalise =
                    checklist.CriadoPorNome
                    ?? User.FindFirstValue(ClaimTypes.Name)
                    ?? User.FindFirstValue(ClaimTypes.Email)
                    ?? "Controle Interno";

                var request = new ChecklistPdfService.ChecklistPdfRequest(
                    checklist.Id,
                    checklist.Processo?.Numero ?? $"Checklist {checklist.Id}",
                    checklist.Modalidade ?? "-",
                    AreaOrganogramaCatalog.NormalizarAreaOuOriginal(checklist.Processo?.Area) ?? "-",
                    checklist.Processo?.Gestor ?? "-",
                    checklist.Competencia ?? checklist.Processo?.Competencia ?? "-",
                    dataCriacao,
                    responsavelAnalise,
                    checklist.AjustesConfirmados && possuiNaoConformidade,
                    checklist.AjustesConfirmados && possuiNaoConformidade ? checklist.AjustesConfirmadosPor : null,
                    checklist.AjustesConfirmados && possuiNaoConformidade && checklist.AjustesConfirmadosEm.HasValue
                        ? checklist.AjustesConfirmadosEm.Value.ToString("dd/MM/yyyy HH:mm")
                        : null,
                    elementos.Select(e => new ChecklistPdfService.ChecklistPdfElemento(
                        e.Id,
                        e.ElementoNome ?? "-",
                        e.DataElemento?.ToString("dd/MM/yyyy") ?? "-",
                        string.IsNullOrWhiteSpace(e.Nup) ? "-" : e.Nup!)).ToList(),
                    itens.Select(i => new ChecklistPdfService.ChecklistPdfItem(
                        i.ElementoId,
                        i.Pergunta ?? "-",
                        i.Analise ?? string.Empty,
                        i.Justificativa)).ToList());

                var pdf = await _checklistPdfService.GerarChecklistPdfAsync(request, baseUrl, cancellationToken);
                var numeroProcesso = (checklist.Processo?.Numero ?? $"checklist-{checklist.Id}")
                    .Replace("/", "-")
                    .Replace("\\", "-");

                return File(pdf, "application/pdf", $"checklist-{numeroProcesso}.pdf");
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao gerar PDF do checklist {ChecklistId}", id);
                return StatusCode(500, "Erro ao gerar PDF do checklist.");
            }
        }

        [HttpDelete("/api/checklists/{id:int}")]
        public async Task<IActionResult> DeletarChecklist(int id)
        {
            try
            {
                await _checklistService.DeletarChecklistAsync(id);
                return Json(new { success = true, message = "Checklist deletado com sucesso" });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao deletar checklist {ChecklistId}", id);
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Erro ao deletar checklist" });
            }
        }

        [HttpPost("/api/checklists/{id:int}/elementos")]
        public async Task<IActionResult> AdicionarElemento(int id, [FromBody] Dictionary<string, string?> dados)
        {
            try
            {
                var elemento = await _checklistService.AdicionarElementoAsync(id, dados);
                return Json(new
                {
                    success = true,
                    message = "Elemento adicionado com sucesso",
                    elemento = new
                    {
                        id = elemento.Id,
                        checklist_id = elemento.ChecklistId,
                        tipo = elemento.Tipo,
                        elemento = elemento.ElementoNome,
                        data_elemento = elemento.DataElemento.HasValue ? elemento.DataElemento.Value.ToString("yyyy-MM-dd") : null,
                        nup = elemento.Nup
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao adicionar elemento no checklist {ChecklistId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao adicionar elemento" });
            }
        }

        [HttpPost("/api/checklists/{id:int}/itens")]
        public async Task<IActionResult> AdicionarItem(int id, [FromBody] Dictionary<string, string?> dados)
        {
            try
            {
                var elementoId = Convert.ToInt32(dados.GetValueOrDefault("elemento_id") ?? "0");
                var item = await _checklistService.AdicionarItemAsync(id, elementoId, dados);
                return Json(new
                {
                    success = true,
                    message = "Item adicionado com sucesso",
                    item = new
                    {
                        id = item.Id,
                        elemento_id = item.ElementoId,
                        checklist_id = item.ChecklistId,
                        pergunta = item.Pergunta,
                        analise = item.Analise,
                        categoria = item.Categoria,
                        justificativa = item.Justificativa
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao adicionar item no checklist {ChecklistId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao adicionar item" });
            }
        }

        [HttpPost("/api/checklists/{id:int}/crono-analise")]
        public async Task<IActionResult> AdicionarCronoAnalise(int id, [FromBody] Dictionary<string, string?> dados)
        {
            try
            {
                var crono = await _checklistService.AdicionarCronoAnaliseAsync(id, dados);
                return Json(new
                {
                    success = true,
                    message = "Análise cronológica adicionada com sucesso",
                    crono_analise = new
                    {
                        id = crono.Id,
                        checklist_id = crono.ChecklistId,
                        fase = crono.Fase,
                        data_inicio = crono.DataInicio.HasValue ? crono.DataInicio.Value.ToString("yyyy-MM-dd") : null,
                        data_fim = crono.DataFim.HasValue ? crono.DataFim.Value.ToString("yyyy-MM-dd") : null,
                        duracao = crono.Duracao ?? 0,
                        observacoes = crono.Observacoes
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao adicionar analise cronologica no checklist {ChecklistId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao adicionar analise cronologica" });
            }
        }

        [HttpGet("/api/checklists/estatisticas")]
        public async Task<IActionResult> ObterEstatisticas()
        {
            try
            {
                var (total, porStatus, porModalidade) = await _checklistService.ObterEstatisticasAsync();
                return Json(new { success = true, estatisticas = new { total_checklists = total, por_status = porStatus, por_modalidade = porModalidade } });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter estatisticas de checklists");
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Erro ao obter estatisticas" });
            }
        }

        [HttpGet("/api/checklists/{id:int}/taxa-conformidade")]
        public async Task<IActionResult> ObterTaxaConformidade(int id)
        {
            try
            {
                var taxa = await _checklistService.ObterTaxaConformidadeAsync(id);
                return Json(new { success = true, taxa_conformidade = taxa });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao calcular taxa de conformidade para checklist {ChecklistId}", id);
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Erro ao calcular taxa de conformidade" });
            }
        }

        [HttpPut("/api/editar-checklist/{checklist_id:int}")]
        public async Task<IActionResult> EditarChecklist(int checklist_id, [FromBody] Dictionary<string, object?> dados)
        {
            try
            {
                var checklist = await _checklistService.AtualizarChecklistAsync(checklist_id, dados);
                return Json(new
                {
                    success = true,
                    message = "Checklist atualizado com sucesso",
                    checklist = new
                    {
                        id = checklist.Id,
                        processo_id = checklist.ProcessoId,
                        modalidade = checklist.Modalidade,
                        tipo = checklist.Tipo,
                        status = NormalizeStatus(checklist.Status),
                        data_criacao = checklist.DataCriacao.HasValue ? checklist.DataCriacao.Value.ToString("yyyy-MM-dd") : null,
                        criado_por_nome = checklist.CriadoPorNome,
                        competencia = checklist.Competencia
                    }
                });
            }
            catch (InvalidOperationException e)
            {
                _logger.LogWarning(e, "Validação ao editar checklist {ChecklistId}", checklist_id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = e.Message });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao editar checklist {ChecklistId}", checklist_id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao editar checklist" });
            }
        }

        [HttpPost("/api/checklists/{id:int}/confirmar-ajustes")]
        public async Task<IActionResult> ConfirmarAjustes(int id)
        {
            try
            {
                var checklist = await _db.Checklists
                    .AsTracking()
                    .Include(c => c.Itens)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (checklist == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { success = false, message = "Checklist não encontrado." });
                }

                if (NormalizeStatus(checklist.Status) != "concluido")
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Somente checklists concluídos podem ter ajustes confirmados." });
                }

                if (!checklist.Itens.Any(i => i.Analise == "nao_conforme"))
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Este checklist não possui não conformidades para confirmação de ajuste." });
                }

                checklist.AjustesConfirmados = true;
                checklist.AjustesConfirmadosEm = DateTime.Now;
                checklist.AjustesConfirmadosPor =
                    User.Identity?.Name
                    ?? User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? "Usuário do sistema";

                await _db.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = "Ajustes do gestor confirmados com sucesso.",
                    confirmacao = new
                    {
                        ajustes_confirmados = checklist.AjustesConfirmados,
                        ajustes_confirmados_em = checklist.AjustesConfirmadosEm?.ToString("yyyy-MM-dd HH:mm"),
                        ajustes_confirmados_por = checklist.AjustesConfirmadosPor
                    }
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao confirmar ajustes do checklist {ChecklistId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao confirmar ajustes do checklist." });
            }
        }

        [HttpPost("/api/checklists/{id:int}/reverter-confirmacao-ajustes")]
        public async Task<IActionResult> ReverterConfirmacaoAjustes(int id)
        {
            try
            {
                var checklist = await _db.Checklists
                    .AsTracking()
                    .Include(c => c.Itens)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (checklist == null)
                {
                    Response.StatusCode = 404;
                    return Json(new { success = false, message = "Checklist não encontrado." });
                }

                if (!checklist.AjustesConfirmados)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Este checklist não possui confirmação de correção ativa." });
                }

                if (!checklist.Itens.Any(i => i.Analise == "nao_conforme"))
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Este checklist não possui não conformidades registradas para restauração." });
                }

                checklist.AjustesConfirmados = false;
                checklist.AjustesConfirmadosEm = null;
                checklist.AjustesConfirmadosPor = null;

                await _db.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = "Confirmação de correção revertida com sucesso."
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao reverter confirmação de ajustes do checklist {ChecklistId}", id);
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao reverter confirmação dos ajustes do checklist." });
            }
        }

        [HttpPost("/api/salvar-checklist")]
        public async Task<IActionResult> SalvarChecklist([FromBody] Dictionary<string, object?> dados)
        {
            try
            {
                var processoId = ParseInt(dados.GetValueOrDefault("processoId"));
                var usuarioId = ParseNullableInt(User.FindFirstValue(ClaimTypes.NameIdentifier));
                var usuarioNome = User.FindFirstValue(ClaimTypes.Name);
                var checklist = await _checklistService.CriarChecklistAsync(processoId, dados, usuarioId, usuarioNome);
                return Json(new { success = true, message = "Checklist salvo com sucesso", checklist_id = checklist.Id });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao salvar checklist");
                Response.StatusCode = 400;
                return Json(new { success = false, error = "Erro ao salvar checklist" });
            }
        }

        private static string NormalizeStatus(string? val)
        {
            if (string.IsNullOrWhiteSpace(val))
                return "em_preenchimento";
            var s = val.Trim().ToLowerInvariant().Replace(" ", "_");
            return s switch
            {
                "andamento" => "em_preenchimento",
                "em_andamento" => "em_preenchimento",
                "pendente" => "em_preenchimento",
                "pausado" => "em_preenchimento",
                "nao_iniciado" => "em_preenchimento",
                "incompleto" => "em_preenchimento",
                _ => s
            };
        }

        private static int ParseInt(object? value)
        {
            if (value == null)
                return 0;

            switch (value)
            {
                case int i:
                    return i;
                case long l:
                    return (int)l;
                case JsonElement el:
                    if (el.ValueKind == JsonValueKind.Number)
                    {
                        if (el.TryGetInt32(out var vi))
                            return vi;
                        if (el.TryGetInt64(out var vl))
                            return (int)vl;
                        if (el.TryGetDouble(out var vd))
                            return (int)vd;
                    }
                    if (el.ValueKind == JsonValueKind.String)
                    {
                        var s = el.GetString();
                        if (int.TryParse(s, out var vs))
                            return vs;
                    }
                    break;
                default:
                    var sObj = Convert.ToString(value);
                    if (!string.IsNullOrWhiteSpace(sObj) && int.TryParse(sObj, out var parsed))
                        return parsed;
                    break;
            }

            return 0;
        }

        private static int? ParseNullableInt(string? value)
        {
            return int.TryParse(value, out var parsed) ? parsed : null;
        }
    }
}
