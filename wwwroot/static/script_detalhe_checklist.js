(function () {
    const checklistId = Number(window.__CHECKLIST_ID__ || 0);
    const container = document.getElementById('checklistDetalheContainer');
    const btnImprimir = document.getElementById('btnImprimirChecklistPagina');

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        if (!container || checklistId <= 0) {
            return;
        }

        try {
            const checklist = await carregarChecklist(checklistId);
            window.dadosChecklistAtual = checklist;
            renderChecklistDetalhe(checklist);

            if (btnImprimir) {
                btnImprimir.addEventListener('click', () => {
                    if (typeof window.imprimirChecklistDetalhado === 'function') {
                        window.imprimirChecklistDetalhado(checklist);
                    }
                });
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Não foi possível carregar o checklist.')}</div>`;
        }
    }

    async function carregarChecklist(id) {
        const response = await fetch(`/api/checklists/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes do checklist.');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Erro ao carregar detalhes do checklist.');
        }

        const checklist = sanitizeDeep(data.checklist || {});
        checklist.elementos = Array.isArray(checklist.elementos) ? checklist.elementos : [];
        checklist.itens = Array.isArray(checklist.itens) ? checklist.itens : [];
        checklist.crono_analises = Array.isArray(checklist.crono_analises) ? checklist.crono_analises : [];

        let area = '-';
        let gestor = '-';
        let competencia = formatarCompetencias(checklist.competencia) || '-';

        if (checklist.processo_id) {
            const proc = await buscarDadosProcesso(checklist.processo_id);
            if (proc) {
                area = escapeHtml(proc.area || '-');
                gestor = escapeHtml(proc.gestor || '-');
                competencia = proc.competencia && proc.competencia.trim()
                    ? escapeHtml(formatarCompetencias(proc.competencia))
                    : (formatarCompetencias(checklist.competencia) || '-');
            }
        }

        checklist.__contexto = { area, gestor, competencia };
        return checklist;
    }

    async function buscarDadosProcesso(id) {
        try {
            const response = await fetch(`/api/processos/${id}`, { credentials: 'same-origin' });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.processo || data;
        } catch {
            return null;
        }
    }

    function renderChecklistDetalhe(checklist) {
        const { area, gestor, competencia } = checklist.__contexto || {};
        const totalItens = checklist.itens.length;
        const cntConforme = checklist.itens.filter((item) => item.analise === 'conforme').length;
        const cntNaoConforme = checklist.itens.filter((item) => item.analise === 'nao_conforme').length;
        const cntNA = checklist.itens.filter((item) => item.analise === 'nao_se_aplica').length;
        const taxaConf = totalItens ? ((cntConforme / totalItens) * 100) : 0;

        container.innerHTML = `
            <div class="checklist-detalhe-page">
                <div class="checklist-detalhe-head">
                    <div class="checklist-detalhe-head__title">
                        <h2>Checklist #${escapeHtml(checklist.id || '-')}</h2>
                        <div class="checklist-detalhe-head__badges">
                            <span class="status status-${formatarStatus(checklist.status)}">${escapeHtml(mapearResposta(checklist.status))}</span>
                            <span class="status ${formatarResultadoChecklist(checklist.resultado || inferirResultadoChecklist(checklist))}">${escapeHtml(mapearResultadoChecklist(checklist.resultado || inferirResultadoChecklist(checklist)))}</span>
                        </div>
                    </div>
                </div>

                <div class="checklist-detalhe-summary">
                    <div class="checklist-detalhe-summary__info">
                        <div><strong>Processo:</strong> ${checklist.numero_processo || '-'}</div>
                        <div><strong>Modalidade:</strong> ${mapearModalidade(checklist.modalidade) || '-'}</div>
                        <div><strong>Área:</strong> ${area || '-'}</div>
                        <div><strong>Gestor:</strong> ${gestor || '-'}</div>
                        <div><strong>Data de criação:</strong> ${formatarData(checklist.data_criacao) || '-'}</div>
                        <div><strong>Competências:</strong> ${competencia || '-'}</div>
                        <div><strong>Responsável pela Análise:</strong> ${checklist.criado_por_nome || 'Controle Interno - SEDE'}</div>
                    </div>
                    <div class="checklist-detalhe-kpis">
                        <div class="checklist-detalhe-kpi"><span>${cntConforme}</span><small>Conformes</small></div>
                        <div class="checklist-detalhe-kpi"><span>${cntNaoConforme}</span><small>Não conformes</small></div>
                        <div class="checklist-detalhe-kpi"><span>${cntNA}</span><small>Não se aplica</small></div>
                        <div class="checklist-detalhe-kpi"><span>${taxaConf.toFixed(1)}%</span><small>Taxa de conformidade</small></div>
                    </div>
                </div>

                <section class="checklist-detalhe-section">
                    <h3>Sumário Executivo</h3>
                    <div class="checklist-detalhe-box">
                        Este relatório consolida a verificação do processo ${checklist.numero_processo || '-'} (${mapearModalidade(checklist.modalidade) || '-'}) criado em ${formatarData(checklist.data_criacao) || '-'}. Foram avaliados ${totalItens} itens, com ${cntConforme} conformes, ${cntNaoConforme} não conformes e ${cntNA} não aplicáveis. A taxa de conformidade estimada é de ${taxaConf.toFixed(1)}%.
                    </div>
                </section>

                <section class="checklist-detalhe-section">
                    <h3>Tratativa das Não Conformidades</h3>
                    ${renderTratativaChecklist(checklist, cntNaoConforme)}
                </section>

                <section class="checklist-detalhe-section">
                    <h3>Registro de Não Conformidades</h3>
                    <div class="checklist-detalhe-list">
                        ${checklist.itens.filter((item) => item.analise === 'nao_conforme').map((item, idx) => `
                            <article class="checklist-detalhe-alerta">
                                <h4>${idx + 1}. ${item.pergunta || 'Item'}</h4>
                                <p>${item.justificativa || 'Sem justificativa informada.'}</p>
                            </article>
                        `).join('') || '<div class="checklist-detalhe-box checklist-detalhe-box--ok">Nenhuma não conformidade registrada.</div>'}
                    </div>
                </section>

                <section class="checklist-detalhe-section">
                    <h3>Detalhamento por Elemento</h3>
                    <div class="checklist-detalhe-elementos">
                        ${checklist.elementos.map((elemento) => {
                            const itensDoElemento = checklist.itens.filter((item) => item.elemento_id === elemento.id);
                            const nupFormatado = (!elemento.nup || elemento.nup === '0') ? 'N/A' : elemento.nup;

                            return `
                                <article class="checklist-detalhe-elemento">
                                    <header>
                                        <h4>${elemento.elemento || '-'}</h4>
                                        <span>Data: ${formatarData(elemento.data_elemento) || '-'} | NUP: ${nupFormatado}</span>
                                    </header>
                                    <div class="checklist-detalhe-elemento__lista">
                                        ${itensDoElemento.map((item) => `
                                            <div class="checklist-detalhe-item">
                                                <div><strong>Pergunta:</strong> ${item.pergunta || '-'}</div>
                                                <div><strong>Análise:</strong> <span class="item-status ${item.analise}">${mapearResposta(item.analise)}</span></div>
                                                ${item.justificativa ? `<div><strong>Justificativa:</strong> ${item.justificativa}</div>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </section>

                <section class="checklist-detalhe-section">
                    <h3>Análise Cronológica</h3>
                    <div class="checklist-detalhe-timeline">
                        ${checklist.crono_analises.map((crono) => `
                            <article class="checklist-detalhe-timeline__item">
                                <h4>${crono.fase || '-'}</h4>
                                <p>${formatarData(crono.data_inicio) || '-'} até ${formatarData(crono.data_fim) || '-'} | ${crono.duracao || 0} dias</p>
                                ${crono.observacoes ? `<span>${crono.observacoes}</span>` : ''}
                            </article>
                        `).join('')}
                    </div>
                </section>
            </div>
        `;

        injectStyles();
    }

    function renderTratativaChecklist(checklist, totalNaoConforme) {
        if (checklist.ajustes_confirmados && totalNaoConforme > 0) {
            return `
                <div class="checklist-detalhe-box checklist-detalhe-box--tratativa">
                    As correções informadas pelo gestor foram conferidas pelo Controle Interno.
                    Confirmação registrada por <strong>${checklist.ajustes_confirmados_por || 'usuário do sistema'}</strong>
                    em <strong>${formatarDataHora(checklist.ajustes_confirmados_em) || 'data não informada'}</strong>.
                    As não conformidades originais permanecem preservadas neste checklist para histórico e rastreabilidade.
                </div>
            `;
        }

        if (totalNaoConforme > 0) {
            return '<div class="checklist-detalhe-box checklist-detalhe-box--pendente">Este checklist possui não conformidades registradas e ainda não há confirmação formal de que as correções do gestor foram conferidas pelo Controle Interno.</div>';
        }

        return '<div class="checklist-detalhe-box checklist-detalhe-box--ok">Este checklist não possui não conformidades registradas, portanto não há tratativa pendente para confirmação.</div>';
    }

    function inferirResultadoChecklist(checklist) {
        const temNc = checklist.itens.some((item) => item.analise === 'nao_conforme');
        if (checklist.ajustes_confirmados && temNc) {
            return 'corrigido_pelo_gestor';
        }

        if (temNc) {
            return 'com_nao_conformidades';
        }

        return checklist.status === 'concluido' ? 'tudo_ok' : 'em_analise';
    }

    function mapearModalidade(valor) {
        const mapa = {
            'pedido-cotacao': 'Pedido de cotação',
            'ato-convocatorio': 'Ato convocatório',
            'dispensa': 'Dispensa',
            'inexigibilidade': 'Inexigibilidade'
        };
        const chave = String(valor || '').toLowerCase().trim();
        return mapa[chave] || (valor || '');
    }

    function formatarCompetencias(valor) {
        return String(valor || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .join(', ');
    }

    function mapearResposta(resposta) {
        switch ((resposta || '').toLowerCase()) {
            case 'conforme': return 'Conforme';
            case 'nao_conforme': return 'Não Conforme';
            case 'nao_se_aplica': return 'Não se Aplica';
            case 'em_preenchimento': return 'Em preenchimento';
            case 'concluido': return 'Concluído';
            default: return resposta || '-';
        }
    }

    function mapearResultadoChecklist(resultado) {
        switch ((resultado || '').toLowerCase()) {
            case 'tudo_ok': return 'Tudo ok';
            case 'com_nao_conformidades': return 'Com não conformidades';
            case 'corrigido_pelo_gestor': return 'Corrigido pelo gestor';
            default: return 'Em análise';
        }
    }

    function formatarResultadoChecklist(resultado) {
        switch ((resultado || '').toLowerCase()) {
            case 'tudo_ok': return 'resultado-tudo_ok';
            case 'com_nao_conformidades': return 'resultado-com_nao_conformidades';
            case 'corrigido_pelo_gestor': return 'resultado-corrigido_pelo_gestor';
            default: return 'resultado-em_analise';
        }
    }

    function formatarStatus(status) {
        const statusNormalizado = String(status || '').toLowerCase().replace(/\s+/g, '_');
        return statusNormalizado === 'concluido' ? 'concluido' : 'em_preenchimento';
    }

    function formatarData(data) {
        if (!data) return '';
        const texto = String(data).trim();
        const matchDataPura = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDataPura) {
            return `${matchDataPura[3]}/${matchDataPura[2]}/${matchDataPura[1]}`;
        }

        const valor = new Date(texto.includes('T') ? texto : texto.replace(' ', 'T'));
        return Number.isNaN(valor.getTime()) ? texto : valor.toLocaleDateString('pt-BR');
    }

    function formatarDataHora(data) {
        if (!data) return '';

        const valorOriginal = String(data).trim();
        if (!valorOriginal) return '';

        const normalizada = valorOriginal.includes('T')
            ? valorOriginal
            : valorOriginal.replace(' ', 'T');

        const valor = new Date(normalizada);
        if (Number.isNaN(valor.getTime())) return valorOriginal;

        return `${valor.toLocaleDateString('pt-BR')} ${valor.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeDeep(value) {
        if (typeof value === 'string') return escapeHtml(value);
        if (Array.isArray(value)) return value.map(sanitizeDeep);
        if (value && typeof value === 'object') {
            const result = {};
            Object.keys(value).forEach((key) => result[key] = sanitizeDeep(value[key]));
            return result;
        }
        return value;
    }

    function injectStyles() {
        if (document.getElementById('checklist-detalhe-page-style')) return;
        const style = document.createElement('style');
        style.id = 'checklist-detalhe-page-style';
        style.textContent = `
            .checklist-detalhe-page { display:grid; gap:18px; }
            .checklist-detalhe-head { border:1px solid rgba(0, 92, 160, 0.14); border-radius:20px; padding:18px 20px; background:linear-gradient(135deg, rgba(0, 92, 160, 0.10), rgba(0, 153, 204, 0.05)); box-shadow:0 18px 40px rgba(17,42,70,0.08); }
            .checklist-detalhe-head__title { display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap; }
            .checklist-detalhe-head__title h2 { margin:0; font-size:1.15rem; color:#0f172a; }
            .checklist-detalhe-head__badges { display:flex; gap:10px; flex-wrap:wrap; }
            .checklist-detalhe-summary { display:grid; grid-template-columns:1.3fr .9fr; gap:16px; }
            .checklist-detalhe-summary__info, .checklist-detalhe-box, .checklist-detalhe-elemento, .checklist-detalhe-timeline__item { background:#fff; border:1px solid rgba(0, 92, 160, 0.12); border-radius:16px; padding:16px; box-shadow:0 14px 30px rgba(15,23,42,0.05); }
            .checklist-detalhe-summary__info { display:grid; gap:8px; background:linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,255,1)); }
            .checklist-detalhe-kpis { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
            .checklist-detalhe-kpi { background:linear-gradient(180deg, rgba(255,255,255,1), rgba(243,248,255,1)); border:1px solid rgba(0, 92, 160, 0.12); border-radius:16px; padding:16px; text-align:center; box-shadow:0 14px 28px rgba(15,23,42,0.05); }
            .checklist-detalhe-kpi span { display:block; font-size:1.2rem; font-weight:800; color:#0f172a; }
            .checklist-detalhe-kpi small { color:#64748b; font-weight:700; }
            .checklist-detalhe-section { display:grid; gap:10px; }
            .checklist-detalhe-section h3 { margin:0; font-size:1rem; color:#0f172a; padding:10px 14px; border-radius:14px; background:linear-gradient(90deg, rgba(17,42,70,0.08), rgba(0,153,204,0.04)); }
            .checklist-detalhe-box { line-height:1.5; color:#334155; background:linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,255,1)); }
            .checklist-detalhe-box--ok { background:linear-gradient(180deg, #f8fbff, #eef6ff); }
            .checklist-detalhe-box--pendente { background:#fff7ed; border-color:#fdba74; color:#9a3412; }
            .checklist-detalhe-box--tratativa { background:#f5f3ff; border-color:#c4b5fd; color:#5b21b6; }
            .checklist-detalhe-list, .checklist-detalhe-elementos, .checklist-detalhe-timeline { display:grid; gap:12px; }
            .checklist-detalhe-alerta { background:#fff7f7; border:1px solid #fecaca; border-left:4px solid #ef4444; border-radius:12px; padding:14px; }
            .checklist-detalhe-alerta h4 { margin:0 0 6px; color:#991b1b; }
            .checklist-detalhe-alerta p { margin:0; color:#6b7280; }
            .checklist-detalhe-elemento { background:linear-gradient(180deg, rgba(255,255,255,1), rgba(246,250,255,1)); }
            .checklist-detalhe-elemento header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; }
            .checklist-detalhe-elemento header h4 { margin:0; color:#0f172a; }
            .checklist-detalhe-elemento header span { color:#64748b; font-size:.85rem; }
            .checklist-detalhe-elemento__lista { display:grid; gap:10px; }
            .checklist-detalhe-item { display:grid; gap:6px; padding:12px; border:1px solid rgba(0, 92, 160, 0.10); border-radius:12px; background:linear-gradient(180deg, #f8fafc, #f1f7ff); }
            .checklist-detalhe-timeline__item { background:linear-gradient(180deg, rgba(255,255,255,1), rgba(245,249,255,1)); }
            .checklist-detalhe-timeline__item h4 { margin:0 0 6px; }
            .checklist-detalhe-timeline__item p, .checklist-detalhe-timeline__item span { margin:0; color:#64748b; }
            .status { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:.78rem; font-weight:700; }
            .status-concluido { background:rgba(37,99,235,.12); color:#1d4ed8; }
            .status-em_preenchimento { background:rgba(245,158,11,.14); color:#b45309; }
            .resultado-tudo_ok { background:rgba(37,99,235,.12); color:#1d4ed8; }
            .resultado-com_nao_conformidades { background:rgba(220,38,38,.12); color:#dc2626; }
            .resultado-corrigido_pelo_gestor { background:rgba(124,58,237,.14); color:#6d28d9; border:1px solid rgba(99,102,241,.24); }
            .resultado-em_analise { background:rgba(245,158,11,.14); color:#b45309; }
            .item-status.conforme { color:#15803d; font-weight:800; }
            .item-status.nao_conforme { color:#b91c1c; font-weight:800; }
            .item-status.nao_se_aplica { color:#b45309; font-weight:800; }
            @media (max-width: 980px) { .checklist-detalhe-summary { grid-template-columns:1fr; } .checklist-detalhe-kpis { grid-template-columns:repeat(2,1fr); } }
            @media (max-width: 640px) { .checklist-detalhe-kpis { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(style);
    }

    window.imprimirChecklistDetalhado = async function imprimirChecklistDetalhado(checklist) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        try {
            const usuario = await buscarUsuarioLogado();
            const html = gerarHTMLImpressaoAGEVAP({
                checklist,
                area: checklist.__contexto?.area || '-',
                gestor: checklist.__contexto?.gestor || '-',
                competencia: checklist.__contexto?.competencia || '-',
                elementos: checklist.elementos || [],
                itens: checklist.itens || [],
                nomeUsuario: escapeHtml(usuario || 'Responsável')
            });

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 800);
            }, 300);
        } catch (error) {
            console.error(error);
            alert('Erro ao gerar a visualização para impressão.');
            document.body.removeChild(iframe);
        }
    };

    async function buscarUsuarioLogado() {
        try {
            const response = await fetch('/api/usuario-atual');
            if (!response.ok) return null;
            const data = await response.json();
            return data.usuario ? data.usuario.name : null;
        } catch {
            return null;
        }
    }

    function gerarHTMLImpressaoAGEVAP(ctx) {
        const { checklist, area, gestor, competencia, elementos, itens, nomeUsuario } = ctx;
        const baseUrl = window.location.origin;
        const logoAgevap = `${baseUrl}/static/logo_agevap.jpeg`;
        const logoAgedoce = `${baseUrl}/static/logo_agedoce.png`;
        const logoAgegrande = `${baseUrl}/static/logo_agegrande.png`;
        const logoAgegoias = `${baseUrl}/static/logo_agegoias.png`;
        const responsavelAnalise = escapeHtml(checklist.criado_por_nome || 'Controle Interno - SEDE');
        const itensNormalizados = (itens || []).map(i => ({
            ...i,
            analise_normalizada: String(i.analise || '').trim().toLowerCase()
        }));
        const itensAvaliados = itensNormalizados.filter(i => i.analise_normalizada === 'conforme' || i.analise_normalizada === 'nao_conforme');
        const itensPendentes = itensNormalizados.filter(i => !i.analise_normalizada);
        const itensImpressao = itensNormalizados.filter(i => i.analise_normalizada !== 'nao_se_aplica');
        const conf = itensAvaliados.filter(i => i.analise_normalizada === 'conforme').length;
        const nao = itensAvaliados.filter(i => i.analise_normalizada === 'nao_conforme').length;
        const totalConsiderados = conf + nao;
        const taxa = totalConsiderados ? ((conf / totalConsiderados) * 100).toFixed(1) : '0.0';
        const total = itensImpressao.length;
        const na = itensNormalizados.filter(i => i.analise_normalizada === 'nao_se_aplica').length;
        const totalElementos = (elementos || []).length;
        const elementosPorId = new Map((elementos || []).map(el => [el.id, el.elemento || '-']));
        const naoConformes = itensImpressao.filter(i => i.analise_normalizada === 'nao_conforme');
        const ncSection = naoConformes.length === 0
            ? '<div class="alert-ok">Nenhuma não conformidade registrada.</div>'
            : naoConformes.map(i => {
                const elementoNome = elementosPorId.get(i.elemento_id) || '-';
                const apontamento = i.justificativa
                    ? `<strong>Apontamento:</strong> ${i.justificativa}`
                    : '<strong>Apontamento:</strong> Sem apontamento informado.';
                return `<div class="nc-card"><div class="nc-title">${elementoNome}</div><div class="nc-just">${apontamento}</div></div>`;
            }).join('');
        const parecerTexto = itensPendentes.length > 0
            ? 'O checklist ainda está em preenchimento. Existem itens pendentes de resposta e o documento precisa ser concluído antes de representar um parecer final de conformidade.'
            : naoConformes.length > 0
                ? 'Recomendamos que o processo não prossiga neste momento, uma vez que foram identificadas não conformidades que demandam correção. Assim, será necessário realizar o ajuste do(s) apontamento(s) registrado(s) e, após a regularização, submeter novamente para nova verificação de conformidade e continuidade dos trâmites.'
                : 'Recomendamos o prosseguimento dos trâmites do processo, considerando que, após verificação, não foram identificadas não conformidades ou pendências impeditivas, estando a documentação e as informações apresentadas em conformidade.';
        const tratativaHtml = itensPendentes.length > 0
            ? '<div class="exec exec-pendente"><strong>Checklist em preenchimento.</strong> Existem itens sem resposta. Finalize o checklist para que a tratativa e o parecer reflitam o resultado definitivo.</div>'
            : checklist.ajustes_confirmados && naoConformes.length > 0
                ? `<div class="exec exec-tratativa"><strong>Tratativa registrada.</strong> As correções informadas pelo gestor foram conferidas pelo Controle Interno. Confirmação registrada por <strong>${checklist.ajustes_confirmados_por || 'usuário do sistema'}</strong> em <strong>${formatarDataHora(checklist.ajustes_confirmados_em) || 'data não informada'}</strong>. As não conformidades originais permanecem preservadas neste checklist para histórico e rastreabilidade.</div>`
                : naoConformes.length > 0
                    ? '<div class="exec exec-pendente"><strong>Tratativa pendente.</strong> Este checklist possui não conformidades registradas que deverão ser tratadas pelo setor responsável.</div>'
                    : '<div class="exec exec-ok"><strong>Sem tratativa pendente.</strong> Este checklist não possui não conformidades registradas, portanto não há tratativa pendente para confirmação.</div>';

        const elementosHTML = (elementos || []).map(el => {
            const its = itensImpressao.filter(it => it.elemento_id === el.id);
            const nupFmt = (!el.nup || el.nup === '0') ? 'N/A' : el.nup;
            if (!its.length) {
                return '';
            }
            const pendentesEl = its.filter(it => !it.analise_normalizada);
            const naoConformesEl = its.filter(it => it.analise_normalizada === 'nao_conforme');
            const isPendente = pendentesEl.length > 0;
            const isNaoConforme = naoConformesEl.length > 0;
            const statusClass = isPendente ? 'st-nao_se_aplica' : (isNaoConforme ? 'st-nao_conforme' : 'st-conforme');
            const statusTexto = isPendente ? 'Em preenchimento' : (isNaoConforme ? 'Não Conforme' : 'Conforme');
            const apontamentos = naoConformesEl.map(it => it.justificativa).filter(Boolean).join('<br>');
            const apontamentoHTML = isPendente
                ? `<div class="elem-apontamento"><strong>Pendências:</strong> ${pendentesEl.length} item(ns) sem resposta neste elemento.</div>`
                : isNaoConforme
                    ? `<div class="elem-apontamento"><strong>Apontamento:</strong> ${apontamentos || 'Sem apontamento informado.'}</div>`
                    : '';
            return `
          <div class="elem-card">
            <div class="elem-head">
              <div class="elem-title">${el.elemento || '-'}</div>
              <div class="elem-status"><span class="status-label">Status:</span> <span class="${statusClass}">${statusTexto}</span></div>
            </div>
            <div class="elem-meta"><strong>Data:</strong> ${formatarData(el.data_elemento) || '-'} \u00b7 <strong>NUP:</strong> ${nupFmt}</div>
            ${apontamentoHTML}
          </div>`;
        }).filter(Boolean).join('');

        return `<!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Checklist</title>
        <style>
          @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
          body { font-family: Segoe UI, Inter, Arial, sans-serif; color:#0f172a; background:#ffffff; }
          .logos { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom: 14px; padding:0 6px; }
          .logo-left { height: 34px; max-width: 150px; object-fit: contain; flex-shrink: 0; }
          .logo-right { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:nowrap; }
          .logo-divider { width:1px; height:30px; background:#cbd5e1; opacity:0.9; }
          .logo-right img { height: 30px; max-width: 104px; object-fit: contain; }
          .banner { background:linear-gradient(135deg, #0b3b91, #123f8d 55%, #173976); color:#fff; border-radius:18px; padding:14px 18px; font-weight:800; margin: 0 0 14px 0; text-align:left; letter-spacing: 0.4px; text-transform: uppercase; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
          .banner-inner { display:flex; align-items:center; gap:18px; }
          .banner-accent { width:13px; align-self:stretch; min-height:46px; border-radius:999px; background:linear-gradient(180deg, #4ec5ff, #2b8cff); box-shadow:0 0 0 1px rgba(255,255,255,0.14) inset; }
          .banner-text { font-size:16px; line-height:1.28; }
          .meta-card { border:1px solid #dbe7ff; border-radius:14px; padding:0; background:#ffffff; box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.22); overflow:hidden; }
          .grid { display:grid; grid-template-columns: 1.15fr 1.15fr 1.25fr 1.1fr 0.95fr; gap:0; align-items:stretch; }
          .cell { padding:10px 12px; background:#ffffff; min-height:54px; display:flex; position:relative; }
          .cell + .cell::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:1px; background:#dbe7ff; }
          .cell--row { grid-column:1 / -1; display:grid; grid-template-columns: 0.95fr 1.95fr; border-top:1px solid #dbe7ff; }
          .cell--row .cell { min-height:42px; padding:9px 12px; }
          .cell--row .cell::before { display:none; }
          .cell--row .cell + .cell::before { display:block; top:9px; bottom:9px; }
          .cell-head { display:flex; align-items:flex-start; gap:8px; width:100%; }
          .cell-icon { width:24px; height:24px; color:#1e4ea1; flex-shrink:0; margin-top:1px; }
          .cell-copy { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-start; }
          .label { font-size:8px; color:#36558f; font-weight:800; margin-bottom:2px; text-transform: uppercase; letter-spacing:0.04em; }
          .value { font-size:10px; color:#0f172a; font-weight:700; line-height:1.2; }
          .value--compact { font-size:9px; line-height:1.18; word-break:break-word; }
          .section-title { display:flex; align-items:center; gap:12px; background:linear-gradient(135deg, #334766, #44506a); color:#fff; font-weight:900; padding:10px 14px; border-radius:14px; margin: 18px 0 8px 0; text-align: left; }
          .section-title__icon { width:24px; height:24px; flex-shrink:0; }
          .exec { border:1px solid #e5e7eb; border-radius:12px; padding:12px; font-size:12px; color:#334155; line-height:1.5; }
          .exec strong { font-weight:800; }
          .exec-tratativa { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
          .exec-pendente { background:#fff7ed; border-color:#fed7aa; color:#b45309; }
          .exec-ok { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
          .alert-ok { border-left:4px solid #16a34a; background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:10px 12px; color:#14532d; }
          .nc-card { border-left:4px solid #b91c1c; background:#fff7f7; border:1px solid #fecaca; border-radius:12px; padding:10px 12px; margin:6px 0; }
          .nc-title { font-weight:800; color:#991b1b; font-size:12px; }
          .nc-just { font-size:12px; color:#6b7280; margin-top:4px; }
          .elem-card { border:1px solid #d1d5db; border-radius:12px; padding:12px; margin:10px 0; break-inside: avoid; page-break-inside: avoid; }
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
          .print-block-keep { break-inside: avoid; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="logos">
          <img class="logo-left" src="${logoAgevap}" alt="AGEVAP" onerror="this.style.display='none'" />
          <div class="logo-right">
            <span class="logo-divider" aria-hidden="true"></span>
            <img src="${logoAgedoce}" alt="AGEDOCE" onerror="this.style.display='none'" />
            <span class="logo-divider" aria-hidden="true"></span>
            <img src="${logoAgegrande}" alt="AGEGRANDE" onerror="this.style.display='none'" />
            <span class="logo-divider" aria-hidden="true"></span>
            <img src="${logoAgegoias}" alt="AGEGOIAS" onerror="this.style.display='none'" />
          </div>
        </div>
        <div class="banner">
          <div class="banner-inner">
            <span class="banner-accent" aria-hidden="true"></span>
            <div class="banner-text">RELATÓRIO DE CHECKLIST CONTROLE DE PROCESSOS - CONTROLE INTERNO AGEVAP</div>
          </div>
        </div>
        <div class="meta-card">
          <div class="grid">
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg><div class="cell-copy"><div class="label">Processo</div><div class="value">${checklist.numero_processo || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Gestor</div><div class="value">${gestor || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M10 7h7v7"/><path d="M7 7h3"/><path d="M14 14 7 21"/></svg><div class="cell-copy"><div class="label">Modalidade</div><div class="value">${mapearModalidade(checklist.modalidade) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg><div class="cell-copy"><div class="label">Data de Criação</div><div class="value">${formatarData(checklist.data_criacao) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 22h18"/><path d="M5 22V9l7-4 7 4v13"/><path d="M9 22V12h6v10"/><path d="M4 9h16"/></svg><div class="cell-copy"><div class="label">Área</div><div class="value">${area || '-'}</div></div></div></div>
            <div class="cell--row">
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Responsável pela Análise</div><div class="value">${responsavelAnalise}</div></div></div></div>
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/><path d="m6.5 10 .8.8 1.7-1.7"/><path d="m6.5 14 .8.8 1.7-1.7"/></svg><div class="cell-copy"><div class="label">Competências</div><div class="value value--compact">${competencia || '-'}</div></div></div></div>
            </div>
          </div>
        </div>
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/></svg><span>Sumário Executivo</span></div>
        <div class="exec">
        Este relatório apresenta uma análise qualitativa de conformidade do processo ${checklist.numero_processo || '-'}
        (${mapearModalidade(checklist.modalidade) || '-'}), com ${total} itens avaliados a partir de uma
        relação de ${totalElementos} documentos presentes no referido processo. Do total, ${conf} itens estão
        conformes, ${nao} não conformes, ${na} não se aplicam e ${itensPendentes.length} permanecem sem resposta, com uma taxa de ${taxa}% de conformidade sobre os itens efetivamente avaliados. As seções seguintes detalham os registros de não conformidade, o Status de conformidade por Documento e o Parecer do Controle Interno.
        </div>
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Tratativa das não conformidades</span></div>
        ${tratativaHtml}
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Registro de não conformidades</span></div>
        ${ncSection}
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg><span>Detalhamento por Elemento</span></div>
        ${elementosHTML}
        <div class="print-block-keep">
          <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z"/></svg><span>Parecer Controle Interno</span></div>
          <div class="exec">${parecerTexto}</div>
          <div class="footer">
            <div><strong>${nomeUsuario || 'Responsável'}</strong><br/>Controle Interno</div>
            <div>Data/Hora: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
          </div>
        </div>
      </body>
    </html>`;
    }
})();




