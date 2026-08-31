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
    [Authorize]
    public class DashboardController : Controller
    {
        private readonly AppDbContext _db;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(AppDbContext db, ILogger<DashboardController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet("/DASHBOARD-CONF")]
        public IActionResult DashboardConf()
        {
            return View("DASHBOARD-CONF");
        }

        [HttpGet("/DASHBOARD-CRONO")]
        public IActionResult DashboardCrono()
        {
            return View("DASHBOARD-CRONO");
        }

        [HttpGet("/TELA-RELATORIO")]
        public IActionResult TelaRelatorio()
        {
            return View("TELA-RELATORIO");
        }

        [HttpGet("/api/dashboard/filtros")]
        public async Task<IActionResult> FiltrosDashboard()
        {
            try
            {
                var modalidadesRaw = await _db.Checklists
                    .AsNoTracking()
                    .Select(c => c.Modalidade)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .ToListAsync();

                var modalidades = modalidadesRaw
                    .Select(NormalizarModalidadeOuOriginal)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Distinct()
                    .OrderBy(v => v)
                    .ToList();

                var areasRaw = await _db.Processos
                    .AsNoTracking()
                    .Select(p => p.Area)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .ToListAsync();

                var areas = areasRaw
                    .Select(AreaOrganogramaCatalog.NormalizarAreaOuOriginal)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Distinct()
                    .OrderBy(v => v)
                    .ToList();

                var competenciasRaw = await _db.Processos
                    .AsNoTracking()
                    .Select(p => p.Competencia)
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .ToListAsync();

                var competencias = competenciasRaw
                    .SelectMany(SplitCompetencias)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(v => v)
                    .ToList();

                return Json(new
                {
                    modalidades,
                    areas,
                    competencias
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter filtros do dashboard");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/top5-nao-conformidades")]
        public async Task<IActionResult> Top5NaoConformidades([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var itensQuery = ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Analise == "nao_conforme");

                var result = await itensQuery
                    .GroupBy(i => i.Categoria)
                    .Select(g => new { categoria = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .Take(5)
                    .ToListAsync();

                var payload = result.Select(r => new
                {
                    categoria = string.IsNullOrWhiteSpace(r.categoria) ? "Sem categoria" : r.categoria,
                    count = r.count
                });

                return Json(payload);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter top 5 nao conformidades");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/checklist-por-mes")]
        public async Task<IActionResult> ChecklistPorMes([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var agrupado = await ApplyChecklistFilters(BaseChecklistsQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(c => c.DataCriacao != null)
                    .GroupBy(c => new { c.DataCriacao!.Value.Year, c.DataCriacao.Value.Month })
                    .Select(g => new
                    {
                        Ano = g.Key.Year,
                        Mes = g.Key.Month,
                        Total = g.Count()
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToListAsync();

                var result = agrupado.Select(x => new
                {
                    mes = $"{x.Ano}-{x.Mes:00}",
                    total = x.Total
                });

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter checklists por mes");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/modalidadespizza")]
        public async Task<IActionResult> ModalidadesPizza([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var resultRaw = await ApplyChecklistFilters(BaseChecklistsQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .ToListAsync();

                var result = resultRaw
                    .GroupBy(c => NormalizarModalidadeOuOriginal(c.Modalidade))
                    .Select(g => new { modalidade = g.Key, total = g.Count() })
                    .ToList();

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter modalidades");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/nao-conformidades-por-modalidade")]
        public async Task<IActionResult> NaoConformidadesPorModalidade([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var resultRaw = await ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Analise == "conforme" || i.Analise == "nao_conforme")
                    .ToListAsync();

                var result = resultRaw
                    .GroupBy(i => NormalizarModalidadeOuOriginal(i.Checklist!.Modalidade))
                    .Select(g => new
                    {
                        modalidade = g.Key,
                        total_avaliados = g.Count(),
                        nao_conformes = g.Count(x => x.Analise == "nao_conforme")
                    })
                    .ToList();

                var payload = result.Select(x => new
                {
                    modalidade = x.modalidade,
                    total_avaliados = x.total_avaliados,
                    nao_conformes = x.nao_conformes,
                    taxa_nao_conformidade = x.total_avaliados > 0
                        ? Math.Round((double)x.nao_conformes / x.total_avaliados * 100.0, 2)
                        : 0.0
                });

                return Json(payload);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter nao conformidades por modalidade");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/taxa-conformidade")]
        public async Task<IActionResult> TaxaConformidade([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var itensQuery = ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim);

                var totalItens = await itensQuery.CountAsync();
                var itensConformes = await itensQuery.CountAsync(i => i.Analise == "conforme");
                var itensNaoConformes = await itensQuery.CountAsync(i => i.Analise == "nao_conforme");
                var itensNaoSeAplica = await itensQuery.CountAsync(i => i.Analise == "nao_se_aplica");
                var totalAvaliados = itensConformes + itensNaoConformes;

                var taxa = totalAvaliados > 0 ? (double)itensConformes / totalAvaliados * 100.0 : 0.0;

                return Json(new
                {
                    taxa = Math.Round(taxa, 2),
                    total_itens = totalItens,
                    total_avaliados = totalAvaliados,
                    conformes = itensConformes,
                    nao_conformes = itensNaoConformes,
                    nao_se_aplica = itensNaoSeAplica
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter taxa de conformidade");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/evolucao-nao-conformidades")]
        public async Task<IActionResult> EvolucaoNaoConformidades([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var agrupado = await ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Analise == "nao_conforme" && i.Checklist!.DataCriacao != null)
                    .GroupBy(i => new { i.Checklist!.DataCriacao!.Value.Year, i.Checklist.DataCriacao.Value.Month })
                    .Select(g => new
                    {
                        Ano = g.Key.Year,
                        Mes = g.Key.Month,
                        Total = g.Count()
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToListAsync();

                var result = agrupado.Select(x => new
                {
                    mes = $"{x.Ano}-{x.Mes:00}",
                    total = x.Total
                });

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter evolucao de nao conformidades");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/evolucao-conformidades")]
        public async Task<IActionResult> EvolucaoConformidades([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var agrupado = await ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Analise == "conforme" && i.Checklist!.DataCriacao != null)
                    .GroupBy(i => new { i.Checklist!.DataCriacao!.Value.Year, i.Checklist.DataCriacao.Value.Month })
                    .Select(g => new
                    {
                        Ano = g.Key.Year,
                        Mes = g.Key.Month,
                        Total = g.Count()
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToListAsync();

                var result = agrupado.Select(x => new
                {
                    mes = $"{x.Ano}-{x.Mes:00}",
                    total = x.Total
                });

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter evolucao de conformidades");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/evolucao-conformidade")]
        public async Task<IActionResult> EvolucaoConformidade([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var agrupado = await ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Checklist!.DataCriacao != null)
                    .GroupBy(i => new { i.Checklist!.DataCriacao!.Value.Year, i.Checklist.DataCriacao.Value.Month })
                    .Select(g => new
                    {
                        Ano = g.Key.Year,
                        Mes = g.Key.Month,
                        Conformes = g.Count(x => x.Analise == "conforme"),
                        NaoConformes = g.Count(x => x.Analise == "nao_conforme"),
                        NaoSeAplica = g.Count(x => x.Analise == "nao_se_aplica")
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToListAsync();

                var result = agrupado.Select(x =>
                {
                    var avaliados = x.Conformes + x.NaoConformes;
                    var taxa = avaliados > 0 ? (double)x.Conformes / avaliados * 100.0 : 0.0;
                    var taxaNao = avaliados > 0 ? (double)x.NaoConformes / avaliados * 100.0 : 0.0;
                    return new
                    {
                        mes = $"{x.Ano}-{x.Mes:00}",
                        avaliados,
                        conformes = x.Conformes,
                        nao_conformes = x.NaoConformes,
                        nao_se_aplica = x.NaoSeAplica,
                        taxa_conformidade = Math.Round(taxa, 2),
                        taxa_nao_conformidade = Math.Round(taxaNao, 2)
                    };
                });

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter evolucao de conformidade");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/dados-crono-analise")]
        [HttpGet("/api/dashboard/geral")]
        public async Task<IActionResult> DadosCronoAnalise([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] string? fase, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var cronoRaw = await ApplyCronoFilters(BaseCronoQuery(), competencia, area, modalidade, categoria, fase, dataInicio, dataFim)
                    .Select(c => new
                    {
                        c.ChecklistId,
                        c.Fase,
                        c.DataInicio,
                        c.DataFim,
                        c.Duracao,
                        Area = c.Checklist != null && c.Checklist.Processo != null ? c.Checklist.Processo.Area : null
                    })
                    .ToListAsync();

                var duracoesPorFase = cronoRaw
                    .Select(c => new
                    {
                        c.Fase,
                        Duracao = ResolverDuracaoCrono(c.Duracao, c.DataInicio, c.DataFim)
                    })
                    .Where(x => !string.IsNullOrWhiteSpace(x.Fase) && x.Duracao.HasValue && x.Duracao.Value >= 0)
                    .ToList();

                var fases = duracoesPorFase
                    .GroupBy(x => x.Fase)
                    .Select(g =>
                    {
                        var valores = g.Select(x => (double)x.Duracao!.Value).ToList();
                        return new
                        {
                            nome = g.Key,
                            total = valores.Sum(),
                            media = valores.Average(),
                            p50 = Percentile(valores, 0.5),
                            p90 = Percentile(valores, 0.9),
                            count = valores.Count
                        };
                    })
                    .ToList();

                var faseGargalo = fases.OrderByDescending(f => f.p90).FirstOrDefault();

                var cronoConsistente = cronoRaw
                    .Where(c => DataCronoValida(c.DataInicio) && DataCronoValida(c.DataFim) && c.DataFim!.Value.Date >= c.DataInicio!.Value.Date)
                    .ToList();

                var leadTimePorChecklist = cronoConsistente
                    .GroupBy(c => c.ChecklistId)
                    .Select(g => new
                    {
                        ChecklistId = g.Key,
                        Inicio = g.Min(x => x.DataInicio),
                        Fim = g.Max(x => x.DataFim),
                        Area = g.Select(x => x.Area).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
                    })
                    .Where(x => x.Inicio.HasValue && x.Fim.HasValue && x.Fim.Value.Date >= x.Inicio.Value.Date)
                    .Select(x => new
                    {
                        x.ChecklistId,
                        x.Inicio,
                        x.Fim,
                        x.Area,
                        Duracao = (x.Fim!.Value.Date - x.Inicio!.Value.Date).TotalDays
                    })
                    .Where(x => x.Duracao >= 0 && x.Duracao <= 3650)
                    .ToList();

                var leadTimes = leadTimePorChecklist.Select(x => x.Duracao).ToList();
                var totalProcessos = leadTimes.Count;
                var leadTimeMedio = leadTimes.Count > 0 ? leadTimes.Average() : 0.0;
                var leadTimeP50 = Percentile(leadTimes, 0.5);
                var leadTimeP90 = Percentile(leadTimes, 0.9);
                var maiorTempoRegistrado = leadTimes.Count > 0 ? leadTimes.Max() : 0.0;

                var tempoPorArea = leadTimePorChecklist
                    .Where(x => !string.IsNullOrWhiteSpace(x.Area))
                    .GroupBy(x => x.Area!)
                    .Select(g =>
                    {
                        var valores = g.Select(x => x.Duracao).ToList();
                        return new
                        {
                            nome = g.Key,
                            total = valores.Sum(),
                            media = valores.Count > 0 ? valores.Average() : 0.0,
                            p90 = Percentile(valores, 0.9),
                            count = valores.Count
                        };
                    })
                    .OrderByDescending(x => x.media)
                    .ToList();

                var evolucao = leadTimePorChecklist
                    .GroupBy(x => new { x.Fim!.Value.Year, x.Fim.Value.Month })
                    .Select(g =>
                    {
                        var valores = g.Select(x => x.Duracao).ToList();
                        return new
                        {
                            Ano = g.Key.Year,
                            Mes = g.Key.Month,
                            Total = valores.Count,
                            LeadTimeMedio = valores.Count > 0 ? valores.Average() : 0.0,
                            LeadTimeP90 = Percentile(valores, 0.9)
                        };
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToList();

                return Json(new
                {
                    total_processos = totalProcessos,
                    lead_time_medio = Math.Round(leadTimeMedio, 2),
                    lead_time_p50 = Math.Round(leadTimeP50, 2),
                    lead_time_p90 = Math.Round(leadTimeP90, 2),
                    maior_tempo_registrado = Math.Round(maiorTempoRegistrado, 2),
                    fase_gargalo = faseGargalo != null
                        ? $"{faseGargalo.nome} - {Math.Round(faseGargalo.p90, 2)} dias"
                        : null,
                    tempo_por_fase = fases.Select(t => new
                    {
                        nome = t.nome,
                        media = Math.Round(t.media, 2),
                        p50 = Math.Round(t.p50, 2),
                        p90 = Math.Round(t.p90, 2),
                        total = Math.Round(t.total, 2),
                        count = t.count
                    }),
                    total_dias_por_fase = fases.Select(d => new
                    {
                        nome = d.nome,
                        total = Math.Round(d.total, 2)
                    }),
                    tempo_por_area = tempoPorArea.Select(a => new
                    {
                        nome = a.nome,
                        media = Math.Round(a.media, 2),
                        p90 = Math.Round(a.p90, 2),
                        total = Math.Round(a.total, 2),
                        count = a.count
                    }),
                    evolucao = evolucao.Select(e => new
                    {
                        mes = $"{e.Ano}-{e.Mes:00}",
                        total = e.Total,
                        lead_time_medio = Math.Round(e.LeadTimeMedio, 2),
                        lead_time_p90 = Math.Round(e.LeadTimeP90, 2)
                    })
                });
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter dados de crono analise");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/qtd-processos-por-mes")]
        public async Task<IActionResult> QtdProcessosPorMes([FromQuery] string? competencia, [FromQuery] string? area, [FromQuery] string? modalidade, [FromQuery] string? categoria, [FromQuery] DateTime? dataInicio, [FromQuery] DateTime? dataFim)
        {
            try
            {
                var agrupado = await ApplyChecklistFilters(BaseChecklistsQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(c => c.DataCriacao != null)
                    .GroupBy(c => new { c.DataCriacao!.Value.Year, c.DataCriacao.Value.Month })
                    .Select(g => new
                    {
                        Ano = g.Key.Year,
                        Mes = g.Key.Month,
                        Total = g.Count()
                    })
                    .OrderBy(x => x.Ano)
                    .ThenBy(x => x.Mes)
                    .ToListAsync();

                var result = agrupado.Select(x => new
                {
                    mes = $"{x.Ano}-{x.Mes:00}",
                    total = x.Total
                });

                return Json(result);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter quantidade de processos por mes");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        [HttpGet("/api/top-categorias-nao-conformidades")]
        [HttpGet("/api/top10-processos-nao-conformidades")]
        public async Task<IActionResult> TopCategoriasNaoConformidades([FromQuery] int top = 10, [FromQuery] string? competencia = null, [FromQuery] string? area = null, [FromQuery] string? modalidade = null, [FromQuery] string? categoria = null, [FromQuery] DateTime? dataInicio = null, [FromQuery] DateTime? dataFim = null)
        {
            try
            {
                var limite = top <= 0 ? 10 : Math.Min(top, 50);

                var naoConformes = ApplyItemFilters(BaseItensQuery(), competencia, area, modalidade, categoria, dataInicio, dataFim)
                    .Where(i => i.Analise == "nao_conforme");

                var totalNaoConformidades = await naoConformes.CountAsync();

                var agregados = await naoConformes
                    .GroupBy(i => string.IsNullOrWhiteSpace(i.Categoria) ? "Sem categoria" : i.Categoria!.Trim())
                    .Select(g => new
                    {
                        categoria = g.Key,
                        total_nao_conformidades = g.Count()
                    })
                    .OrderByDescending(x => x.total_nao_conformidades)
                    .Take(limite)
                    .ToListAsync();

                var payload = agregados.Select(x => new
                {
                    categoria = string.IsNullOrWhiteSpace(x.categoria) ? "Sem categoria" : x.categoria.Trim(),
                    x.total_nao_conformidades,
                    percentual_total_nc = totalNaoConformidades > 0
                        ? Math.Round((double)x.total_nao_conformidades / totalNaoConformidades * 100.0, 2)
                        : 0.0
                });

                return Json(payload);
            }
            catch (Exception e)
            {
                _logger.LogError(e, "Erro ao obter top categorias nao conformes");
                Response.StatusCode = 500;
                return Json(new { error = "Erro interno" });
            }
        }

        private IQueryable<Checklist> BaseChecklistsQuery()
        {
            return _db.Checklists
                .AsNoTracking()
                .Include(c => c.Processo);
        }

        private IQueryable<Item> BaseItensQuery()
        {
            return _db.Itens
                .AsNoTracking()
                .Include(i => i.Checklist)
                .ThenInclude(c => c!.Processo);
        }

        private IQueryable<CronoAnalise> BaseCronoQuery()
        {
            return _db.CronoAnalises
                .AsNoTracking()
                .Include(c => c.Checklist)
                .ThenInclude(ch => ch!.Processo);
        }

        private static IQueryable<Checklist> ApplyChecklistFilters(IQueryable<Checklist> query, string? competencia, string? area, string? modalidade, string? categoria, DateTime? dataInicio, DateTime? dataFim)
        {
            if (!string.IsNullOrWhiteSpace(modalidade))
            {
                var modalidadesAceitas = ObterValoresAceitosParaModalidade(modalidade.Trim());
                query = query.Where(c => modalidadesAceitas.Contains(c.Modalidade));
            }

            if (!string.IsNullOrWhiteSpace(area))
            {
                var areasAceitas = AreaOrganogramaCatalog.ObterValoresAceitosParaFiltro(area.Trim());
                query = query.Where(c => c.Processo != null && c.Processo.Area != null && areasAceitas.Contains(c.Processo.Area));
            }

            if (!string.IsNullOrWhiteSpace(competencia))
            {
                var competenciaFiltro = competencia.Trim();
                query = query.Where(c =>
                    c.Competencia.Contains(competenciaFiltro) ||
                    (c.Processo != null && c.Processo.Competencia.Contains(competenciaFiltro)));
            }

            if (!string.IsNullOrWhiteSpace(categoria))
            {
                var categoriaFiltro = categoria.Trim();
                query = query.Where(c => c.Itens.Any(i => i.Categoria == categoriaFiltro));
            }

            if (dataInicio.HasValue)
            {
                var inicio = dataInicio.Value.Date;
                query = query.Where(c => c.DataCriacao.HasValue && c.DataCriacao.Value.Date >= inicio);
            }

            if (dataFim.HasValue)
            {
                var fim = dataFim.Value.Date;
                query = query.Where(c => c.DataCriacao.HasValue && c.DataCriacao.Value.Date <= fim);
            }

            return query;
        }

        private static IQueryable<Item> ApplyItemFilters(IQueryable<Item> query, string? competencia, string? area, string? modalidade, string? categoria, DateTime? dataInicio, DateTime? dataFim)
        {
            if (!string.IsNullOrWhiteSpace(modalidade))
            {
                var modalidadesAceitas = ObterValoresAceitosParaModalidade(modalidade.Trim());
                query = query.Where(i => i.Checklist != null && modalidadesAceitas.Contains(i.Checklist.Modalidade));
            }

            if (!string.IsNullOrWhiteSpace(area))
            {
                var areasAceitas = AreaOrganogramaCatalog.ObterValoresAceitosParaFiltro(area.Trim());
                query = query.Where(i => i.Checklist != null && i.Checklist.Processo != null && i.Checklist.Processo.Area != null && areasAceitas.Contains(i.Checklist.Processo.Area));
            }

            if (!string.IsNullOrWhiteSpace(competencia))
            {
                var competenciaFiltro = competencia.Trim();
                query = query.Where(i =>
                    i.Checklist != null &&
                    (i.Checklist.Competencia.Contains(competenciaFiltro) ||
                     (i.Checklist.Processo != null && i.Checklist.Processo.Competencia.Contains(competenciaFiltro))));
            }

            if (!string.IsNullOrWhiteSpace(categoria))
            {
                var categoriaFiltro = categoria.Trim();
                query = query.Where(i => i.Categoria == categoriaFiltro);
            }

            if (dataInicio.HasValue)
            {
                var inicio = dataInicio.Value.Date;
                query = query.Where(i => i.Checklist != null && i.Checklist.DataCriacao.HasValue && i.Checklist.DataCriacao.Value.Date >= inicio);
            }

            if (dataFim.HasValue)
            {
                var fim = dataFim.Value.Date;
                query = query.Where(i => i.Checklist != null && i.Checklist.DataCriacao.HasValue && i.Checklist.DataCriacao.Value.Date <= fim);
            }

            return query;
        }

        private static IQueryable<CronoAnalise> ApplyCronoFilters(IQueryable<CronoAnalise> query, string? competencia, string? area, string? modalidade, string? categoria, string? fase, DateTime? dataInicio, DateTime? dataFim)
        {
            if (!string.IsNullOrWhiteSpace(modalidade))
            {
                var modalidadesAceitas = ObterValoresAceitosParaModalidade(modalidade.Trim());
                query = query.Where(c => c.Checklist != null && modalidadesAceitas.Contains(c.Checklist.Modalidade));
            }

            if (!string.IsNullOrWhiteSpace(area))
            {
                var areasAceitas = AreaOrganogramaCatalog.ObterValoresAceitosParaFiltro(area.Trim());
                query = query.Where(c => c.Checklist != null && c.Checklist.Processo != null && c.Checklist.Processo.Area != null && areasAceitas.Contains(c.Checklist.Processo.Area));
            }

            if (!string.IsNullOrWhiteSpace(competencia))
            {
                var competenciaFiltro = competencia.Trim();
                query = query.Where(c =>
                    c.Checklist != null &&
                    (c.Checklist.Competencia.Contains(competenciaFiltro) ||
                     (c.Checklist.Processo != null && c.Checklist.Processo.Competencia.Contains(competenciaFiltro))));
            }

            if (!string.IsNullOrWhiteSpace(categoria))
            {
                var categoriaFiltro = categoria.Trim();
                query = query.Where(c => c.Checklist != null && c.Checklist.Itens.Any(i => i.Categoria == categoriaFiltro));
            }

            if (!string.IsNullOrWhiteSpace(fase))
            {
                var faseFiltro = fase.Trim();
                query = query.Where(c => c.Fase == faseFiltro);
            }

            if (dataInicio.HasValue)
            {
                var inicio = dataInicio.Value.Date;
                query = query.Where(c => c.Checklist != null && c.Checklist.DataCriacao.HasValue && c.Checklist.DataCriacao.Value.Date >= inicio);
            }

            if (dataFim.HasValue)
            {
                var fim = dataFim.Value.Date;
                query = query.Where(c => c.Checklist != null && c.Checklist.DataCriacao.HasValue && c.Checklist.DataCriacao.Value.Date <= fim);
            }

            return query;
        }

        private static IEnumerable<string> SplitCompetencias(string? valor)
        {
            return (valor ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(v => !string.IsNullOrWhiteSpace(v));
        }

        private static string NormalizarModalidadeOuOriginal(string? valor)
        {
            var texto = (valor ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(texto))
            {
                return string.Empty;
            }

            return texto.ToLowerInvariant() switch
            {
                "ato-convocatorio" => "Ato Convocatório",
                "ato convocatório" => "Ato Convocatório",
                "pedido de cotação" => "Pedido de Cotação",
                "pedido de cotacao" => "Pedido de Cotação",
                "pedido-cotacao" => "Pedido de Cotação",
                "dispensa" => "Dispensa",
                "inexigibilidade" => "Inexigibilidade",
                _ => texto
            };
        }

        private static List<string> ObterValoresAceitosParaModalidade(string modalidade)
        {
            var valor = NormalizarModalidadeOuOriginal(modalidade);
            return valor switch
            {
                "Ato Convocatório" => ["ato-convocatorio", "Ato Convocatório", "ato convocatório"],
                "Pedido de Cotação" => ["pedido-cotacao", "Pedido de Cotação", "pedido de cotação", "pedido de cotacao"],
                "Dispensa" => ["dispensa", "Dispensa"],
                "Inexigibilidade" => ["inexigibilidade", "Inexigibilidade"],
                _ => [modalidade.Trim()]
            };
        }

        private static int? CalcularDuracao(DateTime? inicio, DateTime? fim)
        {
            if (!inicio.HasValue || !fim.HasValue)
                return null;
            var dias = (int)(fim.Value.Date - inicio.Value.Date).TotalDays;
            return dias >= 0 ? dias : null;
        }

        private static bool DataCronoValida(DateTime? data)
        {
            return data.HasValue && data.Value.Year >= 2000 && data.Value.Year <= 2100;
        }

        private static int? ResolverDuracaoCrono(int? duracao, DateTime? inicio, DateTime? fim)
        {
            var duracaoCalculada = DataCronoValida(inicio) && DataCronoValida(fim)
                ? CalcularDuracao(inicio, fim)
                : null;

            if (duracaoCalculada.HasValue && duracaoCalculada.Value >= 0 && duracaoCalculada.Value <= 3650)
                return duracaoCalculada;

            if (duracao.HasValue && duracao.Value >= 0 && duracao.Value <= 3650)
                return duracao.Value;

            return null;
        }

        private static double Percentile(IReadOnlyList<double> valores, double percentil)
        {
            if (valores == null || valores.Count == 0)
                return 0.0;
            var ordenado = valores.OrderBy(v => v).ToList();
            var posicao = (ordenado.Count - 1) * percentil;
            var inferior = (int)Math.Floor(posicao);
            var superior = (int)Math.Ceiling(posicao);
            if (inferior == superior)
                return ordenado[inferior];
            var peso = posicao - inferior;
            return ordenado[inferior] + (ordenado[superior] - ordenado[inferior]) * peso;
        }
    }
}
