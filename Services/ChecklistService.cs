using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using versaoCsharp.Data;
using versaoCsharp.Models;

namespace versaoCsharp.Services
{
    public class ChecklistService
    {
        private readonly AppDbContext _db;

        public ChecklistService(AppDbContext db)
        {
            _db = db;
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

        private static bool StatusExigeConclusao(string? status)
        {
            return string.Equals(NormalizeStatus(status), "concluido", StringComparison.OrdinalIgnoreCase);
        }

        private static bool ItemTemAnaliseValida(Item item)
        {
            if (string.IsNullOrWhiteSpace(item.Analise))
                return false;

            var analise = item.Analise.Trim().ToLowerInvariant();
            if (analise != "conforme" && analise != "nao_conforme" && analise != "nao_se_aplica")
                return false;

            if (analise == "nao_conforme" && string.IsNullOrWhiteSpace(item.Categoria))
                return false;

            return true;
        }

        private static bool ElementoPodeIgnorarCampos(Elemento elemento, IEnumerable<Item> itensElemento)
        {
            var itens = itensElemento.ToList();
            return itens.Count > 0 && itens.All(item =>
                string.Equals(item.Analise, "nao_se_aplica", StringComparison.OrdinalIgnoreCase));
        }

        private static bool ChecklistEstaCompleto(Checklist checklist)
        {
            var elementos = checklist.Elementos?.ToList() ?? new List<Elemento>();
            var itens = checklist.Itens?.ToList() ?? new List<Item>();
            var cronos = checklist.CronoAnalises?.ToList() ?? new List<CronoAnalise>();

            if (elementos.Count == 0 || itens.Count == 0 || cronos.Count == 0)
                return false;

            foreach (var elemento in elementos)
            {
                var itensElemento = itens.Where(i => i.ElementoId == elemento.Id).ToList();
                if (itensElemento.Count == 0)
                    return false;

                if (itensElemento.Any(item => !ItemTemAnaliseValida(item)))
                    return false;

                var podeIgnorarCampos = ElementoPodeIgnorarCampos(elemento, itensElemento);
                if (!podeIgnorarCampos)
                {
                    if (!elemento.DataElemento.HasValue)
                        return false;

                    if (string.IsNullOrWhiteSpace(elemento.Nup))
                        return false;
                }
            }

            foreach (var crono in cronos)
            {
                if (string.IsNullOrWhiteSpace(crono.Fase))
                    return false;

                if (!crono.DataInicio.HasValue || !crono.DataFim.HasValue || !crono.Duracao.HasValue)
                    return false;
            }

            return true;
        }

        private static int CalcularDuracaoDias(DateTime dataInicio, DateTime dataFim)
        {
            var diferenca = (int)(dataFim.Date - dataInicio.Date).TotalDays;
            return Math.Max(0, diferenca);
        }

        private static DateTime? ParseDateOnlyOrNull(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var texto = value.Trim();

            if (DateTime.TryParseExact(
                texto,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dataPura))
            {
                return dataPura.Date;
            }

            if (DateTime.TryParse(texto, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dataGenerica))
                return dataGenerica.Date;

            if (DateTime.TryParse(texto, out dataGenerica))
                return dataGenerica.Date;

            return null;
        }

        private static int? TryGetId(JsonElement el, params string[] names)
        {
            foreach (var name in names)
            {
                if (!el.TryGetProperty(name, out var idEl))
                {
                    continue;
                }

                if (idEl.ValueKind == JsonValueKind.Number && idEl.TryGetInt32(out var idNum))
                {
                    return idNum;
                }

                if (idEl.ValueKind == JsonValueKind.String &&
                    int.TryParse(idEl.GetString(), out var idStr))
                {
                    return idStr;
                }
            }

            return null;
        }

        private static string NormalizeKey(string? value)
        {
            return value?.Trim() ?? string.Empty;
        }

        private static string? GetStringOrNull(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var valueEl) || valueEl.ValueKind != JsonValueKind.String)
                return null;

            var value = valueEl.GetString();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static string? GetScalarTextOrNull(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var valueEl))
                return null;

            if (valueEl.ValueKind == JsonValueKind.String)
            {
                var value = valueEl.GetString();
                return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
            }

            if (valueEl.ValueKind == JsonValueKind.Number)
                return valueEl.ToString();

            return null;
        }

        private static string? NormalizarCategoriaNaoConformidade(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
                return null;

            var texto = valor.Trim();
            var comparacao = RemoverAcentos(texto).ToLowerInvariant();

            return comparacao switch
            {
                "documentacao incompleta" => "Documentação incompleta",
                "documento ausente" => "Documento ausente",
                "informacao divergente" => "Informação divergente",
                "prazo nao atendido" => "Prazo não atendido",
                "aprovacao pendente" => "Aprovação pendente",
                "assinatura ausente" => "Assinatura ausente",
                "classificacao incorreta" => "Classificação incorreta",
                "outro" => "Outro",
                _ => texto
            };
        }

        private static string RemoverAcentos(string valor)
        {
            var normalizado = valor.Normalize(System.Text.NormalizationForm.FormD);
            var buffer = new System.Text.StringBuilder(normalizado.Length);

            foreach (var ch in normalizado)
            {
                var categoria = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch);
                if (categoria != System.Globalization.UnicodeCategory.NonSpacingMark)
                {
                    buffer.Append(ch);
                }
            }

            return buffer.ToString().Normalize(System.Text.NormalizationForm.FormC);
        }

        private static bool TodosItensSaoNaoSeAplica(JsonElement itensEl, string campoPrincipal, string? campoAlternativo = null)
        {
            if (itensEl.ValueKind != JsonValueKind.Array)
                return false;

            var possuiItens = false;

            foreach (var itemEl in itensEl.EnumerateArray())
            {
                possuiItens = true;

                var analise = GetStringOrNull(itemEl, campoPrincipal);
                if (string.IsNullOrWhiteSpace(analise) && !string.IsNullOrWhiteSpace(campoAlternativo))
                {
                    analise = GetStringOrNull(itemEl, campoAlternativo!);
                }

                if (!string.Equals(analise, "nao_se_aplica", StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            return possuiItens;
        }

        private static void ValidarPerguntasObrigatorias(JsonElement perguntasEl)
        {
            var erros = new List<string>();
            var indiceElemento = 0;

            foreach (var perguntaEl in perguntasEl.EnumerateArray())
            {
                indiceElemento++;
                var titulo = GetStringOrNull(perguntaEl, "titulo") ?? $"Elemento {indiceElemento}";
                var dataElemento = GetStringOrNull(perguntaEl, "date");
                var nup = GetStringOrNull(perguntaEl, "nup");
                var todosNaoSeAplica = perguntaEl.TryGetProperty("subPerguntas", out var subsElTmp)
                    && subsElTmp.ValueKind == JsonValueKind.Array
                    && TodosItensSaoNaoSeAplica(subsElTmp, "resposta", "analise");

                if (!todosNaoSeAplica && string.IsNullOrWhiteSpace(dataElemento))
                    erros.Add($"{titulo}: data do elemento obrigatória.");

                if (!todosNaoSeAplica && string.IsNullOrWhiteSpace(nup))
                    erros.Add($"{titulo}: NUP obrigatório.");

                if (!perguntaEl.TryGetProperty("subPerguntas", out var subsEl) || subsEl.ValueKind != JsonValueKind.Array)
                    continue;

                todosNaoSeAplica = TodosItensSaoNaoSeAplica(subsEl, "resposta", "analise");

                var indicePergunta = 0;
                foreach (var subEl in subsEl.EnumerateArray())
                {
                    indicePergunta++;
                    var textoPergunta = GetStringOrNull(subEl, "pergunta") ?? $"Pergunta {indicePergunta}";
                    var analise = GetStringOrNull(subEl, "resposta") ?? GetStringOrNull(subEl, "analise");
                    var categoria = GetStringOrNull(subEl, "categoria");

                    if (string.IsNullOrWhiteSpace(analise))
                    {
                        erros.Add($"{titulo} - {textoPergunta}: resposta obrigatória não preenchida.");
                        continue;
                    }

                    if (!string.Equals(analise, "conforme", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(analise, "nao_conforme", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(analise, "nao_se_aplica", StringComparison.OrdinalIgnoreCase))
                    {
                        erros.Add($"{titulo} - {textoPergunta}: resposta inválida.");
                        continue;
                    }

                    if (string.Equals(analise, "nao_conforme", StringComparison.OrdinalIgnoreCase) &&
                        string.IsNullOrWhiteSpace(categoria))
                    {
                        erros.Add($"{titulo} - {textoPergunta}: categoria obrigatória para não conformidade.");
                    }
                }
            }

            if (erros.Count > 0)
                throw new InvalidOperationException(string.Join(" ", erros.Take(5)));
        }

        private static void ValidarItensObrigatoriosEdicao(JsonElement elementosEl)
        {
            var erros = new List<string>();

            foreach (var elementoEl in elementosEl.EnumerateArray())
            {
                var descricao = GetStringOrNull(elementoEl, "descricao") ??
                                GetStringOrNull(elementoEl, "elemento") ??
                                "Elemento";
                var dataElemento = GetStringOrNull(elementoEl, "data_elemento") ?? GetStringOrNull(elementoEl, "date");
                var nup = GetStringOrNull(elementoEl, "nup");
                var todosNaoSeAplica = elementoEl.TryGetProperty("itens", out var itensElTmp)
                    && itensElTmp.ValueKind == JsonValueKind.Array
                    && TodosItensSaoNaoSeAplica(itensElTmp, "analise", "resposta");

                if (!todosNaoSeAplica && string.IsNullOrWhiteSpace(dataElemento))
                    erros.Add($"{descricao}: data do elemento obrigatória.");

                if (!todosNaoSeAplica && string.IsNullOrWhiteSpace(nup))
                    erros.Add($"{descricao}: NUP obrigatório.");

                if (!elementoEl.TryGetProperty("itens", out var itensEl) || itensEl.ValueKind != JsonValueKind.Array)
                    continue;

                todosNaoSeAplica = TodosItensSaoNaoSeAplica(itensEl, "analise", "resposta");

                foreach (var itemEl in itensEl.EnumerateArray())
                {
                    var pergunta = GetStringOrNull(itemEl, "descricao") ??
                                   GetStringOrNull(itemEl, "pergunta") ??
                                   "Item";
                    var analise = GetStringOrNull(itemEl, "analise") ?? GetStringOrNull(itemEl, "resposta");
                    var categoria = GetStringOrNull(itemEl, "categoria");

                    if (string.IsNullOrWhiteSpace(analise))
                    {
                        erros.Add($"{descricao} - {pergunta}: resposta obrigatória não preenchida.");
                        continue;
                    }

                    if (!string.Equals(analise, "conforme", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(analise, "nao_conforme", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(analise, "nao_se_aplica", StringComparison.OrdinalIgnoreCase))
                    {
                        erros.Add($"{descricao} - {pergunta}: resposta inválida.");
                        continue;
                    }

                    if (string.Equals(analise, "nao_conforme", StringComparison.OrdinalIgnoreCase) &&
                        string.IsNullOrWhiteSpace(categoria))
                    {
                        erros.Add($"{descricao} - {pergunta}: categoria obrigatória para não conformidade.");
                    }
                }
            }

            if (erros.Count > 0)
                throw new InvalidOperationException(string.Join(" ", erros.Take(5)));
        }

        private static void ValidarMarcosObrigatorios(JsonElement marcosEl)
        {
            var erros = new List<string>();
            var indice = 0;

            foreach (var marcoEl in marcosEl.EnumerateArray())
            {
                indice++;
                var nome = GetScalarTextOrNull(marcoEl, "nome") ?? GetScalarTextOrNull(marcoEl, "fase") ?? $"Marco {indice}";
                var dataInicio = GetScalarTextOrNull(marcoEl, "data_inicio");
                var dataFim = GetScalarTextOrNull(marcoEl, "data_fim");
                var duracao = GetScalarTextOrNull(marcoEl, "tempo_dias") ?? GetScalarTextOrNull(marcoEl, "duracao");

                if (string.IsNullOrWhiteSpace(nome))
                    erros.Add($"Marco {indice}: fase obrigatória.");

                if (string.IsNullOrWhiteSpace(dataInicio))
                    erros.Add($"{nome}: data inicial obrigatória.");

                if (string.IsNullOrWhiteSpace(dataFim))
                    erros.Add($"{nome}: data final obrigatória.");

                if (string.IsNullOrWhiteSpace(duracao))
                    erros.Add($"{nome}: duração obrigatória.");
            }

            if (erros.Count > 0)
                throw new InvalidOperationException(string.Join(" ", erros.Take(5)));
        }

        public async Task<Checklist> CriarChecklistAsync(int processoId, Dictionary<string, object?> dados, int? criadoPorUsuarioId = null, string? criadoPorNome = null)
        {
            if (processoId <= 0)
                throw new InvalidOperationException("Processo inválido");

            var processoExiste = await _db.Processos.AsNoTracking().AnyAsync(p => p.Id == processoId);
            if (!processoExiste)
                throw new InvalidOperationException("Processo não encontrado");

            var competenciasObj = dados.GetValueOrDefault("competencias");
            string competenciaFinal;

            if (competenciasObj is JsonElement compEl)
            {
                if (compEl.ValueKind == JsonValueKind.Array)
                {
                    var partes = compEl
                        .EnumerateArray()
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))!;
                    competenciaFinal = string.Join(", ", partes);
                }
                else
                {
                    competenciaFinal = compEl.GetString() ?? string.Empty;
                }
            }
            else if (competenciasObj is IEnumerable<string> lista)
            {
                competenciaFinal = string.Join(", ", lista.Where(c => !string.IsNullOrWhiteSpace(c)));
            }
            else
            {
                competenciaFinal = Convert.ToString(competenciasObj) ?? string.Empty;
            }

            var dataCriacaoStr = Convert.ToString(dados.GetValueOrDefault("data_criacao"));
            var dataCriacao = ParseDateOnlyOrNull(dataCriacaoStr);
            if (!dataCriacao.HasValue)
            {
                dataCriacao = DateTime.Now.Date;
            }

            var checklist = new Checklist
            {
                ProcessoId = processoId,
                Modalidade = Convert.ToString(dados.GetValueOrDefault("modalidade")) ?? string.Empty,
                Tipo = Convert.ToString(dados.GetValueOrDefault("tipo")) ?? string.Empty,
                Status = NormalizeStatus(Convert.ToString(dados.GetValueOrDefault("status")) ?? "em_preenchimento"),
                DataCriacao = dataCriacao.Value,
                Competencia = competenciaFinal,
                CriadoPorUsuarioId = criadoPorUsuarioId,
                CriadoPorNome = string.IsNullOrWhiteSpace(criadoPorNome) ? null : criadoPorNome.Trim()
            };

            _db.Checklists.Add(checklist);

            // Processar perguntas (elementos e itens), se vierem no payload
            if (dados.TryGetValue("perguntas", out var perguntasObj) &&
                perguntasObj is JsonElement perguntasEl &&
                perguntasEl.ValueKind == JsonValueKind.Array)
            {
                if (StatusExigeConclusao(checklist.Status))
                {
                    ValidarPerguntasObrigatorias(perguntasEl);
                }

                foreach (var perguntaEl in perguntasEl.EnumerateArray())
                {
                    var titulo = perguntaEl.TryGetProperty("titulo", out var tEl)
                        ? tEl.GetString() ?? string.Empty
                        : string.Empty;

                    DateTime dataElemento = DateTime.Now.Date;
                    if (perguntaEl.TryGetProperty("date", out var dEl) &&
                        dEl.ValueKind == JsonValueKind.String)
                    {
                        var dateStr = dEl.GetString();
                        var parsed = ParseDateOnlyOrNull(dateStr);
                        if (parsed.HasValue)
                        {
                            dataElemento = parsed.Value;
                        }
                    }

                    string? nup = null;
                    if (perguntaEl.TryGetProperty("nup", out var nupEl) &&
                        nupEl.ValueKind == JsonValueKind.String)
                    {
                        nup = nupEl.GetString();
                    }

                    var elemento = new Elemento
                    {
                        Checklist = checklist,
                        Tipo = "pergunta",
                        ElementoNome = titulo,
                        DataElemento = dataElemento,
                        Nup = nup
                    };
                    _db.Elementos.Add(elemento);

                    if (perguntaEl.TryGetProperty("subPerguntas", out var subsEl) &&
                        subsEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var subEl in subsEl.EnumerateArray())
                        {
                            var perguntaTexto = subEl.TryGetProperty("pergunta", out var pEl)
                                ? pEl.GetString() ?? string.Empty
                                : string.Empty;
                            var analise = subEl.TryGetProperty("resposta", out var rEl)
                                ? rEl.GetString()
                                : null;
                            var categoria = subEl.TryGetProperty("categoria", out var cEl)
                                ? NormalizarCategoriaNaoConformidade(cEl.GetString())
                                : null;
                            var justificativa = subEl.TryGetProperty("justificativa", out var jEl)
                                ? jEl.GetString()
                                : null;

                            var item = new Item
                            {
                                Checklist = checklist,
                                Elemento = elemento,
                                Pergunta = perguntaTexto,
                                Analise = analise,
                                Categoria = categoria,
                                Justificativa = justificativa
                            };
                            _db.Itens.Add(item);
                        }
                    }
                }
            }

            // Processar marcos (crono_analise), se vierem no payload
            if (dados.TryGetValue("marcos", out var marcosObj) &&
                marcosObj is JsonElement marcosEl &&
                marcosEl.ValueKind == JsonValueKind.Array)
            {
                if (StatusExigeConclusao(checklist.Status))
                {
                    ValidarMarcosObrigatorios(marcosEl);
                }

                foreach (var marcoEl in marcosEl.EnumerateArray())
                {
                    var fase = marcoEl.TryGetProperty("nome", out var fEl)
                        ? fEl.GetString() ?? string.Empty
                        : string.Empty;

                    DateTime? dataInicio = null;
                    DateTime? dataFim = null;
                    int? duracao = null;

                    if (marcoEl.TryGetProperty("data_inicio", out var diEl) &&
                        diEl.ValueKind == JsonValueKind.String)
                    {
                        var s = diEl.GetString();
                        var parsedInicio = ParseDateOnlyOrNull(s);
                        if (parsedInicio.HasValue)
                        {
                            dataInicio = parsedInicio.Value;
                        }
                    }

                    if (marcoEl.TryGetProperty("data_fim", out var dfEl) &&
                        dfEl.ValueKind == JsonValueKind.String)
                    {
                        var s = dfEl.GetString();
                        var parsedFim = ParseDateOnlyOrNull(s);
                        if (parsedFim.HasValue)
                        {
                            dataFim = parsedFim.Value;
                        }
                    }

                    if (marcoEl.TryGetProperty("tempo_dias", out var durEl))
                    {
                        if (durEl.ValueKind == JsonValueKind.Number && durEl.TryGetInt32(out var d))
                        {
                            duracao = d;
                        }
                        else if (durEl.ValueKind == JsonValueKind.String &&
                                 int.TryParse(durEl.GetString(), out var d2))
                        {
                            duracao = d2;
                        }
                    }

                    if (!duracao.HasValue && dataInicio.HasValue && dataFim.HasValue)
                    {
                        duracao = CalcularDuracaoDias(dataInicio.Value, dataFim.Value);
                    }

                    var crono = new CronoAnalise
                    {
                        Checklist = checklist,
                        Fase = fase,
                        DataInicio = dataInicio,
                        DataFim = dataFim,
                        Duracao = duracao,
                        Observacoes = null
                    };
                    _db.CronoAnalises.Add(crono);
                }
            }

            await _db.SaveChangesAsync();
            return checklist;
        }

        public async Task<Checklist> BuscarPorIdAsync(int id)
        {
            var checklist = await _db.Checklists
                .Include(c => c.Processo)
                .Include(c => c.Elementos)
                .Include(c => c.Itens)
                .Include(c => c.CronoAnalises)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (checklist == null)
                throw new InvalidOperationException("Checklist não encontrado");

            return checklist;
        }

        public async Task<List<Checklist>> ListarAsync(int? processoId = null)
        {
            var query = _db.Checklists
                .Include(c => c.Processo)
                .AsQueryable();

            if (processoId.HasValue)
                query = query.Where(c => c.ProcessoId == processoId.Value);

            return await query.ToListAsync();
        }

        public async Task<Checklist> AtualizarChecklistAsync(int id, Dictionary<string, object?> dados)
        {
            var checklist = await _db.Checklists
                .AsTracking()
                .Include(c => c.Elementos)
                .Include(c => c.Itens)
                .Include(c => c.CronoAnalises)
                .FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new InvalidOperationException("Checklist não encontrado");

            string? statusSolicitado = null;
            if (dados.TryGetValue("status", out var statusObj) && statusObj is string statusStr)
            {
                statusSolicitado = NormalizeStatus(statusStr);
                checklist.Status = statusSolicitado;
            }

            if (dados.TryGetValue("competencia", out var compObj) && compObj is string compStr)
            {
                checklist.Competencia = compStr;
            }

            if (dados.TryGetValue("data_criacao", out var dataCriacaoObj))
            {
                var dataCriacaoStr = Convert.ToString(dataCriacaoObj);
                var dataCriacao = ParseDateOnlyOrNull(dataCriacaoStr);
                if (dataCriacao.HasValue)
                {
                    checklist.DataCriacao = dataCriacao.Value;
                }
            }

            // Atualizar elementos e itens a partir do payload de edição
            if (dados.TryGetValue("elementos", out var elementosObj) && elementosObj is JsonElement elementosEl &&
                elementosEl.ValueKind == JsonValueKind.Array)
            {
                if (StatusExigeConclusao(checklist.Status))
                {
                    ValidarItensObrigatoriosEdicao(elementosEl);
                }

                foreach (var elementoEl in elementosEl.EnumerateArray())
                {
                    var descricaoElemento = elementoEl.TryGetProperty("descricao", out var descEl)
                        ? descEl.GetString() ?? string.Empty
                        : string.Empty;

                    var elementoId = TryGetId(elementoEl, "id", "elemento_id", "elementoId");
                    var descricaoKey = NormalizeKey(descricaoElemento);

                    Elemento? elementoDb = null;
                    if (elementoId.HasValue)
                    {
                        elementoDb = checklist.Elementos.FirstOrDefault(e => e.Id == elementoId.Value);
                    }

                    if (elementoDb == null && !string.IsNullOrWhiteSpace(descricaoKey))
                    {
                        elementoDb = checklist.Elementos.FirstOrDefault(e =>
                            string.Equals(NormalizeKey(e.ElementoNome), descricaoKey, StringComparison.OrdinalIgnoreCase));
                    }

                    if (elementoDb == null)
                        continue;

                    if (elementoEl.TryGetProperty("nup", out var nupEl) && nupEl.ValueKind == JsonValueKind.String)
                    {
                        var nup = nupEl.GetString();
                        elementoDb.Nup = string.IsNullOrWhiteSpace(nup) ? null : nup;
                    }

                    if (elementoEl.TryGetProperty("data_elemento", out var dataEl) && dataEl.ValueKind == JsonValueKind.String)
                    {
                        var dataStr = dataEl.GetString();
                        var data = ParseDateOnlyOrNull(dataStr);
                        if (data.HasValue)
                        {
                            elementoDb.DataElemento = data.Value;
                        }
                    }

                    if (elementoEl.TryGetProperty("itens", out var itensEl) && itensEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var itemEl in itensEl.EnumerateArray())
                        {
                            var perguntaTexto = itemEl.TryGetProperty("descricao", out var pEl)
                                ? pEl.GetString() ?? string.Empty
                                : string.Empty;
                            var perguntaKey = NormalizeKey(perguntaTexto);

                            var itemId = TryGetId(itemEl, "id", "item_id", "itemId");
                            Item? itemDb = null;
                            if (itemId.HasValue)
                            {
                                itemDb = checklist.Itens.FirstOrDefault(i => i.Id == itemId.Value);
                                if (itemDb != null && itemDb.ElementoId != elementoDb.Id)
                                {
                                    itemDb = null;
                                }
                            }

                            if (itemDb == null && !string.IsNullOrWhiteSpace(perguntaKey))
                            {
                                itemDb = checklist.Itens.FirstOrDefault(i =>
                                    i.ElementoId == elementoDb.Id &&
                                    string.Equals(NormalizeKey(i.Pergunta), perguntaKey, StringComparison.OrdinalIgnoreCase));
                            }

                            if (itemDb == null)
                                continue;

                            string? analise = null;
                            if (itemEl.TryGetProperty("analise", out var aEl) &&
                                aEl.ValueKind == JsonValueKind.String)
                            {
                                analise = aEl.GetString();
                            }

                            string? justificativa = null;
                            if (itemEl.TryGetProperty("justificativa", out var jEl) &&
                                jEl.ValueKind == JsonValueKind.String)
                            {
                                justificativa = jEl.GetString();
                            }

                            string? categoria = null;
                            if (itemEl.TryGetProperty("categoria", out var cEl) &&
                                cEl.ValueKind == JsonValueKind.String)
                            {
                                categoria = NormalizarCategoriaNaoConformidade(cEl.GetString());
                            }

                            itemDb.Analise = string.IsNullOrWhiteSpace(analise) ? null : analise;
                            itemDb.Categoria = string.IsNullOrWhiteSpace(categoria) ? null : categoria;
                            itemDb.Justificativa = string.IsNullOrWhiteSpace(justificativa) ? null : justificativa;
                        }
                    }
                }
            }

            // Atualizar cronoanálises
            if (dados.TryGetValue("crono_analises", out var cronoObj) && cronoObj is JsonElement cronoEl &&
                cronoEl.ValueKind == JsonValueKind.Array)
            {
                if (StatusExigeConclusao(checklist.Status))
                {
                    ValidarMarcosObrigatorios(cronoEl);
                }

                foreach (var cronoItemEl in cronoEl.EnumerateArray())
                {
                    int idCrono = 0;
                    if (cronoItemEl.TryGetProperty("id", out var idEl))
                    {
                        if (idEl.ValueKind == JsonValueKind.Number)
                            idCrono = idEl.GetInt32();
                        else if (idEl.ValueKind == JsonValueKind.String &&
                                 int.TryParse(idEl.GetString(), out var parsedId))
                            idCrono = parsedId;
                    }

                    var fase = cronoItemEl.TryGetProperty("fase", out var faseEl)
                        ? faseEl.GetString() ?? string.Empty
                        : string.Empty;

                    var cronoDb = checklist.CronoAnalises.FirstOrDefault(c => c.Id == idCrono);
                    if (cronoDb == null)
                    {
                        if (string.IsNullOrWhiteSpace(fase))
                            continue;

                        cronoDb = new CronoAnalise
                        {
                            ChecklistId = checklist.Id,
                            Fase = fase
                        };
                        _db.CronoAnalises.Add(cronoDb);
                        checklist.CronoAnalises.Add(cronoDb);
                    }

                    cronoDb.Fase = fase;

                    if (cronoItemEl.TryGetProperty("data_inicio", out var diEl) &&
                        diEl.ValueKind == JsonValueKind.String)
                    {
                        var diStr = diEl.GetString();
                        var di = ParseDateOnlyOrNull(diStr);
                        if (di.HasValue)
                        {
                            cronoDb.DataInicio = di.Value;
                        }
                    }

                    if (cronoItemEl.TryGetProperty("data_fim", out var dfEl) &&
                        dfEl.ValueKind == JsonValueKind.String)
                    {
                        var dfStr = dfEl.GetString();
                        var df = ParseDateOnlyOrNull(dfStr);
                        if (df.HasValue)
                        {
                            cronoDb.DataFim = df.Value;
                        }
                    }

                    if (cronoItemEl.TryGetProperty("duracao", out var durEl))
                    {
                        int duracao = 0;
                        if (durEl.ValueKind == JsonValueKind.Number)
                        {
                            duracao = durEl.GetInt32();
                        }
                        else if (durEl.ValueKind == JsonValueKind.String &&
                                 int.TryParse(durEl.GetString(), out var durParsed))
                        {
                            duracao = durParsed;
                        }

                        if (duracao <= 0 && cronoDb.DataInicio.HasValue && cronoDb.DataFim.HasValue)
                        {
                            duracao = CalcularDuracaoDias(cronoDb.DataInicio.Value, cronoDb.DataFim.Value);
                        }

                        if (duracao < 0)
                            duracao = 0;

                        cronoDb.Duracao = duracao;
                    }

                    if (cronoItemEl.TryGetProperty("observacoes", out var obsEl) &&
                        obsEl.ValueKind == JsonValueKind.String)
                    {
                        cronoDb.Observacoes = obsEl.GetString();
                    }
                }
            }

            if (string.Equals(statusSolicitado, "concluido", StringComparison.OrdinalIgnoreCase))
            {
                if (!ChecklistEstaCompleto(checklist))
                    throw new InvalidOperationException("O checklist nao pode ser concluido enquanto houver respostas, dados de elemento ou marcos obrigatorios pendentes.");

                checklist.Status = "concluido";
            }
            else if (string.Equals(statusSolicitado, "em_preenchimento", StringComparison.OrdinalIgnoreCase))
            {
                checklist.Status = "em_preenchimento";
            }

            await _db.SaveChangesAsync();
            return checklist;
        }

        public async Task<int> NormalizarChecklistsCompletosAsync()
        {
            var checklists = await _db.Checklists
                .Include(c => c.Elementos)
                .Include(c => c.Itens)
                .Include(c => c.CronoAnalises)
                .ToListAsync();

            var alterados = 0;

            foreach (var checklist in checklists)
            {
                var statusAtual = NormalizeStatus(checklist.Status);
                if (statusAtual == "concluido")
                    continue;

                if (!ChecklistEstaCompleto(checklist))
                    continue;

                checklist.Status = "concluido";
                alterados++;
            }

            if (alterados > 0)
            {
                await _db.SaveChangesAsync();
            }

            return alterados;
        }

        public async Task<Elemento> AdicionarElementoAsync(int checklistId, Dictionary<string, string?> dados)
        {
            var checklistExists = await _db.Checklists.AsNoTracking()
                .AnyAsync(c => c.Id == checklistId);
            if (!checklistExists)
                throw new InvalidOperationException("Checklist nao encontrado");

            var elemento = new Elemento
            {
                ChecklistId = checklistId,
                Tipo = dados.GetValueOrDefault("tipo") ?? string.Empty,
                ElementoNome = dados.GetValueOrDefault("elemento") ?? string.Empty
            };

            var dataStr = dados.GetValueOrDefault("data_elemento");
            var data = ParseDateOnlyOrNull(dataStr);
            if (data.HasValue)
            {
                elemento.DataElemento = data.Value;
            }

            elemento.Nup = dados.GetValueOrDefault("nup");

            _db.Elementos.Add(elemento);
            await _db.SaveChangesAsync();
            return elemento;
        }

        public async Task<Item> AdicionarItemAsync(int checklistId, int elementoId, Dictionary<string, string?> dados)
        {
            var elemento = await _db.Elementos.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == elementoId && e.ChecklistId == checklistId);
            if (elemento == null)
                throw new InvalidOperationException("Elemento invalido para checklist");

            var item = new Item
            {
                ChecklistId = checklistId,
                ElementoId = elementoId,
                Pergunta = dados.GetValueOrDefault("pergunta") ?? string.Empty,
                Analise = dados.GetValueOrDefault("analise"),
                Categoria = dados.GetValueOrDefault("categoria"),
                Justificativa = dados.GetValueOrDefault("justificativa")
            };

            _db.Itens.Add(item);
            await _db.SaveChangesAsync();
            return item;
        }

        public async Task<CronoAnalise> AdicionarCronoAnaliseAsync(int checklistId, Dictionary<string, string?> dados)
        {
            var checklistExists = await _db.Checklists.AsNoTracking()
                .AnyAsync(c => c.Id == checklistId);
            if (!checklistExists)
                throw new InvalidOperationException("Checklist nao encontrado");

            var crono = new CronoAnalise
            {
                ChecklistId = checklistId,
                Fase = dados.GetValueOrDefault("fase") ?? string.Empty
            };

            var di = ParseDateOnlyOrNull(dados.GetValueOrDefault("data_inicio"));
            if (di.HasValue)
                crono.DataInicio = di.Value;
            var df = ParseDateOnlyOrNull(dados.GetValueOrDefault("data_fim"));
            if (df.HasValue)
                crono.DataFim = df.Value;

            if (int.TryParse(dados.GetValueOrDefault("duracao"), out var dur))
                crono.Duracao = dur;

            if (!crono.Duracao.HasValue && crono.DataInicio.HasValue && crono.DataFim.HasValue)
                crono.Duracao = CalcularDuracaoDias(crono.DataInicio.Value, crono.DataFim.Value);

            crono.Observacoes = dados.GetValueOrDefault("observacoes");

            _db.CronoAnalises.Add(crono);
            await _db.SaveChangesAsync();
            return crono;
        }

        public async Task<(int totalChecklists, Dictionary<string, int> porStatus, Dictionary<string, int> porModalidade)>
            ObterEstatisticasAsync()
        {
            var total = await _db.Checklists.CountAsync();

            var porStatus = await _db.Checklists
                .GroupBy(c => c.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            var porModalidade = await _db.Checklists
                .GroupBy(c => c.Modalidade)
                .Select(g => new { Modalidade = g.Key, Count = g.Count() })
                .ToListAsync();

            return (
                total,
                porStatus.ToDictionary(x => x.Status, x => x.Count),
                porModalidade.ToDictionary(x => x.Modalidade, x => x.Count)
            );
        }

        public async Task<double> ObterTaxaConformidadeAsync(int checklistId)
        {
            var totalAvaliados = await _db.Itens.CountAsync(i =>
                i.ChecklistId == checklistId && (i.Analise == "conforme" || i.Analise == "nao_conforme"));
            if (totalAvaliados == 0)
                return 0.0;

            var conformes = await _db.Itens.CountAsync(i => i.ChecklistId == checklistId && i.Analise == "conforme");
            return (double)conformes / totalAvaliados * 100.0;
        }

        public async Task DeletarChecklistAsync(int checklistId)
        {
            var checklist = await _db.Checklists.FindAsync(checklistId)
                            ?? throw new InvalidOperationException("Checklist não encontrado");

            var itens = _db.Itens.Where(i => i.ChecklistId == checklistId);
            _db.Itens.RemoveRange(itens);

            var elementos = _db.Elementos.Where(e => e.ChecklistId == checklistId);
            _db.Elementos.RemoveRange(elementos);

            var crono = _db.CronoAnalises.Where(c => c.ChecklistId == checklistId);
            _db.CronoAnalises.RemoveRange(crono);

            _db.Checklists.Remove(checklist);
            await _db.SaveChangesAsync();
        }
    }
}
