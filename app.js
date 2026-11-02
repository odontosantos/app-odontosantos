let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: [],
    auditoria: []
};

const SENHA_EXCLUSAO = '1234';
let ouvinteTempoReal = null;
let visaoAgendaAtual = 'dia';
let usuarioAtual = null;
let abaOrigem = 'agenda';
let subAbaAtualPaciente = 'prontuario';
let pacienteAtualId = null;
let exibiApenasInativos = false;
let dataAgendaAtual = obterDataLocalISO();

// ==========================================
// UTILITÁRIOS E ASSINATURA
// ==========================================
function obterUsuarioAssinatura() {
    if (usuarioAtual && usuarioAtual.email) {
        return usuarioAtual.email.split('@')[0];
    }
    return 'dr.mikeias';
}

function gerarIdUnico() {
    return Date.now().toString() + '-' + Math.floor(Math.random() * 10000);
}

function obterDataLocalISO() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return ano + '-' + mes + '-' + dia;
}

function formatarMesAno(dataStr) {
    if (!dataStr) return 'Outros';
    const partes = dataStr.split('-');
    if (partes.length < 2) return 'Outros';
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return (meses[parseInt(partes[1], 10) - 1] || 'Mês') + ' de ' + partes[0];
}

// ==========================================
// AUDITORIA (60 DIAS) E MODAIS
// ==========================================
function registrarAuditoria(acao, detalhes) {
    const hoje = new Date();
    if (!db.auditoria) db.auditoria = [];
    db.auditoria.push({
        id: gerarIdUnico(),
        data: hoje.toISOString(),
        acao: acao,
        detalhes: detalhes,
        usuario: obterUsuarioAssinatura()
    });
    limparAuditoriaAntiga();
    persistirDB();
}

function limparAuditoriaAntiga() {
    if (!db.auditoria) return;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 60);
    db.auditoria = db.auditoria.filter(log => new Date(log.data) >= dataLimite);
}

function abrirModalAuditoria() {
    const logs = (db.auditoria || []).slice().sort((a, b) => new Date(b.data) - new Date(a.data));
    let html = '<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">';
    if(logs.length === 0) {
        html += '<p class="text-sm text-slate-400 p-2">Nenhum registro nos últimos 60 dias.</p>';
    } else {
        logs.forEach(log => {
            const dataFmt = new Date(log.data).toLocaleString('pt-BR');
            html += `<div class="p-3 border-b border-slate-100 text-xs bg-slate-50 rounded-lg mb-2">
                        <div class="flex justify-between items-center font-bold text-slate-700">
                            <span>${log.acao}</span>
                            <span class="text-slate-400">${dataFmt}</span>
                        </div>
                        <div class="text-slate-500 mt-1">${log.detalhes}</div>
                        <div class="text-blue-600 mt-2 flex items-center gap-1 font-medium"><i class="fa-solid fa-pen text-[10px]"></i> ${log.usuario}</div>
                     </div>`;
        });
    }
    html += '</div>';
    mostrarModalPersonalizado("Auditoria de Sistema (60 Dias)", html, `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs shadow">Fechar</button>`);
}

function mostrarModalPersonalizado(titulo, corpoHtml, botoesHtml) {
    const modal = document.getElementById('modal-customizado');
    document.getElementById('modal-custom-titulo').innerText = titulo;
    document.getElementById('modal-custom-corpo').innerHTML = corpoHtml;
    document.getElementById('modal-custom-botoes').innerHTML = botoesHtml;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function fecharModalPersonalizado() {
    fecharModal('modal-customizado');
}

function verificarSenhaExclusao() {
    return new Promise((resolve) => {
        const corpo = `<p class="text-slate-600">Ação restrita. Digite a senha de exclusão:</p>
                       <input type="password" id="input-senha-exclusao-modal" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Senha">`;
        const botoes = `<button onclick="fecharModalPersonalizado(); window._senhaResolvida(false)" class="px-3 py-2 border rounded-lg text-xs">Cancelar</button>
                        <button onclick="const s = document.getElementById('input-senha-exclusao-modal').value; fecharModalPersonalizado(); window._senhaResolvida(s === '${SENHA_EXCLUSAO}');" class="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold">Confirmar</button>`;
        window._senhaResolvida = (val) => {
            if (!val) alertCustomizado("❌ Senha incorreta ou ação cancelada.");
            resolve(val);
        };
        mostrarModalPersonalizado("🔒 Confirmação de Segurança", corpo, botoes);
    });
}

function alertCustomizado(mensagem) {
    mostrarModalPersonalizado("Aviso", `<p class="text-slate-700">${mensagem}</p>`, `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">OK</button>`);
}

// ==========================================
// PERSISTÊNCIA E TEMPO REAL (SYNC)
// ==========================================
function carregarDadosLocais() {
    try {
        db.pacientes = JSON.parse(localStorage.getItem('odonto_pacientes')) || [];
        db.agendamentos = JSON.parse(localStorage.getItem('odonto_agendamentos')) || [];
        db.prontuarios = JSON.parse(localStorage.getItem('odonto_prontuarios')) || [];
        db.pagamentos = JSON.parse(localStorage.getItem('odonto_pagamentos')) || [];
        db.despesas = JSON.parse(localStorage.getItem('odonto_despesas')) || [];
        db.auditoria = JSON.parse(localStorage.getItem('odonto_auditoria')) || [];
    } catch (e) { console.error("Erro ao carregar dados locais.", e); }
}

carregarDadosLocais();

async function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));
    localStorage.setItem('odonto_auditoria', JSON.stringify(db.auditoria));

    if (window.usaFirebase && window.firebaseDb && window.setDoc) {
        try {
            await window.setDoc(window.doc(window.firebaseDb, "clinica", "dados_compartilhados"), db);
        } catch (e) { console.warn("Falha ao sincronizar Firebase.", e); }
    }
}

async function sincronizarDadosNuvem() {
    if (window.usaFirebase && window.firebaseDb && window.getDoc) {
        try {
            const snap = await window.getDoc(window.doc(window.firebaseDb, "clinica", "dados_compartilhados"));
            if (snap.exists()) {
                db = Object.assign(db, snap.data());
                if(!db.auditoria) db.auditoria = [];
                persistirDB(); 
            }
        } catch (e) { console.warn("Falha ao puxar nuvem.", e); }
    }
}

function ativarSincronizacaoEmTempoReal() {
    if (window.usaFirebase && window.firebaseDb) {
        if (ouvinteTempoReal) return;
        ouvinteTempoReal = window.firebaseDb.collection("clinica").doc("dados_compartilhados")
            .onSnapshot((doc) => {
                if (doc.exists) {
                    db = Object.assign(db, doc.data());
                    if (!db.auditoria) db.auditoria = [];
                    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
                    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
                    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
                    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
                    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));
                    localStorage.setItem('odonto_auditoria', JSON.stringify(db.auditoria));

                    if (document.getElementById('tab-agenda') && !document.getElementById('tab-agenda').classList.contains('hidden')) {
                        renderizarAgendaCards();
                    }
                    if (document.getElementById('tab-pacientes') && !document.getElementById('tab-pacientes').classList.contains('hidden')) {
                        renderizarPacientes();
                    }
                    if (document.getElementById('tab-financeiro') && !document.getElementById('tab-financeiro').classList.contains('hidden')) {
                        renderizarFinanceiro();
                    }
                    if (document.getElementById('tab-detalhes-paciente') && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden') && pacienteAtualId) {
                        abrirDetalhesPaciente(pacienteAtualId, abaOrigem);
                    }
                }
            });
    }
}

function mascaraTelefone(input) {
    let v = input.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    input.value = v.substring(0, 15);
}

function mascaraCPF(input) {
    let v = input.value.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    input.value = v.substring(0, 14);
}

async function fazerLoginFirebase(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    if (!window.usaFirebase || !window.firebaseAuth) return alertCustomizado("⚠️ Firebase carregando...");
    
    try {
        await window.firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
        processarUsuarioLogado(userCredential.user);
    } catch (error) {
        alertCustomizado("❌ Erro no login: " + error.message);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.usaFirebase && window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged(async (user) => {
                if (user) processarUsuarioLogado(user);
            });
        }
    }, 1000);
});

async function processarUsuarioLogado(user) {
    usuarioAtual = { perfil: 'dentista', email: user.email };
    iniciarSessaoSistema();
    registrarAuditoria('Login', 'Acesso ao sistema.');
}

async function iniciarSessaoSistema() {
    document.getElementById('login-screen')?.classList.replace('flex', 'hidden');
    await sincronizarDadosNuvem();
    document.getElementById('main-header')?.classList.remove('hidden');
    document.getElementById('main-nav')?.classList.remove('hidden');
    document.getElementById('main-content')?.classList.remove('hidden');
    configurarNavbar();
    inicializarSistema();
    ativarSincronizacaoEmTempoReal();
}

function logout() {
    if (ouvinteTempoReal) { ouvinteTempoReal(); ouvinteTempoReal = null; }
    if (window.usaFirebase && window.signOut) window.signOut(window.firebaseAuth);
    usuarioAtual = null;
    document.getElementById('login-screen')?.classList.replace('hidden', 'flex');
    document.getElementById('main-header')?.classList.add('hidden');
    document.getElementById('main-nav')?.classList.add('hidden');
    document.getElementById('main-content')?.classList.add('hidden');
}

function configurarNavbar() {
    const badge = document.getElementById('header-user-badge');
    if (badge) {
        badge.innerText = `Dr. Mikeias Santos (${obterUsuarioAssinatura()})`;
    }
    const navTabs = document.getElementById('nav-tabs');
    if (navTabs) {
        navTabs.innerHTML = `
            <button onclick="mudarAba('agenda')" id="btn-tab-agenda" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-blue-500 text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-calendar-days"></i> Agenda</button>
            <button onclick="mudarAba('pacientes')" id="btn-tab-pacientes" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-users"></i> Pacientes</button>
            <button onclick="mudarAba('financeiro')" id="btn-tab-financeiro" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-file-invoice-dollar"></i> Financeiro</button>
        `;
    }
}

function mudarAba(nomeAba) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#nav-tabs button').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-white');
        btn.classList.add('border-transparent', 'text-slate-400');
    });

    const abaAlvo = document.getElementById('tab-' + nomeAba);
    if (abaAlvo) abaAlvo.classList.remove('hidden');

    const ativoBtn = document.getElementById('btn-tab-' + nomeAba);
    if (ativoBtn) {
        ativoBtn.classList.remove('border-transparent', 'text-slate-400');
        ativoBtn.classList.add('border-blue-500', 'text-white');
    }

    if (nomeAba === 'agenda') renderizarAgendaCards();
    if (nomeAba === 'pacientes') renderizarPacientes();
    if (nomeAba === 'financeiro') renderizarFinanceiro();
}

function inicializarSistema() {
    popularSelectPacientes();
    mudarAba('agenda');
}

// ==========================================
// AGENDA (CINEMA 08h-21h E MACRO)
// ==========================================
function mudarVisaoAgenda(visao) {
    visaoAgendaAtual = visao;
    ['dia', 'semana', 'mes'].forEach(v => {
        const btn = document.getElementById(`btn-visao-${v}`);
        if(btn) {
            if(v === visao) {
                btn.className = "px-3 py-1 bg-white text-blue-600 shadow-sm rounded text-xs font-bold border border-slate-200";
            } else {
                btn.className = "px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-xs font-bold transition";
            }
        }
    });
    renderizarAgendaCards();
}

function mudarDiaAgenda(dias) {
    const data = new Date(dataAgendaAtual + 'T12:00:00');
    if(visaoAgendaAtual === 'dia') data.setDate(data.getDate() + dias);
    if(visaoAgendaAtual === 'semana') data.setDate(data.getDate() + (dias * 7));
    if(visaoAgendaAtual === 'mes') data.setMonth(data.getMonth() + dias);
    dataAgendaAtual = data.toISOString().split('T')[0];
    renderizarAgendaCards();
}

function alterarDataAgendaManual(event) {
    if (event.target.value) {
        dataAgendaAtual = event.target.value;
        renderizarAgendaCards();
    }
}

function renderizarAgendaCards() {
    const container = document.getElementById('agenda-cards-container');
    const displayData = document.getElementById('data-agenda-display');
    const inputData = document.getElementById('input-data-agenda');
    if (!container || !displayData) return;

    if (inputData) inputData.value = dataAgendaAtual;
    container.className = "flex flex-col gap-2 overflow-y-auto max-h-[70vh] pr-2";

    const dataObj = new Date(dataAgendaAtual + 'T12:00:00');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    if(visaoAgendaAtual === 'dia') {
        displayData.innerText = `${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}, ${dataObj.getFullYear()}`;
        renderizarAgendaDiariaCinema(container);
    } else if(visaoAgendaAtual === 'semana') {
        displayData.innerText = `Semana de ${String(dataObj.getDate()).padStart(2,'0')} ${meses[dataObj.getMonth()]}`;
        renderizarAgendaSemanal(container);
    } else if(visaoAgendaAtual === 'mes') {
        displayData.innerText = `${meses[dataObj.getMonth()]} de ${dataObj.getFullYear()}`;
        renderizarAgendaMensal(container);
    }
}

function renderizarAgendaDiariaCinema(container) {
    container.innerHTML = '';
    const eventosDoDia = db.agendamentos.filter(a => a.data === dataAgendaAtual);

    for(let h = 8; h <= 21; h++) {
        ['00', '30'].forEach(m => {
            if(h === 21 && m === '30') return;
            let horaSlot = String(h).padStart(2,'0') + ':' + m;
            
            let eventoEncontrado = eventosDoDia.find(ag => ag.horario <= horaSlot && ag.horaFim > horaSlot);

            if(eventoEncontrado) {
                if(eventoEncontrado._renderizado) return;
                eventoEncontrado._renderizado = true;

                let isBloqueio = eventoEncontrado.tipoEvento === 'bloqueio';
                let isLembrete = eventoEncontrado.tipoEvento === 'lembrete';
                let titulo = isLembrete ? '📌 ' + eventoEncontrado.titulo : (isBloqueio ? '🔒 ' + eventoEncontrado.titulo : (db.pacientes.find(p => p.id === eventoEncontrado.pacienteId)?.nome || 'Paciente'));
                let cor = eventoEncontrado.cor || (isBloqueio ? '#ef4444' : '#3b82f6');
                
                let statusHtml = '';
                if(!isLembrete && !isBloqueio) {
                    const statusAtual = eventoEncontrado.status || 'agendado';
                    let corStatus = 'bg-blue-100 text-blue-700';
                    let iconStatus = 'fa-clock';
                    if (statusAtual === 'atendido') { corStatus = 'bg-emerald-100 text-emerald-700'; iconStatus = 'fa-check-double'; }
                    if (statusAtual === 'faltou') { corStatus = 'bg-rose-100 text-rose-700'; iconStatus = 'fa-user-xmark'; }
                    if (statusAtual === 'remarcou') { corStatus = 'bg-amber-100 text-amber-700'; iconStatus = 'fa-rotate'; }
                    statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${corStatus} absolute top-2 right-2"><i class="fa-solid ${iconStatus}"></i> ${statusAtual}</span>`;
                }

                container.innerHTML += `
                <div class="relative bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex cursor-pointer hover:shadow-md transition min-h-[65px]" onclick="abrirModalDetalhesAgendamento('${eventoEncontrado.id}')">
                    <div class="w-1.5 shrink-0" style="background-color: ${cor};"></div>
                    <div class="p-2.5 flex-grow flex flex-col justify-center min-w-0 pr-20">
                        <span class="font-extrabold text-slate-800 text-[11px] mb-0.5 flex items-center gap-1"><i class="fa-regular fa-clock text-slate-400"></i> ${eventoEncontrado.horario} às ${eventoEncontrado.horaFim || '?'}</span>
                        <h4 class="font-bold text-slate-900 text-sm leading-tight truncate">${titulo}</h4>
                        <p class="text-[10px] text-slate-500 truncate mt-0.5">${eventoEncontrado.tipo || eventoEncontrado.obs || ''}</p>
                        ${statusHtml}
                    </div>
                    <div class="w-10 bg-slate-50 border-l border-slate-100 flex justify-center items-center shrink-0 absolute right-0 top-0 bottom-0">
                         <i class="fa-solid fa-chevron-right text-blue-600 text-xs"></i>
                    </div>
                </div>`;
            } else {
                container.innerHTML += `
                <div class="border-2 border-dashed border-slate-200 bg-slate-50/50 p-2 rounded-lg flex justify-between items-center text-slate-400 hover:bg-blue-50/50 transition shadow-sm cursor-pointer" onclick="abrirModalAgendamento('${dataAgendaAtual}', '${horaSlot}')">
                    <span class="text-[11px] font-bold uppercase tracking-wide"><i class="fa-regular fa-clock"></i> ${horaSlot} (Livre)</span>
                    <button class="px-2 py-1 bg-white border border-slate-200 text-blue-600 rounded text-[10px] font-bold shadow-sm flex items-center gap-1"><i class="fa-solid fa-plus"></i> Encaixar</button>
                </div>`;
            }
        });
    }
    db.agendamentos.forEach(a => delete a._renderizado);
}

function renderizarAgendaSemanal(container) {
    container.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3"><h4 class="font-bold text-slate-800 text-sm border-b pb-2">Visão Macro Semanal</h4><p class="text-xs text-slate-500">Utilize as setas para alternar as semanas.</p></div>`;
}

function renderizarAgendaMensal(container) {
    container.innerHTML = `<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3"><h4 class="font-bold text-slate-800 text-sm border-b pb-2">Visão Macro Mensal</h4><p class="text-xs text-slate-500">Utilize as setas para alternar os meses.</p></div>`;
}

// ==========================================
// MODAIS DE AGENDAMENTO E DETALHES
// ==========================================
function alterarStatusAgendamento(id, status) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (ag) {
        ag.status = status;
        persistirDB();
        renderizarAgendaCards();
        abrirModalDetalhesAgendamento(id);
    }
}

function atualizarHoraFimPadrao() {
    const inputInicio = document.getElementById('agendamento-horario');
    const inputFim = document.getElementById('agendamento-hora-fim');
    if (!inputInicio || !inputFim || !inputInicio.value) return;
    const [h, m] = inputInicio.value.split(':').map(Number);
    let totalMins = h * 60 + m + 30;
    let novoH = Math.floor(totalMins / 60) % 24;
    let novoM = totalMins % 60;
    inputFim.value = String(novoH).padStart(2, '0') + ':' + String(novoM).padStart(2, '0');
}

function abrirModalDetalhesAgendamento(id) {
    const ag = db.agendamentos.find(item => item.id === id);
    if (!ag) return;

    if (ag.tipoEvento === 'lembrete' || ag.tipoEvento === 'bloqueio' || ag.isLembrete) {
        const icone = ag.tipoEvento === 'bloqueio' ? '🔒' : '📌';
        document.getElementById('detalhe-ag-paciente').innerText = icone + ' ' + (ag.titulo || 'Lembrete');
        document.getElementById('detalhe-ag-categoria').innerText = 'BLOQUEIO / LEMBRETE';
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-tipo').innerText = 'Evento de Agenda';
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação.';
        
        document.getElementById('botoes-acao-detalhe').innerHTML = `
            <div class="flex gap-2 mt-4 pt-3 border-t w-full justify-end">
                <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}')" class="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold"><i class="fa-solid fa-trash"></i> Excluir</button>
            </div>`;
    } else {
        const paciente = db.pacientes.find(p => p.id === ag.pacienteId) || { nome: 'DESCONHECIDO', categoria: 'Geral' };
        document.getElementById('detalhe-ag-paciente').innerText = paciente.nome;
        document.getElementById('detalhe-ag-categoria').innerText = paciente.categoria;
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-tipo').innerText = ag.tipo;
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação.';

        document.getElementById('botoes-acao-detalhe').innerHTML = `
            <div class="flex flex-col gap-3 mt-4 pt-3 border-t w-full">
                <div class="grid grid-cols-3 gap-1.5">
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'atendido')" class="py-2 bg-emerald-100 text-emerald-700 rounded text-xs font-bold"><i class="fa-solid fa-check"></i> Atendido</button>
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'faltou')" class="py-2 bg-rose-100 text-rose-700 rounded text-xs font-bold"><i class="fa-solid fa-user-xmark"></i> Faltou</button>
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'remarcou')" class="py-2 bg-amber-100 text-amber-700 rounded text-xs font-bold"><i class="fa-solid fa-rotate"></i> Remarcou</button>
                </div>
                <div class="flex justify-between items-center">
                    <button onclick="fecharModal('modal-detalhes-agendamento'); abrirDetalhesPaciente('${ag.pacienteId}', 'agenda')" class="px-3 py-2 bg-blue-50 text-blue-600 rounded text-xs font-bold"><i class="fa-solid fa-eye"></i> Ver Ficha</button>
                    <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}', '${ag.pacienteId}')" class="px-3 py-2 bg-red-50 text-red-600 rounded text-xs font-bold"><i class="fa-solid fa-trash"></i> Excluir</button>
                </div>
            </div>`;
    }
    document.getElementById('modal-detalhes-agendamento').classList.replace('hidden', 'flex');
}

function abrirModalAgendamento(dataPreenchida, horaPreenchida) {
    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-edit-id').value = '';
    document.getElementById('agendamento-data').value = dataPreenchida || dataAgendaAtual;
    if(horaPreenchida) {
        document.getElementById('agendamento-horario').value = horaPreenchida;
        atualizarHoraFimPadrao();
    }
    document.getElementById('modal-agendamento').classList.replace('hidden', 'flex');
}

function salvarAgendamento(event) {
    event.preventDefault();
    const pacienteId = document.getElementById('agendamento-paciente').value;
    const editId = document.getElementById('agendamento-edit-id').value;
    const dataAg = document.getElementById('agendamento-data').value;
    const horaAg = document.getElementById('agendamento-horario').value;
    const horaFimAg = document.getElementById('agendamento-hora-fim').value;

    if (!pacienteId) return alertCustomizado('Selecione um paciente.');
    if (horaFimAg <= horaAg) return alertCustomizado('Hora final inválida.');

    const dados = {
        tipoEvento: 'agendamento',
        pacienteId,
        data: dataAg,
        horario: horaAg,
        horaFim: horaFimAg,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim()
    };

    if (editId) {
        const idx = db.agendamentos.findIndex(a => a.id === editId);
        const statusAntigo = db.agendamentos[idx].status;
        db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados, status: statusAntigo };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), status: 'agendado', ...dados });
    }

    registrarAuditoria('Agendamento', 'Agendamento salvo.');
    persistirDB();
    fecharModal('modal-agendamento');
    renderizarAgendaCards();
}

async function excluirAgendamento(id, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    db.agendamentos = db.agendamentos.filter(a => a.id !== id);
    persistirDB();
    renderizarAgendaCards();
    if(pacienteId) abrirDetalhesPaciente(pacienteId, abaOrigem);
    alertCustomizado('Item excluído!');
}

function abrirModalLembrete() {
    document.getElementById('lembrete-data').value = dataAgendaAtual;
    document.getElementById('modal-lembrete').classList.replace('hidden', 'flex');
}

function salvarLembrete(event) {
    event.preventDefault();
    const titulo = document.getElementById('lembrete-titulo').value.trim();
    const isBloqueio = document.getElementById('lembrete-is-bloqueio').checked;
    
    db.agendamentos.push({
        id: gerarIdUnico(),
        isLembrete: true,
        tipoEvento: isBloqueio ? 'bloqueio' : 'lembrete',
        titulo,
        data: document.getElementById('lembrete-data').value,
        horario: document.getElementById('lembrete-horario').value,
        horaFim: document.getElementById('lembrete-hora-fim').value,
        obs: document.getElementById('lembrete-obs').value.trim()
    });

    persistirDB();
    fecharModal('modal-lembrete');
    renderizarAgendaCards();
}

// ==========================================
// PACIENTES E PRONTUÁRIOS
// ==========================================
function definirFiltroCategoria(cat) {
    exibiApenasInativos = false;
    window._categoriaSelecionada = cat;
    renderizarPacientes();
}

function alternarFiltroInativos() {
    exibiApenasInativos = !exibiApenasInativos;
    renderizarPacientes();
}

function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes-container');
    if (!container) return;
    container.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-1";
    container.innerHTML = '';
    
    const termo = (document.getElementById('busca-pacientes-tabela')?.value || '').toLowerCase();
    const filtrados = db.pacientes.filter(p => p.nome.toLowerCase().includes(termo) || (p.cpf || '').includes(termo));

    if (filtrados.length === 0) {
        container.innerHTML = '<p class="text-slate-400 p-4">Nenhum paciente encontrado.</p>';
        return;
    }

    filtrados.forEach(p => {
        container.innerHTML += `
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between gap-3">
            <div>
                <h4 class="font-bold text-slate-900 text-base">${p.nome}</h4>
                <p class="text-xs text-slate-500"><i class="fa-solid fa-phone"></i> ${p.telefone || '-'}</p>
                <span class="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600">${p.categoria}</span>
            </div>
            <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"><i class="fa-solid fa-eye"></i> Abrir Ficha</button>
        </div>`;
    });
}

function abrirModalPaciente(pacienteId) {
    document.getElementById('form-paciente')?.reset();
    document.getElementById('paciente-edit-id').value = pacienteId || '';
    if(pacienteId) {
        const p = db.pacientes.find(x => x.id === pacienteId);
        if(p) {
            document.getElementById('paciente-nome').value = p.nome;
            document.getElementById('paciente-telefone').value = p.telefone || '';
            document.getElementById('paciente-nascimento').value = p.nascimento || '';
            document.getElementById('paciente-cpf').value = p.cpf || '';
            document.getElementById('paciente-categoria').value = p.categoria;
        }
    }
    document.getElementById('modal-paciente').classList.replace('hidden', 'flex');
}

function salvarPaciente(event) {
    event.preventDefault();
    const editId = document.getElementById('paciente-edit-id').value;
    const dados = {
        nome: document.getElementById('paciente-nome').value.trim().toUpperCase(),
        telefone: document.getElementById('paciente-telefone').value,
        nascimento: document.getElementById('paciente-nascimento').value,
        cpf: document.getElementById('paciente-cpf').value,
        categoria: document.getElementById('paciente-categoria').value
    };

    if(editId) {
        const idx = db.pacientes.findIndex(p => p.id === editId);
        db.pacientes[idx] = { ...db.pacientes[idx], ...dados };
    } else {
        db.pacientes.push({ id: gerarIdUnico(), planejamentoEtapas: [], ...dados });
    }

    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();
    if(editId && pacienteAtualId) abrirDetalhesPaciente(pacienteAtualId, abaOrigem);
    alertCustomizado('Paciente salvo com sucesso!');
}

async function excluirPaciente(pacienteId) {
    if(!(await verificarSenhaExclusao())) return;
    db.pacientes = db.pacientes.filter(p => p.id !== pacienteId);
    db.agendamentos = db.agendamentos.filter(a => a.pacienteId !== pacienteId);
    persistirDB();
    renderizarPacientes();
    mudarAba('pacientes');
    alertCustomizado('Paciente excluído.');
}

function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem;
    pacienteAtualId = pacienteId;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    const container = document.getElementById('detalhes-paciente-container');
    if(container) {
        container.innerHTML = `
        <div class="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h2 class="text-xl font-bold text-slate-900">${paciente.nome}</h2>
            <p class="text-xs text-slate-500">Telefone: ${paciente.telefone || '-'} | Categoria: ${paciente.categoria}</p>
            <div class="flex gap-2 pt-2">
                <button onclick="mudarAba('${origem}')" class="px-4 py-2 bg-slate-100 rounded text-xs font-bold">Voltar</button>
                <button onclick="excluirPaciente('${paciente.id}')" class="px-4 py-2 bg-rose-50 text-rose-600 rounded text-xs font-bold">Excluir Paciente</button>
            </div>
        </div>`;
    }
    mudarAba('detalhes-paciente');
}

function voltarParaOrigem() { mudarAba(abaOrigem || 'pacientes'); }

// ==========================================
// FINANCEIRO, BACKUP E PDF
// ==========================================
function renderizarFinanceiro() {
    const elFat = document.getElementById('kpi-faturamento');
    const elDesp = document.getElementById('kpi-despesas');
    const elSaldo = document.getElementById('kpi-saldo-liquido');
    
    let fat = 0, desp = 0;
    db.pagamentos.forEach(p => fat += parseFloat(p.valor || 0));
    db.despesas.forEach(d => desp += parseFloat(d.valor || 0));

    if(elFat) elFat.innerText = 'R$ ' + fat.toFixed(2);
    if(elDesp) elDesp.innerText = 'R$ ' + desp.toFixed(2);
    if(elSaldo) elSaldo.innerText = 'R$ ' + (fat - desp).toFixed(2);
}

function lancarDespesa() {
    const corpo = `<div><label class="text-xs font-semibold">Valor (R$)</label><input type="number" id="d-val" class="w-full p-2 border rounded"></div>`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-3 py-1 border rounded">Cancelar</button><button onclick="salvarDespesa()" class="px-3 py-1 bg-rose-600 text-white rounded">Salvar</button>`;
    mostrarModalPersonalizado("Nova Despesa", corpo, botoes);
}

function salvarDespesa() {
    const v = parseFloat(document.getElementById('d-val').value) || 0;
    db.despesas.push({ id: gerarIdUnico(), data: obterDataLocalISO(), valor: v, descricao: 'Despesa Geral' });
    persistirDB();
    fecharModalPersonalizado();
    renderizarFinanceiro();
}

function abrirModalCaixaDiario() { alertCustomizado("Caixa Diário ativo."); }
function abrirModalPagamentoAvulso() { alertCustomizado("Pagamento avulso ativo."); }
function alternarFiltroPersonalizadoFinanceiro() { renderizarFinanceiro(); }

function exportarBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "backup_clinica_" + obterDataLocalISO() + ".json");
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importarBackup(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        db = JSON.parse(evt.target.result);
        if(!db.auditoria) db.auditoria = [];
        persistirDB();
        renderizarAgendaCards();
        alertCustomizado("Backup restaurado!");
    };
    reader.readAsText(file);
}

function fecharModal(id) {
    document.getElementById(id)?.classList.replace('flex', 'hidden');
}

function popularSelectPacientes() {
    const sel = document.getElementById('agendamento-paciente');
    if(sel) {
        sel.innerHTML = '';
        db.pacientes.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nome}</option>`);
    }
}
