using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.Playwright;

namespace versaoCsharp.Services
{
    public sealed class ChecklistPdfService
    {
        private static readonly IReadOnlyDictionary<string, string> MapaModalidades = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["pedido-cotacao"] = "Pedido de cotacao",
            ["ato-convocatorio"] = "Ato convocatorio",
            ["dispensa"] = "Dispensa",
            ["inexigibilidade"] = "Inexigibilidade"
        };

        private static readonly IReadOnlyDictionary<string, string> MapaCompetencias = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ANA_036_25"] = "ANA 036/25",
            ["ANA_035_25"] = "ANA 035/25",
            ["ANA_027_20"] = "ANA 027/20",
            ["ANA_008_25"] = "ANA 008/25",
            ["INEA_069_22"] = "INEA 069/22",
            ["INEA_069_22_TRANSP"] = "INEA 069/22-TRANSP",
            ["INEA_068_22"] = "INEA 068/22",
            ["INEA_067_22"] = "INEA 067/22",
            ["IGAM_PS1_007_24"] = "IGAM PS1 007/24",
            ["IGAM_PS2_008_24"] = "IGAM PS2 008/24",
            ["IGAM_002_25"] = "IGAM 002/25",
            ["IGAM_005_24"] = "IGAM 005/24",
            ["ACT_003_25"] = "ACT 003/25",
            ["OUTRAS_FONTES"] = "Outras fontes"
        };

        public sealed record ChecklistPdfRequest(
            int ChecklistId,
            string NumeroProcesso,
            string Modalidade,
            string Area,
            string Gestor,
            string Competencia,
            string DataCriacao,
            string ResponsavelAnalise,
            bool AjustesConfirmados,
            string? AjustesConfirmadosPor,
            string? AjustesConfirmadosEm,
            IReadOnlyList<ChecklistPdfElemento> Elementos,
            IReadOnlyList<ChecklistPdfItem> Itens);

        public sealed record ChecklistPdfElemento(int Id, string Nome, string DataElemento, string Nup);
        public sealed record ChecklistPdfItem(int ElementoId, string Pergunta, string Analise, string? Justificativa);

        public async Task<byte[]> GerarChecklistPdfAsync(
            ChecklistPdfRequest request,
            string baseUrl,
            CancellationToken cancellationToken = default)
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true
            });

            var page = await browser.NewPageAsync(new BrowserNewPageOptions
            {
                ViewportSize = new ViewportSize { Width = 1280, Height = 1800 }
            });

            await page.SetContentAsync(GerarHtml(request), new PageSetContentOptions
            {
                WaitUntil = WaitUntilState.Load
            });

            return await page.PdfAsync(new PagePdfOptions
            {
                Format = "A4",
                PrintBackground = true,
                Margin = new Margin
                {
                    Top = "0",
                    Right = "0",
                    Bottom = "0",
                    Left = "0"
                }
            });
        }

        private static string GerarHtml(ChecklistPdfRequest request)
        {
            var modalidade = MapearModalidade(request.Modalidade);
            var competencia = FormatarCompetencias(request.Competencia);
            var area = string.IsNullOrWhiteSpace(request.Area) ? "-" : request.Area.Trim();
            var gestor = string.IsNullOrWhiteSpace(request.Gestor) ? "-" : request.Gestor.Trim();
            var responsavelAnalise = string.IsNullOrWhiteSpace(request.ResponsavelAnalise)
                ? "Controle Interno - SEDE"
                : request.ResponsavelAnalise.Trim();

            var itensNormalizados = request.Itens
                .Select(item => new
                {
                    item.ElementoId,
                    item.Pergunta,
                    Analise = NormalizarAnalise(item.Analise),
                    item.Justificativa
                })
                .ToList();

            var itensAvaliados = itensNormalizados
                .Where(i => i.Analise is "conforme" or "nao_conforme")
                .ToList();
            var itensPendentes = itensNormalizados
                .Where(i => string.IsNullOrWhiteSpace(i.Analise))
                .ToList();
            var itensImpressao = itensNormalizados
                .Where(i => i.Analise != "nao_se_aplica")
                .ToList();

            var naoSeAplica = itensNormalizados.Count(i => i.Analise == "nao_se_aplica");
            var conformes = itensAvaliados.Count(i => i.Analise == "conforme");
            var naoConformes = itensAvaliados.Count(i => i.Analise == "nao_conforme");
            var totalConsiderados = conformes + naoConformes;
            var taxa = totalConsiderados > 0
                ? ((double)conformes / totalConsiderados * 100d).ToString("0.0", CultureInfo.InvariantCulture)
                : "0.0";

            var elementosPorId = request.Elementos.ToDictionary(e => e.Id, e => e.Nome);
            var registrosNc = itensImpressao.Where(i => i.Analise == "nao_conforme").ToList();

            var registroNcHtml = registrosNc.Count == 0
                ? """<div class="alert-ok">Nenhuma nao conformidade registrada.</div>"""
                : string.Join("", registrosNc.Select(item =>
                {
                    var nomeElemento = elementosPorId.TryGetValue(item.ElementoId, out var nome) ? nome : "-";
                    var apontamento = string.IsNullOrWhiteSpace(item.Justificativa)
                        ? "<strong>Apontamento:</strong> Sem apontamento informado."
                        : $"<strong>Apontamento:</strong> {Html(item.Justificativa)}";
                    return $$"""
                    <div class="nc-card">
                      <div class="nc-title">{{Html(nomeElemento)}}</div>
                      <div class="nc-just">{{apontamento}}</div>
                    </div>
                    """;
                }));

            var tratativaHtml = itensPendentes.Count > 0
                ? """<div class="exec exec-pendente"><strong>Checklist em preenchimento.</strong> Existem itens sem resposta. Finalize o checklist para que a tratativa e o parecer reflitam o resultado definitivo.</div>"""
                : request.AjustesConfirmados && naoConformes > 0
                    ? $$"""<div class="exec exec-tratativa"><strong>Tratativa registrada.</strong> As correcoes informadas pelo gestor foram conferidas pelo Controle Interno. Confirmacao registrada por <strong>{{Html(request.AjustesConfirmadosPor ?? "usuario do sistema")}}</strong> em <strong>{{Html(request.AjustesConfirmadosEm ?? "data nao informada")}}</strong>. As nao conformidades originais permanecem preservadas neste checklist para historico e rastreabilidade.</div>"""
                    : naoConformes > 0
                        ? """<div class="exec exec-pendente"><strong>Tratativa pendente.</strong> Este checklist possui nao conformidades registradas que deverao ser tratadas pelo setor responsavel.</div>"""
                        : """<div class="exec exec-ok"><strong>Sem tratativa pendente.</strong> Este checklist nao possui nao conformidades registradas, portanto nao ha tratativa pendente para confirmacao.</div>""";

            var parecerTexto = itensPendentes.Count > 0
                ? "O checklist ainda esta em preenchimento. Existem itens pendentes de resposta e o documento precisa ser concluido antes de representar um parecer final de conformidade."
                : naoConformes > 0
                    ? "Recomendamos que o processo nao prossiga neste momento, uma vez que foram identificadas nao conformidades que demandam correcao. Assim, sera necessario realizar o ajuste do(s) apontamento(s) registrado(s) e, apos a regularizacao, submeter novamente para nova verificacao de conformidade e continuidade dos tramites."
                    : "Recomendamos o prosseguimento dos tramites do processo, considerando que, apos verificacao, nao foram identificadas nao conformidades ou pendencias impeditivas, estando a documentacao e as informacoes apresentadas em conformidade.";

            var elementosHtml = string.Join("", request.Elementos.Select(elemento =>
            {
                var itensElemento = itensImpressao.Where(i => i.ElementoId == elemento.Id).ToList();
                if (itensElemento.Count == 0)
                {
                    return string.Empty;
                }

                var pendentesElemento = itensElemento.Where(i => string.IsNullOrWhiteSpace(i.Analise)).ToList();
                var naoConformesElemento = itensElemento.Where(i => i.Analise == "nao_conforme").ToList();
                var isPendente = pendentesElemento.Count > 0;
                var isNaoConforme = naoConformesElemento.Count > 0;
                var statusClasse = isPendente ? "st-nao_se_aplica" : isNaoConforme ? "st-nao_conforme" : "st-conforme";
                var statusTexto = isPendente ? "Em preenchimento" : isNaoConforme ? "Nao Conforme" : "Conforme";
                var nup = string.IsNullOrWhiteSpace(elemento.Nup) || elemento.Nup == "0" ? "N/A" : elemento.Nup;
                var apontamentos = string.Join("<br>", naoConformesElemento
                    .Select(i => string.IsNullOrWhiteSpace(i.Justificativa) ? "Sem apontamento informado." : Html(i.Justificativa)));

                var apontamentoHtml = isPendente
                    ? $$"""<div class="elem-apontamento"><strong>Pendencias:</strong> {{pendentesElemento.Count}} item(ns) sem resposta neste elemento.</div>"""
                    : isNaoConforme
                        ? $$"""<div class="elem-apontamento"><strong>Apontamento:</strong> {{(string.IsNullOrWhiteSpace(apontamentos) ? "Sem apontamento informado." : apontamentos)}}</div>"""
                        : string.Empty;

                return $$"""
                <div class="elem-card">
                  <div class="elem-head">
                    <div class="elem-title">{{Html(elemento.Nome)}}</div>
                    <div class="elem-status"><span class="status-label">Status:</span> <span class="{{statusClasse}}">{{statusTexto}}</span></div>
                  </div>
                  <div class="elem-meta"><strong>Data:</strong> {{Html(elemento.DataElemento)}} · <strong>NUP:</strong> {{Html(nup)}}</div>
                  {{apontamentoHtml}}
                </div>
                """;
            }));

            var logoAgevap = ObterLogoDataUri("logo_agevap.jpeg");
            var logoAgedoce = ObterLogoDataUri("logo_agedoce.png");
            var logoAgegrande = ObterLogoDataUri("logo_agegrande.png");
            var logoAgegoias = ObterLogoDataUri("logo_agegoias.png");

            return $$"""
            <!DOCTYPE html>
            <html lang="pt-BR">
              <head>
                <meta charset="utf-8">
                <title>Relatorio de Checklist</title>
                <style>
                  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
                  body { font-family: Segoe UI, Arial, sans-serif; color:#0f172a; background:#ffffff; }
                  .logos { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; padding:0 6px; }
                  .logo-left { height:34px; max-width:150px; object-fit:contain; flex-shrink:0; }
                  .logo-right { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:nowrap; }
                  .logo-divider { width:1px; height:30px; background:#cbd5e1; opacity:0.9; }
                  .logo-right img { height:30px; max-width:104px; object-fit:contain; }
                  .banner { background:linear-gradient(135deg, #0b3b91, #123f8d 55%, #173976); color:#fff; border-radius:18px; padding:14px 18px; font-weight:800; margin:0 0 14px 0; text-align:left; letter-spacing:0.4px; text-transform:uppercase; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08); }
                  .banner-inner { display:flex; align-items:center; gap:18px; }
                  .banner-accent { width:13px; align-self:stretch; min-height:46px; border-radius:999px; background:linear-gradient(180deg, #4ec5ff, #2b8cff); box-shadow:0 0 0 1px rgba(255,255,255,0.14) inset; }
                  .banner-text { font-size:16px; line-height:1.28; }
                  .meta-card { border:1px solid #dbe7ff; border-radius:14px; background:#ffffff; box-shadow:inset 0 0 0 1px rgba(191,219,254,0.22); overflow:hidden; }
                  .grid { display:grid; grid-template-columns:1.15fr 1.15fr 1.25fr 1.1fr 0.95fr; gap:0; align-items:stretch; }
                  .cell { padding:10px 12px; background:#ffffff; min-height:54px; display:flex; position:relative; }
                  .cell + .cell::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:1px; background:#dbe7ff; }
                  .cell--row { grid-column:1 / -1; display:grid; grid-template-columns:0.95fr 1.95fr; border-top:1px solid #dbe7ff; }
                  .cell--row .cell { min-height:42px; padding:9px 12px; }
                  .cell--row .cell::before { display:none; }
                  .cell--row .cell + .cell::before { display:block; top:9px; bottom:9px; }
                  .cell-head { display:flex; align-items:flex-start; gap:8px; width:100%; }
                  .cell-icon { width:24px; height:24px; color:#1e4ea1; flex-shrink:0; margin-top:1px; }
                  .cell-copy { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-start; }
                  .label { font-size:8px; color:#36558f; font-weight:800; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.04em; }
                  .value { font-size:10px; color:#0f172a; font-weight:700; line-height:1.2; }
                  .value--compact { font-size:9px; line-height:1.18; word-break:break-word; }
                  .section-title { display:flex; align-items:center; gap:12px; background:linear-gradient(135deg, #334766, #44506a); color:#fff; font-weight:900; padding:10px 14px; border-radius:14px; margin:18px 0 8px 0; text-align:left; font-size:13px; }
                  .exec { border:1px solid #e5e7eb; border-radius:12px; padding:12px; font-size:12px; color:#334155; line-height:1.55; }
                  .exec strong { font-weight:800; }
                  .exec-tratativa { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
                  .exec-pendente { background:#fff7ed; border-color:#fed7aa; color:#b45309; }
                  .exec-ok { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
                  .alert-ok { border-left:4px solid #16a34a; background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:10px 12px; color:#14532d; font-size:12px; }
                  .nc-card { border-left:4px solid #b91c1c; background:#fff7f7; border:1px solid #fecaca; border-radius:12px; padding:10px 12px; margin:6px 0; }
                  .nc-title { font-weight:800; color:#991b1b; font-size:12px; }
                  .nc-just { font-size:12px; color:#6b7280; margin-top:4px; }
                  .elem-card { border:1px solid #d1d5db; border-radius:12px; padding:12px; margin:10px 0; break-inside:avoid; page-break-inside:avoid; }
                  .elem-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
                  .elem-title { font-weight:900; font-size:13px; margin:0; text-align:left; }
                  .elem-meta { font-size:11px; color:#64748b; margin-bottom:6px; }
                  .elem-status { font-size:11px; color:#0f172a; font-weight:700; }
                  .elem-apontamento { font-size:11px; color:#6b7280; margin-top:6px; }
                  .status-label { color:#475569; margin-right:6px; }
                  .st-conforme { color:#16a34a; }
                  .st-nao_conforme { color:#b91c1c; }
                  .st-nao_se_aplica { color:#d97706; }
                  .footer { border-top:1px solid #e5e7eb; margin-top:14px; padding-top:10px; display:flex; justify-content:space-between; align-items:flex-end; font-size:11px; color:#0d47a1; }
                  .print-block-keep { break-inside:avoid; page-break-inside:avoid; }
                </style>
              </head>
              <body>
                <div class="logos">
                  <img class="logo-left" src="{{logoAgevap}}" alt="AGEVAP">
                  <div class="logo-right">
                    <span class="logo-divider" aria-hidden="true"></span>
                    <img src="{{logoAgedoce}}" alt="AGEDOCE">
                    <span class="logo-divider" aria-hidden="true"></span>
                    <img src="{{logoAgegrande}}" alt="AGEGRANDE">
                    <span class="logo-divider" aria-hidden="true"></span>
                    <img src="{{logoAgegoias}}" alt="AGEGOIAS">
                  </div>
                </div>
                <div class="banner">
                  <div class="banner-inner">
                    <span class="banner-accent" aria-hidden="true"></span>
                    <div class="banner-text">RELATORIO DE CHECKLIST CONTROLE DE PROCESSOS - CONTROLE INTERNO AGEVAP</div>
                  </div>
                </div>
                <div class="meta-card">
                  <div class="grid">
                    <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path><path d="M14 3v6h6"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></svg><div class="cell-copy"><div class="label">Processo</div><div class="value">{{Html(request.NumeroProcesso)}}</div></div></div></div>
                    <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="8" r="4"></circle></svg><div class="cell-copy"><div class="label">Gestor</div><div class="value">{{Html(gestor)}}</div></div></div></div>
                    <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M10 7h7v7"></path><path d="M7 7h3"></path><path d="M14 14 7 21"></path></svg><div class="cell-copy"><div class="label">Modalidade</div><div class="value">{{Html(modalidade)}}</div></div></div></div>
                    <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg><div class="cell-copy"><div class="label">Data de Criacao</div><div class="value">{{Html(request.DataCriacao)}}</div></div></div></div>
                    <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 22h18"></path><path d="M5 22V9l7-4 7 4v13"></path><path d="M9 22V12h6v10"></path><path d="M4 9h16"></path></svg><div class="cell-copy"><div class="label">Area</div><div class="value">{{Html(area)}}</div></div></div></div>
                    <div class="cell--row">
                      <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="8" r="4"></circle></svg><div class="cell-copy"><div class="label">Responsavel pela Analise</div><div class="value">{{Html(responsavelAnalise)}}</div></div></div></div>
                      <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path><path d="m6.5 10 .8.8 1.7-1.7"></path><path d="m6.5 14 .8.8 1.7-1.7"></path></svg><div class="cell-copy"><div class="label">Competencias</div><div class="value value--compact">{{Html(competencia)}}</div></div></div></div>
                    </div>
                  </div>
                </div>
                <div class="section-title">Sumario Executivo</div>
                <div class="exec">
                  Este relatorio apresenta uma analise qualitativa de conformidade do processo {{Html(request.NumeroProcesso)}} ({{Html(modalidade)}}), com {{itensImpressao.Count}} itens avaliados a partir de uma relacao de {{request.Elementos.Count}} documentos presentes no referido processo. Do total, {{conformes}} itens estao conformes, {{naoConformes}} nao conformes, {{naoSeAplica}} nao se aplicam e {{itensPendentes.Count}} permanecem sem resposta, com uma taxa de {{taxa}}% de conformidade sobre os itens efetivamente avaliados. As secoes seguintes detalham os registros de nao conformidade, o status de conformidade por documento e o parecer do Controle Interno.
                </div>
                <div class="section-title">Tratativa das nao conformidades</div>
                {{tratativaHtml}}
                <div class="section-title">Registro de nao conformidades</div>
                {{registroNcHtml}}
                <div class="section-title">Detalhamento por Elemento</div>
                {{elementosHtml}}
                <div class="print-block-keep">
                  <div class="section-title">Parecer Controle Interno</div>
                  <div class="exec">{{Html(parecerTexto)}}</div>
                  <div class="footer">
                    <div><strong>{{Html(responsavelAnalise)}}</strong><br>Controle Interno</div>
                    <div>Data/Hora: {{DateTime.Now.ToString("dd/MM/yyyy HH:mm", new CultureInfo("pt-BR"))}}</div>
                  </div>
                </div>
              </body>
            </html>
            """;
        }

        private static string MapearModalidade(string? valor)
        {
            var chave = (valor ?? string.Empty).Trim();
            return MapaModalidades.TryGetValue(chave, out var descricao)
                ? descricao
                : chave;
        }

        private static string FormatarCompetencias(string? valor)
        {
            var lista = (valor ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Select(item => MapaCompetencias.TryGetValue(item, out var descricao) ? descricao : item);

            var formatado = string.Join(", ", lista);
            return string.IsNullOrWhiteSpace(formatado) ? "-" : formatado;
        }

        private static string ObterLogoDataUri(string fileName)
        {
            var path = Path.Combine(AppContext.BaseDirectory, "wwwroot", "static", fileName);
            if (!File.Exists(path))
            {
                return string.Empty;
            }

            var bytes = File.ReadAllBytes(path);
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            var mime = ext switch
            {
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".svg" => "image/svg+xml",
                _ => "application/octet-stream"
            };

            return $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
        }

        private static string NormalizarAnalise(string? valor)
        {
            return string.IsNullOrWhiteSpace(valor)
                ? string.Empty
                : valor.Trim().ToLowerInvariant();
        }

        private static string Html(string? value)
        {
            return WebUtility.HtmlEncode(value ?? "-");
        }
    }
}
