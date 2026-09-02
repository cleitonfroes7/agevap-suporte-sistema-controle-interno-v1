(function () {
    const form = document.getElementById('formNovoChecklist');
    const processoSelect = document.getElementById('processo');
    const modalidadeInput = document.getElementById('modalidade');
    const competenciasInput = document.getElementById('competencias');
    const dataInicioInput = document.getElementById('dataInicio');
    const tipoChecklistSelect = document.getElementById('tipoChecklist');
    const perguntasContainer = document.getElementById('perguntasDinamicas');

    const processoMap = new Map();
    const templateCache = new Map();
    const MARCADOR_APONTAMENTOS = '\n• ';

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
            .replace(/[\\u0300-\\u036f]/g, '')
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

    const templates = {
        'gestor-unico': '/static/perguntas_gestor.json',
        'ato-convocatorio-p1': '/static/perguntas_ato1.json',
        'ato-convocatorio-p2': '/static/perguntas_ato2.json',
        'ato-convocatorio-p3': '/static/perguntas_ato3.json',
        'pedido-cot-dispensa-p1': '/static/perguntas_pedido_dispensa1.json',
        'pedido-cot-dispensa-p2': '/static/perguntas_pedido_dispensa2.json',
        'pedido-cot-dispensa-p3': '/static/perguntas_pedido_dispensa3.json',
        'agegoias-consulta-p1': '/static/perguntas_agegoias_consulta1.json',
        'agegoias-consulta-p2': '/static/perguntas_agegoias_consulta2.json',
        'agegoias-selecao-p1': '/static/perguntas_agegoias_selecao1.json',
        'agegoias-selecao-p2': '/static/perguntas_agegoias_selecao2.json',
        'agegoias-selecao-p3': '/static/perguntas_agegoias_selecao3.json',
        'inexigibilidade-p1': '/static/perguntas_inexigibilidade1.json',
        'inexigibilidade-p2': '/static/perguntas_inexigibilidade2.json',
        'inexigibilidade-p3': '/static/perguntas_inexigibilidade3.json'
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        if (!form || !processoSelect || !tipoChecklistSelect) {
            return;
        }

        dataInicioInput.value = formatarDataLocalInput(new Date());
        processoSelect.addEventListener('change', onProcessoChange);
        tipoChecklistSelect.addEventListener('change', onTipoChecklistChange);
        await carregarProcessos();
    }

    async function carregarProcessos() {
        try {
            const response = await fetch('/api/processos', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Nao foi possivel carregar os processos.');
            }

            const processos = await response.json();
            processoSelect.innerHTML = '<option value="">Selecione um processo</option>';

            processos.forEach((processo) => {
                processoMap.set(String(processo.id), processo);
                const option = document.createElement('option');
                option.value = processo.id;
                option.textContent = processo.numero_processo || `Processo ${processo.id}`;
                processoSelect.appendChild(option);
            });

            if (window.jQuery && typeof window.jQuery.fn.select2 === 'function') {
                window.jQuery(processoSelect).select2({
                    width: '100%',
                    placeholder: 'Selecione um processo'
                });
                window.jQuery(processoSelect).on('change', onProcessoChange);
            }
        } catch (error) {
            console.error(error);
            alert(error.message || 'Erro ao carregar os processos.');
        }
    }

    function onProcessoChange() {
        const processo = processoMap.get(String(processoSelect.value));
        modalidadeInput.value = processo?.modalidade || '';
        competenciasInput.value = processo?.competencia || '';
    }

    async function onTipoChecklistChange() {
        const tipo = tipoChecklistSelect.value;
        const url = templates[tipo];

        if (!url) {
            perguntasContainer.innerHTML = '<div class="empty-state">Selecione um tipo de checklist para carregar o formulario.</div>';
            return;
        }

        try {
            const estrutura = await carregarTemplate(url);
            const elementos = normalizarEstrutura(estrutura.perguntas || []);
            const marcos = normalizarMarcos(estrutura.perguntas || []);
            renderFormulario(elementos, marcos);
        } catch (error) {
            console.error(error);
            perguntasContainer.innerHTML = '<div class="empty-state">Nao foi possivel carregar o formulario deste checklist.</div>';
        }
    }

    async function carregarTemplate(url) {
        if (templateCache.has(url)) {
            return templateCache.get(url);
        }

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Falha ao carregar ${url}`);
        }

        const data = await response.json();
        templateCache.set(url, data);
        return data;
    }

    function normalizarEstrutura(registros) {
        const lista = Array.isArray(registros) ? registros : [];

        if (!lista.length) {
            return [];
        }

        const registrosElementos = lista.filter((registro) =>
            registro &&
            typeof registro === 'object' &&
            (registro.elemento || registro.item || registro.pergunta || Array.isArray(registro.sub_perguntas))
        );

        if (!registrosElementos.length) {
            return [];
        }

        const gestorSimples = registrosElementos.every((registro) => registro.pergunta && !registro.elemento && !registro.item);

        if (gestorSimples) {
            return registrosElementos.map((registro, index) => ({
                titulo: registro.pergunta || `Elemento ${index + 1}`,
                data: '',
                nup: registro.nup || '',
                subPerguntas: [
                    {
                        pergunta: registro.pergunta || `Pergunta ${index + 1}`,
                        resposta: '',
                        justificativa: '',
                        categoria: ''
                    }
                ]
            }));
        }

        return registrosElementos
            .map((registro, index) => {
                const subPerguntasOriginais = Array.isArray(registro.sub_perguntas) ? registro.sub_perguntas : [];
                const subPerguntas = (subPerguntasOriginais.length
                    ? subPerguntasOriginais
                    : [{ pergunta: registro.pergunta || `Item ${registro.item || index + 1}` }])
                    .map((sub, subIndex) => ({
                        pergunta: sub?.pergunta || `Pergunta ${subIndex + 1}`,
                        resposta: '',
                        justificativa: '',
                        categoria: ''
                    }))
                    .filter((sub) => sub.pergunta);

                return {
                    titulo: registro.elemento || registro.descricao || `Item ${registro.item || index + 1}`,
                    data: '',
                    nup: registro.nup || '',
                    subPerguntas
                };
            })
            .filter((registro) => registro.titulo && registro.subPerguntas.length);
    }

    function renderFormulario(elementos, marcos) {
        if (!elementos.length) {
            perguntasContainer.innerHTML = '<div class="empty-state">Este tipo nao possui itens configurados.</div>';
            return;
        }

        perguntasContainer.innerHTML = montarFluxoComCrono(
            elementos.map((elemento, index) => ({ ...elemento, __index: index })),
            marcos,
            (elemento) => extrairItensDoElementoNovo(elemento),
            (elemento) => renderElementoNovo(elemento, elemento.__index),
            (marco, index) => renderMarcoNovo(marco, index)
        );
        bindRules();
    }

    function normalizarMarcos(registros) {
        return registros
            .filter((registro) => registro.marco)
            .map((registro, index) => ({
                id: `novo-${index}`,
                nome: registro.marco || `Marco ${index + 1}`,
                data_inicio: registro.data_inicio || '',
                data_fim: registro.data_fim || '',
                tempo_dias: registro.tempo_dias || '',
                observacoes: registro.observacoes || ''
            }));
    }

    function renderMarcoNovo(marco, index) {
        return `
            <article class="crono-analise-card" data-crono-index="${index}">
                <div class="crono-analise-card__header">
                    <div class="crono-analise-card__heading">
                        <span class="crono-analise-card__index">Marco ${index + 1}</span>
                        <h3 class="crono-analise-card__title">${escapeHtml(marco.nome || '')}</h3>
                        <p class="crono-analise-card__subtitle">Este marco acompanha a etapa correspondente do checklist e ajuda a registrar o tempo do processo.</p>
                    </div>
                    <span class="crono-analise-card__badge">Cronoanálise</span>
                </div>
                <div class="crono-analise-card__body">
                    <div class="field crono-analise-card__field crono-analise-card__field--fase">
                        <label>Fase</label>
                        <input type="text" class="js-crono-fase" value="${escapeHtml(marco.nome || '')}" readonly>
                    </div>
                    <div class="field crono-analise-card__field">
                        <label>Data início</label>
                        <input type="date" class="js-crono-inicio" value="${escapeHtml(marco.data_inicio || '')}">
                    </div>
                    <div class="field crono-analise-card__field">
                        <label>Data fim</label>
                        <input type="date" class="js-crono-fim" value="${escapeHtml(marco.data_fim || '')}">
                    </div>
                    <div class="field crono-analise-card__field crono-analise-card__field--duracao">
                        <label>Duração (dias)</label>
                        <input type="number" min="0" class="js-crono-duracao" value="${escapeHtml(String(marco.tempo_dias || ''))}">
                    </div>
                </div>
            </article>
        `;
    }

    function renderElementoNovo(elemento, index) {
        return `
            <article class="element-card" data-element-index="${index}">
                <div class="element-card__header">
                    <div class="element-card__heading">
                        <span class="element-card__icon" aria-hidden="true">
                            <i class="fas fa-file-lines"></i>
                        </span>
                        <h3 class="element-card__title">${escapeHtml(elemento.titulo)}</h3>
                        <p class="content-card__subtitle">${elemento.subPerguntas.length} pergunta(s) para preencher.</p>
                    </div>
                    <div class="element-card__toolbar">
                        <span class="element-card__badge">Obrigatorio</span>
                        <div class="field element-card__field element-card__field--date">
                        <label>Data do elemento</label>
                        <input type="date" class="js-elemento-data" value="${escapeHtml(elemento.data || '')}">
                        </div>
                        <div class="field element-card__field element-card__field--nup">
                        <label>NUP</label>
                        <input type="text" class="js-elemento-nup" value="${escapeHtml(elemento.nup || '')}" placeholder="Informe o NUP, se houver">
                        </div>
                    </div>
                </div>
                <div class="element-card__questions">
                    ${elemento.subPerguntas.map((item, itemIndex) => renderPergunta(item, index, itemIndex)).join('')}
                </div>
            </article>
        `;
    }

    function renderPergunta(item, elementIndex, itemIndex) {
        const groupName = `analise_${elementIndex}_${itemIndex}`;
        const permiteApontamentosExtras = aceitaApontamentosExtras(item.pergunta);
        const apontamentos = quebrarApontamentos(item.justificativa, permiteApontamentosExtras);
        return `
            <div class="question-card" data-question-index="${itemIndex}">
                <div class="question-card__main">
                    <div class="question-card__content">
                        <span class="question-card__index">${itemIndex + 1}</span>
                        <div class="question-card__text">
                            <label>${escapeHtml(item.pergunta)}</label>
                            <p class="question-card__hint">Selecione a classificacao do item e detalhe somente se houver nao conformidade.</p>
                        </div>
                    </div>
                    <div class="conformidade-options" role="radiogroup" aria-label="${escapeHtml(item.pergunta)}">
                        ${renderOpcao(groupName, 'conforme', 'Conforme')}
                        ${renderOpcao(groupName, 'nao_conforme', 'Nao conforme')}
                        ${renderOpcao(groupName, 'nao_se_aplica', 'Nao se aplica')}
                    </div>
                    <div class="justificativa js-justificativa-wrap is-disabled" hidden>
                        <div class="justificativa__field">
                            <label>${permiteApontamentosExtras ? 'Apontamentos complementares' : 'Justificativa / observacao'}</label>
                            ${permiteApontamentosExtras
                                ? `
                                <div class="js-apontamentos-lista">
                                    ${apontamentos.map((apontamento, apontamentoIndex) => renderCampoApontamento(apontamento, apontamentoIndex > 0)).join('')}
                                </div>
                                <button type="button" class="btn btn-secondary btn-apontamento-extra js-add-apontamento" disabled>
                                    <i class="fas fa-plus"></i>
                                    Adicionar apontamento
                                </button>`
                                : '<textarea class="js-item-justificativa" placeholder="Explique ou complemente (opcional)." disabled></textarea>'}
                        </div>
                        <div class="justificativa__field js-categoria-wrap" hidden>
                            <label>Categoria da nao conformidade</label>
                            <select class="js-item-categoria" disabled>
                                <option value="">Selecione a categoria</option>
                                ${categoriasNaoConformidade.map((categoria) => `<option value="${escapeHtml(categoria)}">${escapeHtml(categoria)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderOpcao(groupName, value, label) {
        const css = value === 'conforme' ? 'conforme' : value === 'nao_conforme' ? 'nao-conforme' : 'nao-se-aplica';
        const icon = value === 'conforme' ? '✓' : value === 'nao_conforme' ? '×' : '−';
        return `
            <label class="conformidade-option conformidade-option--${css}">
                <input type="radio" name="${groupName}" value="${value}">
                <span class="conformidade-option__control" aria-hidden="true"></span>
                <span class="conformidade-option__icon" aria-hidden="true">${icon}</span>
                <span class="conformidade-option__label ${css}">${label}</span>
            </label>
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

        return texto
            .split(/\n•\s*/g)
            .map((item) => item.trim())
            .filter(Boolean)
            .concat([''])
            .slice(0, Math.max(1, texto.split(/\n•\s*/g).filter(Boolean).length));
    }

    function renderCampoApontamento(valor, exibirRemover = false) {
        return `
            <div class="apontamento-extra js-apontamento-extra-item">
                <textarea class="js-item-justificativa js-apontamento-extra" placeholder="Descreva o apontamento." disabled>${escapeHtml(valor || '')}</textarea>
                ${exibirRemover ? `
                    <button type="button" class="btn btn-secondary btn-apontamento-remover js-remove-apontamento" disabled>
                        Remover
                    </button>` : ''}
            </div>
        `;
    }

    function bindRules() {
        perguntasContainer.querySelectorAll('.question-card').forEach((card) => {
            card.querySelectorAll('input[type="radio"]').forEach((radio) => {
                radio.addEventListener('change', () => {
                    updateQuestionState(card);
                    const elementCard = card.closest('[data-element-index]');
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

        perguntasContainer.querySelectorAll('[data-element-index]').forEach(updateElementState);
        perguntasContainer.querySelectorAll('[data-crono-index]').forEach(vincularAutoCalculoCrono);
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
            duracaoEl.value = valor === null ? '' : String(valor);
        };

        inicioEl.addEventListener('change', recalcular);
        fimEl.addEventListener('change', recalcular);
        inicioEl.addEventListener('input', recalcular);
        fimEl.addEventListener('input', recalcular);

        recalcular();
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
        wrapper.innerHTML = renderCampoApontamento(valor, true).trim();
        const item = wrapper.firstElementChild;
        if (!item) {
            return;
        }

        lista.appendChild(item);
        item.querySelector('.js-remove-apontamento')?.addEventListener('click', () => item.remove());
        const textarea = item.querySelector('.js-apontamento-extra');
        if (textarea) {
            textarea.disabled = card.querySelector('input[type="radio"]:checked')?.value !== 'nao_conforme';
            textarea.focus();
        }
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

    function validarPerguntasObrigatorias() {
        const pendencias = [];

        perguntasContainer.querySelectorAll('[data-element-index]').forEach((elementoEl) => {
            const tituloElemento = elementoEl.querySelector('.element-card__title')?.textContent?.trim() || 'Elemento';
            const dataElemento = elementoEl.querySelector('.js-elemento-data')?.value?.trim() || '';
            const nup = elementoEl.querySelector('.js-elemento-nup')?.value?.trim() || '';
            const respostas = Array.from(elementoEl.querySelectorAll('.question-card input[type="radio"]:checked')).map((radio) => radio.value);
            const totalPerguntas = elementoEl.querySelectorAll('.question-card').length;
            const allNaoSeAplica = totalPerguntas > 0
                && respostas.length === totalPerguntas
                && respostas.every((resposta) => resposta === 'nao_se_aplica');

            if (!allNaoSeAplica && !dataElemento) {
                pendencias.push(`${tituloElemento} (data do elemento)`);
            }

            if (!allNaoSeAplica && !nup) {
                pendencias.push(`${tituloElemento} (NUP)`);
            }

            elementoEl.querySelectorAll('.question-card').forEach((card, itemIndex) => {
                const pergunta = card.querySelector('.question-card__text label')?.textContent?.trim() || `Pergunta ${itemIndex + 1}`;
                const resposta = card.querySelector('input[type="radio"]:checked')?.value || '';
                const categoria = normalizarCategoriaNaoConformidade(card.querySelector('.js-item-categoria')?.value?.trim() || '');

                if (!resposta) {
                    pendencias.push(`${tituloElemento} - ${pergunta}`);
                    card.classList.add('is-invalid');
                    return;
                }

                card.classList.remove('is-invalid');

                if (resposta === 'nao_conforme' && !categoria) {
                    pendencias.push(`${tituloElemento} - ${pergunta} (categoria da não conformidade)`);
                    card.classList.add('is-invalid');
                    return;
                }

                card.classList.remove('is-invalid');
            });
        });

        if (pendencias.length > 0) {
            const resumo = pendencias.slice(0, 5).join('\n- ');
            alert(`Preencha todas as respostas obrigatórias antes de salvar.\n- ${resumo}`);
            return false;
        }

        const marcosPendentes = [];
        perguntasContainer.querySelectorAll('[data-crono-index]').forEach((cronoEl, index) => {
            const fase = cronoEl.querySelector('.js-crono-fase')?.value?.trim() || `Marco ${index + 1}`;
            const dataInicio = cronoEl.querySelector('.js-crono-inicio')?.value?.trim() || '';
            const dataFim = cronoEl.querySelector('.js-crono-fim')?.value?.trim() || '';
            const duracao = cronoEl.querySelector('.js-crono-duracao')?.value?.trim() || '';

            if (!dataInicio) marcosPendentes.push(`${fase} (data inicial)`);
            if (!dataFim) marcosPendentes.push(`${fase} (data final)`);
            if (!duracao) marcosPendentes.push(`${fase} (duração)`);
        });

        if (marcosPendentes.length > 0) {
            const resumoMarcos = marcosPendentes.slice(0, 5).join('\n- ');
            alert(`Preencha todos os marcos obrigatórios antes de salvar.\n- ${resumoMarcos}`);
            return false;
        }

        return true;
    }

    function existeConteudoPreenchido() {
        const algumaResposta = perguntasContainer.querySelector('input[type="radio"]:checked');
        const algumTexto = Array.from(perguntasContainer.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], textarea'))
            .some((campo) => String(campo.value || '').trim() !== '');
        return Boolean(algumaResposta || algumTexto);
    }

    function definirStatusSalvamento(modo) {
        if (modo === 'concluir') {
            return 'concluido';
        }

        return 'em_preenchimento';
    }

    function validarMinimoParaContinuarDepois() {
        if (!processoSelect.value) {
            alert('Selecione o processo antes de salvar e continuar depois.');
            processoSelect.focus();
            return false;
        }

        if (!tipoChecklistSelect.value) {
            alert('Selecione o tipo de checklist antes de salvar e continuar depois.');
            tipoChecklistSelect.focus();
            return false;
        }

        if (!dataInicioInput.value) {
            dataInicioInput.value = formatarDataLocalInput(new Date());
        }

        return true;
    }

    window.salvarNovoChecklist = async function salvarNovoChecklist(modo = 'concluir') {
        if (modo === 'concluir') {
            if (!form.reportValidity()) {
                return;
            }
        } else if (!validarMinimoParaContinuarDepois()) {
            return;
        }

        if (modo === 'concluir' && !validarPerguntasObrigatorias()) {
            return;
        }

        const tipo = tipoChecklistSelect.value;
        const url = templates[tipo];
        let perguntas = [];

        if (url) {
            const estrutura = await carregarTemplate(url);
            perguntas = hidratarPerguntas(normalizarEstrutura(estrutura.perguntas || []));
        }

        const statusFinal = definirStatusSalvamento(modo);
        const statusSelect = document.getElementById('status');
        if (statusSelect) {
            statusSelect.value = statusFinal;
        }

        const payload = {
            processo_id: Number(processoSelect.value),
            modalidade: modalidadeInput.value,
            tipo: tipo,
            data_criacao: dataInicioInput.value,
            competencias: competenciasInput.value,
            status: statusFinal,
            perguntas: perguntas,
            marcos: coletarCronos()
        };

        try {
            const response = await fetch('/novo-checklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Nao foi possivel salvar o checklist.');
            }

            if (modo === 'continuar') {
                alert('Checklist salvo em preenchimento. Você pode continuar depois.');
            }

            window.location.href = `/detalhes-checklist/${data.checklist_id}`;
        } catch (error) {
            console.error(error);
            alert(error.message || 'Erro ao salvar o checklist.');
        }
    };

    function hidratarPerguntas(baseElementos) {
        return baseElementos.map((elemento, index) => {
            const elementEl = perguntasContainer.querySelector(`[data-element-index="${index}"]`);
            const data = elementEl?.querySelector('.js-elemento-data')?.value || '';
            const nup = elementEl?.querySelector('.js-elemento-nup')?.value || '';

            return {
                titulo: elemento.titulo,
                date: data,
                nup: nup,
                subPerguntas: elemento.subPerguntas.map((item, itemIndex) => {
                    const questionEl = elementEl?.querySelector(`[data-question-index="${itemIndex}"]`);
                    const resposta = questionEl?.querySelector(`input[name="analise_${index}_${itemIndex}"]:checked`)?.value || '';
                    const justificativa = serializarJustificativa(questionEl, item.pergunta);
                    const categoria = normalizarCategoriaNaoConformidade(questionEl?.querySelector('.js-item-categoria')?.value || '');

                    return {
                        pergunta: item.pergunta,
                        resposta: resposta,
                        justificativa: justificativa,
                        categoria: categoria
                    };
                })
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
        return Array.from(perguntasContainer.querySelectorAll('[data-crono-index]')).map((cronoEl) => ({
            nome: cronoEl.querySelector('.js-crono-fase')?.value || '',
            data_inicio: cronoEl.querySelector('.js-crono-inicio')?.value || '',
            data_fim: cronoEl.querySelector('.js-crono-fim')?.value || '',
            tempo_dias: cronoEl.querySelector('.js-crono-duracao')?.value || ''
        }));
    }

    function montarFluxoComCrono(elementos, marcos, obterItensElemento, renderElemento, renderMarco) {
        if (!marcos.length) {
            return elementos.map(renderElemento).join('');
        }

        const buckets = new Map();
        const pendentes = [];
        const ranges = elementos.map((elemento, index) => ({
            index,
            itens: obterItensElemento(elemento)
        }));

        marcos.forEach((marco, marcoIndex) => {
            const refs = extrairItensDoMarco(marco.nome || '');
            let alvo = -1;

            if (refs.length) {
                ranges.forEach((range) => {
                    if (range.itens.some((item) => refs.includes(item))) {
                        alvo = range.index;
                    }
                });
            }

            if (alvo >= 0) {
                const atuais = buckets.get(alvo) || [];
                atuais.push(renderMarco(marco, marcoIndex));
                buckets.set(alvo, atuais);
            } else {
                pendentes.push(renderMarco(marco, marcoIndex));
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

    function extrairItensDoElementoNovo(elemento) {
        return Array.from(new Set(
            (elemento.subPerguntas || [])
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

    function formatarDataLocalInput(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
})();

