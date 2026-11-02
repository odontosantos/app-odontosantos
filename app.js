let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: [],
    auditoria: []
};

const SENHA_EXCLUSAO = '1234';

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
// SISTEMA DE AUDITORIA LEVE (60 DIAS)
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

// ==========================================
// MODAL DE ALERTAS/PROMPTS PERSONALIZADOS
// ==========================================
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
    const corpo = `<p class="text-slate-700">${mensagem}</p>`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">OK</button>`;
    mostrarModalPersonalizado("Aviso", corpo, botoes);
}

// ==========================================
// PERSISTÊNCIA DE SESSÃO E DADOS
// ==========================================
function carregarDadosLocais() {
    try {
        db.pacientes = JSON.parse(localStorage.getItem('odonto_pacientes')) || [];
        db.agendamentos = JSON.parse(localStorage.getItem('odonto_agendamentos')) || [];
        db.prontuarios = JSON.parse(localStorage.getItem('odonto_prontuarios')) || [];
        db.pagamentos = JSON.parse(localStorage.getItem('odonto_pagamentos')) || [];
        db.despesas = JSON.parse(localStorage.getItem('odonto_despesas')) || [];
        db.auditoria = JSON.parse(localStorage.getItem('odonto_auditoria')) || [];
    } catch (e) {
        console.error("Erro ao carregar dados locais.", e);
    }
}

carregarDadosLocais();

let usuarioAtual = null;
let abaOrigem = 'agenda';
let subAbaAtualPaciente = 'prontuario';
let pacienteAtualId = null;
let exibiApenasInativos = false;
let dataAgendaAtual = obterDataLocalISO();

async function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));
    localStorage.setItem('odonto_auditoria', JSON.stringify(db.auditoria));

    if (window.usaFirebase && window.firebaseDb && window.setDoc) {
        try {
            const docRef = window.doc(window.firebaseDb, "clinica", "dados_compartilhados");
            await window.setDoc(docRef, db);
        } catch (e) {
            console.warn("Aviso: Falha ao sincronizar com o Firebase.", e);
        }
    }
}

async function sincronizarDadosNuvem() {
    if (window.usaFirebase && window.firebaseDb && window.getDoc) {
        try {
            const docRef = window.doc(window.firebaseDb, "clinica", "dados_compartilhados");
            const snap = await window.getDoc(docRef);
            if (snap.exists()) {
                db = Object.assign(db, snap.data());
                if(!db.auditoria) db.auditoria = [];
                persistirDB(); 
            }
        } catch (e) {
            console.warn("Aviso: Falha ao puxar dados da nuvem.", e);
        }
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

function prevenirEnterBusca(e) {
    if (e.key === 'Enter') e.preventDefault();
}

async function fazerLoginFirebase(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (!window.usaFirebase || !window.firebaseAuth) {
        alertCustomizado("⚠️ O Firebase ainda está carregando. Aguarde um segundo e tente novamente.");
        return;
    }

    try {
        await window.firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
        processarUsuarioLogado(userCredential.user);
    } catch (error) {
        let mensagemErro = error.message;
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            mensagemErro = "E-mail ou senha incorretos.";
        }
        alertCustomizado("❌ Erro no login: " + mensagemErro);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.usaFirebase && window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged(async (user) => {
                if (user) {
                    processarUsuarioLogado(user);
                }
            });
        }
    }, 1000);
});

async function processarUsuarioLogado(user) {
    try {
        const docRef = window.doc(window.firebaseDb, "usuarios", user.email);
        const userDoc = await window.getDoc(docRef);
        let perfilEncontrado = userDoc.exists() ? userDoc.data().perfil : 'secretaria';
        usuarioAtual = { perfil: perfilEncontrado, email: user.email };
        registrarAuditoria('Login', 'Acesso ao sistema.');
        iniciarSessaoSistema();
    } catch (e) {
        usuarioAtual = { perfil: 'secretaria', email: user.email };
        iniciarSessaoSistema();
    }
}

async function iniciarSessaoSistema() {
    const telaLogin = document.getElementById('login-screen');
    if (telaLogin) telaLogin.classList.replace('flex', 'hidden');

    await sincronizarDadosNuvem();

    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('main-content').classList.add('flex-grow');
    
    configurarNavbar();
    inicializarSistema();
}

function logout() {
    if (window.usaFirebase && window.signOut) {
        window.signOut(window.firebaseAuth);
    }
    usuarioAtual = null;
    document.getElementById('login-screen').classList.replace('hidden', 'flex');
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
}

function configurarNavbar() {
    const navTabs = document.getElementById('nav-tabs');
    const badge = document.getElementById('header-user-badge');
    if (!navTabs || !badge) return;

    badge.innerText = `Logado como: ${obterUsuarioAssinatura()}`;
    badge.className = 'inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800 rounded-full mt-0.5';

    navTabs.innerHTML = '<button onclick="mudarAba(\'agenda\')" id="btn-tab-agenda" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-blue-500 text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-calendar-days"></i> Agenda</button>' +
        '<button onclick="mudarAba(\'pacientes\')" id="btn-tab-pacientes" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-users"></i> Pacientes</button>' +
        '<button onclick="mudarAba(\'financeiro\')" id="btn-tab-financeiro" class="px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-file-invoice-dollar"></i> Financeiro</button>';
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

    const fab = document.getElementById('fab-agenda-mobile');
    if (fab) {
        fab.classList.toggle('hidden', nomeAba !== 'agenda');
    }

    if (nomeAba === 'agenda') renderizarAgendaCards();
    if (nomeAba === 'pacientes') renderizarPacientes();
    if (nomeAba === 'financeiro') renderizarFinanceiro();
}

function inicializarSistema() {
    popularSelectPacientes();
    mudarAba('agenda');
    inicializarCalendario();
}

// ==========================================
// AGENDA (Cards Verticais e Cálculo de Buracos)
// ==========================================
function inicializarCalendario() {
    renderizarAgendaCards();
}

function atualizarCalendario() {
    renderizarAgendaCards();
}

function mudarDiaAgenda(dias) {
    const data = new Date(dataAgendaAtual + 'T12:00:00');
    data.setDate(data.getDate() + dias);
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
    container.className = "flex flex-col gap-2 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin scrollbar-thumb-slate-300";

    const dataObj = new Date(dataAgendaAtual + 'T12:00:00');
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const hojeIso = obterDataLocalISO();
    if (dataAgendaAtual === hojeIso) {
        displayData.innerText = `Hoje, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}`;
    } else {
        displayData.innerText = `${diasSemana[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}`;
    }

    container.innerHTML = '';
    const eventos = db.agendamentos.filter(a => a.data === dataAgendaAtual);
    eventos.sort((a, b) => a.horario.localeCompare(b.horario));

    let ultimaHoraFim = "08:00"; 

    if (eventos.length === 0) {
        container.innerHTML = '<div class="text-center p-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400"><i class="fa-solid fa-mug-hot text-4xl mb-3 text-slate-300"></i><p class="font-medium">Sem pacientes agendados para este dia. Agenda livre.</p></div>';
        return;
    }

    eventos.forEach(ag => {
        if (ag.horario > ultimaHoraFim) {
            container.innerHTML += `
            <div class="border-2 border-dashed border-slate-200 bg-slate-50/50 p-2 rounded-lg flex justify-between items-center text-slate-400 hover:bg-slate-100 transition shadow-sm">
                <span class="text-[11px] font-bold uppercase tracking-wide"><i class="fa-regular fa-clock"></i> ${ultimaHoraFim} às ${ag.horario} (Livre)</span>
                <button onclick="abrirModalAgendamento('${dataAgendaAtual}', '${ultimaHoraFim}')" class="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold shadow-sm hover:border-blue-400 transition flex items-center gap-1"><i class="fa-solid fa-plus"></i> Encaixar</button>
            </div>`;
        }

        const isBloqueio = ag.tipoEvento === 'bloqueio';
        const isLembrete = ag.tipoEvento === 'lembrete';
        
        let titulo, subtitulo, corFundo;
        if(isLembrete) {
            titulo = '📌 Lembrete: ' + ag.titulo; subtitulo = ag.obs || ''; corFundo = ag.cor || '#f59e0b';
        } else if (isBloqueio) {
            titulo = '🔒 Bloqueio: ' + ag.titulo; subtitulo = ag.obs || 'Horário Indisponível'; corFundo = ag.cor || '#ef4444';
        } else {
            titulo = db.pacientes.find(p => p.id === ag.pacienteId)?.nome || 'Paciente Não Encontrado';
            subtitulo = ag.tipo + (ag.obs ? ' • ' + ag.obs : '');
            corFundo = ag.cor || '#3b82f6';
        }

        let statusHtml = '';
        if(!isLembrete && !isBloqueio) {
            const statusAtual = ag.status || 'agendado';
            let corStatus = 'bg-blue-100 text-blue-700';
            let iconStatus = 'fa-clock';
            if (statusAtual === 'atendido') { corStatus = 'bg-emerald-100 text-emerald-700'; iconStatus = 'fa-check-double'; corFundo = '#10b981'; }
            if (statusAtual === 'faltou') { corStatus = 'bg-rose-100 text-rose-700'; iconStatus = 'fa-user-xmark'; corFundo = '#f43f5e'; }
            if (statusAtual === 'remarcou') { corStatus = 'bg-slate-200 text-slate-700'; iconStatus = 'fa-rotate'; corFundo = '#94a3b8'; }
            statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${corStatus} absolute top-2 right-2"><i class="fa-solid ${iconStatus}"></i> ${statusAtual}</span>`;
        }

        container.innerHTML += `
        <div class="relative bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex cursor-pointer hover:shadow-md transition active:scale-[0.98] min-h-[65px]" onclick="abrirModalDetalhesAgendamento('${ag.id}')">
            <div class="w-1.5 shrink-0" style="background-color: ${corFundo};"></div>
            <div class="p-2.5 flex-grow flex flex-col justify-center min-w-0 pr-20">
                <span class="font-extrabold text-slate-800 text-[11px] mb-0.5 flex items-center gap-1"><i class="fa-regular fa-clock text-slate-400"></i> ${ag.horario} às ${ag.horaFim || '?'}</span>
                <h4 class="font-bold text-slate-900 text-sm leading-tight truncate">${titulo}</h4>
                <p class="text-[10px] text-slate-500 truncate mt-0.5">${subtitulo}</p>
                ${statusHtml}
            </div>
            <div class="w-10 bg-slate-50 border-l border-slate-100 flex justify-center items-center shrink-0 absolute right-0 top-0 bottom-0">
                 <i class="fa-solid fa-chevron-right text-blue-600 text-xs"></i>
            </div>
        </div>`;

        if (ag.horaFim && ag.horaFim > ultimaHoraFim) {
            ultimaHoraFim = ag.horaFim;
        }
    });
}

function alterarStatusAgendamento(id, status) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (ag && ag.tipoEvento === 'agendamento') {
        if (ag.status === status) ag.status = 'agendado';
        else ag.status = status;
        
        persistirDB();
        atualizarCalendario();
        abrirModalDetalhesAgendamento(id);
    }
}

// ==========================================
// MODAIS DE AGENDAMENTO E LEMBRETES
// ==========================================
function atualizarHoraFimPadrao() {
    const inputInicio = document.getElementById('agendamento-horario');
    const inputFim = document.getElementById('agendamento-hora-fim');
    if (!inputInicio || !inputFim) return;
    const horaInicio = inputInicio.value;
    if (horaInicio) {
        const partes = horaInicio.split(':');
        let h = parseInt(partes[0], 10);
        let m = parseInt(partes[1], 10) + 30;
        h += Math.floor(m / 60);
        m = m % 60;
        inputFim.value = String(h % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
}

function atualizarHoraFimLembretePadrao() {
    const inputInicio = document.getElementById('lembrete-horario');
    const inputFim = document.getElementById('lembrete-hora-fim');
    if (!inputInicio || !inputFim) return;
    const horaInicio = inputInicio.value;
    if (horaInicio) {
        const partes = horaInicio.split(':');
        let h = parseInt(partes[0], 10);
        let m = parseInt(partes[1], 10) + 30;
        h += Math.floor(m / 60);
        m = m % 60;
        inputFim.value = String(h % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
}

function selecionarCorAgenda(corHex, elementoBtn) {
    const inputCor = document.getElementById('agendamento-cor');
    if (inputCor) inputCor.value = corHex;
    document.querySelectorAll('.cor-agenda-btn').forEach(btn => {
        btn.innerHTML = '';
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400');
    });
    if (elementoBtn) {
        elementoBtn.innerHTML = '<i class="fa-solid fa-check text-white text-[10px]"></i>';
        elementoBtn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400');
    }
}

function selecionarCorLembrete(corHex, elementoBtn) {
    const inputCor = document.getElementById('lembrete-cor');
    if (inputCor) inputCor.value = corHex;
    document.querySelectorAll('.cor-lembrete-btn').forEach(btn => {
        btn.innerHTML = '';
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-400');
    });
    if (elementoBtn) {
        elementoBtn.innerHTML = '<i class="fa-solid fa-check text-white text-[10px]"></i>';
        elementoBtn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-400');
    }
}

async function excluirAgendamento(id, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    const ag = db.agendamentos.find(a => a.id === id);
    if (!ag) return;

    db.agendamentos = db.agendamentos.filter(a => a.id !== id);
    registrarAuditoria('Exclusão de Evento na Agenda', `O item do dia ${ag.data} às ${ag.horario} foi excluído.`);
    persistirDB();
    atualizarCalendario();
    if (pacienteId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
    alertCustomizado('Item excluído com sucesso!');
}

function abrirModalDetalhesAgendamento(id) {
    const ag = db.agendamentos.find(item => item.id === id);
    if (!ag) return;

    if (ag.tipoEvento === 'lembrete' || ag.tipoEvento === 'bloqueio') {
        const icone = ag.tipoEvento === 'bloqueio' ? '🔒' : '📌';
        document.getElementById('detalhe-ag-paciente').innerText = icone + ' ' + ag.titulo;
        document.getElementById('detalhe-ag-categoria').innerText = ag.tipoEvento.toUpperCase();
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-tipo').innerText = 'Agendamento Fechado';
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação.';
        
        const containerAcoes = document.getElementById('botoes-acao-detalhe');
        if (containerAcoes) {
            containerAcoes.innerHTML = `
                <div class="flex gap-2 mt-4 pt-3 border-t w-full justify-end">
                    <button onclick="fecharModal('modal-detalhes-agendamento'); abrirModalEditarLembrete('${ag.id}')" class="w-10 h-10 flex justify-center items-center rounded bg-slate-100 text-slate-700 hover:bg-slate-200" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}')" class="w-10 h-10 flex justify-center items-center rounded bg-rose-50 text-rose-600 hover:bg-rose-100" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        }
        document.getElementById('modal-detalhes-agendamento').classList.remove('hidden');
        document.getElementById('modal-detalhes-agendamento').classList.add('flex');
        return;
    }

    const paciente = db.pacientes.find(p => p.id === ag.pacienteId) || { nome: 'DESCONHECIDO', categoria: 'Geral' };
    
    document.getElementById('detalhe-ag-paciente').innerText = paciente.nome;
    document.getElementById('detalhe-ag-categoria').innerText = paciente.categoria;
    document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
    document.getElementById('detalhe-ag-tipo').innerText = ag.tipo;
    document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação.';

    const containerAcoes = document.getElementById('botoes-acao-detalhe');
    if (containerAcoes) {
        containerAcoes.innerHTML = `
            <div class="flex gap-2 mt-4 pt-3 border-t w-full justify-between items-center">
                <div class="flex gap-2">
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'atendido')" class="w-10 h-10 flex justify-center items-center rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-sm" title="Marcar como Atendido"><i class="fa-solid fa-check"></i></button>
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'faltou')" class="w-10 h-10 flex justify-center items-center rounded bg-rose-100 text-rose-700 hover:bg-rose-200 shadow-sm" title="Marcar como Faltou"><i class="fa-solid fa-user-xmark"></i></button>
                </div>
                <div class="flex gap-2">
                    <button onclick="fecharModal('modal-detalhes-agendamento'); abrirDetalhesPaciente('${ag.pacienteId}', 'agenda')" class="w-10 h-10 flex justify-center items-center rounded bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-sm" title="Ficha do Paciente"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="fecharModal('modal-detalhes-agendamento'); abrirModalEditarAgendamento('${ag.id}')" class="w-10 h-10 flex justify-center items-center rounded bg-amber-50 text-amber-700 hover:bg-amber-100 shadow-sm" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}', '${ag.pacienteId}')" class="w-10 h-10 flex justify-center items-center rounded bg-red-50 text-red-600 hover:bg-red-100 shadow-sm" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    }

    document.getElementById('modal-detalhes-agendamento').classList.remove('hidden');
    document.getElementById('modal-detalhes-agendamento').classList.add('flex');
}

function abrirModalAgendamento(dataPreenchida, horaPreenchida) {
    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-edit-id').value = '';
    const filtroBusca = document.getElementById('filtro-paciente-busca');
    if (filtroBusca) filtroBusca.value = '';
    document.getElementById('agendamento-obs').value = '';

    const btnPadrao = document.querySelector('.cor-agenda-btn[style*="#039be5"]');
    selecionarCorAgenda('#039be5', btnPadrao);

    const containerCadRapido = document.getElementById('container-cadastro-rapido');
    const containerBuscaPac = document.getElementById('container-busca-paciente');
    const btnToggleCad = document.getElementById('btn-toggle-cadastro-rapido');

    if (containerCadRapido) containerCadRapido.classList.add('hidden');
    if (containerBuscaPac) containerBuscaPac.classList.remove('hidden');
    if (btnToggleCad) btnToggleCad.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Rápido';
    
    document.getElementById('agendamento-data').value = dataPreenchida || dataAgendaAtual || obterDataLocalISO();
    
    const inputHora = document.getElementById('agendamento-horario');
    if (inputHora) inputHora.value = horaPreenchida || '09:00';
    atualizarHoraFimPadrao();

    if(typeof inicializarPilulasHorario === 'function') inicializarPilulasHorario();

    const modalAg = document.getElementById('modal-agendamento');
    modalAg.classList.remove('hidden');
    modalAg.classList.add('flex');
}

function abrirModalEditarAgendamento(agendamentoId) {
    const ag = db.agendamentos.find(a => a.id === agendamentoId);
    if (!ag || ag.tipoEvento === 'lembrete' || ag.tipoEvento === 'bloqueio') return;

    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Editar Agendamento';
    document.getElementById('agendamento-edit-id').value = ag.id;
    document.getElementById('agendamento-paciente').value = ag.pacienteId;
    document.getElementById('agendamento-data').value = ag.data;
    
    const inputHora = document.getElementById('agendamento-horario');
    if (inputHora) inputHora.value = ag.horario;
    if(typeof inicializarPilulasHorario === 'function') inicializarPilulasHorario();
    
    if (ag.horaFim) {
        document.getElementById('agendamento-hora-fim').value = ag.horaFim;
    } else {
        atualizarHoraFimPadrao();
    }

    document.getElementById('agendamento-tipo').value = ag.tipo;
    document.getElementById('agendamento-obs').value = ag.obs || '';

    const corSalva = ag.cor || '#039be5';
    const btnCorSalva = document.querySelector(`.cor-agenda-btn[style*="${corSalva}"]`) || document.querySelector('.cor-agenda-btn[style*="#039be5"]');
    selecionarCorAgenda(corSalva, btnCorSalva);

    const containerCadRapido = document.getElementById('container-cadastro-rapido');
    const containerBuscaPac = document.getElementById('container-busca-paciente');
    if (containerCadRapido) containerCadRapido.classList.add('hidden');
    if (containerBuscaPac) containerBuscaPac.classList.remove('hidden');

    const modalAg = document.getElementById('modal-agendamento');
    modalAg.classList.remove('hidden');
    modalAg.classList.add('flex');
}

function salvarAgendamento(event) {
    event.preventDefault();
    const pacienteId = document.getElementById('agendamento-paciente').value;
    const editId = document.getElementById('agendamento-edit-id').value;

    if (!pacienteId) { alertCustomizado('Selecione um paciente.'); return; }

    const dataAg = document.getElementById('agendamento-data').value;
    const horaAg = document.getElementById('agendamento-horario').value;
    const horaFimAg = document.getElementById('agendamento-hora-fim').value;

    if (horaFimAg <= horaAg) {
        alertCustomizado('A Hora Final deve ser posterior à Hora Inicial.');
        return;
    }

    const conflito = db.agendamentos.find(a => a.data === dataAg && ((a.horario >= horaAg && a.horario < horaFimAg) || (a.horaFim > horaAg && a.horaFim <= horaFimAg)) && a.id !== editId);
    if (conflito) {
        if (conflito.tipoEvento === 'bloqueio') {
            return alertCustomizado(`⛔ O horário de ${conflito.horario} às ${conflito.horaFim} está BLOQUEADO: ${conflito.titulo}`);
        }
        const nomeConflito = conflito.tipoEvento === 'lembrete' ? conflito.titulo : (db.pacientes.find(p => p.id === conflito.pacienteId)?.nome || 'Outro evento');
        if (!confirm(`⚠️ Já existe agendamento/lembrete para "${nomeConflito}" nesse horário. Agendar mesmo assim?`)) return;
    }

    const inputCor = document.getElementById('agendamento-cor');
    const dadosAgendamento = {
        tipoEvento: 'agendamento',
        pacienteId: pacienteId,
        data: dataAg,
        horario: horaAg,
        horaFim: horaFimAg,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim(),
        cor: inputCor ? inputCor.value : '#039be5' 
    };

    if (editId) {
        const index = db.agendamentos.findIndex(a => a.id === editId);
        if (index !== -1) {
            const statusAntigo = db.agendamentos[index].status;
            db.agendamentos[index] = { ...db.agendamentos[index], ...dadosAgendamento, status: statusAntigo };
        }
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), status: 'agendado', ...dadosAgendamento });
    }

    registrarAuditoria('Agendamento de Paciente', editId ? `Edição de horário para paciente ID: ${pacienteId}` : `Novo agendamento criado para paciente ID: ${pacienteId}`);
    persistirDB();
    fecharModal('modal-agendamento');
    atualizarCalendario();
    if (!document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) { 
        abrirDetalhesPaciente(pacienteId, abaOrigem); 
    }
}

function abrirModalLembrete(dataPreenchida, horaPreenchida) {
    document.getElementById('titulo-modal-lembrete').innerText = 'Novo Lembrete / Bloqueio';
    document.getElementById('lembrete-edit-id').value = '';
    document.getElementById('lembrete-titulo').value = '';
    document.getElementById('lembrete-obs').value = '';
    
    const isBloqueioCheck = document.getElementById('lembrete-is-bloqueio');
    if(isBloqueioCheck) isBloqueioCheck.checked = false;

    const btnPadrao = document.querySelector('.cor-lembrete-btn[style*="#616161"]');
    selecionarCorLembrete('#616161', btnPadrao);

    document.getElementById('lembrete-data').value = dataPreenchida || dataAgendaAtual || obterDataLocalISO();
    document.getElementById('lembrete-horario').value = horaPreenchida || '12:00';
    atualizarHoraFimLembretePadrao();

    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function abrirModalEditarLembrete(lembreteId) {
    const ag = db.agendamentos.find(a => a.id === lembreteId);
    if (!ag || ag.tipoEvento === 'agendamento') return;

    document.getElementById('titulo-modal-lembrete').innerText = 'Editar Lembrete / Bloqueio';
    document.getElementById('lembrete-edit-id').value = ag.id;
    document.getElementById('lembrete-titulo').value = ag.titulo;
    document.getElementById('lembrete-data').value = ag.data;
    document.getElementById('lembrete-horario').value = ag.horario;
    document.getElementById('lembrete-hora-fim').value = ag.horaFim || '';
    document.getElementById('lembrete-obs').value = ag.obs || '';
    
    const isBloqueioCheck = document.getElementById('lembrete-is-bloqueio');
    if(isBloqueioCheck) isBloqueioCheck.checked = (ag.tipoEvento === 'bloqueio');

    const corSalva = ag.cor || '#616161';
    const btnCorSalva = document.querySelector(`.cor-lembrete-btn[style*="${corSalva}"]`) || document.querySelector('.cor-lembrete-btn[style*="#616161"]');
    selecionarCorLembrete(corSalva, btnCorSalva);

    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function salvarLembrete(event) {
    event.preventDefault();
    const editId = document.getElementById('lembrete-edit-id').value;
    const titulo = document.getElementById('lembrete-titulo').value.trim();
    const dataLembrete = document.getElementById('lembrete-data').value;
    const horaInicio = document.getElementById('lembrete-horario').value;
    const horaFim = document.getElementById('lembrete-hora-fim').value;
    const isBloqueioCheck = document.getElementById('lembrete-is-bloqueio');
    const isBloqueio = isBloqueioCheck ? isBloqueioCheck.checked : false;

    if (!titulo) { alertCustomizado('Informe o título.'); return; }
    if (horaFim <= horaInicio) { alertCustomizado('A Hora Final deve ser posterior à Hora Inicial.'); return; }

    const inputCor = document.getElementById('lembrete-cor');
    const dadosLembrete = {
        tipoEvento: isBloqueio ? 'bloqueio' : 'lembrete',
        titulo: titulo,
        data: dataLembrete,
        horario: horaInicio,
        horaFim: horaFim,
        obs: document.getElementById('lembrete-obs').value.trim(),
        cor: inputCor ? inputCor.value : '#616161'
    };

    if (editId) {
        const index = db.agendamentos.findIndex(a => a.id === editId);
        if (index !== -1) {
            db.agendamentos[index] = { ...db.agendamentos[index], ...dadosLembrete };
        }
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dadosLembrete });
    }

    registrarAuditoria('Lembrete/Bloqueio de Agenda', isBloqueio ? `Bloqueio: ${titulo}` : `Lembrete: ${titulo}`);
    persistirDB();
    fecharModal('modal-lembrete');
    atualizarCalendario();
    alertCustomizado('Lembrete/Bloqueio salvo com sucesso!');
}

// ==========================================
// PACIENTES (Lista Vertical Pura)
// ==========================================
function obterUltimaConsultaPaciente(pacienteId) {
    const datas = [];
    db.agendamentos.filter(a => a.pacienteId === pacienteId && a.data).forEach(a => datas.push(a.data));
    db.prontuarios.filter(pr => pr.pacienteId === pacienteId && pr.data).forEach(pr => datas.push(pr.data));

    if (datas.length === 0) return null;
    datas.sort((a, b) => new Date(b) - new Date(a));
    return datas[0];
}

function calcularDiasDesdeUltimaConsulta(dataIso) {
    if (!dataIso) return 9999;
    const dataConsulta = new Date(dataIso);
    const hoje = new Date();
    const diffTempo = hoje - dataConsulta;
    return Math.floor(diffTempo / (1000 * 60 * 60 * 24));
}

function definirFiltroCategoria(categoria) {
    exibiApenasInativos = false;
    window._categoriaSelecionada = categoria;
    
    ['todos', 'clinico', 'orto'].forEach(cat => {
        const btn = document.getElementById('tag-filtro-' + cat);
        if (btn) {
            if (cat === categoria) {
                btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition bg-blue-600 text-white shadow-sm';
            } else {
                btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition bg-slate-100 text-slate-700 hover:bg-slate-200';
            }
        }
    });
    
    const btnInativos = document.getElementById('btn-filtro-inativos');
    if (btnInativos) btnInativos.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition bg-amber-50 text-amber-800 border border-amber-200';

    renderizarPacientes();
}

function alternarFiltroInativos() {
    exibiApenasInativos = !exibiApenasInativos;
    const btnInativos = document.getElementById('btn-filtro-inativos');
    if (btnInativos) {
        if (exibiApenasInativos) {
            btnInativos.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition bg-amber-600 text-white shadow-sm';
        } else {
            btnInativos.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition bg-amber-50 text-amber-800 border border-amber-200';
        }
    }
    renderizarPacientes();
}

function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes-container');
    if (!container) return;
    
    const termoBusca = (document.getElementById('busca-pacientes-tabela')?.value || '').toLowerCase().trim();
    const opcaoCategoria = window._categoriaSelecionada || 'todos';

    // Garante Lista Vertical empilhada
    container.className = "flex flex-col gap-3 overflow-y-auto max-h-[75vh] pr-2 scrollbar-thin scrollbar-thumb-slate-300"; 
    container.innerHTML = '';
    
    let total = db.pacientes.length, clinicos = 0, orto = 0, inativosCount = 0;

    db.pacientes.forEach(p => {
        p.categoria === 'Ortodontia' ? orto++ : clinicos++;
        const ult = obterUltimaConsultaPaciente(p.id);
        if (ult && calcularDiasDesdeUltimaConsulta(ult) > 30) inativosCount++;
    });

    const kpiTotal = document.getElementById('kpi-total-pacientes');
    const kpiClinico = document.getElementById('kpi-clinico-pacientes');
    const kpiOrto = document.getElementById('kpi-orto-pacientes');
    const kpiInativos = document.getElementById('kpi-inativos-pacientes');

    if (kpiTotal) kpiTotal.innerText = total;
    if (kpiClinico) kpiClinico.innerText = clinicos;
    if (kpiOrto) kpiOrto.innerText = orto;
    if (kpiInativos) kpiInativos.innerText = inativosCount;

    const listaExibicao = db.pacientes.filter(p => {
        const bateuBusca = (p.nome || '').toLowerCase().includes(termoBusca) || (p.cpf || '').includes(termoBusca);
        if (!bateuBusca) return false;
        if (opcaoCategoria === 'clinico' && p.categoria === 'Ortodontia') return false;
        if (opcaoCategoria === 'orto' && p.categoria !== 'Ortodontia') return false;
        if (exibiApenasInativos) {
            const ult = obterUltimaConsultaPaciente(p.id);
            return ult ? calcularDiasDesdeUltimaConsulta(ult) > 30 : false;
        }
        return true;
    });

    if (listaExibicao.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm"><i class="fa-solid fa-users-slash text-3xl mb-2"></i><p>Nenhum paciente encontrado.</p></div>';
        return;
    }

    listaExibicao.forEach(p => {
        const badgeClass = p.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700';
        const venc = p.categoria === 'Ortodontia' ? (p.vencimento ? p.vencimento.split('-').reverse().join('/') : 'Não definida') : '-';
        const ultimaData = obterUltimaConsultaPaciente(p.id);
        const dias = calcularDiasDesdeUltimaConsulta(ultimaData);
        
        let htmlUltimaConsulta = '-';
        if (ultimaData) {
            const dataFmt = ultimaData.split('-').reverse().join('/');
            htmlUltimaConsulta = dias > 30 ? `<span class="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">${dataFmt} (${dias}d)</span>` : `<span class="text-slate-700 font-medium">${dataFmt}</span>`;
        } else {
            htmlUltimaConsulta = '<span class="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Sem consultas</span>';
        }

        container.innerHTML += `
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 relative hover:shadow-md transition">
            <div class="flex-grow space-y-1">
                <div class="flex items-center gap-2">
                    <h4 class="font-bold text-slate-900 text-base truncate">${p.nome}</h4>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${badgeClass}">${p.categoria}</span>
                </div>
                <div class="flex flex-wrap gap-4 text-xs text-slate-500">
                    <p><i class="fa-solid fa-phone text-slate-400"></i> ${p.telefone || '-'}</p>
                    <p><i class="fa-solid fa-calendar-check text-slate-400"></i> Última: ${htmlUltimaConsulta}</p>
                    ${p.categoria === 'Ortodontia' ? `<p><i class="fa-solid fa-file-invoice-dollar text-slate-400"></i> Venc: ${venc}</p>` : ''}
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="abrirModalPaciente('${p.id}')" class="w-10 h-10 flex justify-center items-center bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="px-4 h-10 flex justify-center items-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold gap-2 transition whitespace-nowrap">
                    <i class="fa-solid fa-eye"></i> Ficha
                </button>
            </div>
        </div>`;
    });
}

async function excluirPaciente(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    if (!(await verificarSenhaExclusao())) return;
    
    const corpo = `<p class="text-slate-600">Tem certeza que deseja EXCLUIR permanentemente o paciente "${paciente.nome}"?</p>`;
    const botoes = `<button onclick="fecharModalPersonalizado(); window._confirmaExcluirPac(false)" class="px-3 py-2 border rounded-lg text-xs">Cancelar</button>
                    <button onclick="fecharModalPersonalizado(); window._confirmaExcluirPac(true)" class="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold">Excluir</button>`;
    window._confirmaExcluirPac = (conf) => {
        if (conf) {
            db.pacientes = db.pacientes.filter(p => p.id !== pacienteId);
            db.agendamentos = db.agendamentos.filter(a => a.pacienteId !== pacienteId);
            db.prontuarios = db.prontuarios.filter(pr => pr.pacienteId !== pacienteId);

            db.pagamentos.forEach(pg => {
                if (pg.pacienteId === pacienteId) {
                    pg.pacienteId = null; 
                    pg.descricao = `[Paciente Excluído: ${paciente.nome}] ` + pg.descricao;
                }
            });

            registrarAuditoria('Exclusão de Paciente', `Paciente ${paciente.nome} e seus prontuários excluídos.`);
            persistirDB();
            atualizarCalendario();
            renderizarPacientes();
            alertCustomizado('Paciente excluído com sucesso! (O histórico financeiro foi mantido no caixa).');
            voltarParaOrigem();
        }
    };
    mostrarModalPersonalizado("Excluir Paciente", corpo, botoes);
}

async function excluirProntuario(prontuarioId, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    db.prontuarios = db.prontuarios.filter(pr => pr.id !== prontuarioId);
    registrarAuditoria('Exclusão de Prontuário', `Item de evolução clínica excluído para o paciente ID: ${pacienteId}`);
    persistirDB();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

// ==========================================
// FINANCEIRO & CAIXA
// ==========================================
function estornarPagamento(pagamentoId, pacienteId) {
    const pagamentoOriginal = db.pagamentos.find(pg => pg.id === pagamentoId);
    if (!pagamentoOriginal) return;

    const corpo = `<p class="text-slate-600">Digite o motivo do estorno do pagamento (Obrigatório):</p>
                   <input type="text" id="input-motivo-estorno" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: Cobrança indevida, desistência...">`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-3 py-2 border rounded-lg text-xs">Cancelar</button>
                    <button onclick="const m = document.getElementById('input-motivo-estorno').value; if(!m) { alert('Motivo obrigatório'); return; } fecharModalPersonalizado(); executarEstorno('${pagamentoId}', '${pacienteId}', '${m}')" class="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold">Avançar</button>`;
    mostrarModalPersonalizado("Motivo do Estorno", corpo, botoes);
}

async function executarEstorno(pagamentoId, pacienteId, motivo) {
    const pagamentoOriginal = db.pagamentos.find(pg => pg.id === pagamentoId);
    if (!pagamentoOriginal) return;
    if (!(await verificarSenhaExclusao())) return;

    db.pagamentos.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        valor: -Math.abs(parseFloat(pagamentoOriginal.valor)),
        forma: 'Estorno',
        descricao: `ESTORNO: ${pagamentoOriginal.descricao} - Motivo: ${motivo}`
    });

    registrarAuditoria('Estorno Financeiro', `Estorno gerado no valor de -${pagamentoOriginal.valor} para o ID: ${pacienteId || 'Avulso'}`);
    persistirDB();
    alertCustomizado('Estorno realizado com sucesso!');
    if (pacienteId) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    } else {
        renderizarFinanceiro();
    }
}

function salvarLancamentoCaixaManual(event, pacienteId) {
    event.preventDefault();
    const descricaoProc = document.getElementById('caixa-proc-desc').value.trim();
    const valorPago = parseFloat(document.getElementById('caixa-valor-pago').value) || 0;
    const forma = document.getElementById('caixa-forma').value;
    const observacao = document.getElementById('caixa-obs-manual').value.trim();
    const temPendencia = document.getElementById('caixa-marca-pendencia').checked;
    
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    paciente.possuiPendenciaManual = temPendencia;
    paciente.obsFinanceiraManual = observacao;

    if (valorPago > 0) {
        let descFinal = descricaoProc;
        if (observacao) descFinal += ' (Obs: ' + observacao + ')';
        
        db.pagamentos.push({ 
            id: gerarIdUnico(), 
            pacienteId: pacienteId, 
            data: obterDataLocalISO(), 
            valor: valorPago, 
            forma: forma, 
            descricao: descFinal
        });
        registrarAuditoria('Lançamento Financeiro', `Entrada de R$ ${valorPago} registrada para o paciente ${paciente.nome}`);
    }

    persistirDB();
    alertCustomizado('Lançamento salvo e status atualizado com sucesso!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function removerPendenciaManual(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    paciente.possuiPendenciaManual = false;
    paciente.obsFinanceiraManual = '';
    persistirDB();
    
    if (!document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    } else {
        renderizarFinanceiro();
    }
}

function lancarDespesa() {
    const corpo = `<div class="space-y-3">
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Descrição</label><input type="text" id="desp-desc" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: Material de consumo"></div>
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Valor (R$)</label><input type="number" step="0.01" id="desp-valor" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00"></div>
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Categoria</label><input type="text" id="desp-cat" class="w-full px-3 py-2 border rounded-lg text-sm" value="Operacional"></div>
    </div>`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-3 py-2 border rounded-lg text-xs">Cancelar</button>
                    <button onclick="salvarDespesaCustom()" class="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold">Salvar Despesa</button>`;
    mostrarModalPersonalizado("Lançar Despesa", corpo, botoes);
}

function salvarDespesaCustom() {
    const desc = document.getElementById('desp-desc').value.trim();
    let valorStr = document.getElementById('desp-valor').value.replace(',', '.');
    const valor = parseFloat(valorStr);
    const cat = document.getElementById('desp-cat').value.trim() || 'Operacional';

    if (!desc || isNaN(valor) || valor <= 0) {
        alertCustomizado("Preencha a descrição e um valor válido.");
        return;
    }

    db.despesas.push({
        id: gerarIdUnico(),
        data: obterDataLocalISO(),
        descricao: desc,
        valor: valor,
        categoria: cat
    });

    registrarAuditoria('Despesa Clínica', `Saída de R$ ${valor} registrada: ${desc}`);
    persistirDB();
    fecharModalPersonalizado();
    renderizarFinanceiro();
    alertCustomizado('Despesa lançada com sucesso!');
}

async function excluirDespesa(id) {
    if (!(await verificarSenhaExclusao())) return;
    const d = db.despesas.find(d => d.id === id);
    if(d) registrarAuditoria('Exclusão de Despesa', `Despesa excluída: ${d.descricao}`);
    db.despesas = db.despesas.filter(d => d.id !== id);
    persistirDB();
    renderizarFinanceiro();
    alertCustomizado('Despesa excluída!');
}

function abrirModalCaixaDiario() {
    const inputData = document.getElementById('input-data-caixa-diario');
    if (inputData) inputData.value = obterDataLocalISO();
    carregarFechamentoCaixaData();
    const modal = document.getElementById('modal-fechamento-caixa');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function carregarFechamentoCaixaData() {
    const inputData = document.getElementById('input-data-caixa-diario');
    const dataSelecionada = inputData ? inputData.value : obterDataLocalISO();
    
    const pagamentosDia = db.pagamentos.filter(pg => pg.data === dataSelecionada);
    const despesasDia = db.despesas.filter(d => d.data === dataSelecionada);

    let totalEntradas = 0;
    pagamentosDia.forEach(pg => totalEntradas += parseFloat(pg.valor || 0));

    let totalSaidas = 0;
    despesasDia.forEach(d => totalSaidas += parseFloat(d.valor || 0));

    let saldoDia = totalEntradas - totalSaidas;

    const porForma = {};
    pagamentosDia.forEach(pg => {
        if(pg.valor > 0){
           porForma[pg.forma] = (porForma[pg.forma] || 0) + parseFloat(pg.valor || 0);
        }
    });

    let html = `<div class="space-y-2 mb-4">
                <div class="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                    <span class="font-semibold text-slate-600"><i class="fa-solid fa-arrow-down text-emerald-500 mr-2"></i>Entradas/Movimentos</span>
                    <span class="font-bold text-emerald-600">R$ ${totalEntradas.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                    <span class="font-semibold text-slate-600"><i class="fa-solid fa-arrow-up text-rose-500 mr-2"></i>Despesas</span>
                    <span class="font-bold text-rose-600">R$ ${totalSaidas.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center p-3 bg-blue-100 border border-blue-200 rounded-lg">
                    <span class="font-bold text-blue-900"><i class="fa-solid fa-wallet text-blue-600 mr-2"></i>Saldo Líquido</span>
                    <span class="font-extrabold text-blue-700">R$ ${saldoDia.toFixed(2)}</span>
                </div>
             </div>`;

    if (Object.keys(porForma).length > 0) {
        html += `<h4 class="font-bold text-slate-800 mb-2 border-b pb-1 text-xs uppercase">Resumo por Forma de Pagamento</h4><div class="space-y-1">`;
        for (let forma in porForma) {
            html += `<div class="flex justify-between text-sm p-2 bg-slate-50 rounded border">
                        <span class="text-slate-700 font-medium">${forma}</span>
                        <span class="font-bold text-slate-900">R$ ${porForma[forma].toFixed(2)}</span>
                     </div>`;
        }
        html += `</div>`;
    } else {
        html += `<p class="text-sm text-slate-500 italic text-center">Nenhuma entrada registrada nesta data.</p>`;
    }

    document.getElementById('conteudo-fechamento-caixa').innerHTML = html;
}

function abrirModalPagamentoAvulso() {
    const corpo = `<div class="space-y-3">
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Valor (R$)</label><input type="number" step="0.01" id="avulso-valor" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00"></div>
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Descrição</label><input type="text" id="avulso-desc" class="w-full px-3 py-2 border rounded-lg text-sm" value="Consulta / Procedimento"></div>
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Forma de Pagamento</label><select id="avulso-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white"><option value="Pix">Pix</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option><option value="Dinheiro">Dinheiro</option></select></div>
    </div>`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-3 py-2 border rounded-lg text-xs">Cancelar</button>
                    <button onclick="salvarPagamentoAvulsoCustom()" class="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold">Salvar</button>`;
    mostrarModalPersonalizado("Pagamento Avulso", corpo, botoes);
}

function salvarPagamentoAvulsoCustom() {
    let valorStr = document.getElementById('avulso-valor').value.replace(',', '.');
    const valor = parseFloat(valorStr);
    const desc = document.getElementById('avulso-desc').value.trim() || 'Pagamento Avulso';
    const forma = document.getElementById('avulso-forma').value;

    if (isNaN(valor) || valor <= 0) {
        alertCustomizado("Informe um valor válido.");
        return;
    }

    db.pagamentos.push({ 
        id: gerarIdUnico(), 
        pacienteId: null, 
        data: obterDataLocalISO(), 
        valor: valor, 
        forma: forma, 
        descricao: desc 
    });
    
    registrarAuditoria('Pagamento Avulso', `Entrada avulsa de R$ ${valor} registrada.`);
    persistirDB();
    fecharModalPersonalizado();
    renderizarFinanceiro();
    alertCustomizado('Pagamento lançado com sucesso!');
}

function alternarFiltroPersonalizadoFinanceiro() {
    const filtro = document.getElementById('filtro-periodo-financeiro').value;
    const container = document.getElementById('container-datas-personalizadas');
    if (filtro === 'personalizado') {
        container.classList.remove('hidden');
        container.classList.add('flex');
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
        renderizarFinanceiro();
    }
}

function renderizarFinanceiro() {
    const listaPendencias = document.getElementById('lista-pendencias-financeiras');
    const listaFluxo = document.getElementById('lista-pagamentos-realizados');
    const filtroPeriodo = document.getElementById('filtro-periodo-financeiro')?.value || 'mes';
    
    const dataInicioFin = document.getElementById('data-inicio-fin')?.value;
    const dataFimFin = document.getElementById('data-fim-fin')?.value;

    if (!listaPendencias || !listaFluxo) return;

    listaPendencias.innerHTML = '';
    listaFluxo.innerHTML = '';

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
    const prefixoMes = anoAtual + '-' + mesAtual;
    const hojeIso = obterDataLocalISO();

    let transacoes = [];
    db.pagamentos.forEach(pg => transacoes.push({ id: pg.id, tipo: 'entrada', data: pg.data, valor: pg.valor, forma: pg.forma, descricao: pg.descricao, pacienteId: pg.pacienteId }));
    db.despesas.forEach(d => transacoes.push({ id: d.id, tipo: 'saida', data: d.data, valor: d.valor, forma: 'Despesa', descricao: d.descricao + ' (' + d.categoria + ')', pacienteId: null }));

    transacoes = transacoes.filter(t => {
        if (!t.data) return false;
        if (filtroPeriodo === 'hoje') return t.data === hojeIso;
        if (filtroPeriodo === 'mes') return t.data.startsWith(prefixoMes);
        if (filtroPeriodo === 'personalizado') {
            if (dataInicioFin && t.data < dataInicioFin) return false;
            if (dataFimFin && t.data > dataFimFin) return false;
            return true;
        }
        return true;
    });

    let faturamentoFiltrado = 0;
    let despesasFiltradas = 0;
    transacoes.forEach(t => {
        if (t.tipo === 'entrada') faturamentoFiltrado += parseFloat(t.valor || 0);
        else despesasFiltradas += parseFloat(t.valor || 0);
    });
    let saldoLiquidoFiltrado = faturamentoFiltrado - despesasFiltradas;
    let qtdPacientesComPendencia = db.pacientes.filter(p => p.possuiPendenciaManual).length;

    const elFat = document.getElementById('kpi-faturamento');
    const elDesp = document.getElementById('kpi-despesas');
    const elSaldo = document.getElementById('kpi-saldo-liquido');
    const elRec = document.getElementById('kpi-receber');

    if (elFat) elFat.innerText = 'R$ ' + faturamentoFiltrado.toFixed(2);
    if (elDesp) elDesp.innerText = 'R$ ' + despesasFiltradas.toFixed(2);
    if (elSaldo) elSaldo.innerText = 'R$ ' + saldoLiquidoFiltrado.toFixed(2);
    if (elRec) elRec.innerText = qtdPacientesComPendencia + ' Pacientes';

    let encontrouPendencia = false;
    db.pacientes.forEach(paciente => {
        if (paciente.possuiPendenciaManual) {
            encontrouPendencia = true;
            listaPendencias.innerHTML += '<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm flex justify-between items-center">' +
                '<div><p class="font-semibold text-amber-900">' + paciente.nome + '</p><span class="text-xs text-amber-700">' + (paciente.obsFinanceiraManual || 'Pendência manual') + '</span></div>' +
                '<div class="text-right flex items-center gap-2"><button onclick="abrirDetalhesPaciente(\'' + paciente.id + '\', \'financeiro\')" class="text-xs text-blue-600 hover:underline px-2">Ver Ficha</button><button onclick="removerPendenciaManual(\'' + paciente.id + '\')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow transition"><i class="fa-solid fa-check"></i> Baixar</button></div>' +
            '</div>';
        }
    });

    if (!encontrouPendencia) {
        listaPendencias.innerHTML = '<p class="text-sm text-slate-400">Nenhum paciente marcado com pendência.</p>';
    }

    transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (transacoes.length === 0) {
        listaFluxo.innerHTML = '<p class="text-sm text-slate-400">Nenhum lançamento registrado para este período.</p>';
    } else {
        transacoes.forEach(t => {
            if (t.tipo === 'entrada') {
                const paciente = db.pacientes.find(p => p.id === t.pacienteId) || { nome: 'PACIENTE AVULSO / EXCLUÍDO' };
                const isEstorno = t.valor < 0;
                const corValor = isEstorno ? 'text-rose-600' : 'text-emerald-600';
                const prefixoValor = isEstorno ? '' : '+ ';

                listaFluxo.innerHTML += '<div class="p-3 bg-white border border-slate-100 rounded-lg text-sm flex justify-between items-center shadow-sm">' +
                    '<div><p class="font-semibold text-slate-900"><i class="fa-solid fa-circle-dot text-xs mr-1 ' + corValor + '"></i> ' + paciente.nome + '</p><span class="text-xs text-slate-500">' + t.descricao + ' • ' + (t.data ? t.data.split('-').reverse().join('/') : '-') + ' (' + t.forma + ')</span></div>' +
                    '<span class="font-bold ' + corValor + '">' + prefixoValor + 'R$ ' + Number(t.valor).toFixed(2) + '</span>' +
                '</div>';
            } else {
                listaFluxo.innerHTML += '<div class="p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm flex justify-between items-center">' +
                    '<div><p class="font-semibold text-rose-900"><i class="fa-solid fa-arrow-up mr-1"></i> Despesa Clínica</p><span class="text-xs text-slate-500">' + t.descricao + ' • ' + (t.data ? t.data.split('-').reverse().join('/') : '-') + '</span></div>' +
                    '<div class="flex items-center gap-3"><span class="font-bold text-rose-600">- R$ ' + Number(t.valor).toFixed(2) + '</span><button onclick="excluirDespesa(\'' + t.id + '\')" class="text-rose-400 hover:text-rose-700 text-xs transition"><i class="fa-solid fa-trash"></i></button></div>' +
                '</div>';
            }
        });
    }
}

// ==========================================
// FICHA DO PACIENTE (COM ASSINATURA NO PRONTUÁRIO)
// ==========================================
function voltarParaOrigem() { mudarAba(abaOrigem || 'pacientes'); }
function alternarAccordion(id) { const el = document.getElementById(id); if (el) el.classList.toggle('hidden'); }

function abrirSubAbaPaciente(subAba) {
    subAbaAtualPaciente = subAba;
    document.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.querySelectorAll('.subtab-content').forEach(content => content.classList.add('hidden'));

    const btnAtivo = document.getElementById('btn-subtab-' + subAba);
    const contentAtivo = document.getElementById('subtab-content-' + subAba);
    
    if (btnAtivo) {
        btnAtivo.classList.remove('border-transparent', 'text-slate-500');
        btnAtivo.classList.add('border-blue-600', 'text-blue-600');
    }
    if (contentAtivo) contentAtivo.classList.remove('hidden');
}

function filtrarProntuarioLinhaTempo(pacienteId) {
    const inputBusca = document.getElementById('busca-prontuario-input');
    if (!inputBusca) return;
    const termo = inputBusca.value.toLowerCase();
    const container = document.getElementById('container-prontuario-timeline');
    const prontuarios = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    if (prontuarios.length === 0) return;
    const prontuariosFiltrados = prontuarios.filter(pr => (pr.procedimento || '').toLowerCase().includes(termo) || (pr.data || '').includes(termo));
    renderizarLinhaTempoProntuario(container, prontuariosFiltrados, pacienteId);
}

function renderizarLinhaTempoProntuario(container, prontuarios, pacienteId) {
    if (!container) return;
    container.innerHTML = '';
    if (prontuarios.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400 p-2">Nenhum registro encontrado.</p>';
        return;
    }

    const grupos = {};
    const prontuariosOrdenados = prontuarios.slice().sort((a, b) => new Date(b.data) - new Date(a.data));
    prontuariosOrdenados.forEach(pr => {
        const mesAno = formatarMesAno(pr.data);
        if (!grupos[mesAno]) grupos[mesAno] = [];
        grupos[mesAno].push(pr);
    });

    let index = 0;
    const mesAtualFormatado = formatarMesAno(obterDataLocalISO());

    Object.keys(grupos).forEach(mesAno => {
        const accId = 'acc-prontuario-' + index;
        const estaAberto = (mesAno === mesAtualFormatado) || (index === 0);
        
        let htmlItens = '';
        grupos[mesAno].forEach(pr => {
            const proxHtml = pr.proximaConsulta ? '<p class="text-xs font-semibold text-blue-700 bg-blue-50 p-1.5 rounded mt-1"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Próxima consulta: ' + pr.proximaConsulta + '</p>' : '';
            const assinaturaTexto = pr.assinatura || 'dr.mikeias'; // Assinatura Limpa
            
            htmlItens += `<div class="p-3 bg-white rounded-lg border border-slate-100 shadow-sm relative">
                <button onclick="excluirProntuario('${pr.id}', '${pacienteId}')" class="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                <div class="text-[10px] text-slate-400 font-bold mb-1">Data: ${(pr.data ? pr.data.split('-').reverse().join('/') : '-')}</div>
                <p class="text-slate-800 text-sm font-medium mb-1">${pr.procedimento}</p>
                ${proxHtml}
                <div class="mt-2 pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-medium text-right flex justify-end items-center gap-1">
                    <i class="fa-solid fa-pen text-slate-300"></i> ${assinaturaTexto}
                </div>
            </div>`;
        });

        container.innerHTML += '<div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">' +
            '<button onclick="alternarAccordion(\'' + accId + '\')" class="w-full px-4 py-3 text-left font-bold text-slate-800 flex justify-between items-center hover:bg-slate-100 transition text-sm">' +
                '<span><i class="fa-regular fa-calendar-check mr-2 text-blue-600"></i>' + mesAno + ' (' + grupos[mesAno].length + ' registros)</span>' +
                '<i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>' +
            '</button>' +
            '<div id="' + accId + '" class="' + (estaAberto ? '' : 'hidden') + ' p-3 space-y-2 border-t border-slate-200">' + htmlItens + '</div>' +
        '</div>';
        index++;
    });
}

function salvarProcedimentoDentista(event, pacienteId) {
    event.preventDefault();
    const procedimento = document.getElementById('proc-desc').value;
    const proximaConsulta = document.getElementById('proc-proxima').value;

    db.prontuarios.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        procedimento: procedimento,
        valorCobrado: 0,
        proximaConsulta: proximaConsulta,
        assinatura: obterUsuarioAssinatura() // Salva o nome limpo na criação
    });
    registrarAuditoria('Evolução Clínica', `Registro de prontuário adicionado para o ID: ${pacienteId}`);
    persistirDB();
    alertCustomizado('Evolução do Prontuário salva!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function adicionarEtapaPlanejamento(event, pacienteId) {
    event.preventDefault();
    const denteInput = document.getElementById('plan-dente');
    const descInput = document.getElementById('plan-desc');
    const valorInput = document.getElementById('plan-valor');

    const dente = denteInput ? (denteInput.value.trim() || 'Geral') : 'Geral';
    const desc = descInput ? descInput.value.trim() : '';
    const valor = valorInput ? (parseFloat(valorInput.value) || 0) : 0;

    if (!desc) { alertCustomizado('Informe a descrição.'); return; }

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        if (!Array.isArray(paciente.planejamentoEtapas)) paciente.planejamentoEtapas = [];
        paciente.planejamentoEtapas.push({ id: gerarIdUnico(), dente: dente, procedimento: desc, valor: valor, concluido: false });
        persistirDB();
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

function alternarStatusEtapa(pacienteId, etapaId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente && Array.isArray(paciente.planejamentoEtapas)) {
        const etapa = paciente.planejamentoEtapas.find(e => e.id === etapaId);
        if (etapa) {
            etapa.concluido = !etapa.concluido;
            persistirDB();
            abrirDetalhesPaciente(pacienteId, abaOrigem);
        }
    }
}

async function excluirEtapaPlanejamento(pacienteId, etapaId) {
    if (!(await verificarSenhaExclusao())) return;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente && Array.isArray(paciente.planejamentoEtapas)) {
        paciente.planejamentoEtapas = paciente.planejamentoEtapas.filter(e => e.id !== etapaId);
        persistirDB();
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

function exportarBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup_clinica_" + obterDataLocalISO() + ".json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const conteudo = JSON.parse(e.target.result);
            if (conteudo && Array.isArray(conteudo.pacientes)) {
                if (confirm('⚠️ Deseja realmente restaurar este backup?')) {
                    db = conteudo;
                    if(!db.auditoria) db.auditoria = [];
                    persistirDB();
                    atualizarCalendario();
                    renderizarPacientes();
                    alertCustomizado('Backup restaurado com sucesso!');
                }
            } else {
                alertCustomizado('Arquivo de backup inválido.');
            }
        } catch (err) {
            alertCustomizado('Erro ao ler o arquivo JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function abrirModalPaciente(pacienteId) {
    const formPaciente = document.getElementById('form-paciente');
    if (formPaciente) formPaciente.reset();

    const titulo = document.getElementById('titulo-modal-paciente');
    const editId = document.getElementById('paciente-edit-id');

    if (pacienteId) {
        const paciente = db.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;

        if (titulo) titulo.innerText = 'Editar Cadastro do Paciente';
        if (editId) editId.value = paciente.id;
        document.getElementById('paciente-nome').value = paciente.nome;
        document.getElementById('paciente-telefone').value = paciente.telefone || '';
        document.getElementById('paciente-nascimento').value = paciente.nascimento || '';
        document.getElementById('paciente-cpf').value = paciente.cpf || '';
        document.getElementById('paciente-categoria').value = paciente.categoria;
        document.getElementById('paciente-vencimento').value = paciente.vencimento || '';
        
        toggleVencimentoOrto();
    } else {
        if (titulo) titulo.innerText = 'Cadastrar Novo Paciente';
        if (editId) editId.value = '';
        const grupoVencimento = document.getElementById('grupo-vencimento-orto');
        if (grupoVencimento) grupoVencimento.classList.add('hidden');
    }

    const modalPaciente = document.getElementById('modal-paciente');
    if (modalPaciente) {
        modalPaciente.classList.remove('hidden');
        modalPaciente.classList.add('flex');
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function toggleVencimentoOrto() {
    const categoria = document.getElementById('paciente-categoria')?.value;
    const grupoOrto = document.getElementById('grupo-vencimento-orto');
    if (!grupoOrto) return;
    if (categoria === 'Ortodontia') grupoOrto.classList.remove('hidden');
    else grupoOrto.classList.add('hidden');
}

function popularSelectPacientes() {
    const select = document.getElementById('agendamento-paciente');
    if (!select) return;
    select.innerHTML = '';
    db.pacientes.forEach(p => {
        select.innerHTML += '<option value="' + p.id + '">' + p.nome + ' (' + p.categoria + ')</option>';
    });
}

function toggleFormCadastroRapido() {
    const bloco = document.getElementById('container-cadastro-rapido');
    const busca = document.getElementById('container-busca-paciente');
    const btn = document.getElementById('btn-toggle-cadastro-rapido');
    if (!bloco || !busca || !btn) return;

    if (bloco.classList.contains('hidden')) {
        bloco.classList.remove('hidden');
        busca.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar';
        document.getElementById('rapido-nome').value = '';
        document.getElementById('rapido-telefone').value = '';
    } else {
        bloco.classList.add('hidden');
        busca.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Rápido';
    }
}

function cadastrarPacienteRapido() {
    const nome = document.getElementById('rapido-nome').value.trim().toUpperCase();
    const telefone = document.getElementById('rapido-telefone').value.trim();
    const categoria = document.getElementById('rapido-categoria').value;

    if (!nome) { alertCustomizado('Informe o nome.'); return; }

    const novoId = gerarIdUnico();
    db.pacientes.push({ id: novoId, nome: nome, telefone: telefone, nascimento: '', cpf: '', categoria: categoria, vencimento: '', planejamentoEtapas: [] });
    registrarAuditoria('Cadastro de Paciente', `Cadastro Rápido efetuado: ${nome}`);
    persistirDB();

    popularSelectPacientes();
    renderizarPacientes();
    const selectAg = document.getElementById('agendamento-paciente');
    if (selectAg) selectAg.value = novoId;
    toggleFormCadastroRapido();
    alertCustomizado('Paciente cadastrado!');
}

function filtrarPacientesSelect() {
    const inputFiltro = document.getElementById('filtro-paciente-busca');
    const select = document.getElementById('agendamento-paciente');
    if (!inputFiltro || !select) return;

    const termo = inputFiltro.value.toLowerCase();
    select.innerHTML = '';
    
    const filtrados = db.pacientes.filter(p => p.nome.toLowerCase().includes(termo));
    if (filtrados.length === 0) {
        select.innerHTML = '<option value="">Nenhum paciente encontrado</option>';
        return;
    }
    filtrados.forEach(p => {
        select.innerHTML += '<option value="' + p.id + '">' + p.nome + ' (' + p.categoria + ')</option>';
    });
}

function salvarPaciente(event) {
    event.preventDefault();
    const categoria = document.getElementById('paciente-categoria').value;
    const nomeCaixaAlta = document.getElementById('paciente-nome').value.trim().toUpperCase();
    const editId = document.getElementById('paciente-edit-id').value;

    if (!nomeCaixaAlta) { alertCustomizado('O nome do paciente é obrigatório.'); return; }

    const dadosPaciente = {
        nome: nomeCaixaAlta,
        telefone: document.getElementById('paciente-telefone').value,
        nascimento: document.getElementById('paciente-nascimento').value,
        cpf: document.getElementById('paciente-cpf').value,
        categoria: categoria,
        vencimento: categoria === 'Ortodontia' ? document.getElementById('paciente-vencimento').value : ''
    };

    if (editId) {
        const index = db.pacientes.findIndex(p => p.id === editId);
        if (index !== -1) {
            const etapasAnteriores = db.pacientes[index].planejamentoEtapas || [];
            db.pacientes[index] = { ...dadosPaciente, id: editId, planejamentoEtapas: etapasAnteriores };
        }
    } else {
        db.pacientes.push({ id: gerarIdUnico(), planejamentoEtapas: [], possuiPendenciaManual: false, obsFinanceiraManual: '', ...dadosPaciente });
    }

    registrarAuditoria('Cadastro de Paciente', `Ficha do paciente ${nomeCaixaAlta} salva.`);
    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();
    atualizarCalendario();

    if (editId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(editId, abaOrigem);
    }
    alertCustomizado('Dados do paciente salvos!');
}

function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem;
    pacienteAtualId = pacienteId;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    const agendamentosPaciente = db.agendamentos.filter(ag => ag.tipoEvento === 'agendamento' && ag.pacienteId === pacienteId);
    const prontuariosPaciente = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    const pagamentosPaciente = db.pagamentos.filter(pg => pg.pacienteId === pacienteId);
    
    const container = document.getElementById('detalhes-paciente-container');
    if (!container) return;

    const telefoneLimpo = paciente.telefone ? paciente.telefone.replace(/\D/g, '') : '';
    const btnWhatsapp = telefoneLimpo ? '<a href="https://wa.me/55' + telefoneLimpo + '" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-bold ml-2 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp text-base"></i> Conversar</a>' : '';

    let badgePendencia = '';
    if (paciente.possuiPendenciaManual) {
        badgePendencia = '<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">' +
            '<div class="flex items-center justify-between">' +
                '<span class="text-[10px] uppercase font-bold text-amber-600 tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Pendência Financeira</span>' +
            '</div>' +
            '<p class="text-xs font-medium text-amber-900">' + (paciente.obsFinanceiraManual || 'Paciente marcado com pendência/débito.') + '</p>' +
            '<button onclick="removerPendenciaManual(\'' + paciente.id + '\')" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1"><i class="fa-solid fa-check"></i> Dar Baixa</button>' +
        '</div>';
    } else {
        badgePendencia = '<div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">' +
            '<div><span class="text-[10px] uppercase font-bold text-emerald-600">Financeiro: </span><span class="text-xs font-semibold text-emerald-800">Sem pendências</span></div>' +
        '</div>';
    }

    let etapas = Array.isArray(paciente.planejamentoEtapas) ? paciente.planejamentoEtapas : [];
    const valorTotalPlano = etapas.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

    let htmlItensEtapas = etapas.length === 0 ? '<p class="text-xs text-slate-400 italic p-2">Nenhuma etapa cadastrada.</p>' :
        etapas.map((et, index) => {
            const statusBg = et.concluido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
            const statusTexto = et.concluido ? 'Concluído' : 'Pendente';
            const estiloTexto = et.concluido ? 'line-through text-slate-400' : 'text-slate-800 font-medium';
            const btnCheck = usuarioAtual && usuarioAtual.perfil !== 'secretaria' ? '<button type="button" onclick="alternarStatusEtapa(\'' + paciente.id + '\', \'' + et.id + '\')" class="px-2 py-1 ' + (et.concluido ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white') + ' text-xs font-semibold rounded"><i class="fa-solid ' + (et.concluido ? 'fa-rotate-left' : 'fa-check') + '"></i> ' + (et.concluido ? 'Reabrir' : 'Concluir') + '</button>' : '';
            const btnLixo = usuarioAtual && usuarioAtual.perfil !== 'secretaria' ? '<button type="button" onclick="excluirEtapaPlanejamento(\'' + paciente.id + '\', \'' + et.id + '\')" class="text-slate-400 hover:text-red-600 text-xs p-1"><i class="fa-solid fa-trash"></i></button>' : '';

            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-indigo-100 text-xs gap-2 shadow-sm">' +
                '<div class="flex items-center space-x-2 flex-grow min-w-0">' +
                    '<span class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">' + (et.dente || 'Geral') + '</span>' +
                    '<span class="' + estiloTexto + ' truncate">' + et.procedimento + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between sm:justify-end space-x-2 border-t sm:border-0 border-slate-100">' +
                    '<span class="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">R$ ' + Number(et.valor || 0).toFixed(2) + '</span>' +
                    '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full ' + statusBg + '">' + statusTexto + '</span>' + btnCheck + btnLixo +
                '</div></div>';
        }).join('');

    let htmlFormAdicionarEtapa = '';
    if (usuarioAtual && usuarioAtual.perfil !== 'secretaria') {
        htmlFormAdicionarEtapa = '<form onsubmit="adicionarEtapaPlanejamento(event, \'' + paciente.id + '\')" class="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100">' +
            '<div class="sm:col-span-2"><input type="text" id="plan-dente" placeholder="Dente" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white"></div>' +
            '<div class="sm:col-span-5"><input type="text" id="plan-desc" required placeholder="Procedimento" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white"></div>' +
            '<div class="sm:col-span-3"><input type="number" step="0.01" id="plan-valor" placeholder="Valor (R$)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white"></div>' +
            '<div class="sm:col-span-2"><button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow">Add</button></div></form>';
    }

    let htmlPlanoTratamento = '<div class="space-y-3 bg-indigo-50/20 p-3 rounded-xl border border-indigo-100">' +
        '<div class="flex justify-between items-center text-xs font-bold text-indigo-900"><span>Itens do Plano</span><span>Total: R$ ' + valorTotalPlano.toFixed(2) + '</span></div>' +
        '<div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">' + htmlItensEtapas + '</div>' + htmlFormAdicionarEtapa + '</div>';

    let htmlFormProntuario = '';
    if (usuarioAtual && usuarioAtual.perfil !== 'secretaria') {
        htmlFormProntuario = '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm mb-4">' +
            '<h4 class="font-bold text-blue-900 text-sm flex items-center gap-2"><i class="fa-solid fa-stethoscope text-blue-600"></i> Registrar Evolução do Prontuário</h4>' +
            '<form onsubmit="salvarProcedimentoDentista(event, \'' + paciente.id + '\')" class="space-y-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Procedimento Realizado *</label><input type="text" id="proc-desc" required placeholder="Ex: Restauração Resina Dente 16" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">O que fazer no Próximo Retorno?</label><input type="text" id="proc-proxima" placeholder="Ex: Moldagem e ajuste de oclusão" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Prontuário</button></form></div>';
    }

    let htmlFormCaixa = '<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-sm mb-4">' +
        '<h4 class="font-bold text-emerald-900 text-sm flex items-center gap-2"><i class="fa-solid fa-cash-register text-emerald-600"></i> Lançamento Financeiro</h4>' +
        '<form onsubmit="salvarLancamentoCaixaManual(event, \'' + paciente.id + '\')" class="space-y-3">' +
            '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Descrição *</label><input type="text" id="caixa-proc-desc" required class="w-full px-3 py-2 border rounded-lg text-sm bg-white"></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Valor (R$)</label><input type="number" step="0.01" id="caixa-valor-pago" class="w-full px-3 py-2 border rounded-lg text-sm bg-white"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Forma</label><select id="caixa-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white"><option value="Pix">Pix</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option><option value="Dinheiro">Dinheiro</option></select></div>' +
            '</div>' +
            '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Observação / Status</label><input type="text" id="caixa-obs-manual" value="' + (paciente.obsFinanceiraManual || '') + '" class="w-full px-3 py-2 border rounded-lg text-sm bg-white"></div>' +
            '<div class="flex items-center gap-2 pt-1">' +
                '<input type="checkbox" id="caixa-marca-pendencia" class="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" ' + (paciente.possuiPendenciaManual ? 'checked' : '') + '>' +
                '<label for="caixa-marca-pendencia" class="text-xs font-semibold text-slate-700 cursor-pointer">Marcar paciente com pendência financeira</label>' +
            '</div>' +
            '<button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow">Salvar Lançamento</button></form></div>';

    let htmlAgendamentos = agendamentosPaciente.length === 0 ? '<p class="text-sm text-slate-400 p-2">Nenhum agendamento.</p>' : '';
    agendamentosPaciente.forEach(ag => {
        htmlAgendamentos += '<div class="p-3 bg-white rounded-lg border border-slate-200 text-sm flex justify-between items-center shadow-sm">' +
            '<div><p class="font-semibold text-slate-800">' + ag.tipo + ' • ' + (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + '</p></div>' +
            '<div class="flex gap-2"><button onclick="abrirModalEditarAgendamento(\'' + ag.id + '\')" class="p-1.5 bg-amber-50 text-amber-700 rounded text-xs"><i class="fa-solid fa-pen"></i></button><button onclick="excluirAgendamento(\'' + ag.id + '\', \'' + paciente.id + '\')" class="p-1.5 bg-red-50 text-red-600 rounded text-xs"><i class="fa-solid fa-trash"></i></button></div></div>';
    });

    let htmlPagamentosTimeline = pagamentosPaciente.length === 0 ? '<p class="text-sm text-slate-400 p-2">Nenhum pagamento.</p>' : '';
    pagamentosPaciente.slice().sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(pg => {
        const isEstorno = pg.valor < 0;
        const btnEstornar = !isEstorno ? '<button onclick="estornarPagamento(\'' + pg.id + '\', \'' + pacienteId + '\')" class="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded ml-2">Estornar</button>' : '';
        htmlPagamentosTimeline += '<div class="p-3 ' + (isEstorno ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100') + ' border rounded-lg text-sm flex justify-between items-center mb-2">' +
            '<div><p class="font-semibold text-slate-800">' + pg.descricao + '</p><span class="text-xs text-slate-500">' + (pg.data ? pg.data.split('-').reverse().join('/') : '-') + '</span></div>' +
            '<div class="flex items-center"><span class="font-bold text-slate-700">R$ ' + Number(pg.valor).toFixed(2) + '</span>' + btnEstornar + '</div></div>';
    });

    container.innerHTML = '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">' +
        '<div class="lg:col-span-1 space-y-4">' +
            '<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">' +
                '<div class="flex items-center space-x-3 border-b pb-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-base">' + paciente.nome.charAt(0) + '</div><div><h3 class="font-bold text-slate-900 text-base leading-tight">' + paciente.nome + '</h3><span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mt-0.5">' + paciente.categoria + '</span></div></div>' +
                '<div class="space-y-1.5 text-xs">' +
                    '<div><span class="font-semibold text-slate-400">Telefone:</span> <span class="font-medium text-slate-800">' + (paciente.telefone || '-') + '</span>' + btnWhatsapp + '</div>' +
                    '<div><span class="font-semibold text-slate-400">CPF:</span> <span class="font-medium text-slate-800">' + (paciente.cpf || '-') + '</span></div>' +
                    '<div><span class="font-semibold text-slate-400">Nascimento:</span> <span class="font-medium text-slate-800">' + (paciente.nascimento ? paciente.nascimento.split('-').reverse().join('/') : '-') + '</span></div>' +
                '</div>' + badgePendencia +
                '<div class="pt-2 border-t flex gap-2">' +
                    '<button onclick="abrirModalPaciente(\'' + paciente.id + '\')" class="flex-1 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold"><i class="fa-solid fa-user-pen"></i> Editar</button>' +
                    '<button onclick="excluirPaciente(\'' + paciente.id + '\')" class="flex-1 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold"><i class="fa-solid fa-user-xmark"></i> Excluir</button>' +
                '</div></div></div>' +
        '<div class="lg:col-span-2 space-y-4">' +
            '<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">' +
                '<div class="border-b border-slate-200 flex space-x-4 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">' +
                    '<button onclick="abrirSubAbaPaciente(\'prontuario\')" id="btn-subtab-prontuario" class="subtab-btn pb-2 border-b-2 border-blue-600 text-blue-600 flex items-center gap-1.5"><i class="fa-solid fa-notes-medical"></i> Prontuário</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'plano\')" id="btn-subtab-plano" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500"><i class="fa-solid fa-clipboard-list"></i> Plano</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'caixa\')" id="btn-subtab-caixa" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500"><i class="fa-solid fa-cash-register"></i> Caixa</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'agendamentos\')" id="btn-subtab-agendamentos" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500"><i class="fa-solid fa-calendar-check"></i> Agendamentos</button>' +
                '</div>' +
                '<div id="subtab-content-prontuario" class="subtab-content space-y-4">' +
                    htmlFormProntuario +
                    '<input type="text" id="busca-prontuario-input" oninput="filtrarProntuarioLinhaTempo(\'' + paciente.id + '\')" placeholder="🔍 Pesquisar no histórico..." class="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50">' +
                    '<div id="container-prontuario-timeline" class="space-y-3 max-h-[50vh] overflow-y-auto pr-1"></div>' +
                '</div>' +
                '<div id="subtab-content-plano" class="subtab-content hidden space-y-3">' + htmlPlanoTratamento + '</div>' +
                '<div id="subtab-content-caixa" class="subtab-content hidden space-y-3">' + htmlFormCaixa + htmlPagamentosTimeline + '</div>' +
                '<div id="subtab-content-agendamentos" class="subtab-content hidden space-y-3">' + htmlAgendamentos + '</div>' +
            '</div></div></div>';

    mudarAba('detalhes-paciente');
    renderizarLinhaTempoProntuario(document.getElementById('container-prontuario-timeline'), prontuariosPaciente, paciente.id);
    abrirSubAbaPaciente(subAbaAtualPaciente);
}

// ==========================================
// PDF DO ORÇAMENTO (CABEÇALHO OFICIAL)
// ==========================================
function gerarPDFOrcamento(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    
    let etapas = Array.isArray(paciente.planejamentoEtapas) ? paciente.planejamentoEtapas : [];
    let linhasHtml = '';
    let total = 0;
    
    etapas.forEach((et, idx) => {
        linhasHtml += `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${idx + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${et.dente || 'Geral'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${et.procedimento}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">R$ ${Number(et.valor).toFixed(2)}</td>
        </tr>`;
        total += parseFloat(et.valor) || 0;
    });

    const janelaImpressao = window.open('', '_blank');
    janelaImpressao.document.write(`
        <html>
        <head>
            <title>Plano de Tratamento - ${paciente.nome}</title>
            <style>body { font-family: Arial, sans-serif; color: #333; margin: 40px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; }</style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #1e3a8a;">Dr. Mikeias Santos</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Cirurgião Dentista CRO Pa 8360</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">Rua Assis Dória, 61 - Centro - Marituba</p>
            </div>
            <h3>Plano de Tratamento</h3>
            <p><strong>Paciente:</strong> ${paciente.nome}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <table>
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 8px;">#</th><th style="padding: 8px;">Dente</th><th style="padding: 8px;">Procedimento</th><th style="padding: 8px;">Valor</th>
                    </tr>
                </thead>
                <tbody>${linhasHtml}</tbody>
            </table>
            <h3 style="text-align: right; margin-top: 20px; color: #1e40af;">Total Estimado: R$ ${total.toFixed(2)}</h3>
            <div style="margin-top: 60px; text-align: center; border-top: 1px solid #ccc; width: 300px; margin-left: auto; margin-right: auto; padding-top: 10px;">
                Assinatura do Profissional
            </div>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
    setTimeout(() => { janelaImpressao.print(); }, 500);
}
