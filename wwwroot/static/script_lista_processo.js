(function(){ window.__DEBUG__ = window.__DEBUG__ || false; const __origLog = console.log.bind(console); console.log = (...args)=>{ if(window.__DEBUG__) __origLog(...args); };})();
(function () {
    const state = {
        todos: [],
        filtrados: [],
        paginaAtual: 1,
        porPagina: 15,
        processoEmEdicao: null,
        areasOficiais: []
    };

    const refs = {};

    const MAPA_MODALIDADES = {
        'pedido-cotacao': 'Pedido de cotação',
        'ato-convocatorio': 'Ato convocatório',
        'agegoias-consulta': 'Consulta de Preços',
        'agegoias-selecao': 'Seleção de Propostas',
        'dispensa': 'Dispensa',
        'inexigibilidade': 'Inexigibilidade'
    };

    const MAPA_TIPOS_CHECKLIST = {
        'gestor-unico': 'Gestor - Único',
        'ato-convocatorio-p1': 'Ato convocatório - P1',
        'ato-convocatorio-p2': 'Ato convocatório - P2',
        'ato-convocatorio-p3': 'Ato convocatório - P3',
        'agegoias-consulta-p1': 'AGEGOIÁS - Consulta - P1',
        'agegoias-consulta-p2': 'AGEGOIÁS - Consulta - P2',
        'agegoias-selecao-p1': 'AGEGOIÁS - Seleção - P1',
        'agegoias-selecao-p2': 'AGEGOIÁS - Seleção - P2',
        'agegoias-selecao-p3': 'AGEGOIÁS - Seleção - P3',
        'pedido-cot-dispensa-p1': 'Pedido cot./dispensa - P1',
        'pedido-cot-dispensa-p2': 'Pedido cot./dispensa - P2',
        'pedido-cot-dispensa-p3': 'Pedido cot./dispensa - P3',
        'inexigibilidade-p1': 'Inexigibilidade - P1',
        'inexigibilidade-p2': 'Inexigibilidade - P2',
        'inexigibilidade-p3': 'Inexigibilidade - P3'
    };

    const MAPA_COMPETENCIAS = {
        'ANA_036_25': 'ANA 036/25',
        'INEA_069_22': 'INEA 069/22',
        'INEA_069_22_TRANSP': 'INEA 069/22-TRANSP',
        'INEA_068_22': 'INEA 068/22',
        'INEA_067_22': 'INEA 067/22',
        'IGAM_PS1_007_24': 'IGAM PS1 007/24',
        'IGAM_PS2_008_24': 'IGAM PS2 008/24',
        'ANA_035_25': 'ANA 035/25',
        'IGAM_002_25': 'IGAM 002/25',
        'ANA_008_25': 'ANA 008/25',
        'IGAM_005_24': 'IGAM 005/24',
        'ACT_003_25': 'ACT 003/25',
        'ANA_027_20': 'ANA 027/20',
        'ANA_034_20': 'ANA 034/20',
        'IGAM_001_20': 'IGAM 001/20',
        'IGAM_PS1_001_29': 'IGAM PS1 001/29',
        'IGAM_PS2_002_19': 'IGAM PS2 002/19',
        'OUTRAS_FONTES': 'Outras fontes'
    };

    const AREAS_OFICIAIS_FALLBACK = [
        'Diretoria de Gestão',
        'Diretoria Administrativo-Financeira',
        'Diretoria de Obras, Projetos e Estudos',
        'Diretoria de Planejamento e Ações Estratégicas',
        'Superintendência Regional AGEVAP',
        'Superintendência Regional AGEDOCE',
        'Superintendência Regional AGEGRANDE',
        'Superintendência Regional AGEGOIÁS',
        'Gerência Administrativa',
        'Gerência Financeira',
        'Gerência de Comunicação',
        'Gerência CEIVAP',
        'Gerência CBHs',
        'Gerência Guandu-BIG',
        'Gerência BG',
        'Gerência PS1/PS2',
        'Gerência de Atendimento aos Comitês',
        'Gerência de Fundos e Recursos Hídricos',
        'Gerência de Fundos Ambientais',
        'Gerência de Recursos Hídricos',
        'Gerência de Meio Ambiente',
        'Gerência de Obras',
        'Gerência de Projetos',
        'Gerência de Planejamento',
        'Gerência de Ações Estratégicas'
    ];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function lerJsonSeguro(resposta) {
        const texto = await resposta.text();
        if (!texto) {
            return null;
        }
        try {
            return JSON.parse(texto);
        } catch {
            return null;
        }
    }

    function obterTokenCsrf() {
        const cookie = document.cookie
            .split('; ')
            .find((item) => item.startsWith('XSRF-TOKEN='));
        return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
    }

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        refs.tabelaBody = document.querySelector('#tabelaProcessos tbody');
        if (!refs.tabelaBody) {
            return;
        }

        refs.filtro = document.getElementById('filtroPesquisa');
        refs.infoPaginacao = document.getElementById('infoPaginacao');
        refs.btnAnterior = document.getElementById('btnAnterior');
        refs.btnProximo = document.getElementById('btnProximo');
        refs.numerosPagina = document.getElementById('numerosPagina');
        refs.modalNovo = document.getElementById('modalNovoProcesso');
        refs.formNovo = document.getElementById('formNovoProcesso');
        refs.modalVisualizar = document.getElementById('modalVisualizarProcesso');
        refs.modalEditar = document.getElementById('modalEditarProcesso');
        refs.formEditar = document.getElementById('formEditarProcesso');
        refs.filtroArea = document.getElementById('filtroArea');

        window.abrirModal = abrirModalNovo;
        window.fecharModal = fecharModalNovo;
        window.salvarNovoProcesso = salvarNovoProcesso;
        window.fecharModalVisualizar = fecharModalVisualizar;
        window.aplicarFiltros = () => aplicarFiltros(true);
        window.salvarEdicaoProcesso = salvarEdicaoProcesso;
        window.fecharModalEditar = fecharModalEditar;

        if (refs.btnAnterior) {
            refs.btnAnterior.addEventListener('click', () => alterarPagina(state.paginaAtual - 1));
        }
        if (refs.btnProximo) {
            refs.btnProximo.addEventListener('click', () => alterarPagina(state.paginaAtual + 1));
        }
        if (refs.filtro) {
            refs.filtro.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    aplicarFiltros(true);
                }
            });
        }
        refs.filtroArea?.addEventListener('change', () => aplicarFiltros(true));

        configurarSeletorCompetencias('competenciaList', 'competencia');
        configurarSeletorCompetencias('editarCompetenciaList', 'editarCompetencia');

        Promise.all([carregarAreasOficiais(), carregarProcessos()])
            .catch((erro) => {
                console.error('Erro ao inicializar tela de processos:', erro);
            });
    }

    async function carregarAreasOficiais() {
        try {
            const resposta = await fetch('/api/processos/areas', {
                headers: { 'Accept': 'application/json' }
            });
            const data = await lerJsonSeguro(resposta);
            if (!resposta.ok || !data || data.success === false || !Array.isArray(data.areas) || !data.areas.length) {
                throw new Error((data && (data.message || data.error)) || 'Não foi possível carregar a lista oficial de áreas.');
            }

            state.areasOficiais = data.areas.slice();
        } catch (erro) {
            console.error('Erro ao carregar áreas oficiais, usando fallback local:', erro);
            state.areasOficiais = AREAS_OFICIAIS_FALLBACK.slice();
        }
        preencherFiltroAreas();
        preencherSelectAreas(document.getElementById('area'));
        preencherSelectAreas(document.getElementById('editarArea'));
    }

    function preencherFiltroAreas() {
            if (!refs.filtroArea) {
                return;
            }

        const valorAtual = refs.filtroArea.value;
        const areasCatalogo = state.areasOficiais.length
            ? state.areasOficiais
            : AREAS_OFICIAIS_FALLBACK;
        const areasDisponiveis = [...new Set([
            ...areasCatalogo,
            ...state.todos.filter((processo) => !processo.areaAusente).map((processo) => processo.area)
        ])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            refs.filtroArea.innerHTML = '<option value="">Todas as áreas</option><option value="__SEM_AREA__">Sem área</option>';
        areasDisponiveis.forEach((area) => {
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                refs.filtroArea.appendChild(option);
            });

        if (valorAtual === '__SEM_AREA__' || areasDisponiveis.includes(valorAtual)) {
            refs.filtroArea.value = valorAtual;
        }
    }

    function preencherSelectAreas(selectEl) {
        if (!selectEl) {
            return;
        }

        const valorAtual = selectEl.value;
        selectEl.innerHTML = '<option value="">Selecione a área</option>';
        state.areasOficiais.forEach((area) => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            selectEl.appendChild(option);
        });

        if (valorAtual && state.areasOficiais.includes(valorAtual)) {
            selectEl.value = valorAtual;
        }
    }

    function configurarSeletorCompetencias(gridId, hiddenId) {
        const grid = document.getElementById(gridId);
        const hidden = document.getElementById(hiddenId);
        if (!grid || !hidden) {
            return;
        }
        grid.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                checkbox.parentElement.classList.toggle('selected', checkbox.checked);
                atualizarCampoCompetencia(grid, hidden);
            });
        });
        atualizarCampoCompetencia(grid, hidden);
    }

    function atualizarCampoCompetencia(grid, hidden) {
        const valores = Array.from(grid.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value.trim());
        hidden.value = valores.join(', ');
    }

    async function carregarProcessos() {
        try {
            mostrarMensagemTabela('Carregando processos...');
            const resposta = await fetch('/api/processos', {
                headers: { 'Accept': 'application/json' }
            });
            if (!resposta.ok) {
                throw new Error('Não foi possível carregar os processos');
            }
            const data = await resposta.json();
            state.todos = Array.isArray(data) ? data.map(normalizarProcesso) : [];
            preencherFiltroAreas();
            aplicarFiltros(true);
        } catch (erro) {
            console.error('Erro ao carregar processos:', erro);
            mostrarMensagemTabela('Não foi possível carregar os processos.');
        }
    }

    function normalizarProcesso(item) {
        const competenciasCodigos = extrairCodigosCompetencia(item.competencia);
        const status = mapearStatus(item.status);
        const areaNormalizada = item.area ? String(item.area).trim() : '';
        return {
            id: item.id,
            numero: item.numero_processo || '-',
            descricao: item.objeto || '-',
            modalidadeOriginal: item.modalidade || '',
            modalidade: mapearModalidade(item.modalidade),
            dataISO: item.data_abertura || '',
            dataFormatada: formatarData(item.data_abertura),
            competenciasCodigos,
            competenciasTexto: competenciasCodigos.map(mapearCompetenciaCodigo).join(', '),
            area: areaNormalizada || '-',
            areaAusente: !areaNormalizada,
            gestor: item.gestor || '-',
            statusLabel: status.rotulo,
            statusClass: status.classe
        };
    }

    function extrairCodigosCompetencia(valor) {
        if (!valor) {
            return [];
        }
        if (Array.isArray(valor)) {
            return valor.map((item) => item.trim().toUpperCase()).filter(Boolean);
        }
        return String(valor)
            .split(/[,;]+/)
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean);
    }

    function aplicarFiltros(reset = false) {
        const termo = refs.filtro ? refs.filtro.value.trim().toLowerCase() : '';
        const areaSelecionada = refs.filtroArea ? refs.filtroArea.value.trim() : '';
        const normalizarAreaParaFiltro = (valor) => String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        if (!termo) {
            state.filtrados = [...state.todos];
        } else {
            state.filtrados = state.todos.filter((processo) => {
                return [
                    processo.numero,
                    processo.descricao,
                    processo.modalidade,
                    processo.competenciasTexto,
                    processo.area,
                    processo.gestor
                ].join(' ').toLowerCase().includes(termo);
            });
        }

        if (areaSelecionada === '__SEM_AREA__') {
            state.filtrados = state.filtrados.filter((processo) => processo.areaAusente);
        } else if (areaSelecionada) {
            const areaSelecionadaNormalizada = normalizarAreaParaFiltro(areaSelecionada);
            state.filtrados = state.filtrados.filter((processo) =>
                !processo.areaAusente && normalizarAreaParaFiltro(processo.area) === areaSelecionadaNormalizada
            );
        }

        if (reset) {
            state.paginaAtual = 1;
        } else {
            const totalPaginas = calcularTotalPaginas();
            if (state.paginaAtual > totalPaginas) {
                state.paginaAtual = totalPaginas;
            }
        }
        renderTabela();
        renderPaginacao();
    }

    function calcularTotalPaginas() {
        return Math.max(1, Math.ceil(state.filtrados.length / state.porPagina));
    }

    function renderTabela() {
        if (!state.filtrados.length) {
            mostrarMensagemTabela('Nenhum processo encontrado.');
            return;
        }

        const inicio = (state.paginaAtual - 1) * state.porPagina;
        const fim = inicio + state.porPagina;
        const registros = state.filtrados.slice(inicio, fim);

        const fragment = document.createDocumentFragment();
        registros.forEach((processo) => {
            const tr = document.createElement('tr');
            if (processo.areaAusente) {
                tr.classList.add('row-missing-area');
            }

            const areaBadgeClass = processo.areaAusente ? 'area-badge area-badge--missing' : 'area-badge area-badge--ok';
            const areaBadgeText = processo.areaAusente ? 'Sem área definida' : processo.area;
            tr.innerHTML = `
                <td>${escapeHtml(processo.numero)}</td>
                <td>${escapeHtml(processo.descricao)}</td>
                <td>${escapeHtml(processo.modalidade)}</td>
                <td>${escapeHtml(processo.dataFormatada)}</td>
                <td>${escapeHtml(processo.competenciasTexto || '-')}</td>
                <td><span class="${areaBadgeClass}">${escapeHtml(areaBadgeText)}</span></td>
                <td>${escapeHtml(processo.gestor)}</td>
                <td></td>
            `;
            const colunaAcoes = tr.lastElementChild;
            colunaAcoes.appendChild(criarMenuAcoes([
                { label: 'Detalhes', icon: 'fa-circle-info', kind: 'info', onClick: () => visualizarProcesso(processo.id) },
                { label: 'Visualizar', icon: 'fa-eye', kind: 'primary', onClick: () => visualizarProcesso(processo.id) },
                { label: 'Alterar', icon: 'fa-pen-to-square', kind: 'warning', onClick: () => editarProcesso(processo.id) },
                { label: 'Excluir', icon: 'fa-trash', kind: 'danger', onClick: () => excluirProcesso(processo.id) }
            ]));
            fragment.appendChild(tr);
        });

        refs.tabelaBody.innerHTML = '';
        refs.tabelaBody.appendChild(fragment);
        marcarMenusUltimasLinhas(refs.tabelaBody, 5);
        atualizarInfoPaginacao();
    }

    function marcarMenusUltimasLinhas(tbody, quantidadeProtegida = 5) {
        if (!tbody) {
            return;
        }

        const linhas = Array.from(tbody.querySelectorAll('tr'));
        const totalLinhas = linhas.length;

        linhas.forEach((linha, index) => {
            const menu = linha.querySelector('.action-menu');
            if (!menu) {
                return;
            }

            const estaNasUltimasLinhas = totalLinhas - index <= quantidadeProtegida;
            menu.classList.toggle('action-menu--up-preferred', estaNasUltimasLinhas);
        });
    }

    function mostrarMensagemTabela(mensagem) {
        refs.tabelaBody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(mensagem)}</td></tr>`;
        atualizarInfoPaginacao(0, 0, 0);
    }

    function atualizarInfoPaginacao(inicioForcado, fimForcado, totalForcado) {
        if (!refs.infoPaginacao) {
            return;
        }
        const total = totalForcado !== undefined ? totalForcado : state.filtrados.length;
        if (!total) {
            refs.infoPaginacao.textContent = '';
            return;
        }
        const inicio = inicioForcado !== undefined ? inicioForcado : (state.paginaAtual - 1) * state.porPagina + 1;
        const fim = fimForcado !== undefined ? fimForcado : Math.min(inicio + state.porPagina - 1, total);
        refs.infoPaginacao.textContent = `Exibindo ${inicio}-${fim} de ${total}`;
    }

    function renderPaginacao() {
        if (!refs.numerosPagina) {
            return;
        }
        const totalPaginas = calcularTotalPaginas();
        if (refs.btnAnterior) {
            refs.btnAnterior.disabled = state.paginaAtual <= 1;
        }
        if (refs.btnProximo) {
            refs.btnProximo.disabled = state.paginaAtual >= totalPaginas;
        }

        refs.numerosPagina.innerHTML = '';
        const maxLinks = 5;
        let inicio = Math.max(1, state.paginaAtual - Math.floor(maxLinks / 2));
        let fim = Math.min(totalPaginas, inicio + maxLinks - 1);
        if (fim - inicio + 1 < maxLinks) {
            inicio = Math.max(1, fim - maxLinks + 1);
        }

        for (let pagina = inicio; pagina <= fim; pagina += 1) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.textContent = String(pagina);
            if (pagina === state.paginaAtual) {
                botao.classList.add('active');
            }
            botao.addEventListener('click', () => alterarPagina(pagina));
            refs.numerosPagina.appendChild(botao);
        }
    }

    function alterarPagina(novaPagina) {
        const totalPaginas = calcularTotalPaginas();
        const paginaAjustada = Math.min(Math.max(1, novaPagina), totalPaginas);
        if (paginaAjustada === state.paginaAtual) {
            return;
        }
        state.paginaAtual = paginaAjustada;
        renderTabela();
        renderPaginacao();
    }

    function criarMenuAcoes(items) {
        const menu = document.createElement('div');
        menu.className = 'action-menu';

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'action-menu__trigger';
        botao.setAttribute('aria-haspopup', 'menu');
        botao.setAttribute('aria-expanded', 'false');
        botao.innerHTML = '<i class="fas fa-ellipsis"></i><span>Ações</span><i class="fas fa-chevron-down"></i>';

        const dropdown = document.createElement('div');
        dropdown.className = 'action-menu__dropdown';

        items.forEach((item, index) => {
            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.className = `action-menu__item action-menu__item--${item.kind || 'primary'}`;
            actionBtn.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;
            actionBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                menu.classList.remove('is-open');
                botao.setAttribute('aria-expanded', 'false');
                item.onClick();
            });
            dropdown.appendChild(actionBtn);

            if (index === 1 && items.length > 3) {
                const divider = document.createElement('div');
                divider.className = 'action-menu__divider';
                dropdown.appendChild(divider);
            }
        });

        botao.addEventListener('click', (event) => {
            event.stopPropagation();
            document.querySelectorAll('.action-menu.is-open').forEach((openMenu) => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('is-open');
                    openMenu.classList.remove('action-menu--up');
                    openMenu.closest('tr')?.classList.remove('row-actions-open');
                    const trigger = openMenu.querySelector('.action-menu__trigger');
                    if (trigger) {
                        trigger.setAttribute('aria-expanded', 'false');
                    }
                }
            });

            const vaiAbrir = !menu.classList.contains('is-open');
            if (vaiAbrir) {
                ajustarPosicionamentoMenu(menu, dropdown);
            } else {
                menu.classList.remove('action-menu--up');
            }

            const open = menu.classList.toggle('is-open');
            menu.closest('tr')?.classList.toggle('row-actions-open', open);
            botao.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        menu.append(botao, dropdown);
        return menu;
    }

    function ajustarPosicionamentoMenu(menu, dropdown) {
        menu.classList.remove('action-menu--up');

        if (menu.classList.contains('action-menu--up-preferred')) {
            menu.classList.add('action-menu--up');
            return;
        }

        const menuRect = menu.getBoundingClientRect();
        const dropdownHeight = Math.max(dropdown.scrollHeight || 0, 180);
        const espacoAbaixo = window.innerHeight - menuRect.bottom;
        const espacoAcima = menuRect.top;

        if (espacoAbaixo < dropdownHeight + 24 && espacoAcima > espacoAbaixo) {
            menu.classList.add('action-menu--up');
        }
    }

    function abrirModalNovo() {
        if (refs.formNovo) {
            refs.formNovo.reset();
        }
        preencherSelectAreas(document.getElementById('area'));
        configurarSeletorCompetencias('competenciaList', 'competencia');
        if (refs.modalNovo) {
            refs.modalNovo.style.display = 'block';
        }
    }

    function fecharModalNovo() {
        if (refs.modalNovo) {
            refs.modalNovo.style.display = 'none';
        }
    }

    async function salvarNovoProcesso() {
        if (!refs.formNovo) {
            return;
        }
        const numero = document.getElementById('numeroProcesso').value.trim();
        const descricao = document.getElementById('descricao').value.trim();
        const modalidade = document.getElementById('modalidade').value;
        const data = document.getElementById('dataInicial').value;
        const area = document.getElementById('area') ? document.getElementById('area').value.trim() : '';
        const gestor = document.getElementById('gestor') ? document.getElementById('gestor').value.trim() : '';
        const competencias = document.getElementById('competencia').value.trim();

        if (!numero || !descricao || !modalidade || !data || !competencias || !area) {
            alert('Preencha todos os campos obrigatórios antes de salvar.');
            return;
        }

        const payload = {
            numero,
            objeto: descricao,
            modalidade,
            data_abertura: data,
            competencia: competencias,
            area,
            gestor
        };

        const botao = refs.formNovo.querySelector('button[type="button"]');
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando';
        }

        try {
            const resposta = await fetch('/api/salvar-processo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const dataResposta = await lerJsonSeguro(resposta);
            if (!resposta.ok || !dataResposta || !dataResposta.success) {
                throw new Error((dataResposta && (dataResposta.message || dataResposta.error)) || `Erro ao salvar processo (${resposta.status})`);
            }
            alert('Processo salvo com sucesso!');
            fecharModalNovo();
            await carregarProcessos();
        } catch (erro) {
            console.error('Erro ao salvar processo:', erro);
            alert(erro.message || 'Não foi possível salvar o processo.');
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = '<i class="fas fa-save"></i> Salvar';
            }
        }
    }

    async function visualizarProcesso(id) {
        try {
            const resposta = await fetch(`/api/detalhes-processo/${id}`);
            const data = await resposta.json();
            if (!resposta.ok || !data.success) {
                throw new Error(data.message || 'Não foi possível carregar os detalhes do processo.');
            }
            popularModalVisualizar(data.processo);
            if (refs.modalVisualizar) {
                refs.modalVisualizar.style.display = 'block';
            }
        } catch (erro) {
            console.error('Erro ao visualizar processo:', erro);
            alert(erro.message || 'Erro ao carregar os detalhes do processo.');
        }
    }

    function popularModalVisualizar(processo) {
        if (!processo) {
            return;
        }
        const titulo = document.getElementById('modalTitulo');
        const descricao = document.getElementById('modalDescricao');
        const modalidade = document.getElementById('modalModalidade');
        const data = document.getElementById('modalDataInicio');
        const competencia = document.getElementById('modalCompetencia');
        const area = document.getElementById('modalArea');
        const gestor = document.getElementById('modalGestor');
        const container = document.getElementById('detalhesProcesso');

        if (titulo) {
            titulo.textContent = processo.numero || 'Detalhes do processo';
        }
        if (descricao) {
            descricao.textContent = processo.objeto || '-';
        }
        if (modalidade) {
            modalidade.textContent = mapearModalidade(processo.modalidade);
        }
        if (data) {
            data.textContent = formatarData(processo.data_abertura) || '-';
        }
        if (competencia) {
            const codigos = extrairCodigosCompetencia(processo.competencia);
            competencia.textContent = codigos.map(mapearCompetenciaCodigo).join(', ') || '-';
        }
        if (area) {
            area.textContent = processo.area || '-';
        }
        if (gestor) {
            gestor.textContent = processo.gestor || '-';
        }
        if (container) {
            const checklists = Array.isArray(processo.checklists) ? processo.checklists : [];
            if (!checklists.length) {
                container.innerHTML = '<p class="empty-state">Nenhum checklist associado a este processo.</p>';
            } else {
                const linhas = checklists.map((item) => {
                    const status = mapearStatus(item.status);
                    return `<tr>
                        <td>${escapeHtml(item.id)}</td>
                        <td>${escapeHtml(mapearTipoChecklist(item.tipo) || '-')}</td>
                        <td>${escapeHtml(mapearModalidade(item.modalidade))}</td>
                        <td><span class="status ${status.classe}">${escapeHtml(status.rotulo)}</span></td>
                        <td>${escapeHtml(formatarData(item.data_criacao) || '-')}</td>
                    </tr>`;
                }).join('');
                container.innerHTML = `
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tipo</th>
                                <th>Modalidade</th>
                                <th>Status</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                `;
            }
        }
    }

    function fecharModalVisualizar() {
        if (refs.modalVisualizar) {
            refs.modalVisualizar.style.display = 'none';
        }
    }

    async function editarProcesso(id) {
        try {
            const resposta = await fetch(`/api/detalhes-processo/${id}`);
            const data = await resposta.json();
            if (!resposta.ok || !data.success) {
                throw new Error(data.message || 'Não foi possível carregar o processo.');
            }
            popularModalEditar(data.processo);
            if (refs.modalEditar) {
                refs.modalEditar.style.display = 'block';
            }
        } catch (erro) {
            console.error('Erro ao editar processo:', erro);
            alert(erro.message || 'Erro ao carregar dados do processo.');
        }
    }

    function popularModalEditar(processo) {
        if (!processo || !refs.formEditar) {
            return;
        }
        state.processoEmEdicao = processo.id;
        refs.formEditar.reset();
        document.getElementById('editarProcessoId').value = processo.id;
        document.getElementById('editarNumeroProcesso').value = processo.numero || '';
        document.getElementById('editarDescricao').value = processo.objeto || '';
        document.getElementById('editarModalidade').value = processo.modalidade || '';
        document.getElementById('editarDataInicio').value = processo.data_abertura ? String(processo.data_abertura).substring(0, 10) : '';
        preencherSelectAreas(document.getElementById('editarArea'));
        document.getElementById('editarArea').value = processo.area || '';
        document.getElementById('editarGestor').value = processo.gestor || '';

        const codigos = extrairCodigosCompetencia(processo.competencia);
        const grid = document.getElementById('editarCompetenciaList');
        const hidden = document.getElementById('editarCompetencia');
        if (grid && hidden) {
            grid.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
                const selecionado = codigos.includes(checkbox.value.toUpperCase());
                checkbox.checked = selecionado;
                checkbox.parentElement.classList.toggle('selected', selecionado);
            });
            hidden.value = codigos.join(', ');
        }
    }

    async function salvarEdicaoProcesso() {
        if (!refs.formEditar || state.processoEmEdicao === null) {
            return;
        }
        const id = state.processoEmEdicao;
        const payload = {
            numero: document.getElementById('editarNumeroProcesso').value.trim(),
            objeto: document.getElementById('editarDescricao').value.trim(),
            modalidade: document.getElementById('editarModalidade').value,
            data_abertura: document.getElementById('editarDataInicio').value,
            area: document.getElementById('editarArea').value.trim(),
            gestor: document.getElementById('editarGestor').value.trim(),
            competencia: document.getElementById('editarCompetencia').value.trim()
        };

        if (!payload.numero || !payload.objeto || !payload.modalidade || !payload.data_abertura || !payload.competencia || !payload.area) {
            alert('Preencha todos os campos obrigatórios antes de salvar.');
            return;
        }

        const botao = refs.formEditar.querySelector('button[type="button"]');
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando';
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            const tokenCsrf = obterTokenCsrf();
            if (tokenCsrf) {
                headers['X-CSRF-TOKEN'] = tokenCsrf;
            }

            const resposta = await fetch(`/api/editar-processo/${id}`, {
                method: 'PUT',
                headers,
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            });
            const dataResposta = await lerJsonSeguro(resposta);
            if (!resposta.ok || !dataResposta || !dataResposta.success) {
                throw new Error((dataResposta && (dataResposta.message || dataResposta.error)) || `Erro ao atualizar processo (${resposta.status})`);
            }
            alert('Processo atualizado com sucesso!');
            fecharModalEditar();
            await carregarProcessos();
        } catch (erro) {
            console.error('Erro ao atualizar processo:', erro);
            alert(erro.message || 'Não foi possível atualizar o processo.');
        } finally {
            if (botao) {
                botao.disabled = false;
                botao.innerHTML = '<i class="fas fa-save"></i> Salvar alterações';
            }
        }
    }

    async function excluirProcesso(id) {
        if (!confirm('Deseja realmente excluir este processo?')) {
            return;
        }
        try {
            const resposta = await fetch(`/api/deletar-processo/${id}`, { method: 'DELETE' });
            const data = await lerJsonSeguro(resposta);
            if (!resposta.ok || !data || !data.success) {
                throw new Error((data && (data.message || data.error)) || `Erro ao excluir processo (${resposta.status})`);
            }
            alert('Processo excluído com sucesso!');
            await carregarProcessos();
        } catch (erro) {
            console.error('Erro ao excluir processo:', erro);
            alert(erro.message || 'Não foi possível excluir o processo.');
        }
    }

    function fecharModalEditar() {
        if (refs.modalEditar) {
            refs.modalEditar.style.display = 'none';
        }
        state.processoEmEdicao = null;
    }

    function formatarData(valor) {
        if (!valor) {
            return '-';
        }
        const texto = String(valor).trim();
        const matchDataPura = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDataPura) {
            return `${matchDataPura[3]}/${matchDataPura[2]}/${matchDataPura[1]}`;
        }

        const data = new Date(texto.includes('T') ? texto : texto.replace(' ', 'T'));
        if (Number.isNaN(data.getTime())) {
            return texto;
        }
        return data.toLocaleDateString('pt-BR');
    }

    function mapearModalidade(valor) {
        const chave = String(valor || '').toLowerCase();
        return MAPA_MODALIDADES[chave] || (valor || '-');
    }

    function mapearTipoChecklist(valor) {
        const chave = String(valor || '').toLowerCase();
        return MAPA_TIPOS_CHECKLIST[chave] || (valor || '-');
    }

    function mapearCompetenciaCodigo(valor) {
        const chave = String(valor || '').toUpperCase();
        return MAPA_COMPETENCIAS[chave] || valor;
    }

    function mapearStatus(valor) {
        const padrao = { rotulo: 'Em andamento', classe: 'status status-em_andamento' };
        if (!valor) {
            return padrao;
        }
        const chave = String(valor).toLowerCase().replace(/\s+/g, '_');
        switch (chave) {
            case 'concluido':
                return { rotulo: 'Concluído', classe: 'status status-concluido' };
            case 'pendente':
                return { rotulo: 'Pendente', classe: 'status status-pendente' };
            case 'em_andamento':
                return { rotulo: 'Em andamento', classe: 'status status-em_andamento' };
            default:
                return padrao;
        }
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.action-menu.is-open').forEach((menu) => {
            menu.classList.remove('is-open');
            menu.closest('tr')?.classList.remove('row-actions-open');
            const trigger = menu.querySelector('.action-menu__trigger');
            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    });

})();
