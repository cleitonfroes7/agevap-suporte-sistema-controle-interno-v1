(function () {
    const MAPA_TIPOS_CHECKLIST = {
        'gestor-unico': 'Gestor - Único',
        'ato-convocatorio-p1': 'Ato convocatório - P1',
        'ato-convocatorio-p2': 'Ato convocatório - P2',
        'ato-convocatorio-p3': 'Ato convocatório - P3',
        'pedido-cot-dispensa-p1': 'Pedido cot./dispensa - P1',
        'pedido-cot-dispensa-p2': 'Pedido cot./dispensa - P2',
        'pedido-cot-dispensa-p3': 'Pedido cot./dispensa - P3',
        'inexigibilidade-p1': 'Inexigibilidade - P1',
        'inexigibilidade-p2': 'Inexigibilidade - P2',
        'inexigibilidade-p3': 'Inexigibilidade - P3'
    };

    function mapearTipoChecklist(valor) {
        const chave = String(valor || '').toLowerCase().trim();
        return MAPA_TIPOS_CHECKLIST[chave] || (valor || '');
    }

    const checklistIdFromPage = Number(window.__CHECKLIST_ID__ || 0);
    const checklistSelect = document.getElementById('checklistSelect');
    const campoSelecaoChecklist = document.getElementById('campoSelecaoChecklist');
    const refs = {
        checklistId: document.getElementById('checklistId'),
        processo: document.getElementById('processo'),
        tipoChecklist: document.getElementById('tipoChecklist'),
        modalidade: document.getElementById('modalidade'),
        dataInicio: document.getElementById('dataInicio'),
        status: document.getElementById('status'),
        competencias: document.getElementById('competencias'),
        perguntas: document.getElementById('perguntasContainer'),
        crono: document.getElementById('cronoAnalisesContainer')
    };

    const categoriasNaoConformidade = [
        'Documentação incompleta',
        'Documento ausente',
        'Informação divergente',
        'Prazo não atendido',
        'Aprovação pendente',
        'Assinatura ausente',
        'Classificação incorreta',
        'Outro'
    ];

    function normalizarTextoComparacao(valor) {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function normalizarCategoriaNaoConformidade(valor) {
        const texto = String(valor || '').trim();
        if (!texto) {
            return '';
        }

        return categoriasNaoConformidade.find((categoria) =>
            normalizarTextoComparacao(categoria) === normalizarTextoComparacao(texto))
            || texto;
    }

    function obterOpcoesCategoria(categoriaAtual) {
        const categoriaNormalizada = normalizarCategoriaNaoConformidade(categoriaAtual);
        return categoriasNaoConformidade.includes(categoriaNormalizada)
            ? categoriasNaoConformidade
            : [...categoriasNaoConformidade, categoriaNormalizada];
    }
    const MARCADOR_APONTAMENTOS = '\n• ';

    let checklistAtual = null;

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        await carregarOpcoesChecklists();

        if (checklistIdFromPage > 0) {
            checklistSelect.value = String(checklistIdFromPage);
            campoSelecaoChecklist.style.display = 'none';
            await carregarChecklist(checklistIdFromPage);
            return;
        }

        checklistSelect.addEventListener('change', async function () {
            const id = Number(checklistSelect.value || 0);
            if (id > 0) {
                await carregarChecklist(id);
            }
        });
    }

    async function carregarOpcoesChecklists() {
        const response = await fetch('/api/checklists', { cache: 'no-store' });
        const data = await response.json();
        checklistSelect.innerHTML = '<option value="">Selecione um checklist</option>';

        data.forEach((checklist) => {
            const option = document.createElement('option');
            option.value = checklist.id;
            option.textContent = `#${checklist.id} - ${checklist.numero_processo || 'Sem processo'}`;
            checklistSelect.appendChild(option);
        });

        if (window.jQuery && typeof window.jQuery.fn.select2 === 'function') {
            window.jQuery(checklistSelect).select2({
                width: '100%',
                placeholder: 'Selecione um checklist'
            });
            window.jQuery(checklistSelect).on('change', async function () {
                const id = Number(checklistSelect.value || 0);
                if (id > 0) {
                    await carregarChecklist(id);
                }
            });
        }
    }

    async function carregarChecklist(id) {
        refs.perguntas.innerHTML = '<div class="empty-state">Carregando checklist...</div>';
        const response = await fetch(`/api/checklists/${id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Não foi possível carregar o checklist.');
        }

        checklistAtual = data.checklist;
        preencherCabecalho(checklistAtual);
        renderElementos(checklistAtual.elementos || [], checklistAtual.itens || [], checklistAtual.crono_analises || []);
    }

    function preencherCabecalho(checklist) {
        refs.checklistId.value = checklist.id || '';
        refs.processo.value = checklist.numero_processo || checklist.processo?.numero || '';
        refs.tipoChecklist.value = mapearTipoChecklist(checklist.tipo);
        refs.modalidade.value = checklist.modalidade || checklist.processo?.modalidade || '';
        refs.dataInicio.value = checklist.data_criacao ? String(checklist.data_criacao).slice(0, 10) : '';
        refs.status.value = checklist.status || 'em_preenchimento';
        refs.competencias.value = checklist.competencia || checklist.processo?.competencia || '';
    }

    function renderElementos(elementos, itens, cronos) {
        if (!elementos.length) {
            refs.perguntas.innerHTML = '<div class="empty-state">Este checklist não possui elementos cadastrados.</div>';
            return;
        }

        const elementosComItens = elementos.map((elemento) => ({
            ...elemento,
            __itens: itens.filter((item) => item.elemento_id === elemento.id)
        }));

        refs.perguntas.innerHTML = montarFluxoComCrono(
            elementosComItens,
            cronos,
            (elemento) => extrairItensDoElementoEdicao(elemento.__itens || []),
            (elemento) => renderElementoEdicao(elemento),
            (crono) => renderMarcoEdicao(crono)
        );

        bindRules();
    }

    function renderItem(item, itemIndex) {
        const analise = item.analise || '';
        const categoriaAtual = normalizarCategoriaNaoConformidade(item.categoria);
        const groupName = `analise_${item.id}`;
        const showNC = analise === 'nao_conforme';
        const permiteApontamentosExtras = aceitaApontamentosExtras(item.pergunta);
        const apontamentos = quebrarApontamentos(item.justificativa, permiteApontamentosExtras);
        return `
            <div class="question-card" data-item-id="${item.id}">
                <div class="question-card__main">
                    <div class="question-card__content">
                        <span class="question-card__index">${itemIndex + 1}</span>
                        <div class="question-card__text">
                            <label>${escapeHtml(item.pergunta || '')}</label>
                            <p class="question-card__hint">Selecione a classificação do item e detalhe somente se houver não conformidade.</p>
                        </div>
                    </div>
                    <div class="conformidade-options" role="radiogroup" aria-label="${escapeHtml(item.pergunta || '')}">
                        ${renderOpcaoAnalise(groupName, 'conforme', 'Conforme', analise)}
                        ${renderOpcaoAnalise(groupName, 'nao_conforme', 'Não conforme', analise)}
                        ${renderOpcaoAnalise(groupName, 'nao_se_aplica', 'Não se aplica', analise)}
                    </div>
                    <div class="justificativa js-justificativa-wrap ${showNC ? '' : 'is-disabled'}" ${showNC ? '' : 'hidden'}>
                        <div class="justificativa__field">
                            <label>${permiteApontamentosExtras ? 'Apontamentos complementares' : 'Justificativa / observação'}</label>
                            ${permiteApontamentosExtras
                                ? `
                                <div class="js-apontamentos-lista">
                                    ${apontamentos.map((apontamento, apontamentoIndex) => renderCampoApontamento(apontamento, apontamentoIndex > 0, showNC)).join('')}
                                </div>
                                <button type="button" class="btn btn-secondary btn-apontamento-extra js-add-apontamento" ${showNC ? '' : 'disabled'}>
                                    <i class="fas fa-plus"></i>
                                    Adicionar apontamento
                                </button>`
                                : `<textarea class="js-item-justificativa" placeholder="Explique ou complemente (opcional)." ${showNC ? '' : 'disabled'}>${escapeHtml(item.justificativa || '')}</textarea>`}
                        </div>
                        <div class="justificativa__field js-categoria-wrap" ${showNC ? '' : 'hidden'}>
                            <label>Categoria da não conformidade</label>
                            <select class="js-item-categoria" ${showNC ? '' : 'disabled'}>
                                <option value="">Selecione a categoria</option>
                                ${obterOpcoesCategoria(categoriaAtual).map((categoria) => `<option value="${escapeHtml(categoria)}" ${categoriaAtual === categoria ? 'selected' : ''}>${escapeHtml(categoria)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function aceitaApontamentosExtras(textoPergunta) {
        return /outros apontamentos/i.test(String(textoPergunta || ''));
    }

    function quebrarApontamentos(valor, permiteMultiplos) {
        const texto = String(valor || '').trim();
        if (!permiteMultiplos) {
            return [texto];
        }

        if (!texto) {
            return [''];
        }

        return texto.split(/\n•\s*/g).map((item) => item.trim()).filter(Boolean);
    }

    function renderCampoApontamento(valor, exibirRemover = false, habilitado = false) {
        return `
            <div class="apontamento-extra js-apontamento-extra-item">
                <textarea class="js-item-justificativa js-apontamento-extra" placeholder="Descreva o apontamento." ${habilitado ? '' : 'disabled'}>${escapeHtml(valor || '')}</textarea>
                ${exibirRemover ? `<button type="button" class="btn btn-secondary btn-apontamento-remover js-remove-apontamento" ${habilitado ? '' : 'disabled'}>Remover</button>` : ''}
            </div>
        `;
    }

    function renderOpcaoAnalise(groupName, valor, titulo, atual) {
        const css = valor === 'conforme' ? 'conforme' : valor === 'nao_conforme' ? 'nao-conforme' : 'nao-se-aplica';
        const icon = valor === 'conforme' ? '✓' : valor === 'nao_conforme' ? '×' : '−';
        return `
            <label class="conformidade-option conformidade-option--${css}">
                <input type="radio" name="${groupName}" value="${valor}" ${valor === atual ? 'checked' : ''}>
                <span class="conformidade-option__control" aria-hidden="true"></span>
                <span class="conformidade-option__icon" aria-hidden="true">${icon}</span>
                <span class="conformidade-option__label ${css}">${titulo}</span>
            </label>
        `;
    }

    function bindRules() {
        refs.perguntas.querySelectorAll('.question-card').forEach((card) => {
            card.querySelectorAll('input[type="radio"]').forEach((radio) => {
                radio.addEventListener('change', () => {
                    updateQuestionState(card);
                    const elementCard = card.closest('[data-elemento-id]');
                    if (elementCard) {
                        updateElementState(elementCard);
                    }
                });
            });

            card.querySelector('.js-add-apontamento')?.addEventListener('click', () => adicionarApontamento(card));
            card.querySelectorAll('.js-remove-apontamento').forEach((button) => {
                button.addEventListener('click', () => {
                    button.closest('.js-apontamento-extra-item')?.remove();
                });
            });

            updateQuestionState(card);
        });

        refs.perguntas.querySelectorAll('[data-elemento-id]').forEach(updateElementState);
        refs.perguntas.querySelectorAll('[data-crono-id]').forEach(vincularAutoCalculoCrono);
    }

    function vincularAutoCalculoCrono(cronoEl) {
        const inicioEl = cronoEl.querySelector('.js-crono-inicio');
        const fimEl = cronoEl.querySelector('.js-crono-fim');
        const duracaoEl = cronoEl.querySelector('.js-crono-duracao');
        if (!inicioEl || !fimEl || !duracaoEl) {
            return;
        }

        const recalcular = () => {
            const valor = calcularDuracaoDias(inicioEl.value, fimEl.value);
            if (valor !== null) {
                duracaoEl.value = String(valor);
            }
        };

        inicioEl.addEventListener('change', recalcular);
        fimEl.addEventListener('change', recalcular);

        if (!String(duracaoEl.value || '').trim()) {
            recalcular();
        }
    }

    function calcularDuracaoDias(dataInicio, dataFim) {
        if (!dataInicio || !dataFim) {
            return null;
        }

        const inicio = new Date(`${dataInicio}T00:00:00`);
        const fim = new Date(`${dataFim}T00:00:00`);
        if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
            return null;
        }

        const diffMs = fim.getTime() - inicio.getTime();
        const diffDias = Math.floor(diffMs / 86400000);
        return Math.max(0, diffDias);
    }

    function updateQuestionState(card) {
        const selected = card.querySelector('input[type="radio"]:checked')?.value || '';
        const wrap = card.querySelector('.js-justificativa-wrap');
        const textareas = card.querySelectorAll('.js-item-justificativa');
        const categoriaWrap = card.querySelector('.js-categoria-wrap');
        const categoria = card.querySelector('.js-item-categoria');
        const addButton = card.querySelector('.js-add-apontamento');
        const show = selected === 'nao_conforme';

        card.classList.remove('is-conforme', 'is-nao-conforme', 'is-nao-se-aplica');
        if (selected === 'conforme') {
            card.classList.add('is-conforme');
        } else if (selected === 'nao_conforme') {
            card.classList.add('is-nao-conforme');
        } else if (selected === 'nao_se_aplica') {
            card.classList.add('is-nao-se-aplica');
        }

        if (wrap) {
            wrap.classList.toggle('is-disabled', !show);
            wrap.hidden = !show;
        }

        textareas.forEach((textarea) => {
            textarea.disabled = !show;
            if (!show) {
                textarea.value = '';
            }
        });

        if (addButton) {
            addButton.disabled = !show;
        }

        if (categoriaWrap) {
            categoriaWrap.hidden = !show;
        }

        if (categoria) {
            categoria.disabled = !show;
            if (!show) {
                categoria.value = '';
            }
        }

        if (!show) {
            resetarApontamentosExtras(card);
        }
    }

    function adicionarApontamento(card, valor = '') {
        const lista = card.querySelector('.js-apontamentos-lista');
        if (!lista) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderCampoApontamento(valor, true, true).trim();
        const item = wrapper.firstElementChild;
        if (!item) {
            return;
        }

        lista.appendChild(item);
        item.querySelector('.js-remove-apontamento')?.addEventListener('click', () => item.remove());
        item.querySelector('.js-apontamento-extra')?.focus();
    }

    function resetarApontamentosExtras(card) {
        const lista = card.querySelector('.js-apontamentos-lista');
        if (!lista) {
            return;
        }

        const itens = Array.from(lista.querySelectorAll('.js-apontamento-extra-item'));
        itens.forEach((item, index) => {
            const textarea = item.querySelector('.js-apontamento-extra');
            if (textarea) {
                textarea.value = '';
            }

            if (index > 0) {
                item.remove();
            }
        });
    }

    function updateElementState(elementCard) {
        const radios = Array.from(elementCard.querySelectorAll('.question-card input[type="radio"]:checked'));
        const totalQuestions = elementCard.querySelectorAll('.question-card').length;
        const allNaoSeAplica = totalQuestions > 0
            && radios.length === totalQuestions
            && radios.every((radio) => radio.value === 'nao_se_aplica');
        const dataInput = elementCard.querySelector('.js-elemento-data');
        const nupInput = elementCard.querySelector('.js-elemento-nup');

        [dataInput, nupInput].forEach((input) => {
            if (!input) {
                return;
            }

            input.disabled = allNaoSeAplica;
        });
    }

    function validarItensObrigatorios() {
        const pendencias = [];

        refs.perguntas.querySelectorAll('[data-elemento-id]').forEach((elementoEl) => {
            const tituloElemento = elementoEl.querySelector('.element-card__title')?.textContent?.trim() || 'Elemento';
            const dataElemento = elementoEl.querySelector('.js-elemento-data')?.value?.trim() || '';
            const nup = elementoEl.querySelector('.js-elemento-nup')?.value?.trim() || '';
            const respostas = Array.from(elementoEl.querySelectorAll('[data-item-id] input[type="radio"]:checked')).map((radio) => radio.value);
            const totalPerguntas = elementoEl.querySelectorAll('[data-item-id]').length;
            const allNaoSeAplica = totalPerguntas > 0
                && respostas.length === totalPerguntas
                && respostas.every((resposta) => resposta === 'nao_se_aplica');

            if (!allNaoSeAplica && !dataElemento) {
                pendencias.push(`${tituloElemento} (data do elemento)`);
            }

            if (!allNaoSeAplica && !nup) {
                pendencias.push(`${tituloElemento} (NUP)`);
            }

            elementoEl.querySelectorAll('[data-item-id]').forEach((itemEl, itemIndex) => {
                const pergunta = itemEl.querySelector('.question-card__text label')?.textContent?.trim() || `Pergunta ${itemIndex + 1}`;
                const resposta = itemEl.querySelector('input[type="radio"]:checked')?.value || '';
                const categoria = itemEl.querySelector('.js-item-categoria')?.value?.trim() || '';

                if (!resposta) {
                    pendencias.push(`${tituloElemento} - ${pergunta}`);
                    itemEl.classList.add('is-invalid');
                    return;
                }

                itemEl.classList.remove('is-invalid');

                if (resposta === 'nao_conforme' && !categoria) {
                    pendencias.push(`${tituloElemento} - ${pergunta} (categoria da não conformidade)`);
                    itemEl.classList.add('is-invalid');
                    return;
                }

                itemEl.classList.remove('is-invalid');
            });
        });

        if (pendencias.length > 0) {
            const resumo = pendencias.slice(0, 5).join('\n- ');
            alert(`Existem respostas obrigatórias pendentes.\n- ${resumo}`);
            return false;
        }

        const marcosPendentes = [];
        refs.perguntas.querySelectorAll('[data-crono-id]').forEach((cronoEl, index) => {
            const fase = cronoEl.querySelector('.js-crono-fase')?.value?.trim() || `Marco ${index + 1}`;
            const dataInicio = cronoEl.querySelector('.js-crono-inicio')?.value?.trim() || '';
            const dataFim = cronoEl.querySelector('.js-crono-fim')?.value?.trim() || '';
            const duracao = cronoEl.querySelector('.js-crono-duracao')?.value?.trim() || '';

            if (!fase) marcosPendentes.push(`Marco ${index + 1} (fase)`);
            if (!dataInicio) marcosPendentes.push(`${fase} (data inicial)`);
            if (!dataFim) marcosPendentes.push(`${fase} (data final)`);
            if (!duracao) marcosPendentes.push(`${fase} (duração)`);
        });

        if (marcosPendentes.length > 0) {
            const resumoMarcos = marcosPendentes.slice(0, 5).join('\n- ');
            alert(`Existem marcos obrigatórios pendentes.\n- ${resumoMarcos}`);
            return false;
        }

        return true;
    }

    function renderMarcoEdicao(crono) {
        const duracaoValor = crono.duracao ?? calcularDuracaoDias(crono.data_inicio, crono.data_fim);
        return `
            <article class="crono-analise-card" data-crono-id="${crono.id}">
                <div class="crono-analise-card__header">
                    <div class="crono-analise-card__heading">
                        <span class="crono-analise-card__index">Marco</span>
                        <h3 class="crono-analise-card__title">${escapeHtml(crono.fase || 'Fase')}</h3>
                        <p class="crono-analise-card__subtitle">Revise as datas desta etapa e ajuste o contexto temporal sempre que houver atualização no andamento.</p>
                    </div>
                    <span class="crono-analise-card__badge">Cronoanálise</span>
                </div>
                <div class="crono-analise-card__body">
                    <div class="field crono-analise-card__field crono-analise-card__field--fase">
                        <label>Fase</label>
                        <input type="text" class="js-crono-fase" value="${escapeHtml(crono.fase || '')}">
                    </div>
                    <div class="field crono-analise-card__field">
                        <label>Data início</label>
                        <input type="date" class="js-crono-inicio" value="${escapeHtml(crono.data_inicio || '')}">
                    </div>
                    <div class="field crono-analise-card__field">
                        <label>Data fim</label>
                        <input type="date" class="js-crono-fim" value="${escapeHtml(crono.data_fim || '')}">
                    </div>
                    <div class="field crono-analise-card__field crono-analise-card__field--duracao">
                        <label>Duração (dias)</label>
                        <input type="number" min="0" class="js-crono-duracao" value="${escapeHtml(String(duracaoValor ?? 0))}">
                    </div>
                </div>
            </article>
        `;
    }

    function renderElementoEdicao(elemento) {
        const itensDoElemento = elemento.__itens || [];
        return `
            <article class="element-card" data-elemento-id="${elemento.id}">
                <div class="element-card__header">
                    <div class="element-card__heading">
                        <span class="element-card__icon" aria-hidden="true">
                            <i class="fas fa-file-lines"></i>
                        </span>
                        <h3 class="element-card__title">${escapeHtml(elemento.elemento || 'Elemento')}</h3>
                        <p class="content-card__subtitle">NUP ${escapeHtml(elemento.nup || '-')} • ${itensDoElemento.length} item(ns)</p>
                    </div>
                    <div class="element-card__toolbar">
                        <span class="element-card__badge">Obrigatório</span>
                        <div class="field element-card__field element-card__field--date">
                        <label>Data do elemento</label>
                        <input type="date" class="js-elemento-data" value="${escapeHtml(elemento.data_elemento || '')}">
                        </div>
                        <div class="field element-card__field element-card__field--nup">
                        <label>NUP</label>
                        <input type="text" class="js-elemento-nup" value="${escapeHtml(elemento.nup || '')}">
                        </div>
                    </div>
                </div>
                <div class="element-card__questions">
                    ${itensDoElemento.map((item, itemIndex) => renderItem(item, itemIndex)).join('')}
                </div>
            </article>
        `;
    }

    function existeConteudoPreenchido() {
        const algumaResposta = refs.perguntas.querySelector('input[type="radio"]:checked');
        const algumTexto = Array.from(refs.perguntas.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], textarea'))
            .some((campo) => String(campo.value || '').trim() !== '');
        return Boolean(algumaResposta || algumTexto);
    }

    function definirStatusEdicao(modo) {
        if (modo === 'concluir') {
            return 'concluido';
        }

        return 'em_preenchimento';
    }

    window.editarChecklist = async function editarChecklist(modo = 'concluir') {
        if (!checklistAtual) {
            return;
        }

        if (modo === 'concluir' && !validarItensObrigatorios()) {
            return;
        }

        const statusFinal = definirStatusEdicao(modo);
        refs.status.value = statusFinal;

        const payload = {
            status: statusFinal,
            competencia: refs.competencias.value,
            data_criacao: refs.dataInicio.value,
            elementos: coletarElementos(),
            crono_analises: coletarCronos()
        };

        try {
            const response = await fetch(`/api/editar-checklist/${checklistAtual.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Não foi possível atualizar o checklist.');
            }

            alert(modo === 'concluir'
                ? 'Checklist concluído com sucesso.'
                : 'Checklist salvo como rascunho. Ele não foi concluído e deverá ser finalizado depois, quando todas as respostas e marcos estiverem completos.');

            if (modo === 'concluir') {
                window.location.href = `/detalhes-checklist/${checklistAtual.id}`;
                return;
            }

            await carregarChecklist(checklistAtual.id);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Erro ao atualizar o checklist.');
        }
    };

    function coletarElementos() {
        return Array.from(refs.perguntas.querySelectorAll('[data-elemento-id]')).map((elementoEl) => {
            const elementoId = Number(elementoEl.getAttribute('data-elemento-id'));
            return {
                id: elementoId,
                nup: elementoEl.querySelector('.js-elemento-nup')?.value || '',
                data_elemento: elementoEl.querySelector('.js-elemento-data')?.value || '',
                itens: Array.from(elementoEl.querySelectorAll('[data-item-id]')).map((itemEl) => ({
                    id: Number(itemEl.getAttribute('data-item-id')),
                    analise: itemEl.querySelector('input[type="radio"]:checked')?.value || '',
                    justificativa: serializarJustificativa(itemEl, itemEl.querySelector('.question-card__text label')?.textContent || ''),
                    categoria: normalizarCategoriaNaoConformidade(itemEl.querySelector('.js-item-categoria')?.value || '')
                }))
            };
        });
    }

    function serializarJustificativa(questionEl, pergunta) {
        if (!questionEl) {
            return '';
        }

        if (!aceitaApontamentosExtras(pergunta)) {
            return questionEl.querySelector('.js-item-justificativa')?.value || '';
        }

        return Array.from(questionEl.querySelectorAll('.js-apontamento-extra'))
            .map((campo) => String(campo.value || '').trim())
            .filter(Boolean)
            .join(MARCADOR_APONTAMENTOS);
    }

    function coletarCronos() {
        return Array.from(refs.perguntas.querySelectorAll('[data-crono-id]')).map((cronoEl) => ({
            id: Number(cronoEl.getAttribute('data-crono-id')),
            fase: cronoEl.querySelector('.js-crono-fase')?.value || '',
            data_inicio: cronoEl.querySelector('.js-crono-inicio')?.value || '',
            data_fim: cronoEl.querySelector('.js-crono-fim')?.value || '',
            duracao: Number(cronoEl.querySelector('.js-crono-duracao')?.value || 0)
        }));
    }

    function montarFluxoComCrono(elementos, cronos, obterItensElemento, renderElemento, renderMarco) {
        if (!cronos.length) {
            return elementos.map(renderElemento).join('');
        }

        const buckets = new Map();
        const pendentes = [];
        const ranges = elementos.map((elemento, index) => ({
            index,
            itens: obterItensElemento(elemento)
        }));

        cronos.forEach((crono) => {
            const refsItens = extrairItensDoMarco(crono.fase || '');
            let alvo = -1;

            if (refsItens.length) {
                ranges.forEach((range) => {
                    if (range.itens.some((item) => refsItens.includes(item))) {
                        alvo = range.index;
                    }
                });
            }

            if (alvo >= 0) {
                const atuais = buckets.get(alvo) || [];
                atuais.push(renderMarco(crono));
                buckets.set(alvo, atuais);
            } else {
                pendentes.push(renderMarco(crono));
            }
        });

        const html = [];
        elementos.forEach((elemento, index) => {
            html.push(renderElemento(elemento));
            (buckets.get(index) || []).forEach((marcoHtml) => html.push(marcoHtml));
        });

        pendentes.forEach((marcoHtml) => html.push(marcoHtml));
        return html.join('');
    }

    function extrairItensDoMarco(texto) {
        const match = String(texto || '').match(/itens?\s+([0-9,\seE]+)/i);
        if (!match) {
            return [];
        }

        return Array.from(new Set((match[1].match(/\d+/g) || []).map((valor) => Number(valor)).filter((valor) => Number.isFinite(valor))));
    }

    function extrairItensDoElementoEdicao(itens) {
        return Array.from(new Set(
            itens
                .map((item) => {
                    const match = String(item.pergunta || '').match(/^(\d+)/);
                    return match ? Number(match[1]) : null;
                })
                .filter((valor) => Number.isFinite(valor))
        ));
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
})();

