let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: []
};

const SENHA_EXCLUSAO = '1234';
let usuarioAtual = { perfil: 'dentista', email: 'dentista@odontosantos.com' };
let abaOrigem = 'pacientes';
let pacienteAtualId = null;

// CARREGAR DADOS AO INICIAR
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    renderizarAgenda();
    renderizarPacientes();
    renderizarFinanceiro();
});

function salvarDados() {
    localStorage.setItem('odonto_db', JSON.stringify(db));
}

function carregarDados() {
    const salvos = localStorage.getItem('odonto_db');
    if (salvos) {
        try {
            db = JSON.parse(salvos);
        } catch (e) {
            console.error("Erro ao carregar dados", e);
        }
    }
}

// NAVEGAÇÃO DE ABAS
function trocarAba(abaId) {
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    const abaAlvo = document.getElementById(`aba-${abaId}`);
    if (abaAlvo) abaAlvo.classList.remove('hidden');

    document.querySelectorAll('.aba-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'border', 'border-indigo-100');
        btn.classList.add('text-slate-600');
    });

    const btnAtivo = document.getElementById(`btn-aba-${abaId}`);
    if (btnAtivo) {
        btnAtivo.classList.add('bg-indigo-50', 'text-indigo-700', 'border', 'border-indigo-100');
        btnAtivo.classList.remove('text-slate-600');
    }

    if (abaId === 'agenda') renderizarAgenda();
    if (abaId === 'pacientes') renderizarPacientes();
    if (abaId === 'financeiro') renderizarFinanceiro();
}

function fecharModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    document.getElementById(modalId).classList.remove('flex');
}

function abrirModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function fecharModalPersonalizado() {
    fecharModal('modal-customizado');
}

function alertCustomizado(mensagem) {
    document.getElementById('modal-custom-titulo').innerText = "Aviso";
    document.getElementById('modal-custom-corpo').innerHTML = `<p class="text-slate-700">${mensagem}</p>`;
    document.getElementById('modal-custom-botoes').innerHTML = `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">OK</button>`;
    abrirModal('modal-customizado');
}

// ==========================================
// FICHA COMPLETA DO PACIENTE (INTEGRALMENTE RESTAURADA)
// ==========================================
function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem || 'pacientes';
    pacienteAtualId = pacienteId;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    trocarAba('detalhes-paciente');
    const container = document.getElementById('detalhes-paciente-container');
    if (!container) return;

    const agendamentosPaciente = db.agendamentos.filter(ag => !ag.isLembrete && ag.pacienteId === pacienteId);
    const prontuariosPaciente = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    const pagamentosPaciente = db.pagamentos.filter(pg => pg.pacienteId === pacienteId);

    const telefoneLimpo = paciente.telefone ? paciente.telefone.replace(/\D/g, '') : '';
    const btnWhatsapp = telefoneLimpo ? `<a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-bold ml-2 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp text-base"></i> Conversar</a>` : '';

    let badgePendencia = '';
    if (paciente.possuiPendenciaManual) {
        badgePendencia = `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase font-bold text-amber-600 tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Pendência Financeira</span>
                </div>
                <p class="text-xs font-medium text-amber-900">${paciente.obsFinanceiraManual || 'Paciente marcado com pendência/débito.'}</p>
                <button onclick="removerPendenciaManual('${paciente.id}')" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1"><i class="fa-solid fa-check"></i> Dar Baixa</button>
            </div>
        `;
    } else {
        badgePendencia = `
            <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div><span class="text-[10px] uppercase font-bold text-emerald-600">Financeiro: </span><span class="text-xs font-semibold text-emerald-800">Sem pendências</span></div>
            </div>
        `;
    }

    let etapas = Array.isArray(paciente.planejamentoEtapas) ? paciente.planejamentoEtapas : [];
    const valorTotalPlano = etapas.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

    let htmlItensEtapas = etapas.length === 0 ? '<p class="text-xs text-slate-400 italic p-2">Nenhuma etapa cadastrada no plano de tratamento.</p>' :
        etapas.map((et, index) => {
            const numEtapa = index + 1;
            const statusBg = et.concluido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
            const statusTexto = et.concluido ? 'Concluído' : 'Pendente';
            const estiloTexto = et.concluido ? 'line-through text-slate-400' : 'text-slate-800 font-medium';
            const valorFmt = et.valor ? 'R$ ' + Number(et.valor).toFixed(2) : 'R$ 0,00';

            const btnCheck = `<button type="button" onclick="alternarStatusEtapa('${paciente.id}', '${et.id}')" class="px-2 py-1 ${et.concluido ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white'} text-xs font-semibold rounded hover:opacity-90 transition"><i class="fa-solid ${et.concluido ? 'fa-rotate-left' : 'fa-check'}"></i> ${et.concluido ? 'Reabrir' : 'Concluir'}</button>`;
            const btnLixo = `<button type="button" onclick="excluirEtapaPlanejamento('${paciente.id}', '${et.id}')" class="text-slate-400 hover:text-red-600 text-xs p-1" title="Excluir Etapa"><i class="fa-solid fa-trash"></i></button>`;

            return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-indigo-100 text-xs gap-2 shadow-sm">
                    <div class="flex items-center space-x-2 flex-grow min-w-0">
                        <span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">#${numEtapa}</span>
                        <span class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">${et.dente || 'Geral'}</span>
                        <span class="${estiloTexto} truncate">${et.procedimento}</span>
                    </div>
                    <div class="flex items-center justify-between sm:justify-end space-x-2 whitespace-nowrap pt-1 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <span class="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">${valorFmt}</span>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${statusBg}">${statusTexto}</span>
                        ${btnCheck} ${btnLixo}
                    </div>
                </div>
            `;
        }).join('');

    let htmlFormAdicionarEtapa = `
        <form onsubmit="adicionarEtapaPlanejamento(event, '${paciente.id}')" class="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100">
            <div class="sm:col-span-2"><input type="text" id="plan-dente" placeholder="Dente" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>
            <div class="sm:col-span-5"><input type="text" id="plan-desc" required placeholder="Procedimento (ex: Restauração)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>
            <div class="sm:col-span-3"><input type="number" step="0.01" id="plan-valor" placeholder="Valor (R$)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>
            <div class="sm:col-span-2"><button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow flex items-center justify-center gap-1"><i class="fa-solid fa-plus"></i> Add</button></div>
        </form>
    `;

    let htmlFormProntuario = `
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm mb-4">
            <h4 class="font-bold text-blue-900 text-sm flex items-center gap-2"><i class="fa-solid fa-stethoscope text-blue-600"></i> Registrar Evolução do Prontuário</h4>
            <form onsubmit="salvarProcedimentoDentista(event, '${paciente.id}')" class="space-y-3">
                <div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Procedimento Realizado *</label><input type="text" id="proc-desc" required placeholder="Ex: Restauração Resina Dente 16" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>
                <div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Próximo Retorno / Observação</label><input type="text" id="proc-proxima" placeholder="Ex: Polimento" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>
                <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Prontuário</button>
            </form>
        </div>
    `;

    container.innerHTML = `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
                <div>
                    <h2 class="text-xl font-bold text-slate-900">${paciente.nome} ${btnWhatsapp}</h2>
                    <p class="text-xs text-slate-500 mt-0.5">CPF: ${paciente.cpf || 'Não informado'} | Tel: ${paciente.telefone || 'Não informado'} | Nasc: ${paciente.nascimento || 'Não informado'}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold ${paciente.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${paciente.categoria}</span>
            </div>

            ${badgePendencia}

            <!-- Plano de Tratamento por Etapas -->
            <div class="space-y-3 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                <div class="flex justify-between items-center text-xs font-bold text-indigo-900">
                    <span><i class="fa-solid fa-list-check text-indigo-600 mr-1"></i> Plano de Tratamento por Etapas</span>
                    <span>Total Planejado: R$ ${valorTotalPlano.toFixed(2)}</span>
                </div>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">${htmlItensEtapas}</div>
                ${htmlFormAdicionarEtapa}
            </div>

            <!-- Formulário e Histórico de Prontuário -->
            ${htmlFormProntuario}

            <div class="space-y-3 border-t pt-4">
                <h4 class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-clock-rotate-left text-slate-500 mr-1"></i> Histórico de Evoluções Clínicas</h4>
                <div class="space-y-2 max-h-[35vh] overflow-y-auto">
                    ${prontuariosPaciente.length === 0 ? '<p class="text-xs text-slate-400 italic">Nenhuma evolução registrada.</p>' : prontuariosPaciente.map(pr => `
                        <div class="p-3 bg-slate-50 rounded-xl border text-xs space-y-1">
                            <div class="flex justify-between text-[11px] text-slate-500 border-b pb-1">
                                <span><i class="fa-regular fa-clock mr-1"></i>${pr.data || ''}</span>
                                <span class="font-bold text-indigo-700">${pr.usuario || 'Dentista'}</span>
                            </div>
                            <p class="font-semibold text-slate-800">${pr.descricao}</p>
                            ${pr.proximoRetorno ? `<p class="text-slate-500 text-[11px]"><strong>Próximo retorno:</strong> ${pr.proximoRetorno}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function voltarParaOrigem() {
    trocarAba(abaOrigem);
}

// ETAPAS E PENDÊNCIAS DA FICHA
function adicionarEtapaPlanejamento(e, pacienteId) {
    e.preventDefault();
    const dente = document.getElementById('plan-dente').value.trim();
    const proc = document.getElementById('plan-desc').value.trim();
    const valor = parseFloat(document.getElementById('plan-valor').value) || 0;

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    if (!Array.isArray(paciente.planejamentoEtapas)) paciente.planejamentoEtapas = [];

    paciente.planejamentoEtapas.push({
        id: 'etapa_' + Date.now(),
        dente,
        procedimento: proc,
        valor,
        concluido: false
    });

    salvarDados();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function alternarStatusEtapa(pacienteId, etapaId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente || !Array.isArray(paciente.planejamentoEtapas)) return;

    const etapa = paciente.planejamentoEtapas.find(e => e.id === etapaId);
    if (etapa) {
        etapa.concluido = !etapa.concluido;
        salvarDados();
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

function excluirEtapaPlanejamento(pacienteId, etapaId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente || !Array.isArray(paciente.planejamentoEtapas)) return;

    paciente.planejamentoEtapas = paciente.planejamentoEtapas.filter(e => e.id !== etapaId);
    salvarDados();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function salvarProcedimentoDentista(e, pacienteId) {
    e.preventDefault();
    const desc = document.getElementById('proc-desc').value.trim();
    const prox = document.getElementById('proc-proxima').value.trim();

    db.prontuarios.unshift({
        id: 'pront_' + Date.now(),
        pacienteId,
        descricao: desc,
        proximoRetorno: prox,
        usuario: usuarioAtual ? usuarioAtual.email : 'Dentista',
        data: new Date().toLocaleDateString('pt-BR')
    });

    salvarDados();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function removerPendenciaManual(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        paciente.possuiPendenciaManual = false;
        paciente.obsFinanceiraManual = '';
        salvarDados();
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

// ==========================================
// ABA PACIENTES E MODAL
// ==========================================
function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes');
    if (!container) return;

    const busca = (document.getElementById('filtro-pacientes-busca')?.value || '').toLowerCase();
    const filtrados = db.pacientes.filter(p => 
        p.nome.toLowerCase().includes(busca) || 
        (p.cpf && p.cpf.includes(busca)) || 
        (p.telefone && p.telefone.includes(busca))
    );

    if (filtrados.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 text-slate-400 text-xs">Nenhum paciente encontrado.</div>`;
        return;
    }

    container.innerHTML = filtrados.map(p => `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow transition flex flex-col justify-between space-y-3">
            <div>
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-slate-800 text-sm">${p.nome}</h3>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${p.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${p.categoria}</span>
                </div>
                <p class="text-xs text-slate-500 mt-1">Tel: ${p.telefone || 'N/I'} | CPF: ${p.cpf || 'N/I'}</p>
            </div>
            <div class="flex gap-2 pt-2 border-t border-slate-100">
                <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-100 transition">
                    Ver Prontuário
                </button>
            </div>
        </div>
    `).join('');
}

function abrirModalPaciente() {
    document.getElementById('paciente-id').value = '';
    document.getElementById('paciente-nome').value = '';
    document.getElementById('paciente-telefone').value = '';
    document.getElementById('paciente-cpf').value = '';
    document.getElementById('paciente-nascimento').value = '';
    document.getElementById('paciente-categoria').value = 'Clínica Geral';
    document.getElementById('titulo-modal-paciente').innerText = 'Novo Paciente';
    abrirModal('modal-paciente');
}

function salvarPaciente(e) {
    e.preventDefault();
    const id = document.getElementById('paciente-id').value || 'pac_' + Date.now();
    const nome = document.getElementById('paciente-nome').value.trim();
    const telefone = document.getElementById('paciente-telefone').value.trim();
    const cpf = document.getElementById('paciente-cpf').value.trim();
    const nascimento = document.getElementById('paciente-nascimento').value;
    const categoria = document.getElementById('paciente-categoria').value;

    const index = db.pacientes.findIndex(p => p.id === id);
    const dados = { id, nome, telefone, cpf, nascimento, categoria };

    if (index >= 0) db.pacientes[index] = { ...db.pacientes[index], ...dados };
    else db.pacientes.push({ ...dados, planejamentoEtapas: [], possuiPendenciaManual: false });

    salvarDados();
    fecharModal('modal-paciente');
    renderizarPacientes();
}

// ==========================================
// CAIXA & FINANCEIRO (COM BUSCA DE PACIENTE CORRIGIDA)
// ==========================================
function filtrarPacientesCaixa() {
    const termo = (document.getElementById('caixa-busca-paciente')?.value || '').toLowerCase();
    const select = document.getElementById('pagamento-paciente-id');
    if (!select) return;

    select.innerHTML = '';
    const filtrados = db.pacientes.filter(p => p.nome.toLowerCase().includes(termo));

    if (filtrados.length === 0) {
        select.innerHTML = `<option disabled class="p-2 text-slate-400">Nenhum paciente encontrado</option>`;
        return;
    }

    filtrados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nome} (${p.categoria})`;
        opt.className = 'p-2 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer';
        select.appendChild(opt);
    });
}

function abrirModalPagamento() {
    document.getElementById('caixa-busca-paciente').value = '';
    filtrarPacientesCaixa();
    document.getElementById('pagamento-descricao').value = '';
    document.getElementById('pagamento-valor').value = '';
    document.getElementById('pagamento-forma').value = 'Pix';
    abrirModal('modal-pagamento');
}

function salvarPagamentoCaixa(e) {
    e.preventDefault();
    const pacienteId = document.getElementById('pagamento-paciente-id').value;
    const desc = document.getElementById('pagamento-descricao').value.trim();
    const valor = parseFloat(document.getElementById('pagamento-valor').value) || 0;
    const forma = document.getElementById('pagamento-forma').value;

    if (!pacienteId) {
        alertCustomizado("Por favor, selecione um paciente na lista.");
        return;
    }

    const paciente = db.pacientes.find(p => p.id === pacienteId);

    db.pagamentos.unshift({
        id: 'pag_' + Date.now(),
        pacienteId,
        pacienteNome: paciente ? paciente.nome : 'Paciente',
        descricao: desc,
        valor,
        forma,
        data: new Date().toLocaleDateString('pt-BR')
    });

    salvarDados();
    fecharModal('modal-pagamento');
    renderizarFinanceiro();
}

function abrirModalDespesa() {
    document.getElementById('despesa-descricao').value = '';
    document.getElementById('despesa-valor').value = '';
    document.getElementById('despesa-categoria').value = 'Insumos/Materiais';
    abrirModal('modal-despesa');
}

function salvarDespesaCaixa(e) {
    e.preventDefault();
    const desc = document.getElementById('despesa-descricao').value.trim();
    const valor = parseFloat(document.getElementById('despesa-valor').value) || 0;
    const categoria = document.getElementById('despesa-categoria').value;

    db.despesas.unshift({
        id: 'desp_' + Date.now(),
        descricao: desc,
        valor,
        categoria,
        data: new Date().toLocaleDateString('pt-BR')
    });

    salvarDados();
    fecharModal('modal-despesa');
    renderizarFinanceiro();
}

function renderizarFinanceiro() {
    const totRecebido = db.pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const totDespesas = db.despesas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    const saldo = totRecebido - totDespesas;

    document.getElementById('financeiro-total-recebido').innerText = `R$ ${totRecebido.toFixed(2)}`;
    document.getElementById('financeiro-total-despesas').innerText = `R$ ${totDespesas.toFixed(2)}`;
    document.getElementById('financeiro-saldo-liquidado').innerText = `R$ ${saldo.toFixed(2)}`;

    // Renderizar recebimentos
    const containerRec = document.getElementById('lista-recebimentos-caixa');
    if (containerRec) {
        containerRec.innerHTML = db.pagamentos.length === 0 ? '<p class="text-xs text-slate-400 italic">Nenhum recebimento registrado.</p>' :
            db.pagamentos.map(p => `
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                        <span class="font-bold text-slate-800 block">${p.pacienteNome}</span>
                        <span class="text-slate-500 text-[11px]">${p.descricao} • ${p.forma} (${p.data})</span>
                    </div>
                    <span class="font-bold text-emerald-600">+ R$ ${(Number(p.valor) || 0).toFixed(2)}</span>
                </div>
            `).join('');
    }

    // Renderizar despesas
    const containerDesp = document.getElementById('lista-despesas-caixa');
    if (containerDesp) {
        containerDesp.innerHTML = db.despesas.length === 0 ? '<p class="text-xs text-slate-400 italic">Nenhuma despesa registrada.</p>' :
            db.despesas.map(d => `
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                        <span class="font-bold text-slate-800 block">${d.descricao}</span>
                        <span class="text-slate-500 text-[11px]">${d.categoria} (${d.data})</span>
                    </div>
                    <span class="font-bold text-rose-600">- R$ ${(Number(d.valor) || 0).toFixed(2)}</span>
                </div>
            `).join('');
    }
}

// ==========================================
// ABA AGENDA
// ==========================================
function renderizarAgenda() {
    const container = document.getElementById('lista-agendamentos');
    if (!container) return;

    const dataFiltro = document.getElementById('filtro-agenda-data')?.value;
    const buscaFiltro = (document.getElementById('filtro-agenda-busca')?.value || '').toLowerCase();

    let agendamentos = db.agendamentos;

    if (dataFiltro) agendamentos = agendamentos.filter(a => a.data === dataFiltro);
    if (buscaFiltro) agendamentos = agendamentos.filter(a => a.pacienteNome.toLowerCase().includes(buscaFiltro));

    if (agendamentos.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Nenhum agendamento encontrado para o filtro.</div>`;
        return;
    }

    container.innerHTML = agendamentos.map(a => `
        <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
            <div class="flex items-start space-x-3">
                <div class="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-center min-w-[70px]">
                    <span class="block text-xs font-bold">${a.hora || '00:00'}</span>
                    <span class="block text-[10px] text-indigo-500">${a.data ? a.data.split('-').reverse().join('/') : ''}</span>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${a.pacienteNome}</h4>
                    <p class="text-xs text-slate-500">${a.procedimento || 'Consulta Odontológica'}</p>
                </div>
            </div>
            <button onclick="abrirDetalhesPaciente('${a.pacienteId}', 'agenda')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-100 transition">
                Abrir Prontuário
            </button>
        </div>
    `).join('');
}

function limparFiltrosAgenda() {
    if (document.getElementById('filtro-agenda-data')) document.getElementById('filtro-agenda-data').value = '';
    if (document.getElementById('filtro-agenda-busca')) document.getElementById('filtro-agenda-busca').value = '';
    renderizarAgenda();
}
