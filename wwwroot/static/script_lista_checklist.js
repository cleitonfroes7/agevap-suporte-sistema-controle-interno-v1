(function(){ window.__DEBUG__ = window.__DEBUG__ || false; const __origLog = console.log.bind(console); console.log = (...args)=>{ if(window.__DEBUG__) __origLog(...args); };})();
let paginaAtual = 1;
let itensPorPagina = 15;
let dadosChecklists = [];
let dadosFiltrados = [];
let totalPaginas = 0;

// Mapeamento de modalidades para rótulos legíveis
const MAPA_MODALIDADES = {
    'pedido-cotacao': 'Pedido de cotação',
    'ato-convocatorio': 'Ato convocatório',
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
    'pedido-cot-dispensa-p1': 'Pedido cot./dispensa - P1',
    'pedido-cot-dispensa-p2': 'Pedido cot./dispensa - P2',
    'pedido-cot-dispensa-p3': 'Pedido cot./dispensa - P3',
    'inexigibilidade-p1': 'Inexigibilidade - P1',
    'inexigibilidade-p2': 'Inexigibilidade - P2',
    'inexigibilidade-p3': 'Inexigibilidade - P3'
};

const MAPA_COMPETENCIAS = {
    'ANA_036_25': 'ANA 036/25',
    'ANA_035_25': 'ANA 035/25',
    'ANA_027_20': 'ANA 027/20',
    'ANA_008_25': 'ANA 008/25',
    'INEA_069_22': 'INEA 069/22',
    'INEA_069_22_TRANSP': 'INEA 069/22-TRANSP',
    'INEA_068_22': 'INEA 068/22',
    'INEA_067_22': 'INEA 067/22',
    'IGAM_PS1_007_24': 'IGAM PS1 007/24',
    'IGAM_PS2_008_24': 'IGAM PS2 008/24',
    'IGAM_002_25': 'IGAM 002/25',
    'IGAM_005_24': 'IGAM 005/24',
    'ACT_003_25': 'ACT 003/25',
    'OUTRAS_FONTES': 'Outras fontes'
};

function mapearModalidade(valor) {
    const chave = String(valor || '').toLowerCase().trim();
    return MAPA_MODALIDADES[chave] || (valor || '');
}

function mapearTipoChecklist(valor) {
    const chave = String(valor || '').toLowerCase().trim();
    return MAPA_TIPOS_CHECKLIST[chave] || (valor || '');
}

function mapearCompetenciaCodigo(valor) {
    const chave = String(valor || '').toUpperCase().trim();
    return MAPA_COMPETENCIAS[chave] || (valor || '');
}

function formatarCompetencias(valor) {
    const lista = Array.isArray(valor)
        ? valor
        : String(valor || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    return lista.map(mapearCompetenciaCodigo).join(', ');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeDeep(value) {
    if (typeof value === 'string') {
        return escapeHtml(value);
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeDeep);
    }

    if (value && typeof value === 'object') {
        const result = {};
        Object.keys(value).forEach((key) => {
            result[key] = sanitizeDeep(value[key]);
        });
        return result;
    }

    return value;
}

const resumoChecklistState = {
    totalChecklists: null,
    totalConformidades: null,
    totalNaoConformidades: null,
    totalAvaliados: null,
    taxaConformidade: null
};

function clampPercentResumo(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, value));
}

function setRingProgressResumo(id, percent) {
    const ring = document.getElementById(id);
    if (!ring) {
        return;
    }
    ring.style.setProperty('--percent', clampPercentResumo(percent));
}

function setTextResumo(id, text) {
    const el = document.getElementById(id);
    if (!el) {
        return;
    }
    el.textContent = text;
}

function atualizarResumoChecklistCards() {
    if (!document.getElementById('kpiTotalChecklists')) {
        return;
    }

    if (resumoChecklistState.totalChecklists !== null) {
        setTextResumo('kpiTotalChecklists', String(resumoChecklistState.totalChecklists));
        setRingProgressResumo('ringChecklistResumo', resumoChecklistState.totalChecklists > 0 ? 100 : 0);
    }

    if (resumoChecklistState.totalConformidades !== null) {
        setTextResumo('kpiConformes', String(resumoChecklistState.totalConformidades));
    }

    if (resumoChecklistState.totalNaoConformidades !== null) {
        setTextResumo('kpiNaoConformes', String(resumoChecklistState.totalNaoConformidades));
    }

    if (resumoChecklistState.taxaConformidade !== null) {
        setTextResumo('kpiTaxa', `${resumoChecklistState.taxaConformidade.toFixed(2)}%`);
        setRingProgressResumo('ringTaxaResumo', resumoChecklistState.taxaConformidade);
    }

    if (resumoChecklistState.totalAvaliados !== null) {
        const totalAvaliados = resumoChecklistState.totalAvaliados;
        const conformes = resumoChecklistState.totalConformidades ?? 0;
        const naoConformes = resumoChecklistState.totalNaoConformidades ?? 0;
        const taxaConformes = totalAvaliados > 0 ? (conformes / totalAvaliados) * 100 : 0;
        const taxaNaoConformes = totalAvaliados > 0 ? (naoConformes / totalAvaliados) * 100 : 0;

        setRingProgressResumo('ringConformeResumo', taxaConformes);
        setRingProgressResumo('ringNaoConformeResumo', taxaNaoConformes);

        setTextResumo('kpiMetaConformes', totalAvaliados > 0
            ? `Taxa de conformidade: ${taxaConformes.toFixed(1)}%`
            : 'Sem itens avaliados');
        setTextResumo('kpiMetaNaoConformes', totalAvaliados > 0
            ? `Taxa de não conformidade: ${taxaNaoConformes.toFixed(1)}%`
            : 'Sem itens avaliados');
        setTextResumo('kpiMetaTaxa', totalAvaliados > 0
            ? `${conformes} de ${totalAvaliados} avaliados`
            : 'Sem itens avaliados');
    }
}

async function carregarResumoChecklistPorMes() {
    try {
        const response = await fetch('/api/checklist-por-mes');
        if (!response.ok) {
            throw new Error('Erro ao buscar checklists por mês');
        }

        const data = await response.json();
        resumoChecklistState.totalChecklists = Array.isArray(data)
            ? data.reduce((acc, curr) => acc + (curr.total || 0), 0)
            : 0;
        atualizarResumoChecklistCards();
    } catch (error) {
        console.error('Erro ao carregar total de checklists:', error);
        setTextResumo('kpiTotalChecklists', '0');
        setRingProgressResumo('ringChecklistResumo', 0);
    }
}

async function carregarResumoChecklistTaxa() {
    try {
        const response = await fetch('/api/taxa-conformidade');
        if (!response.ok) {
            throw new Error('Erro ao buscar taxa de conformidade');
        }

        const data = await response.json();
        resumoChecklistState.taxaConformidade = typeof data.taxa === 'number' ? data.taxa : 0;
        resumoChecklistState.totalAvaliados = typeof data.total_avaliados === 'number' ? data.total_avaliados : 0;
        resumoChecklistState.totalConformidades = typeof data.conformes === 'number' ? data.conformes : 0;
        resumoChecklistState.totalNaoConformidades = typeof data.nao_conformes === 'number' ? data.nao_conformes : 0;
        atualizarResumoChecklistCards();
    } catch (error) {
        console.error('Erro ao carregar taxa de conformidade:', error);
        setTextResumo('kpiTaxa', 'Erro');
        setTextResumo('kpiMetaTaxa', 'Erro ao carregar dados');
        setRingProgressResumo('ringTaxaResumo', 0);
    }
}

function carregarResumoChecklist() {
    carregarResumoChecklistPorMes();
    carregarResumoChecklistTaxa();
}

// Função para carregar os checklists
async function carregarChecklists() {
    console.log('=== FUNÇÃO CARREGAR CHECKLISTS CHAMADA ===');
    try {
        console.log('Iniciando carregamento dos checklists...');
        
        // Adicionar timestamp para evitar cache
        const timestamp = new Date().getTime();
        const url = `/api/checklists?t=${timestamp}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            credentials: 'same-origin' // Isso enviará os cookies de autenticação
        });
        console.log('Resposta recebida:', response);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta:', response.status, errorText);
            throw new Error(`Erro ao carregar checklists: ${response.status} - ${errorText}`);
        }
        
        dadosChecklists = await response.json();
        console.log('Dados recebidos:', dadosChecklists);
        
        // Log detalhado dos primeiros 5 checklists
        dadosChecklists.slice(0, 5).forEach((checklist, index) => {
            console.log(`Checklist ${index + 1} (ID: ${checklist.id}):`, {
                id: checklist.id,
                tipo: checklist.tipo,
                modalidade: checklist.modalidade,
                status: checklist.status,
                data_criacao: checklist.data_criacao,
                competencias: checklist.competencias
            });
        });
        
        if (!Array.isArray(dadosChecklists)) {
            console.error('Dados recebidos não são um array:', dadosChecklists);
            throw new Error('Formato de dados inválido');
        }
        
        dadosFiltrados = [...dadosChecklists];
        totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
        atualizarTabela();
        atualizarPaginacao();
    } catch (error) {
        console.error('Erro detalhado:', error);
        alert('Erro ao carregar os checklists. Tente novamente.');
    }
}

// Função para atualizar a tabela
function atualizarTabela() {
    console.log('=== ATUALIZANDO TABELA ===');
    const tbody = document.querySelector('#tabelaChecklists tbody');
    if (!tbody) {
        console.error('Tbody não encontrado!');
        return;
    }
    
    tbody.innerHTML = '';

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosFiltrados.slice(inicio, fim);

    console.log('Dados da página:', dadosPagina);
    console.log('Início:', inicio, 'Fim:', fim, 'Página atual:', paginaAtual);

    if (dadosPagina.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="9" style="text-align:center;color:#888;">Nenhum checklist encontrado</td>';
        tbody.appendChild(tr);
        return;
    }

    dadosPagina.forEach((checklist, index) => {
        console.log(`Processando checklist ${index + 1}:`, checklist);
        console.log(`Checklist ${checklist.id} - Tipo: ${checklist.tipo}, Modalidade: ${checklist.modalidade}, Status: ${checklist.status}, Data: ${checklist.data_criacao}`);
        
        // Log detalhado de cada campo
        console.log(`Dados detalhados do checklist ${checklist.id}:`, {
            id: checklist.id,
            numero_processo: checklist.numero_processo,
            tipo: checklist.tipo,
            modalidade: checklist.modalidade,
            status: checklist.status,
            data_criacao: checklist.data_criacao,
            data_formatada: formatarData(checklist.data_criacao),
            competencias: checklist.competencias
        });
        
        const tr = document.createElement('tr');
        
        const dataFormatada = formatarData(checklist.data_criacao);
        const competenciasTexto = formatarCompetencias(checklist.competencias);
        
        console.log(`Dados que serão exibidos na linha ${index + 1}:`, {
            id: checklist.id || '',
            numero_processo: checklist.numero_processo || '',
            tipo: mapearTipoChecklist(checklist.tipo) || '',
            modalidade: checklist.modalidade || '',
            status: checklist.status || '',
            data_formatada: dataFormatada,
            competencias: competenciasTexto
        });
        
        tr.innerHTML = `
            <td>${escapeHtml(checklist.numero_processo || '')}</td>
            <td>${escapeHtml(mapearTipoChecklist(checklist.tipo))}</td>
            <td>${escapeHtml(mapearModalidade(checklist.modalidade))}</td>
            <td><span class="status status-${formatarStatus(checklist.status)}">${escapeHtml(mapearResposta(checklist.status))}</span></td>
            <td>${renderResultadoChecklist(checklist)}</td>
            <td>${escapeHtml(dataFormatada)}</td>
            <td>${escapeHtml(competenciasTexto)}</td>
            <td class="acoes"></td>
        `;

        const acoesChecklist = [
            { label: 'Detalhes', icon: 'fa-circle-info', kind: 'info', onClick: () => abrirDetalhesChecklist(checklist.id) },
            { label: 'Imprimir', icon: 'fa-print', kind: 'primary', onClick: () => imprimirDiretoChecklist(checklist.id) },
            { label: 'Baixar', icon: 'fa-download', kind: 'neutral', onClick: () => baixarChecklistPdf(checklist.id) }
        ];

        if (checklist.tem_nao_conformidade && checklist.status === 'concluido' && !checklist.ajustes_confirmados) {
            acoesChecklist.push({
                label: 'Confirmar ajustes do gestor',
                icon: 'fa-check-double',
                kind: 'success',
                onClick: () => confirmarAjustesChecklist(checklist.id)
            });
        }

        if (checklist.ajustes_confirmados && checklist.tem_nao_conformidade) {
            acoesChecklist.push({
                label: 'Ver confirmação da correção',
                icon: 'fa-badge-check',
                kind: 'success',
                onClick: () => abrirModalConfirmacaoCorrecao(checklist)
            });
        }

        acoesChecklist.push(
            { label: 'Alterar', icon: 'fa-pen-to-square', kind: 'warning', onClick: () => editarChecklist(checklist.id) },
            { label: 'Excluir', icon: 'fa-trash', kind: 'danger', onClick: () => excluirChecklist(checklist.id) }
        );

        tr.querySelector('.acoes').appendChild(criarMenuAcoes(acoesChecklist));

        tbody.appendChild(tr);
        console.log(`Linha ${index + 1} adicionada com botões`);
    });

    marcarMenusUltimasLinhas(tbody, 5);
    
    // Verificar se os botões foram criados
    setTimeout(() => {
        const botoes = document.querySelectorAll('.btn-acao');
        console.log(`Total de botões encontrados: ${botoes.length}`);
        botoes.forEach((botao, index) => {
            console.log(`Botão ${index + 1}:`, botao.className, botao.innerHTML);
        });
    }, 100);
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

function criarMenuAcoes(items) {
    const menu = document.createElement('div');
    menu.className = 'action-menu';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'action-menu__trigger';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<i class="fas fa-ellipsis"></i><span>Ações</span><i class="fas fa-chevron-down"></i>';

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
            trigger.setAttribute('aria-expanded', 'false');
            item.onClick();
        });
        dropdown.appendChild(actionBtn);

        if (index === 2 && items.length > 4) {
            const divider = document.createElement('div');
            divider.className = 'action-menu__divider';
            dropdown.appendChild(divider);
        }
    });

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        document.querySelectorAll('.action-menu.is-open').forEach((openMenu) => {
            if (openMenu !== menu) {
                openMenu.classList.remove('is-open');
                openMenu.classList.remove('action-menu--up');
                const openTrigger = openMenu.querySelector('.action-menu__trigger');
                if (openTrigger) {
                    openTrigger.setAttribute('aria-expanded', 'false');
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
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.append(trigger, dropdown);
    return menu;
}

function abrirDetalhesChecklist(id) {
    window.location.href = `/detalhes-checklist/${id}`;
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

// Função para atualizar a paginação
function atualizarPaginacao() {
    const numerosPagina = document.getElementById('numerosPagina');
    numerosPagina.innerHTML = '';

    // Definir quantos números de página mostrar
    const maxBotoes = 5;
    let inicio = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
    let fim = Math.min(totalPaginas, inicio + maxBotoes - 1);

    // Ajustar início se necessário
    if (fim - inicio + 1 < maxBotoes) {
        inicio = Math.max(1, fim - maxBotoes + 1);
    }

    // Adicionar botões de página
    for (let i = inicio; i <= fim; i++) {
        const button = document.createElement('button');
        button.className = i === paginaAtual ? 'active' : '';
        button.textContent = i;
        button.onclick = () => {
            paginaAtual = i;
            atualizarTabela();
            atualizarPaginacao();
        };
        numerosPagina.appendChild(button);
    }

    // Atualizar estado dos botões anterior/próximo
    document.getElementById('btnAnterior').disabled = paginaAtual === 1;
    document.getElementById('btnProximo').disabled = paginaAtual === totalPaginas;
}

// Função para atualizar os botões de paginação (mantida para compatibilidade)
function atualizarBotoesPaginacao() {
    const btnAnterior = document.getElementById('btnAnterior');
    const btnProximo = document.getElementById('btnProximo');

    btnAnterior.disabled = paginaAtual === 1;
    btnProximo.disabled = paginaAtual === totalPaginas;
}

// Função para mudar de página
function mudarPagina(direcao) {
    paginaAtual += direcao;

    if (paginaAtual < 1) {
        paginaAtual = 1;
    } else if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    atualizarTabela();
    atualizarPaginacao();
}

// Função para aplicar filtros
function aplicarFiltros() {
    const filtro = document.getElementById('filtroPesquisa').value.toLowerCase();
    
    dadosFiltrados = dadosChecklists.filter(checklist => 
        (checklist.numero_processo || '').toLowerCase().includes(filtro) ||
        (checklist.tipo || '').toLowerCase().includes(filtro) ||
        (checklist.modalidade || '').toLowerCase().includes(filtro) ||
        (Array.isArray(checklist.competencias) ? checklist.competencias.join(', ') : checklist.competencias || '').toLowerCase().includes(filtro)
    );

    paginaAtual = 1;
    totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
    atualizarTabela();
    atualizarPaginacao();
}

// Função para formatar data
function formatarData(dataString) {
    if (!dataString) {
        return '';
    }

    const valor = String(dataString).trim();
    const matchDataPura = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchDataPura) {
        return `${matchDataPura[3]}/${matchDataPura[2]}/${matchDataPura[1]}`;
    }

    try {
        const data = new Date(valor.includes('T') ? valor : valor.replace(' ', 'T'));
        if (Number.isNaN(data.getTime())) {
            return '';
        }

        return data.toLocaleDateString('pt-BR');
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return '';
    }
}

function formatarDataHora(dataString) {
    if (!dataString) {
        return '';
    }

    const valorOriginal = String(dataString).trim();
    if (!valorOriginal) {
        return '';
    }

    const normalizada = valorOriginal.includes('T')
        ? valorOriginal
        : valorOriginal.replace(' ', 'T');

    const data = new Date(normalizada);
    if (Number.isNaN(data.getTime())) {
        return valorOriginal;
    }

    return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
}

// Função para formatar o status
function formatarStatus(status) {
    if (!status) return '';
    
    // Normalizar o status para lowercase e substituir espaços por underscore
    const statusNormalizado = status.toLowerCase().replace(/\s+/g, '_');
    
    // Mapear para o formato correto
    switch (statusNormalizado) {
        case 'em_andamento':
        case 'em andamento':
        case 'em_preenchimento':
        case 'pausado':
        case 'nao_iniciado':
            return 'em_preenchimento';
        case 'concluido':
        case 'concluído':
            return 'concluido';
        default:
            return statusNormalizado;
    }
}

// Função para abrir modal de novo checklist
function abrirModal() {
    window.location.href = '/novo-checklist';
}

// Função para fechar modal
function fecharModal() {
    document.getElementById('modalNovoChecklist').style.display = 'none';
}

// Função para carregar processos no select
async function carregarProcessos() {
    try {
        const response = await fetch('/api/processos');
        if (!response.ok) {
            throw new Error('Erro ao carregar processos');
        }
        const processos = await response.json();
        const select = document.getElementById('processo');
        select.innerHTML = '<option value="">Selecione o Processo</option>';
        
        processos.forEach(processo => {
            const option = document.createElement('option');
            option.value = processo.id;
            option.textContent = processo.numero;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar os processos. Tente novamente.');
    }
}

// Função para salvar novo checklist
async function salvarNovoChecklist() {
    window.location.href = '/novo-checklist';
}

// Função para editar checklist
function editarChecklist(id) {
    console.log('Redirecionando para editar checklist:', id);
    // Redireciona para a página de edição com o ID do checklist
    window.location.href = `/editar-checklist/${id}`;
}

// Função para excluir checklist
async function excluirChecklist(id) {
    console.log(`=== INICIANDO EXCLUSÃO DO CHECKLIST ${id} ===`);
    
    if (!confirm('Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita.')) {
        console.log('Exclusão cancelada pelo usuário');
        return;
    }

    try {
        console.log(`Enviando requisição DELETE para /api/checklists/${id}`);
        
        const response = await fetch(`/api/checklists/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        console.log(`Resposta recebida: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta:', response.status, errorText);
            throw new Error(`Erro ao excluir checklist: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Dados da resposta:', data);

        if (data.success) {
            alert('Checklist excluído com sucesso!');
            console.log('Checklist excluído, recarregando lista...');
            carregarChecklists();
        } else {
            throw new Error(data.message || 'Erro desconhecido ao excluir checklist');
        }
    } catch (error) {
        console.error('Erro detalhado na exclusão:', error);
        alert(`Erro ao excluir o checklist: ${error.message}`);
    }
}

// Função para buscar dados do processo pelo ID
async function buscarDadosProcesso(processo_id) {
    try {
        const response = await fetch(`/api/processos/${processo_id}`);
        if (!response.ok) return null;
        const data = await response.json();
        console.log('API /api/processos/' + processo_id + ' retornou:', data);
        return data;
    } catch (e) { console.error('Erro ao buscar processo:', e); return null; }
}

// Função para buscar usuário logado
async function buscarUsuarioLogado() {
    try {
        const response = await fetch('/api/usuario-atual');
        if (!response.ok) return null;
        const data = await response.json();
        return data.usuario ? data.usuario.name : null;
    } catch (e) { return null; }
}

// Função para visualizar checklist
async function visualizarChecklist(id) {
    try {
        const response = await fetch(`/api/checklists/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes do checklist');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Erro ao carregar detalhes do checklist');
        }

        let checklist = sanitizeDeep(data.checklist || {});
        // Garantir que coleções sejam sempre arrays para evitar erros em map/forEach
        checklist.elementos = Array.isArray(checklist.elementos)
            ? checklist.elementos
            : (checklist.elementos ? [checklist.elementos] : []);
        checklist.itens = Array.isArray(checklist.itens)
            ? checklist.itens
            : (checklist.itens ? [checklist.itens] : []);
        checklist.crono_analises = Array.isArray(checklist.crono_analises)
            ? checklist.crono_analises
            : (checklist.crono_analises ? [checklist.crono_analises] : []);
        // Buscar dados do processo
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
        // Salva os dados completos do checklist em variável global para impressão
        window.dadosChecklistAtual = checklist;
        const modal = document.getElementById('modalVisualizarChecklist');
        const modalContent = modal.querySelector('.modal-content');

        // Log para verificar os dados dos itens
        console.log('=== DADOS DOS ITENS PARA VERIFICAÇÃO ===');
        const itensDebug = Array.isArray(checklist.itens) ? checklist.itens : (checklist.itens ? [checklist.itens] : []);
        itensDebug.forEach((item, index) => {
            console.log(`Item ${index + 1}:`, {
                analise: item.analise,
                classe_css: `status-${item.analise}`,
                texto_exibido: mapearResposta(item.analise)
            });
        });

        // Teste direto das cores no modal
        console.log('=== TESTE DAS CORES CSS ===');
        console.log('Verificando se as classes CSS estão definidas:');
        const testStyle = document.createElement('style');
        testStyle.textContent = `
            .teste-conforme { color: #28a745 !important; }
            .teste-nao_conforme { color: #dc3545 !important; }
            .teste-nao_se_aplica { color: #ffc107 !important; }
        `;
        document.head.appendChild(testStyle);

        // Adiciona os estilos no modal
        const style = document.createElement('style');
        style.textContent = `
            .detalhes-checklist {
                font-family: "Aptos", sans-serif;
                font-size: 12pt;
                text-align: left;
                position: relative;
            }
            .secao {
                margin-bottom: 30px;
            }
            .secao h3 {
                font-size: 14pt;
                color: #0c9c6f;
                border-bottom: 2px solid #0c9c6f;
                padding-bottom: 5px;
                margin-bottom: 15px;
            }
            .campo {
                margin-bottom: 8px;
            }
            .campo label {
                font-weight: bold;
                margin-right: 10px;
            }
            .elemento {
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
            }
            .elemento h4 {
                color: #0c9c6f;
                margin-bottom: 10px;
            }
            .item {
                margin: 10px 0;
                padding: 10px;
                border-left: 3px solid #0c9c6f;
            }
            .status-conforme {
                color: #28a745 !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            .status-nao_conforme {
                color: #b1001a !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            .status-nao_se_aplica {
                color: #ffc107 !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            /* Forçar cores em qualquer elemento com essas classes */
            span.status-conforme {
                color: #28a745 !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            span.status-nao_conforme {
                color: #b1001a !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            span.status-nao_se_aplica {
                color: #ffc107 !important;
                font-weight: bold !important;
                background-color: transparent !important;
                font-style: normal !important;
            }
            .crono-analises {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .crono-analise {
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 5px;
            }
            .crono-header h4 {
                color: #0c9c6f;
                margin: 0 0 10px 0;
            }
            .crono-datas {
                display: flex;
                gap: 20px;
                margin-bottom: 10px;
            }
            .crono-obs {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #ddd;
            }
        `;
        document.head.appendChild(style);

        // Adicionar botão + ao lado do título do elemento no modal
        // (apenas na visualização, não na impressão)
        if (typeof window !== 'undefined') {
            window.itensAdicionados = window.itensAdicionados || {};
            window.adicionarItemAoElemento = function(elementoId) {
                const texto = prompt('Digite o texto do novo item:');
                if (texto && texto.trim()) {
                    if (!window.itensAdicionados[elementoId]) window.itensAdicionados[elementoId] = [];
                    window.itensAdicionados[elementoId].push({
                        pergunta: texto.trim(),
                        analise: '',
                        justificativa: ''
                    });
                    // Re-renderizar o modal para mostrar o novo item
                    if (window.reRenderizarModalChecklist) window.reRenderizarModalChecklist();
                }
            };
        }

        // Estrutura do modal com header fixo e footer fixo
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Detalhes do Checklist</h2>
                <button class="close" onclick="fecharModalVisualizar()">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="detalhes-checklist">
                    <div class="secao">
                        <h3>Informações Gerais</h3>
                        <div class="campo">
                            <label>Processo:</label>
                            <span>${checklist.numero_processo}</span>
                        </div>
                        <div class="campo">
                            <label>Modalidade:</label>
                            <span>${mapearModalidade(checklist.modalidade)}</span>
                        </div>
                        <div class="campo">
                            <label>Área:</label>
                            <span>${area}</span>
                        </div>
                        <div class="campo">
                            <label>Gestor:</label>
                            <span>${gestor}</span>
                        </div>
                        <div class="campo">
                            <label>Data de Criação:</label>
                            <span>${formatarData(checklist.data_criacao)}</span>
                        </div>
                        <div class="campo">
                            <label>Competências:</label>
                            <span>${competencia}</span>
                        </div>
                    </div>

                    <div class="secao">
                        <h3>ELEMENTOS DO PROCESSO</h3>
                        ${(Array.isArray(checklist.elementos) ? checklist.elementos : (checklist.elementos ? [checklist.elementos] : [])).map(elemento => {
                            const nupFormatado = (!elemento.nup || elemento.nup === '0') ? 'N/A' : elemento.nup;
                            const itensChecklist = Array.isArray(checklist.itens) ? checklist.itens : [];
                            const itensDoElemento = itensChecklist.filter(item => item.elemento_id === elemento.id);
                            function normalizaStatus(str) {
                                return (str || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9_ ]/g, '').replace(/\s+/g, '_');
                            }
                            let statusElemento = 'CONFORME';
                            if (itensDoElemento.length > 0) {
                                if (itensDoElemento.some(item => normalizaStatus(item.analise) === 'nao_conforme')) {
                                    statusElemento = 'NÃO CONFORME';
                                } else if (itensDoElemento.every(item => normalizaStatus(item.analise) === 'nao_se_aplica')) {
                                    statusElemento = 'NÃO SE APLICA';
                                } else if (itensDoElemento.every(item => normalizaStatus(item.analise) === 'conforme')) {
                                    statusElemento = 'CONFORME';
                                }
                            }
                            let badgeClass = 'status-badge status-conforme';
                            if (statusElemento === 'NÃO CONFORME') badgeClass = 'status-badge status-nao_conforme';
                            if (statusElemento === 'NÃO SE APLICA') badgeClass = 'status-badge status-nao_se_aplica';
                            if (statusElemento === 'NÃO CONFORME') {
                                return `
                                    <div class="elemento">
                                        <h4>${elemento.elemento || ''}</h4>
                                        <div class="campo"><label>DATA:</label> <span>${elemento.data_elemento || ''}</span></div>
                                        <div class="campo"><label>NUP:</label> <span>${nupFormatado}</span></div>
                                        <div class="campo"><label>ANALISE:</label> <span class="${badgeClass}">${statusElemento}</span></div>
                                        ${itensDoElemento.filter(item => normalizaStatus(item.analise) === 'nao_conforme').map(item => {
                                            return `<div class='item-nao-conforme'>
                                                <div class='campo'><label>ITEM:</label> ${item.pergunta || ''}</div>
                                                <div class='campo'><label>JUSTIFICATIVA:</label> ${item.justificativa || ''}</div>
                                            </div>`;
                                        }).join('')}
                                    </div>
                                `;
                            } else if (statusElemento === 'NÃO SE APLICA') {
                                return `
                                    <div class="elemento">
                                        <h4>${elemento.elemento || ''}</h4>
                                        <div class="campo"><label>DATA:</label> <span>${elemento.data_elemento || ''}</span></div>
                                        <div class="campo"><label>NUP:</label> <span>${nupFormatado}</span></div>
                                        <div class="campo"><label>ANALISE:</label> <span class="${badgeClass}">${statusElemento}</span></div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="elemento">
                                        <h4>${elemento.elemento || ''}</h4>
                                        <div class="campo"><label>DATA:</label> <span>${elemento.data_elemento || ''}</span></div>
                                        <div class="campo"><label>NUP:</label> <span>${nupFormatado}</span></div>
                                        <div class="campo"><label>ANALISE:</label> <span class="${badgeClass}">${statusElemento}</span></div>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>

                    <div class="secao">
                        <h3>Análise Cronológica</h3>
                        <div class="crono-analises">
                            ${checklist.crono_analises.map(crono => `
                                <div class="crono-analise">
                                    <div class="crono-header">
                                        <h4>${crono.fase}</h4>
                                    </div>
                                    <div class="crono-detalhes">
                                        <div class="crono-datas">
                                            <span><strong>Início:</strong> ${formatarData(crono.data_inicio)}</span>
                                            <span><strong>Fim:</strong> ${formatarData(crono.data_fim)}</span>
                                            <span><strong>Duração:</strong> ${crono.duracao} dias</span>
                                        </div>
                                        ${crono.observacoes ? `
                                            <div class="crono-obs">
                                                <strong>Observações:</strong> ${crono.observacoes}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <div class="acoes-modal">
                    <button class="btn-imprimir" onclick="imprimirChecklist()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
            </div>
        `;

        // Função para re-renderizar o modal e mostrar itens adicionados
        window.reRenderizarModalChecklist = function() {
            // Repete o mesmo código de montagem do modal, mas inclui os itens adicionados
            // (simplificado para exemplo)
            // ...
            // Aqui, ao renderizar cada elemento:
            // ...
            // Adiciona o botão + ao lado do título
            // ...
            // Ao renderizar os itens do elemento:
            // ...
            // Adiciona os itens extras de window.itensAdicionados[elemento.id]
            // ...
        };

        // Override: aplicar layout profissional do modal (sumário, NCs, timeline)
        try {
            const totalItens = Array.isArray(checklist.itens) ? checklist.itens.length : 0;
            const cntConforme = totalItens ? checklist.itens.filter(i => i.analise === 'conforme').length : 0;
            const cntNaoConforme = totalItens ? checklist.itens.filter(i => i.analise === 'nao_conforme').length : 0;
            const cntNA = totalItens ? checklist.itens.filter(i => i.analise === 'nao_se_aplica').length : 0;
            const taxaConf = totalItens ? ((cntConforme / totalItens) * 100) : 0;

            const proStyle = document.createElement('style');
            proStyle.textContent = `
                .modal-pro { font-family: Segoe UI, Inter, Arial, sans-serif; color: #0f172a; }
                .modal-header-pro { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
                .title-group { display: flex; align-items: center; gap: 10px; }
                .title-group h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
                .badge-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; font-size: .72rem; font-weight: 700; }
                .badge-status.status-conforme { background: #e8f5e9; color: #1b5e20; border: 1px solid #a5d6a7; }
                .badge-status.status-em_andamento { background: #fff8e1; color: #7c4700; border: 1px solid #ffe082; }
                .badge-status.status-pendente { background: #fff3e0; color: #8c4800; border: 1px solid #ffcc80; }
                .badge-status.status-concluido { background: #e3f2fd; color: #0d47a1; border: 1px solid #90caf9; }
                .summary-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px; padding: 12px; }
                .summary-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: grid; grid-template-columns: 140px 1fr; row-gap: 6px; column-gap: 12px; }
                .summary-card .label { color: #64748b; font-size: .8rem; font-weight: 600; }
                .summary-card .value { color: #0f172a; font-size: .9rem; font-weight: 600; }
                .kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
                .kpi { background: #ffffff; border:1px solid #e5e7eb; border-radius: 10px; padding: 10px; text-align: center; }
                .kpi-value { font-size: 1.1rem; font-weight: 800; }
                .kpi-label { font-size: .72rem; color: #64748b; }
                .section { padding: 8px 12px 4px; }
                .section h3 { font-size: .95rem; margin: 0 0 8px 0; color: #0f172a; font-weight: 700; }
                .exec-summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; line-height: 1.4; font-size: .9rem; color: #334155; }
                .tratativa-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 12px; line-height: 1.45; font-size: .9rem; color: #166534; }
                .tratativa-box--pendente { background: #fff7ed; border-color: #fdba74; color: #9a3412; }
                .nc-list { display: grid; gap: 8px; }
                .nc-item { border-left: 4px solid #ef4444; background: #fff7f7; border: 1px solid #fecaca; border-left-color: #ef4444; border-radius: 8px; padding: 10px 12px; }
                .nc-title { margin: 0 0 6px 0; font-weight: 700; color: #991b1b; font-size: .9rem; }
                .nc-just { margin: 0; font-size: .85rem; color: #6b7280; }
                .detalhamento { display: grid; gap: 10px; }
                .elemento-card { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
                .elemento-head { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; display:flex; justify-content: space-between; align-items:center; }
                .elemento-title { margin: 0; font-size: .92rem; font-weight: 700; color: #0f172a; }
                .elemento-meta { color: #64748b; font-size: .78rem; }
                .itens-list { padding: 10px 12px; display: grid; gap: 6px; }
                .item-row { display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: start; }
                .item-label { font-size: .78rem; font-weight: 700; color: #334155; }
                .item-value { font-size: .85rem; color: #0f172a; }
                .item-status { font-weight: 800; }
                .item-status.conforme { color: #15803d; }
                .item-status.nao_conforme { color: #b91c1c; }
                .item-status.nao_se_aplica { color: #b45309; }
                .timeline { position: relative; margin-left: 6px; padding-left: 14px; }
                .timeline::before { content: ""; position: absolute; left: 3px; top: 0; bottom: 0; width: 2px; background: #e5e7eb; }
                .tl-item { position: relative; padding: 8px 8px 8px 12px; margin: 4px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
                .tl-item::before { content: ""; position: absolute; left: -4px; top: 14px; width: 8px; height: 8px; background: #2563eb; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px #e5e7eb; }
                .tl-title { margin: 0 0 2px 0; font-weight: 700; font-size: .9rem; color: #0f172a; }
                .tl-meta { font-size: .78rem; color: #64748b; }
                .modal-footer-pro { padding: 10px 12px; border-top: 1px solid #e5e7eb; display:flex; justify-content:flex-end; }
                .btn-imprimir { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 8px 12px; font-weight: 700; cursor: pointer; }
                .btn-imprimir:hover { background: #1d4ed8; }
            `;
            document.head.appendChild(proStyle);

            modalContent.innerHTML = `
              <div class="modal-pro">
                <div class="modal-header-pro">
                  <div class="title-group">
                    <h2>Checklist #${checklist.id}</h2>
                    <span class="badge-status status-${formatarStatus(checklist.status)}">${mapearResposta(checklist.status)}</span>
                  </div>
                  <button class="close" onclick="fecharModalVisualizar()">&times;</button>
                </div>
                <div class="summary-grid">
                  <div class="summary-card">
                    <div class="label">Processo</div><div class="value">${checklist.numero_processo || '-'}</div>
                    <div class="label">Modalidade</div><div class="value">${mapearModalidade(checklist.modalidade) || '-'}</div>
                    <div class="label">Área</div><div class="value">${area || '-'}</div>
                    <div class="label">Gestor</div><div class="value">${gestor || '-'}</div>
                    <div class="label">Data de Criação</div><div class="value">${formatarData(checklist.data_criacao) || '-'}</div>
                    <div class="label">Competências</div><div class="value">${competencia || '-'}</div>
                  </div>
                  <div class="kpis">
                    <div class="kpi"><div class="kpi-value">${cntConforme}</div><div class="kpi-label">Conformes</div></div>
                    <div class="kpi"><div class="kpi-value">${cntNaoConforme}</div><div class="kpi-label">Não conformes</div></div>
                    <div class="kpi"><div class="kpi-value">${cntNA}</div><div class="kpi-label">Não se aplica</div></div>
                  </div>
                </div>
                <div class="section">
                  <h3>Sumário Executivo</h3>
                  <div class="exec-summary">
                    Este relatório consolida a verificação do processo ${checklist.numero_processo || '-'} (${mapearModalidade(checklist.modalidade) || '-'}) criado em ${formatarData(checklist.data_criacao) || '-'}. Foram avaliados ${totalItens} itens, com ${cntConforme} conformes, ${cntNaoConforme} não conformes e ${cntNA} não aplicáveis. A taxa de conformidade estimada é de ${taxaConf.toFixed(1)}%.
                  </div>
                </div>
                <div class="section">
                  <h3>Tratativa das Não Conformidades</h3>
                  ${checklist.ajustes_confirmados && cntNaoConforme > 0
                    ? `
                    <div class="tratativa-box">
                      As correções informadas pelo gestor foram conferidas pelo Controle Interno.
                      Confirmação registrada por <strong>${checklist.ajustes_confirmados_por || 'usuário do sistema'}</strong>
                      em <strong>${formatarDataHora(checklist.ajustes_confirmados_em) || 'data não informada'}</strong>.
                      As não conformidades originais permanecem preservadas neste checklist para histórico e rastreabilidade.
                    </div>`
                    : `
                    <div class="tratativa-box tratativa-box--pendente">
                      ${cntNaoConforme > 0
                        ? 'Este checklist possui não conformidades registradas e ainda não há confirmação formal de que os ajustes do gestor foram conferidos pelo Controle Interno.'
                        : 'Este checklist não possui não conformidades registradas, portanto não há tratativa pendente para confirmação.'}
                    </div>`
                  }
                </div>
                <div class="section">
                  <h3>Registro de Não Conformidades</h3>
                  <div class="nc-list">
                    ${ (checklist.itens || []).filter(i => i.analise === 'nao_conforme').map((i,idx) => `
                      <div class="nc-item">
                        <h4 class="nc-title">${idx+1}. ${i.pergunta || 'Item'}</h4>
                        <p class="nc-just">${i.justificativa ? i.justificativa : 'Sem justificativa informada.'}</p>
                      </div>
                    `).join('') || '<div class="nc-item" style="border-color:#16a34a;background:#f0fdf4;border:1px solid #86efac;"><h4 class="nc-title" style="color:#166534;">Nenhuma não conformidade registrada.</h4></div>'}
                  </div>
                </div>
                <div class="section">
                  <h3>Detalhamento por Elemento</h3>
                  <div class="detalhamento">
                    ${ (checklist.elementos || []).map(elemento => {
                          const nupFormatado = (!elemento.nup || elemento.nup === '0') ? 'N/A' : elemento.nup;
                          const itensDoElemento = (checklist.itens || []).filter(item => item.elemento_id === elemento.id);
                          return `
                            <div class=\"elemento-card\">
                              <div class=\"elemento-head\">
                                <h4 class=\"elemento-title\">${elemento.elemento || '-'}</h4>
                                <div class=\"elemento-meta\">Data: ${formatarData(elemento.data_elemento) || '-'} • NUP: ${nupFormatado}</div>
                              </div>
                              <div class=\"itens-list\">
                                ${itensDoElemento.map(item => `
                                  <div class=\"item-row\">
                                    <div class=\"item-label\">Pergunta</div>
                                    <div class=\"item-value\">${item.pergunta || '-'}</div>
                                    <div class=\"item-label\">Análise</div>
                                    <div class=\"item-value item-status ${item.analise}\">${mapearResposta(item.analise)}</div>
                                    ${item.justificativa ? `<div class=\"item-label\">Justificativa</div><div class=\"item-value\">${item.justificativa}</div>` : ''}
                                  </div>
                                `).join('')}
                              </div>
                            </div>`
                    }).join('') }
                  </div>
                </div>
                <div class="section">
                  <h3>Linha do Tempo</h3>
                  <div class="timeline">
                    ${ (checklist.crono_analises || []).map(crono => `
                      <div class=\"tl-item\">
                        <div class=\"tl-title\">${crono.fase || '-'}</div>
                        <div class=\"tl-meta\">${formatarData(crono.data_inicio) || '-'} ? ${formatarData(crono.data_fim) || '-'} • ${crono.duracao || 0} dias ${crono.observacoes ? ' • '+crono.observacoes : ''}</div>
                      </div>
                    `).join('') }
                  </div>
                </div>
                <div class="modal-footer-pro">
                  <button class="btn-imprimir" onclick="imprimirChecklist()"><i class="fas fa-print"></i> Imprimir</button>
                </div>
              </div>`;
        } catch (e) { console.warn('Falha ao aplicar layout profissional do modal:', e); }

        modal.style.display = 'block';
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar detalhes do checklist. Tente novamente.');
    }
}

// Função para fechar modal de visualização
function fecharModalVisualizar() {
    document.getElementById('modalVisualizarChecklist').style.display = 'none';
}

// Função para imprimir checklist
async function imprimirChecklist() {
    // Variaveis fora do try para uso no catch
    let btnImprimir;
    let textoOriginal = '';
    try {
        // Mostra indicador de carregamento
        btnImprimir = document.querySelector('.btn-imprimir');
        textoOriginal = btnImprimir ? btnImprimir.innerHTML : '';
        if (btnImprimir) {
            btnImprimir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
            btnImprimir.disabled = true;
        }
        var iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        // Pega os dados do checklist do modal salvos na variável global
        const checklistRaw = window.dadosChecklistAtual;
        if (!checklistRaw) {
            alert('Dados do checklist nao encontrados. Abra o modal de visualizacao antes de imprimir.');
            return;
        }
        const checklist = sanitizeDeep(checklistRaw);
        // Buscar dados do processo
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
        // Buscar nome do usuário logado
        const nomeUsuario = escapeHtml(await buscarUsuarioLogado() || 'Responsavel');
        const elementos = checklist.elementos || [];
        const itens = checklist.itens || [];

        // NOVO LAYOUT: gera o HTML completo no estilo solicitado e imprime
        {
            var doc = iframe.contentWindow.document;
            doc.open();
            doc.write(gerarHTMLImpressaoAGEVAP({
                checklist,
                area,
                gestor,
                competencia,
                elementos,
                itens,
                nomeUsuario
            }));
            doc.close();

            setTimeout(function () {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(function () {
                    document.body.removeChild(iframe);
                    if (btnImprimir) {
                        btnImprimir.innerHTML = textoOriginal;
                        btnImprimir.disabled = false;
                    }
                }, 800);
            }, 400);
            return; // evita executar o layout antigo abaixo
        }
        // Relatório profissional (override)
        {
            const totalItensR = itens.length;
            const totalElementosR = elementos.length;
            const confR = itens.filter(i => i.analise === 'conforme').length;
            const naoR = itens.filter(i => i.analise === 'nao_conforme').length;
            const naR = itens.filter(i => i.analise === 'nao_se_aplica').length;
            const taxaR = totalItensR ? (confR / totalItensR * 100).toFixed(1) : '0.0';

            const elementosPorId = new Map(elementos.map(el => [el.id, el.elemento || '-']));
            const ncCards = (itens.filter(i => i.analise === 'nao_conforme').map(i => {
                const elementoNome = elementosPorId.get(i.elemento_id) || '-';
                const apontamento = i.justificativa
                    ? `<strong>Apontamento:</strong> ${i.justificativa}`
                    : '<strong>Apontamento:</strong> Sem apontamento informado.';
                return `<div class="nc-card"><div class="nc-h">${elementoNome}</div><div class="nc-j">${apontamento}</div></div>`;
            }).join('')) || '<div class="nc-card nc-ok">Nenhuma não conformidade registrada.</div>';
            const parecerTexto = naoR > 0
                ? 'Recomendamos que o processo não prossiga neste momento, uma vez que foram identificadas não conformidades que demandam correção. Assim, será necessário realizar o ajuste do(s) apontamento(s) registrado(s) e, após a regularização, submeter novamente para nova verificação de conformidade e continuidade dos trâmites.'
                : 'Recomendamos o prosseguimento dos trâmites do processo, considerando que, após verificação, não foram identificadas não conformidades ou pendências impeditivas, estando a documentação e as informações apresentadas em conformidade.';

            const elementosHTML = elementos.map(el => {
                const nupFmt = (!el.nup || el.nup==='0') ? 'N/A' : el.nup;
                const its = itens.filter(it => it.elemento_id === el.id && it.analise !== 'nao_se_aplica');
                if (!its.length) {
                    return '';
                }
                const naoConformesEl = its.filter(it => it.analise === 'nao_conforme');
                const isNaoConforme = naoConformesEl.length > 0;
                const statusClass = isNaoConforme ? 'st-nao_conforme' : 'st-conforme';
                const statusTexto = isNaoConforme ? 'Não Conforme' : 'Conforme';
                const apontamentos = naoConformesEl
                    .map(it => it.justificativa)
                    .filter(Boolean)
                    .join('<br>');
                const apontamentoHTML = isNaoConforme
                    ? `<div class="sec-apontamento"><strong>Apontamento:</strong> ${apontamentos || 'Sem apontamento informado.'}</div>`
                    : '';
                return `<div class="sec-bloco">
                          <div class="sec-head">
                            <div class="sec-h">${el.elemento || '-'}</div>
                            <div class="sec-status"><span class="sec-label">Status:</span> <span class="${statusClass}">${statusTexto}</span></div>
                          </div>
                          <div class="sec-meta"><strong>Data:</strong> ${formatarData(el.data_elemento)||'-'} • <strong>NUP:</strong> ${nupFmt}</div>
                          ${apontamentoHTML}
                        </div>`;
            }).filter(Boolean).join('');

            var doc = iframe.contentWindow.document;
            doc.open();
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório de Checklist</title>
            <style>
              @page { size: A4; margin: 18mm 14mm; }
              body { font-family: Segoe UI, Inter, Arial, sans-serif; color: #0f172a; }
              .hdr { display:flex; align-items:center; gap:16px; border-bottom:2px solid #005baa; padding-bottom:8px; }
              .logo { height: 50px; }
              .t1 { margin:0; font-size: 20px; color:#005baa; font-weight:800; }
              .t2 { margin:0; font-size: 12px; color:#334155; }
              .meta { margin: 18px 0 10px 0; border:1px solid #e5e7eb; border-radius:10px; }
              .meta table { width:100%; border-collapse: collapse; font-size: 12px; }
              .meta th { text-align:left; padding:8px 10px; background:#e3f2fd; color:#0d47a1; width: 26%; }
              .meta td { padding:8px 10px; border-top:1px solid #e5e7eb; }
              .kpis { display:flex; gap:10px; margin: 10px 0 0 0; }
              .k { flex:1; border:1px solid #e5e7eb; border-radius:10px; padding:10px; text-align:center; }
              .kv { font-size:20px; font-weight:800; }
              .kl { font-size:11px; color:#64748b; text-transform: uppercase; font-weight:700; }
              h3 { margin: 18px 0 6px 0; font-size: 14px; color:#0f172a; }
              .exec { border:1px solid #e5e7eb; border-radius:10px; padding:12px; font-size:12px; color:#334155; line-height:1.45; }
              .exec-tratativa { background:#f5f3ff; border-color:#c4b5fd; color:#5b21b6; }
              .exec-pendente { background:#fff7ed; border-color:#fdba74; color:#9a3412; }
              .exec-ok { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
              .nc-card { border-left:4px solid #ef4444; background:#fff7f7; border:1px solid #fecaca; border-radius:8px; padding:10px 12px; margin:6px 0; }
              .nc-card.nc-ok { border-left-color:#16a34a; background:#f0fdf4; border-color:#86efac; color:#14532d; }
              .nc-h { font-weight:800; color:#991b1b; font-size:12px; margin-bottom:4px; }
              .nc-j { font-size:12px; color:#6b7280; }
              .sec-bloco { border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; margin:8px 0; }
              .sec-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
              .sec-h { font-weight:800; font-size:13px; margin:0; }
              .sec-meta { font-size:11px; color:#64748b; margin-bottom:6px; }
              .sec-list { margin:0; padding-left:18px; font-size:12px; }
              .sec-status { font-size:11px; color:#0f172a; margin-top:6px; }
              .sec-label { font-weight:700; color:#475569; margin-right:6px; }
              .st-conforme { color:#16a34a; font-weight:800; }
              .st-nao_conforme { color:#b91c1c; font-weight:800; }
              .sec-apontamento { font-size:11px; color:#6b7280; margin-top:6px; }
              .timeline { position: relative; margin-top: 6px; }
              .tl-item { border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; margin:6px 0; }
              .tl-t { font-weight:800; font-size:12px; }
              .tl-m { font-size:11px; color:#64748b; }
              .ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e5e7eb; margin-top: 18px; padding-top: 10px; font-size:11px; color:#0d47a1; }
              .sign .line { margin-top: 24px; border-top:1px solid #0f172a; width: 240px; }
            </style></head><body>
              <div class="hdr"><img class="logo" src="static/logo_agevap.jpeg"/><div><div class="t1">Relatório de Checklist</div><div class="t2">Controle Interno - AGEVAP</div></div></div>
              <div class="meta">
                <table>
                  <tr><th>Processo</th><td>${checklist.numero_processo || '-'}</td></tr>
                  <tr><th>Modalidade</th><td>${mapearModalidade(checklist.modalidade) || '-'}</td></tr>
                  <tr><th>Área</th><td>${area || '-'}</td></tr>
                  <tr><th>Gestor</th><td>${gestor || '-'}</td></tr>
                  <tr><th>Data de Criação</th><td>${formatarData(checklist.data_criacao) || '-'}</td></tr>
                  <tr><th>Competências</th><td>${competencia || '-'}</td></tr>
                </table>
              </div>
              <div class="kpis">
                <div class="k"><div class="kv">${confR}</div><div class="kl">Conformes</div></div>
                <div class="k"><div class="kv">${naoR}</div><div class="kl">Não conformes</div></div>
                <div class="k"><div class="kv">${naR}</div><div class="kl">Não se aplica</div></div>
                <div class="k"><div class="kv">${taxaR}%</div><div class="kl">Taxa de conformidade</div></div>
              </div>
              <h3>Sumário Executivo</h3>
              <div class="exec">Este relatório descreve a análise do processo ${checklist.numero_processo || '-'} (${mapearModalidade(checklist.modalidade) || '-'}) com ${totalItensR} itens avaliados de ${totalElementosR} documentos. Observou-se ${confR} itens conformes (${taxaR}%), ${naoR} não conformes e ${naR} não aplicáveis. As seções seguintes detalham não conformidades, evidências por elemento e o parecer do controle interno.</div>
              <h3>Tratativa das Não Conformidades</h3>
              ${tratativaHtml}
              <h3>Registro de Não Conformidades</h3>
              ${ncCards}
              <h3>Detalhamento por Elemento</h3>
              ${elementosHTML}
              <h3>Parecer Controle Interno</h3>
              <div class="exec">${parecerTexto}</div>
              <div class="ft"><div class="sign"><div class="line"></div><div>${nomeUsuario}</div><div>Controle Interno</div></div><div>Emitido em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></div>
            </body></html>`;
            doc.write(html);
            doc.close();
            setTimeout(function() {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(function() {
                    document.body.removeChild(iframe);
                    if (btnImprimir) { btnImprimir.innerHTML = textoOriginal; btnImprimir.disabled = false; }
                }, 1000);
            }, 500);
            return;
        }
        // Cabeçalho e informações gerais
        var doc = iframe.contentWindow.document;
        doc.open();
        doc.write('<!DOCTYPE html>');
        doc.write('<html><head><title>Relatório de Checklist</title>');
        doc.write('<style>');
        doc.write('@media print { body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; } }');
        doc.write('body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; }');
        doc.write('.relatorio-cabecalho { display: flex; align-items: center; border-bottom: 2px solid #005baa; padding: 18px 24px 10px 24px; background: #fff; }');
        doc.write('.relatorio-logo { height: 55px; margin-right: 24px; }');
        doc.write('.relatorio-titulo { font-size: 1.6em; font-weight: bold; color: #005baa; margin-bottom: 2px; }');
        doc.write('.relatorio-subtitulo { font-size: 1em; color: #333; margin-bottom: 0; }');
        doc.write('.relatorio-info { margin: 24px 24px 0 24px; }');
        doc.write('.relatorio-info-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }');
        doc.write('.relatorio-info-table th, .relatorio-info-table td { text-align: left; padding: 6px 9px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }');
        doc.write('.relatorio-info-table th { background: #e3f2fd; color: #005baa; font-weight: bold; }');
        doc.write('.relatorio-elementos { margin: 0 24px 0 24px; }');
        doc.write('.elemento-bloco { margin-bottom: 20px; border: 1.5px solid #005baa; border-radius: 8px; background: #f9fbfd; padding: 12px 16px; }');
        doc.write('.elemento-titulo { font-size: 0.89em; font-weight: bold; color: #005baa; margin-bottom: 6px; }');
        doc.write('.elemento-info { margin-bottom: 4px; font-size: 10px; }');
        doc.write('.item-tabela { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }');
        doc.write('.item-tabela th, .item-tabela td { border: 1px solid #b3c6e0; padding: 4px 7px; font-size: 10px; }');
        doc.write('.item-tabela th { background: #e3f2fd; color: #005baa; font-weight: bold; }');
        doc.write('.item-tabela td.status-conforme { color: #00b386; font-weight: bold; }');
        doc.write('.item-tabela td.status-nao_conforme { color: #ff1744; font-weight: bold; }');
        doc.write('.item-tabela td.status-nao_se_aplica { color: #ffd600; font-weight: bold; }');
        doc.write('.relatorio-obs { margin: 24px 24px 0 24px; font-size: 10px; color: #444; }');
        doc.write('.relatorio-rodape { margin: 32px 24px 0 24px; border-top: 1.5px solid #005baa; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #005baa; }');
        doc.write('.assinatura-bloco { margin-top: 24px; font-size: 14px; }');
        doc.write('.linha-assinatura, .assinatura-cargo, .assinatura-eletronica { font-size: 14px !important; }');
        doc.write('.relatorio-pagina { text-align: right; font-size: 9px; color: #888; }');
        doc.write('</style>');
        doc.write('</head><body>');
        // Cabeçalho
        doc.write('<div class="relatorio-cabecalho">');
        doc.write('<img src="static/logo_agevap.jpeg" class="relatorio-logo" alt="Logo">');
        doc.write('<div>');
        doc.write('<div class="relatorio-titulo">Relatório de Conformidade de Processos</div>');
        doc.write('<div class="relatorio-subtitulo">Controle Interno - AGEVAP</div>');
        doc.write('</div></div>');
        // Informações gerais
        doc.write('<div class="relatorio-info">');
        doc.write('<table class="relatorio-info-table">');
        doc.write('<tr><th>Processo</th><td>' + (checklist.numero_processo || '-') + '</td>');
        doc.write('<th>Modalidade</th><td>' + (mapearModalidade(checklist.modalidade) || '-') + '</td></tr>');
        doc.write('<tr><th>Área</th><td>' + (area || '-') + '</td>');
        doc.write('<th>Gestor</th><td>' + (gestor || '-') + '</td></tr>');
        doc.write('<tr><th>Data de Criação</th><td>' + (formatarData(checklist.data_criacao) || '-') + '</td>');
        doc.write('<th>Competências</th><td>' + (competencia || '-') + '</td></tr>');
        doc.write('</table>');
        doc.write('</div>');
        // Elementos e itens
        doc.write('<div class="relatorio-elementos">');
        elementos.forEach(function(elemento, idx) {
            var itensDoElemento = itens.filter(item => item.elemento_id === elemento.id);
            doc.write('<div class="elemento-bloco">');
            // Remover duplicidade do número do item
            var textoElemento = (elemento.elemento || '-');
            doc.write('<div class="elemento-titulo">' + textoElemento + '</div>');
            doc.write('<div class="elemento-info"><b>Data:</b> ' + (elemento.data_elemento || elemento.data || '-') + ' &nbsp; <b>NUP:</b> ' + (elemento.nup || '-') + '</div>');
            doc.write('<table class="item-tabela"><thead><tr><th>Item</th><th>Status</th><th>Justificativa</th></tr></thead><tbody>');
            itensDoElemento.forEach(function(item) {
                var statusClass = 'status-' + (item.analise || '').toLowerCase().replace(/ /g, '_');
                doc.write('<tr>');
                doc.write('<td>' + (item.pergunta || '-') + '</td>');
                doc.write('<td class="' + statusClass + '">' + (item.analise || '-') + '</td>');
                doc.write('<td>' + (item.justificativa || '-') + '</td>');
                doc.write('</tr>');
            });
            doc.write('</tbody></table>');
            doc.write('</div>');
        });
        doc.write('</div>');
        // Observações
        doc.write('<div class="relatorio-obs"><b>Observações:</b> ____________________________________________________________________________________________<br><br>____________________________________________________________________________________________<br><br>____________________________________________________________________________________________</div>');
        // Rodapé
        doc.write('<div class="relatorio-rodape">');
        doc.write('<div class="assinatura-bloco"><div class="linha-assinatura">' + nomeUsuario + '</div><div class="assinatura-cargo">Controle Interno</div><div class="assinatura-eletronica">Assinado eletronicamente</div></div>');
        doc.write('<div class="relatorio-pagina">Data/Hora: ' + new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) + '</div>');
        doc.write('</div>');
        doc.write('</body></html>');
        doc.close();
        setTimeout(function() {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(function() {
                document.body.removeChild(iframe);
                if (btnImprimir) {
                    btnImprimir.innerHTML = textoOriginal;
                    btnImprimir.disabled = false;
                }
            }, 1000);
        }, 500);
    } catch (e) {
        alert('Erro ao gerar relatorio para impressao: ' + (e && e.message ? e.message : e));
        if (btnImprimir) {
            btnImprimir.innerHTML = textoOriginal;
            btnImprimir.disabled = false;
        }
    }
}

// Função para imprimir diretamente o checklist sem abrir o modal
async function imprimirDiretoChecklist(id) {
    try {
        const checklist = await carregarChecklistCompletoParaRelatorio(id);
        window.dadosChecklistAtual = checklist;
        await imprimirChecklist();
    } catch (e) {
        alert('Erro ao imprimir checklist: ' + e.message);
    }
}

async function baixarChecklistPdf(id) {
    try {
        const response = await fetch(`/api/checklists/${id}/pdf`, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || 'Erro ao baixar checklist em PDF.');
        }

        const blob = await response.blob();
        const header = response.headers.get('Content-Disposition') || '';
        const match = header.match(/filename="?([^"]+)"?/i);
        const filename = match && match[1] ? match[1] : `checklist-${id}.pdf`;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao baixar checklist em PDF:', error);
        alert(error.message || 'Erro ao baixar checklist em PDF.');
    }
}

async function carregarChecklistCompletoParaRelatorio(id) {
    const response = await fetch(`/api/checklists/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    });

    if (!response.ok) {
        throw new Error('Erro ao carregar detalhes do checklist');
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || 'Erro ao carregar detalhes do checklist');
    }

    return sanitizeDeep(data.checklist || {});
}

function mapearResposta(resposta) {
    switch ((resposta || '').toLowerCase()) {
        case 'conforme':
            return 'Conforme';
        case 'nao_conforme':
            return 'Não Conforme';
        case 'nao_se_aplica':
            return 'Não se Aplica';
        case 'em_andamento':
        case 'em andamento':
        case 'em_preenchimento':
        case 'pausado':
        case 'nao_iniciado':
            return 'Em preenchimento';
        case 'concluido':
            return 'Concluído';
        case 'ajustes_confirmados':
            return 'Corrigido pelo gestor';
        default:
            return resposta || '';
    }
}

function mapearResultadoChecklist(resultado) {
    switch ((resultado || '').toLowerCase()) {
        case 'tudo_ok':
            return 'Tudo ok';
        case 'com_nao_conformidades':
            return 'Com não conformidades';
        case 'corrigido_pelo_gestor':
            return 'Corrigido pelo gestor';
        case 'em_analise':
            return 'Em preenchimento';
        default:
            return resultado || '-';
    }
}

function formatarResultadoChecklist(resultado) {
    switch ((resultado || '').toLowerCase()) {
        case 'tudo_ok':
            return 'resultado-tudo_ok';
        case 'com_nao_conformidades':
            return 'resultado-com_nao_conformidades';
        case 'corrigido_pelo_gestor':
            return 'resultado-corrigido_pelo_gestor';
        case 'em_analise':
            return 'resultado-em_analise';
        default:
            return 'resultado-em_analise';
    }
}

function renderResultadoChecklist(checklist) {
    const resultado = inferirResultadoChecklist(checklist);
    const totalNc = Number(checklist.total_nao_conformidades || 0);
    const contadorNc = resultado === 'com_nao_conformidades' || resultado === 'corrigido_pelo_gestor'
        ? `<span class="resultado-checklist__meta">NC: ${totalNc}</span>`
        : '';

    return `
        <div class="resultado-checklist">
            <span class="status ${formatarResultadoChecklist(resultado)}">${escapeHtml(mapearResultadoChecklist(resultado))}</span>
            ${contadorNc}
        </div>
    `;
}

function inferirResultadoChecklist(checklist) {
    if (!checklist) {
        return 'em_analise';
    }

    if (checklist.ajustes_confirmados && (Number(checklist.total_nao_conformidades || 0) > 0 || checklist.tem_nao_conformidade)) {
        return 'corrigido_pelo_gestor';
    }

    const totalNc = Number(checklist.total_nao_conformidades || 0);
    if (totalNc > 0 || checklist.tem_nao_conformidade) {
        return 'com_nao_conformidades';
    }

    const status = String(checklist.status || '').toLowerCase();
    return status === 'concluido' ? 'tudo_ok' : (checklist.resultado || 'em_analise');
}

async function confirmarAjustesChecklist(checklistId) {
    if (!confirm('Confirmar que o gestor realizou os ajustes e que o Controle Interno conferiu essa regularização? As não conformidades originais serão mantidas no histórico.')) {
        return;
    }

    try {
        const response = await fetch(`/api/checklists/${checklistId}/confirmar-ajustes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Não foi possível confirmar os ajustes do gestor.');
        }

        alert(data.message || 'Correção do gestor confirmada com sucesso.');
        await carregarChecklists();
    } catch (error) {
        console.error('Erro ao confirmar ajustes do checklist:', error);
        alert(error.message || 'Erro ao confirmar ajustes do checklist.');
    }
}

function abrirModalConfirmacaoCorrecao(checklist) {
    const modal = document.getElementById('modalVisualizarChecklist');
    const modalContent = modal?.querySelector('.modal-content');
    if (!modal || !modalContent) {
        return;
    }

    const resultadoAtual = inferirResultadoChecklist(checklist);
    const totalNc = Number(checklist.total_nao_conformidades || 0);
    const confirmadoEm = escapeHtml(formatarDataHora(checklist.ajustes_confirmados_em) || 'Data nao informada');
    const confirmadoPor = escapeHtml(checklist.ajustes_confirmados_por || 'Usuario do sistema');
    const processo = escapeHtml(checklist.numero_processo || '-');
    const modalidade = escapeHtml(mapearModalidade(checklist.modalidade) || '-');

    modalContent.innerHTML = `
        <div class="modal-shell modal-shell--confirmacao">
            <div class="modal-shell__header">
                <div class="modal-shell__title-group">
                    <span class="modal-shell__eyebrow">Correção confirmada</span>
                    <h2>Confirmação da correção do gestor</h2>
                    <p>Revise o registro validado pelo Controle Interno. Se a confirmação tiver sido feita por engano, você pode desfazer e o checklist voltará a sinalizar as nao conformidades pendentes.</p>
                </div>
                <button class="modal-close" type="button" onclick="fecharModalVisualizar()" aria-label="Fechar modal">&times;</button>
            </div>
            <div class="modal-form">
                <div class="confirmacao-ajuste-card">
                    <div class="confirmacao-ajuste-card__hero">
                        <div>
                            <span class="confirmacao-ajuste-card__label">Status atual</span>
                            <div class="confirmacao-ajuste-card__status-wrap">
                                <span class="status ${formatarResultadoChecklist(resultadoAtual)}">${escapeHtml(mapearResultadoChecklist(resultadoAtual))}</span>
                            </div>
                        </div>
                        <div class="confirmacao-ajuste-card__count">
                            <span class="confirmacao-ajuste-card__count-value">${escapeHtml(String(totalNc))}</span>
                            <span class="confirmacao-ajuste-card__count-label">nao conformidade(s) confirmada(s)</span>
                        </div>
                    </div>
                    <div class="confirmacao-ajuste-grid">
                        <div class="confirmacao-ajuste-item">
                            <span class="confirmacao-ajuste-item__label">Checklist</span>
                            <strong class="confirmacao-ajuste-item__value">#${escapeHtml(checklist.id)}</strong>
                        </div>
                        <div class="confirmacao-ajuste-item">
                            <span class="confirmacao-ajuste-item__label">Processo</span>
                            <strong class="confirmacao-ajuste-item__value">${processo}</strong>
                        </div>
                        <div class="confirmacao-ajuste-item">
                            <span class="confirmacao-ajuste-item__label">Modalidade</span>
                            <strong class="confirmacao-ajuste-item__value">${modalidade}</strong>
                        </div>
                        <div class="confirmacao-ajuste-item">
                            <span class="confirmacao-ajuste-item__label">Confirmado por</span>
                            <strong class="confirmacao-ajuste-item__value">${confirmadoPor}</strong>
                        </div>
                        <div class="confirmacao-ajuste-item confirmacao-ajuste-item--full">
                            <span class="confirmacao-ajuste-item__label">Data da confirmacao</span>
                            <strong class="confirmacao-ajuste-item__value">${confirmadoEm}</strong>
                        </div>
                    </div>
                    <div class="confirmacao-ajuste-card__note">
                        A confirmação preserva o histórico do checklist e habilita a emissão do comprovante formal da regularização.
                    </div>
                </div>
            </div>
            <div class="modal-shell__footer">
                <button type="button" class="btn btn-secondary btn-secondary--soft" onclick="fecharModalVisualizar()">
                    Fechar
                </button>
                <button type="button" class="btn btn-primary btn-primary--strong" onclick="imprimirComprovanteCorrecao(${Number(checklist.id)})">
                    Imprimir comprovante
                </button>
                <button type="button" class="btn btn-danger btn-danger--outline" onclick="reverterConfirmacaoAjustesChecklist(${Number(checklist.id)})">
                    Desfazer confirmação
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'block';
}

async function reverterConfirmacaoAjustesChecklist(checklistId) {
    if (!confirm('Deseja realmente desfazer esta confirmação? O checklist voltará a indicar não conformidades encontradas.')) {
        return;
    }

    try {
        const response = await fetch(`/api/checklists/${checklistId}/reverter-confirmacao-ajustes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Não foi possível desfazer a confirmação da correção.');
        }

        fecharModalVisualizar();
        alert(data.message || 'Confirmação revertida com sucesso.');
        await carregarChecklists();
    } catch (error) {
        console.error('Erro ao reverter confirmação do checklist:', error);
        alert(error.message || 'Erro ao reverter confirmação da correção.');
    }
}

async function imprimirComprovanteCorrecao(checklistId) {
    try {
        const response = await fetch(`/api/checklists/${checklistId}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success || !data.checklist) {
            throw new Error(data.message || 'Nao foi possivel carregar os dados do comprovante.');
        }

        const checklist = data.checklist;
        const proc = checklist.processo_id ? await buscarDadosProcesso(checklist.processo_id) : null;
        const area = escapeHtml(proc?.area || '-');
        const gestor = escapeHtml(proc?.gestor || '-');
        const competencia = proc?.competencia && proc.competencia.trim()
            ? escapeHtml(formatarCompetencias(proc.competencia))
            : (formatarCompetencias(checklist.competencia) || '-');
        const nomeUsuario = escapeHtml(await buscarUsuarioLogado() || 'Controle Interno');

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(gerarHTMLComprovanteCorrecao({
            checklist,
            area,
            gestor,
            competencia,
            nomeUsuario
        }));
        doc.close();

        setTimeout(function () {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(function () {
                document.body.removeChild(iframe);
            }, 800);
        }, 400);
    } catch (error) {
        console.error('Erro ao imprimir comprovante de correção:', error);
        alert(error.message || 'Erro ao imprimir comprovante de correção.');
    }
}

function gerarHTMLComprovanteCorrecao(ctx) {
    const { checklist, area, gestor, competencia, nomeUsuario } = ctx;
    const baseUrl = window.location.origin;
    const logoAgevap = `${baseUrl}/static/logo_agevap.jpeg`;
    const logoAgedoce = `${baseUrl}/static/logo_agedoce.png`;
    const logoAgegrande = `${baseUrl}/static/logo_agegrande.png`;
    const logoAgegoias = `${baseUrl}/static/logo_agegoias.png`;
    const itensNc = (checklist.itens || []).filter(item => String(item.analise || '').trim().toLowerCase() === 'nao_conforme');
    const confirmadoEm = formatarDataHora(checklist.ajustes_confirmados_em) || 'data nao informada';
    const confirmadoPor = checklist.ajustes_confirmados_por || nomeUsuario || 'Controle Interno';
    const responsavelAnalise = escapeHtml(checklist.criado_por_nome || 'Controle Interno - SEDE');

    return `<!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Comprovante de Correcao de Nao Conformidades</title>
        <style>
          @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
          body { font-family: Segoe UI, Inter, Arial, sans-serif; color:#0f172a; background:#ffffff; }
          .logos { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; padding:0 6px; }
          .logo-left { height:34px; max-width:150px; object-fit:contain; flex-shrink:0; }
          .logo-right { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:nowrap; }
          .logo-divider { width:1px; height:30px; background:#cbd5e1; opacity:0.9; }
          .logo-right img { height:30px; max-width:104px; object-fit:contain; }
          .banner { background:linear-gradient(135deg, #0f5a2d, #166534 55%, #14532d); color:#fff; border-radius:18px; padding:14px 18px; font-weight:800; margin:0 0 14px 0; letter-spacing:0.4px; text-transform:uppercase; }
          .banner-inner { display:flex; align-items:center; gap:18px; }
          .banner-accent { width:13px; align-self:stretch; min-height:46px; border-radius:999px; background:linear-gradient(180deg, #4ec5ff, #2b8cff); }
          .banner-text { font-size:16px; line-height:1.28; }
          .meta-card { border:1px solid #dbe7ff; border-radius:14px; padding:0; background:#ffffff; overflow:hidden; }
          .grid { display:grid; grid-template-columns: 1.15fr 1.15fr 1.25fr 1.1fr 0.95fr; gap:0; }
          .cell { padding:10px 12px; min-height:54px; display:flex; position:relative; }
          .cell + .cell::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:1px; background:#dbe7ff; }
          .cell--row { grid-column:1 / -1; display:grid; grid-template-columns: 0.95fr 1.95fr; border-top:1px solid #dbe7ff; }
          .cell--row .cell { min-height:42px; padding:9px 12px; }
          .cell--row .cell::before { display:none; }
          .cell--row .cell + .cell::before { display:block; top:9px; bottom:9px; }
          .cell-head { display:flex; align-items:flex-start; gap:8px; width:100%; }
          .cell-icon { width:24px; height:24px; color:#1e4ea1; flex-shrink:0; margin-top:1px; }
          .cell-copy { flex:1; min-width:0; display:flex; flex-direction:column; }
          .label { font-size:8px; color:#36558f; font-weight:800; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.04em; }
          .value { font-size:10px; color:#0f172a; font-weight:700; line-height:1.2; }
          .value--compact { font-size:9px; line-height:1.18; word-break:break-word; }
          .section-title { display:flex; align-items:center; gap:12px; background:linear-gradient(135deg, #334766, #44506a); color:#fff; font-weight:900; padding:10px 14px; border-radius:14px; margin:18px 0 8px 0; }
          .section-title__icon { width:24px; height:24px; flex-shrink:0; }
          .exec { border:1px solid #e5e7eb; border-radius:10px; padding:12px; font-size:12px; color:#334155; line-height:1.45; }
          table { width:100%; border-collapse:collapse; border:1px solid #dbe7ff; border-radius:12px; overflow:hidden; }
          thead th { background:#f8fbff; color:#1e3a8a; font-size:10px; text-transform:uppercase; letter-spacing:0.03em; padding:10px 8px; border-bottom:1px solid #dbe7ff; }
          tbody td { padding:10px 8px; border-bottom:1px solid #e5e7eb; font-size:12px; vertical-align:top; }
          tbody tr:last-child td { border-bottom:none; }
          .td-num { width:44px; text-align:center; font-weight:800; }
          .status-ok { color:#16a34a; font-weight:800; }
          .confirm-grid { display:grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap:0; border:1px solid #dbe7ff; border-radius:12px; overflow:hidden; }
          .confirm-item { padding:10px 12px; position:relative; min-height:52px; }
          .confirm-item + .confirm-item::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:1px; background:#dbe7ff; }
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
            <div class="banner-text">COMPROVANTE DE CORRECAO DE NAO CONFORMIDADES CONTROLE INTERNO AGEVAP</div>
          </div>
        </div>
        <div class="meta-card">
          <div class="grid">
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg><div class="cell-copy"><div class="label">Processo</div><div class="value">${checklist.numero_processo || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Gestor</div><div class="value">${gestor || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M10 7h7v7"/><path d="M7 7h3"/><path d="M14 14 7 21"/></svg><div class="cell-copy"><div class="label">Modalidade</div><div class="value">${mapearModalidade(checklist.modalidade) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg><div class="cell-copy"><div class="label">Data de Criacao</div><div class="value">${formatarData(checklist.data_criacao) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 22h18"/><path d="M5 22V9l7-4 7 4v13"/><path d="M9 22V12h6v10"/><path d="M4 9h16"/></svg><div class="cell-copy"><div class="label">Area</div><div class="value">${area || '-'}</div></div></div></div>
            <div class="cell--row">
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Responsavel pela Analise</div><div class="value">${responsavelAnalise}</div></div></div></div>
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/><path d="m6.5 10 .8.8 1.7-1.7"/><path d="m6.5 14 .8.8 1.7-1.7"/></svg><div class="cell-copy"><div class="label">Competencias</div><div class="value value--compact">${competencia || '-'}</div></div></div></div>
            </div>
          </div>
        </div>
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/></svg><span>Resumo da Regularizacao</span></div>
        <div class="exec">
          As nao conformidades identificadas durante a analise do checklist foram objeto de correcao pelo gestor responsavel.
          Os ajustes informados foram posteriormente confirmados pelo Controle Interno, ficando registrada a regularizacao dos apontamentos relacionados abaixo.
        </div>
        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Registro das Correcoes</span></div>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Apontamento original</th>
              <th>Regularizacao confirmada</th>
              <th>Situacao</th>
              <th>Confirmado em</th>
            </tr>
          </thead>
          <tbody>
            ${itensNc.map((item, index) => `
              <tr>
                <td class="td-num">${index + 1}</td>
                <td>
                  <strong>${escapeHtml(item.pergunta || 'Item sem descricao')}</strong><br/>
                  ${escapeHtml(item.justificativa || 'Apontamento sem justificativa registrada.')}
                </td>
                <td>Ajuste do gestor conferido e considerado regularizado pelo Controle Interno.</td>
                <td class="status-ok">CORRIGIDO</td>
                <td>${escapeHtml(confirmadoEm)}</td>
              </tr>
            `).join('') || `
              <tr>
                <td class="td-num">-</td>
                <td colspan="4">Nao ha nao conformidades confirmadas para este comprovante.</td>
              </tr>
            `}
          </tbody>
        </table>
        <div class="print-block-keep">
          <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z"/></svg><span>Conclusao do Controle Interno</span></div>
          <div class="exec">
            Apos a verificacao das correcoes apresentadas, os apontamentos indicados neste relatorio foram considerados regularizados.
            O registro original das nao conformidades permanece preservado para fins de historico, controle e rastreabilidade.
          </div>
          <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg><span>Confirmacao</span></div>
          <div class="confirm-grid">
            <div class="confirm-item"><div class="label">Status</div><div class="value status-ok">AJUSTES CONFIRMADOS</div></div>
            <div class="confirm-item"><div class="label">Gestor</div><div class="value">${gestor || '-'}</div></div>
            <div class="confirm-item"><div class="label">Confirmado por</div><div class="value">${confirmadoPor}</div></div>
            <div class="confirm-item"><div class="label">Data da confirmacao</div><div class="value">${confirmadoEm}</div></div>
            <div class="confirm-item"><div class="label">Processo</div><div class="value">${checklist.numero_processo || '-'}</div></div>
          </div>
          <div class="footer">
            <div><strong>${nomeUsuario || 'Controle Interno'}</strong><br/>Controle Interno</div>
            <div>Data/Hora: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
          </div>
        </div>
      </body>
    </html>`;
}

// Carregar checklists quando a página carregar
// Template de impressao em PDF (layout AGEVAP)
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
    const na = itensNormalizados.filter(i => i.analise_normalizada === 'nao_se_aplica').length;
    const totalConsiderados = conf + nao;
    const taxa = totalConsiderados ? ((conf / totalConsiderados) * 100).toFixed(1) : '0.0';
    const total = itensImpressao.length;
    const totalElementos = (elementos || []).length;

    const elementosPorId = new Map((elementos || []).map(el => [el.id, el.elemento || '-']));
    const naoConformes = itensImpressao.filter(i => i.analise_normalizada === 'nao_conforme');
    const ncSection = naoConformes.length === 0
        ? '<div class="alert-ok">Nenhuma nao conformidade registrada.</div>'
        : naoConformes.map(i => {
            const elementoNome = elementosPorId.get(i.elemento_id) || '-';
        const apontamento = i.justificativa
            ? `<strong>Apontamento:</strong> ${i.justificativa}`
            : '<strong>Apontamento:</strong> Sem apontamento informado.';
            return `<div class="nc-card"><div class="nc-title">${elementoNome}</div><div class="nc-just">${apontamento}</div></div>`;
          }).join('');
    const parecerTexto = itensPendentes.length > 0
        ? 'O checklist ainda esta em preenchimento. Existem itens pendentes de resposta e o documento precisa ser concluido antes de representar um parecer final de conformidade.'
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
        const apontamentos = naoConformesEl
            .map(it => it.justificativa)
            .filter(Boolean)
            .join('<br>');
        const apontamentoHTML = isPendente
            ? `<div class="elem-apontamento"><strong>Pendencias:</strong> ${pendentesEl.length} item(ns) sem resposta neste elemento.</div>`
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
        <title>Relatorio de Checklist</title>
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
          .elem-list { margin:0; padding-left:18px; font-size:12px; }
          .st-conforme { color:#16a34a; }
          .st-nao_conforme { color:#b91c1c; }
          .st-nao_se_aplica { color:#d97706; }
          .timeline .tl-item { border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; margin:6px 0; }
          .tl-t { font-weight:800; font-size:12px; }
          .tl-m { font-size:11px; color:#64748b; }
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
            <div class="banner-text">RELATORIO DE CHECKLIST CONTROLE DE PROCESSOS - CONTROLE INTERNO AGEVAP</div>
          </div>
        </div>
        <div class="meta-card">
          <div class="grid">
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg><div class="cell-copy"><div class="label">Processo</div><div class="value">${checklist.numero_processo || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Gestor</div><div class="value">${gestor || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M10 7h7v7"/><path d="M7 7h3"/><path d="M14 14 7 21"/></svg><div class="cell-copy"><div class="label">Modalidade</div><div class="value">${mapearModalidade(checklist.modalidade) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg><div class="cell-copy"><div class="label">Data de Criacao</div><div class="value">${formatarData(checklist.data_criacao) || '-'}</div></div></div></div>
            <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 22h18"/><path d="M5 22V9l7-4 7 4v13"/><path d="M9 22V12h6v10"/><path d="M4 9h16"/></svg><div class="cell-copy"><div class="label">Area</div><div class="value">${area || '-'}</div></div></div></div>
            <div class="cell--row">
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><div class="cell-copy"><div class="label">Responsavel pela Analise</div><div class="value">${responsavelAnalise}</div></div></div></div>
              <div class="cell"><div class="cell-head"><svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/><path d="m6.5 10 .8.8 1.7-1.7"/><path d="m6.5 14 .8.8 1.7-1.7"/></svg><div class="cell-copy"><div class="label">Competencias</div><div class="value value--compact">${competencia || '-'}</div></div></div></div>
            </div>
          </div>
        </div>

        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/></svg><span>Sumario Executivo</span></div>
        <div class="exec">
        Este relatório apresenta uma análise qualitativa de conformidade do processo ${checklist.numero_processo || '-'}
        (${mapearModalidade(checklist.modalidade) || '-'}), com ${total} itens avaliados a partir de uma
        relação de ${totalElementos} documentos presentes no referido processo. Do total, ${conf} itens estão
        conformes, ${nao} não conformes, ${na} não se aplicam e ${itensPendentes.length} permanecem sem resposta, com uma taxa de ${taxa}% de conformidade sobre os itens efetivamente avaliados. As seções seguintes detalham os registros de não conformidade, o Status de conformidade por Documento e o Parecer do Controle Interno.
        </div>

        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Tratativa das nao conformidades</span></div>
        ${tratativaHtml}

        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Registro de nao conformidades</span></div>
        ${ncSection}

        <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg><span>Detalhamento por Elemento</span></div>
        ${elementosHTML}

        <div class="print-block-keep">
          <div class="section-title"><svg class="section-title__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z"/></svg><span>Parecer Controle Interno</span></div>
          <div class="exec">${parecerTexto}</div>

          <div class="footer">
            <div><strong>${nomeUsuario || 'Responsavel'}</strong><br/>Controle Interno</div>
            <div>Data/Hora: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</div>
          </div>
        </div>
      </body>
    </html>`;
}

document.addEventListener('DOMContentLoaded', function() {
    carregarChecklists();
    
    // Event Listeners para paginação
    document.getElementById('btnAnterior').addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            atualizarTabela();
            atualizarPaginacao();
        }
    });

    document.getElementById('btnProximo').addEventListener('click', () => {
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            atualizarTabela();
            atualizarPaginacao();
        }
    });

    // Ajustar seletor para só permitir 15 registros
    const selectItensPorPagina = document.getElementById('itensPorPagina');
    if (selectItensPorPagina) {
        selectItensPorPagina.innerHTML = '<option value="15" selected>15</option>';
        selectItensPorPagina.value = '15';
        selectItensPorPagina.addEventListener('change', (e) => {
            itensPorPagina = 15;
            paginaAtual = 1;
            totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina);
            atualizarTabela();
            atualizarPaginacao();
        });
    }
}); 

// Adicionar CSS para o botão +
const styleBtnAdd = document.createElement('style');
styleBtnAdd.textContent = `
.btn-add-item {
    font-size: 1em;
    margin-left: 8px;
    background: #0c9c6f;
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-weight: bold;
}
.btn-add-item:hover {
    background: #0a7d5a;
}`;
document.head.appendChild(styleBtnAdd); 

document.addEventListener('click', () => {
    document.querySelectorAll('.action-menu.is-open').forEach((menu) => {
        menu.classList.remove('is-open');
        const trigger = menu.querySelector('.action-menu__trigger');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
});
