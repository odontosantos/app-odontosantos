let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: []
};

const SENHA_EXCLUSAO = '1234';

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

function carregarDadosLocais() {
    try {
        db.pacientes = JSON.parse(localStorage.getItem('odonto_pacientes')) || [];
        db.agendamentos = JSON.parse(localStorage.getItem('odonto_agendamentos')) || [];
        db.prontuarios = JSON.parse(localStorage.getItem('odonto_prontuarios')) || [];
        db.pagamentos = JSON.parse(localStorage.getItem('odonto_pagamentos')) || [];
        db.despesas = JSON.parse(localStorage.getItem('odonto_despesas')) || [];
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
let visaoAgendaAtual = 'diaria';

function gerarIdUnico() {
    return Date.now().toString() + '-' + Math.floor(Math.random() * 10000);
}

async function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));

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
    ativarSincronizacaoEmTempoReal();
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

    if (usuarioAtual && usuarioAtual.perfil === 'secretaria') {
        badge.innerText = 'Perfil: Secretaria / Recepção';
        badge.className = 'inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full mt-0.5';
    } else {
        badge.innerText = 'Perfil: Dentista (Clínico)';
        badge.className = 'inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800 rounded-full mt-0.5';
    }

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
// AGENDA & MINI CALENDÁRIO
// ==========================================
function inicializarCalendario() { renderizarAgendaCards(); }
function atualizarCalendario() { renderizarAgendaCards(); }

function mudarDiaAgenda(dias) {
    const data = new Date(dataAgendaAtual + 'T12:00:00');
    data.setDate(data.getDate() + dias);
    dataAgendaAtual = data.toISOString().split('T')[0];
    renderizarAgendaCards();
}

function definirVisaoAgenda(visao) {
    visaoAgendaAtual = visao;
    ['diaria', 'semanal', 'mensal'].forEach(v => {
        const btn = document.getElementById('btn-visao-' + v);
        if (btn) {
            if (v === visao) {
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition bg-blue-600 text-white shadow-sm';
            } else {
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition bg-slate-100 text-slate-700 hover:bg-slate-200';
            }
        }
    });
    renderizarAgendaCards();
}

function alternarMiniCalendario() {
    const cont = document.getElementById('mini-calendario-container');
    if (cont) {
        cont.classList.toggle('hidden');
        if (!cont.classList.contains('hidden')) {
            renderizarMiniCalendario();
        }
    }
}

function renderizarMiniCalendario() {
    const cont = document.getElementById('mini-calendario-conteudo');
    if (!cont) return;

    const dataAtualObj = new Date(dataAgendaAtual + 'T12:00:00');
    const ano = dataAtualObj.getFullYear();
    const mes = dataAtualObj.getMonth();

    const primeiroDiaMes = new Date(ano, mes, 1);
    const ultimoDiaMes = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDiaMes.getDate();
    const diaSemanaInicio = primeiroDiaMes.getDay();

    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let html = `<div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-xs text-slate-800">${mesesNomes[mes]} de ${ano}</span>
                    <div class="flex gap-1">
                        <button onclick="mudarMesMini(-1)" class="p-1 hover:bg-slate-200 rounded text-xs"><i class="fa-solid fa-chevron-left"></i></button>
                        <button onclick="mudarMesMini(1)" class="p-1 hover:bg-slate-200 rounded text-xs"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs">`;

    for (let i = 0; i < diaSemanaInicio; i++) { html += `<div></div>`; }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mes + 1).padStart(2, '0');
        const dataIsoStr = `${ano}-${mesStr}-${diaStr}`;

        const temAgendamentos = db.agendamentos.some(a => a.data === dataIsoStr);
        const ehHoje = dataIsoStr === obterDataLocalISO();
        const ehSelecionado = dataIsoStr === dataAgendaAtual;

        let estilo = 'hover:bg-slate-100 text-slate-700';
        if (ehSelecionado) estilo = 'bg-blue-600 text-white font-bold shadow-sm';
        else if (ehHoje) estilo = 'border border-blue-500 text-blue-600 font-bold';

        html += `<div onclick="selecionarDataMini('${dataIsoStr}')" class="relative p-1 rounded-lg cursor-pointer transition ${estilo} flex flex-col items-center justify-center">
                    <span>${dia}</span>
                    ${temAgendamentos && !ehSelecionado ? '<span class="absolute bottom-0.5 w-1 h-1 bg-blue-500 rounded-full"></span>' : ''}
                 </div>`;
    }

    html += `</div>`;
    cont.innerHTML = html;
}

function mudarMesMini(direcao) {
    const d = new Date(dataAgendaAtual + 'T12:00:00');
    d.setMonth(d.getMonth() + direcao);
    dataAgendaAtual = d.toISOString().split('T')[0];
    renderizarMiniCalendario();
    renderizarAgendaCards();
}

function selecionarDataMini(dataIso) {
    dataAgendaAtual = dataIso;
    renderizarAgendaCards();
}

function gerarSlotsExpediente() {
    const slots = [];
    for (let h = 8; h <= 21; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        if (h < 21) { slots.push(`${String(h).padStart(2, '0')}:30`); }
    }
    return slots;
}

function renderizarAgendaCards() {
    const container = document.getElementById('agenda-cards-container');
    const displayData = document.getElementById('data-agenda-display');
    if (!container || !displayData) return;

    const dataObj = new Date(dataAgendaAtual + 'T12:00:00');
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const hojeIso = obterDataLocalISO();
    if (dataAgendaAtual === hojeIso) {
        displayData.innerText = `Hoje, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]} (${diasSemana[dataObj.getDay()]})`;
    } else {
        displayData.innerText = `${diasSemana[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}`;
    }

    if (!document.getElementById('mini-calendario-container').classList.contains('hidden')) {
        renderizarMiniCalendario();
    }
    container.innerHTML = '';

    if (visaoAgendaAtual === 'semanal') { renderizarVisaoSemanal(container); return; }
    if (visaoAgendaAtual === 'mensal') { renderizarVisaoMensal(container); return; }

    const eventosDia = db.agendamentos.filter(a => a.data === dataAgendaAtual);
    const slots = gerarSlotsExpediente();

    let htmlGrade = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2 max-h-[68vh] overflow-y-auto pr-1">`;

    slots.forEach(horarioSlot => {
        // Uso de .filter() para capturar múltiplos eventos (pacientes, lembretes, bloqueios) no mesmo horário
        const eventosNoSlot = eventosDia.filter(ev => {
            if (ev.isBloqueio) {
                return horarioSlot >= ev.horario && horarioSlot < ev.horaFim;
            }
            return ev.horario === horarioSlot;
        });

        if (eventosNoSlot.length > 0) {
            eventosNoSlot.forEach(eventoNoSlot => {
                const isLembrete = eventoNoSlot.isLembrete;
                const isBloqueio = eventoNoSlot.isBloqueio;

                let titulo = isLembrete ? '🔔 ' + eventoNoSlot.titulo : (isBloqueio ? '🚫 ' + eventoNoSlot.titulo : (db.pacientes.find(p => p.id === eventoNoSlot.pacienteId)?.nome || 'Paciente Não Encontrado'));
                let subtitulo = isLembrete ? (eventoNoSlot.obs || 'Lembrete') : (isBloqueio ? (eventoNoSlot.obs || `Bloqueio: ${eventoNoSlot.horario} às ${eventoNoSlot.horaFim}`) : (eventoNoSlot.tipo + (eventoNoSlot.obs ? ' • ' + eventoNoSlot.obs : '')));
                let corFundo = eventoNoSlot.cor || (isBloqueio ? '#e11d48' : '#039be5');
                
                let statusHtml = '';
                if(!isLembrete && !isBloqueio) {
                    const statusAtual = eventoNoSlot.status || 'agendado';
                    let corStatus = 'bg-blue-100 text-blue-700';
                    if (statusAtual === 'atendido') { corStatus = 'bg-emerald-100 text-emerald-700'; corFundo = '#10b981'; }
                    if (statusAtual === 'faltou') { corStatus = 'bg-rose-100 text-rose-700'; corFundo = '#f43f5e'; }
                    if (statusAtual === 'remarcou') { corStatus = 'bg-slate-200 text-slate-700'; corFundo = '#94a3b8'; }
                    statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${corStatus}">${statusAtual}</span>`;
                } else if (isBloqueio) {
                    statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">BLOQUEADO</span>`;
                } else if (isLembrete) {
                    statusHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">LEMBRETE</span>`;
                }

                htmlGrade += `
                <div class="relative bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex cursor-pointer hover:shadow-md transition active:scale-[0.98] mb-1" onclick="abrirModalDetalhesAgendamento('${eventoNoSlot.id}')">
                    <div class="absolute left-0 top-0 bottom-0 w-2" style="background-color: ${corFundo};"></div>
                    <div class="p-2.5 pl-5 flex-grow flex items-center justify-between gap-2">
                        <div>
                            <div class="flex items-center gap-2 mb-0.5">
                                <span class="font-extrabold text-slate-900 text-xs"><i class="fa-regular fa-clock mr-1 text-slate-400"></i> ${isBloqueio ? eventoNoSlot.horario + ' - ' + eventoNoSlot.horaFim : eventoNoSlot.horario}</span>
                                ${statusHtml}
                            </div>
                            <h4 class="font-bold text-slate-800 text-sm leading-tight">${titulo}</h4>
                            <p class="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">${subtitulo}</p>
                        </div>
                        <span class="text-xs text-slate-400"><i class="fa-solid fa-chevron-right"></i></span>
                    </div>
                </div>`;
            });
        } else {
            htmlGrade += `
            <div onclick="abrirModalAgendamento('${dataAgendaAtual}', '${horarioSlot}')" class="group border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition">
                <span class="font-bold text-slate-400 group-hover:text-blue-600 text-xs">${horarioSlot}</span>
                <span class="text-[11px] font-semibold text-slate-400 group-hover:text-blue-600 flex items-center gap-1">
                    <i class="fa-solid fa-plus text-[10px]"></i> Livre (Agendar)
                </span>
            </div>`;
        }
    });

    htmlGrade += `</div>`;
    container.innerHTML = htmlGrade;
}

function renderizarVisaoSemanal(container) {
    const dataInicio = new Date(dataAgendaAtual + 'T12:00:00');
    const diaSemana = dataInicio.getDay();
    dataInicio.setDate(dataInicio.getDate() - diaSemana);

    let html = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 max-h-[68vh] overflow-y-auto">
                    <h4 class="font-bold text-slate-800 text-sm border-b pb-2">Visão Semanal (A partir de ${dataInicio.toLocaleDateString('pt-BR')})</h4>
                    <div class="grid grid-cols-1 sm:grid-cols-7 gap-2">`;

    for (let i = 0; i < 7; i++) {
        const d = new Date(dataInicio);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const evs = db.agendamentos.filter(a => a.data === iso);
        const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        html += `<div class="bg-slate-50 border rounded-lg p-2.5 space-y-2 cursor-pointer hover:border-blue-400 transition" onclick="dataAgendaAtual='${iso}'; definirVisaoAgenda('diaria');">
                    <div class="text-center border-b pb-1">
                        <span class="text-[10px] font-bold text-slate-400 uppercase block">${diasNomes[i]}</span>
                        <span class="font-extrabold text-xs text-slate-800">${d.getDate()}/${d.getMonth()+1}</span>
                    </div>
                    <div class="space-y-1.5 min-h-[120px]">`;

        if (evs.length === 0) {
            html += `<p class="text-[10px] text-slate-400 italic text-center pt-4">Livre</p>`;
        } else {
            evs.sort((a,b) => a.horario.localeCompare(b.horario));
            evs.forEach(ev => {
                const titulo = ev.isLembrete ? '🔔 ' + ev.titulo : (ev.isBloqueio ? '🚫 ' + ev.titulo : (db.pacientes.find(p => p.id === ev.pacienteId)?.nome || 'Paciente'));
                html += `<div onclick="event.stopPropagation(); dataAgendaAtual='${iso}'; definirVisaoAgenda('diaria');" class="p-1.5 bg-white border rounded text-[11px] shadow-sm hover:border-blue-400">
                            <span class="font-bold text-blue-900 block">${ev.horario}</span>
                            <span class="text-slate-700 truncate block">${titulo}</span>
                         </div>`;
            });
        }
        html += `</div></div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}

function renderizarVisaoMensal(container) {
    const dataObj = new Date(dataAgendaAtual + 'T12:00:00');
    const ano = dataObj.getFullYear();
    const mes = dataObj.getMonth();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaInicio = primeiroDia.getDay();
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    let html = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 max-h-[68vh] overflow-y-auto">
                    <div class="flex justify-between items-center border-b pb-2">
                        <h4 class="font-bold text-slate-800 text-sm">Visão Mensal: ${mesesNomes[mes]} de ${ano}</h4>
                    </div>
                    <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
                        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                    </div>
                    <div class="grid grid-cols-7 gap-1">`;

    for (let i = 0; i < diaInicio; i++) { html += `<div></div>`; }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mes + 1).padStart(2, '0');
        const iso = `${ano}-${mesStr}-${diaStr}`;
        const evs = db.agendamentos.filter(a => a.data === iso);

        html += `<div onclick="dataAgendaAtual='${iso}'; definirVisaoAgenda('diaria');" class="border rounded-lg p-2 min-h-[75px] bg-slate-50 cursor-pointer hover:bg-blue-50/50 transition">
                    <span class="font-bold text-xs text-slate-700">${dia}</span>
                    <div class="mt-1 space-y-0.5">`;

        evs.slice(0, 2).forEach(ev => {
            const titulo = ev.isLembrete ? '🔔 Lembrete' : (ev.isBloqueio ? '🚫 Bloqueio' : (db.pacientes.find(p => p.id === ev.pacienteId)?.nome || 'Paciente'));
            html += `<div class="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate font-medium">${ev.horario} ${titulo}</div>`;
        });
        if (evs.length > 2) {
            html += `<div class="text-[9px] text-slate-500 font-bold">+${evs.length - 2} mais</div>`;
        }
        html += `</div></div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}

// ==========================================
// PACIENTES (Responsivo: Grid no PC / Cards no Mobile)
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
    return Math.floor((hoje - dataConsulta) / (1000 * 60 * 60 * 24));
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

    container.innerHTML = '';
    let total = db.pacientes.length, clinicos = 0, orto = 0, inativosCount = 0;

    db.pacientes.forEach(p => {
        p.categoria === 'Ortodontia' ? orto++ : clinicos++;
        const ult = obterUltimaConsultaPaciente(p.id);
        if (ult && calcularDiasDesdeUltimaConsulta(ult) > 30) inativosCount++;
    });

    document.getElementById('kpi-total-pacientes').innerText = total;
    document.getElementById('kpi-clinico-pacientes').innerText = clinicos;
    document.getElementById('kpi-orto-pacientes').innerText = orto;
    document.getElementById('kpi-inativos-pacientes').innerText = inativosCount;

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
        container.innerHTML = '<div class="col-span-full p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm"><i class="fa-solid fa-users-slash text-3xl mb-2"></i><p>Nenhum paciente encontrado.</p></div>';
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
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between gap-3 relative hover:shadow-md transition">
            <div>
                <div class="flex justify-between items-start gap-2 mb-1">
                    <h4 class="font-bold text-slate-900 text-sm sm:text-base truncate pr-2">${p.nome}</h4>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${badgeClass}">${p.categoria}</span>
                </div>
                <div class="text-xs sm:text-sm text-slate-600 space-y-1">
                    <p class="flex items-center gap-2"><i class="fa-solid fa-phone text-slate-400 w-4 text-center"></i> <span class="truncate">${p.telefone || '-'}</span></p>
                    <p class="flex items-center gap-2"><i class="fa-solid fa-calendar-check text-slate-400 w-4 text-center"></i> Última: ${htmlUltimaConsulta}</p>
                    ${p.categoria === 'Ortodontia' ? `<p class="flex items-center gap-2"><i class="fa-solid fa-file-invoice-dollar text-slate-400 w-4 text-center"></i> Vencimento: ${venc}</p>` : ''}
                </div>
            </div>
            <div class="pt-3 border-t border-slate-100 flex gap-2">
                <button onclick="abrirModalPaciente('${p.id}')" class="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition flex items-center justify-center" title="Editar Cadastrais">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition flex-grow flex justify-center items-center gap-2">
                    <i class="fa-solid fa-eye"></i> Abrir Ficha
                </button>
            </div>
        </div>`;
    });
}

async function excluirPaciente(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;
    if (!(await verificarSenhaExclusao())) return;
    
    db.pacientes = db.pacientes.filter(p => p.id !== pacienteId);
    db.agendamentos = db.agendamentos.filter(a => a.pacienteId !== pacienteId);
    db.prontuarios = db.prontuarios.filter(pr => pr.pacienteId !== pacienteId);
    db.pagamentos.forEach(pg => {
        if (pg.pacienteId === pacienteId) {
            pg.pacienteId = null; 
            pg.descricao = `[Paciente Excluído: ${paciente.nome}] ` + pg.descricao;
        }
    });

    persistirDB();
    atualizarCalendario();
    renderizarPacientes();
    alertCustomizado('Paciente excluído com sucesso!');
    voltarParaOrigem();
}

async function excluirProntuario(prontuarioId, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    db.prontuarios = db.prontuarios.filter(pr => pr.id !== prontuarioId);
    persistirDB();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

// ==========================================
// FINANCEIRO
// ==========================================
function estornarPagamento(pagamentoId, pacienteId) {
    const pagamentoOriginal = db.pagamentos.find(pg => pg.id === pagamentoId);
    if (!pagamentoOriginal) return;

    const corpo = `<p class="text-slate-600">Digite o motivo do estorno do pagamento (Obrigatório):</p>
                   <input type="text" id="input-motivo-estorno" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ex: Cobrança indevida...">`;
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

    persistirDB();
    alertCustomizado('Estorno realizado com sucesso!');
    if (pacienteId) abrirDetalhesPaciente(pacienteId, abaOrigem);
    else renderizarFinanceiro();
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
    }

    persistirDB();
    alertCustomizado('Lançamento salvo com sucesso!');
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

    db.despesas.push({ id: gerarIdUnico(), data: obterDataLocalISO(), descricao: desc, valor: valor, categoria: cat });
    persistirDB();
    fecharModalPersonalizado();
    renderizarFinanceiro();
    alertCustomizado('Despesa lançada com sucesso!');
}

async function excluirDespesa(id) {
    if (!(await verificarSenhaExclusao())) return;
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
        if(pg.valor > 0){ porForma[pg.forma] = (porForma[pg.forma] || 0) + parseFloat(pg.valor || 0); }
    });

    let html = `<div class="space-y-2 mb-4">
                <div class="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                    <span class="font-semibold text-slate-600"><i class="fa-solid fa-arrow-down text-emerald-500 mr-2"></i>Entradas</span>
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
        html += `<h4 class="font-bold text-slate-800 mb-2 border-b pb-1 text-xs uppercase">Resumo por Forma</h4><div class="space-y-1">`;
        for (let forma in porForma) {
            html += `<div class="flex justify-between text-sm p-2 bg-slate-50 rounded border"><span class="text-slate-700 font-medium">${forma}</span><span class="font-bold text-slate-900">R$ ${porForma[forma].toFixed(2)}</span></div>`;
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
        <div><label class="block text-xs font-semibold text-slate-500 mb-1">Forma</label><select id="avulso-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white"><option value="Pix">Pix</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option><option value="Dinheiro">Dinheiro</option></select></div>
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

    if (isNaN(valor) || valor <= 0) { alertCustomizado("Informe um valor válido."); return; }

    db.pagamentos.push({ id: gerarIdUnico(), pacienteId: null, data: obterDataLocalISO(), valor: valor, forma: forma, descricao: desc });
    persistirDB();
    fecharModalPersonalizado();
    renderizarFinanceiro();
    alertCustomizado('Pagamento lançado com sucesso!');
}

function alternarFiltroPersonalizadoFinanceiro() {
    const filtro = document.getElementById('filtro-periodo-financeiro').value;
    const container = document.getElementById('container-datas-personalizadas');
    if (filtro === 'personalizado') {
        container.classList.remove('hidden'); container.classList.add('flex');
    } else {
        container.classList.add('hidden'); container.classList.remove('flex');
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
    listaPendencias.innerHTML = ''; listaFluxo.innerHTML = '';

    const agora = new Date();
    const prefixoMes = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
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

    let faturamentoFiltrado = 0, despesasFiltradas = 0;
    transacoes.forEach(t => {
        if (t.tipo === 'entrada') faturamentoFiltrado += parseFloat(t.valor || 0);
        else despesasFiltradas += parseFloat(t.valor || 0);
    });

    document.getElementById('kpi-faturamento').innerText = 'R$ ' + faturamentoFiltrado.toFixed(2);
    document.getElementById('kpi-despesas').innerText = 'R$ ' + despesasFiltradas.toFixed(2);
    document.getElementById('kpi-saldo-liquido').innerText = 'R$ ' + (faturamentoFiltrado - despesasFiltradas).toFixed(2);
    document.getElementById('kpi-receber').innerText = db.pacientes.filter(p => p.possuiPendenciaManual).length + ' Pacientes';

    let encontrouPendencia = false;
    db.pacientes.forEach(paciente => {
        if (paciente.possuiPendenciaManual) {
            encontrouPendencia = true;
            listaPendencias.innerHTML += `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm flex justify-between items-center">
                <div><p class="font-semibold text-amber-900">${paciente.nome}</p><span class="text-xs text-amber-700">${paciente.obsFinanceiraManual || 'Pendência manual'}</span></div>
                <div class="text-right flex items-center gap-2"><button onclick="abrirDetalhesPaciente('${paciente.id}', 'financeiro')" class="text-xs text-blue-600 hover:underline px-2">Ver Ficha</button><button onclick="removerPendenciaManual('${paciente.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow transition"><i class="fa-solid fa-check"></i> Baixar</button></div>
            </div>`;
        }
    });
    if (!encontrouPendencia) listaPendencias.innerHTML = '<p class="text-sm text-slate-400">Nenhum paciente marcado com pendência.</p>';

    transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    if (transacoes.length === 0) {
        listaFluxo.innerHTML = '<p class="text-sm text-slate-400">Nenhum lançamento registrado para este período.</p>';
    } else {
        transacoes.forEach(t => {
            if (t.tipo === 'entrada') {
                const paciente = db.pacientes.find(p => p.id === t.pacienteId) || { nome: 'PACIENTE AVULSO / EXCLUÍDO' };
                const isEstorno = t.valor < 0;
                listaFluxo.innerHTML += `<div class="p-3 bg-white border border-slate-100 rounded-lg text-sm flex justify-between items-center shadow-sm">
                    <div><p class="font-semibold text-slate-900"><i class="fa-solid fa-circle-dot text-xs mr-1 ${isEstorno ? 'text-rose-600' : 'text-emerald-600'}"></i> ${paciente.nome}</p><span class="text-xs text-slate-500">${t.descricao} • ${t.data.split('-').reverse().join('/')} (${t.forma})</span></div>
                    <span class="font-bold ${isEstorno ? 'text-rose-600' : 'text-emerald-600'}">${isEstorno ? '' : '+ '}R$ ${Number(t.valor).toFixed(2)}</span>
                </div>`;
            } else {
                listaFluxo.innerHTML += `<div class="p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm flex justify-between items-center">
                    <div><p class="font-semibold text-rose-900"><i class="fa-solid fa-arrow-up mr-1"></i> Despesa Clínica</p><span class="text-xs text-slate-500">${t.descricao} • ${t.data.split('-').reverse().join('/')}</span></div>
                    <div class="flex items-center gap-3"><span class="font-bold text-rose-600">- R$ ${Number(t.valor).toFixed(2)}</span><button onclick="excluirDespesa('${t.id}')" class="text-rose-400 hover:text-rose-700 text-xs transition"><i class="fa-solid fa-trash"></i></button></div>
                </div>`;
            }
        });
    }
}

// ==========================================
// PRONTUÁRIO & PACIENTE DETALHES
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
    if (btnAtivo) { btnAtivo.classList.remove('border-transparent', 'text-slate-500'); btnAtivo.classList.add('border-blue-600', 'text-blue-600'); }
    if (contentAtivo) contentAtivo.classList.remove('hidden');
}

function filtrarProntuarioLinhaTempo(pacienteId) {
    const inputBusca = document.getElementById('busca-prontuario-input');
    if (!inputBusca) return;
    const termo = inputBusca.value.toLowerCase();
    const container = document.getElementById('container-prontuario-timeline');
    const prontuarios = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    if (prontuarios.length === 0) return;
    renderizarLinhaTempoProntuario(container, prontuarios.filter(pr => (pr.procedimento || '').toLowerCase().includes(termo) || (pr.data || '').includes(termo)), pacienteId);
}

function renderizarLinhaTempoProntuario(container, prontuarios, pacienteId) {
    if (!container) return;
    container.innerHTML = '';
    if (prontuarios.length === 0) { container.innerHTML = '<p class="text-sm text-slate-400 p-2">Nenhum registro encontrado.</p>'; return; }

    const grupos = {};
    prontuarios.slice().sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(pr => {
        const mesAno = formatarMesAno(pr.data);
        if (!grupos[mesAno]) grupos[mesAno] = [];
        grupos[mesAno].push(pr);
    });

    let index = 0, mesAtualFormatado = formatarMesAno(obterDataLocalISO());
    Object.keys(grupos).forEach(mesAno => {
        const accId = 'acc-prontuario-' + index;
        const estaAberto = (mesAno === mesAtualFormatado) || (index === 0);
        let htmlItens = '';
        grupos[mesAno].forEach(pr => {
            const proxHtml = pr.proximaConsulta ? `<p class="text-xs font-semibold text-blue-700 bg-blue-50 p-1.5 rounded mt-1"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Próxima consulta: ${pr.proximaConsulta}</p>` : '';
            htmlItens += `<div class="p-3 bg-white rounded-lg border border-slate-100 space-y-1 shadow-sm flex justify-between items-start gap-2">
                <div class="space-y-1 flex-grow">
                    <div class="flex justify-between text-xs text-slate-500"><span>Data: <strong>${pr.data.split('-').reverse().join('/')}</strong></span></div>
                    <p class="text-slate-800 font-medium">Descrição: ${pr.procedimento}</p>${proxHtml}
                </div>
                <button onclick="excluirProntuario('${pr.id}', '${pacienteId}')" class="text-slate-400 hover:text-red-600 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
        container.innerHTML += `<div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button onclick="alternarAccordion('${accId}')" class="w-full px-4 py-3 text-left font-bold text-slate-800 flex justify-between items-center hover:bg-slate-100 transition text-sm"><span><i class="fa-regular fa-calendar-check mr-2 text-blue-600"></i>${mesAno} (${grupos[mesAno].length})</span><i class="fa-solid fa-chevron-down text-xs text-slate-400"></i></button>
            <div id="${accId}" class="${estaAberto ? '' : 'hidden'} p-3 space-y-2 border-t border-slate-200">${htmlItens}</div>
        </div>`;
        index++;
    });
}

function salvarProcedimentoDentista(event, pacienteId) {
    event.preventDefault();
    db.prontuarios.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        procedimento: document.getElementById('proc-desc').value,
        valorCobrado: 0,
        proximaConsulta: document.getElementById('proc-proxima').value
    });
    persistirDB();
    alertCustomizado('Evolução salva!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function adicionarEtapaPlanejamento(event, pacienteId) {
    event.preventDefault();
    const dente = document.getElementById('plan-dente')?.value.trim() || 'Geral';
    const desc = document.getElementById('plan-desc').value.trim();
    const valor = parseFloat(document.getElementById('plan-valor')?.value) || 0;
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
        if (etapa) { etapa.concluido = !etapa.concluido; persistirDB(); abrirDetalhesPaciente(pacienteId, abaOrigem); }
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
                    persistirDB();
                    atualizarCalendario();
                    renderizarPacientes();
                    alertCustomizado('Backup restaurado com sucesso!');
                }
            } else { alertCustomizado('Arquivo inválido.'); }
        } catch (err) { alertCustomizado('Erro ao ler JSON: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function abrirModalPaciente(pacienteId) {
    document.getElementById('form-paciente').reset();
    const titulo = document.getElementById('titulo-modal-paciente');
    const editId = document.getElementById('paciente-edit-id');

    if (pacienteId) {
        const paciente = db.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;
        titulo.innerText = 'Editar Cadastro';
        editId.value = paciente.id;
        document.getElementById('paciente-nome').value = paciente.nome;
        document.getElementById('paciente-telefone').value = paciente.telefone || '';
        document.getElementById('paciente-nascimento').value = paciente.nascimento || '';
        document.getElementById('paciente-cpf').value = paciente.cpf || '';
        document.getElementById('paciente-categoria').value = paciente.categoria;
        document.getElementById('paciente-vencimento').value = paciente.vencimento || '';
        toggleVencimentoOrto();
    } else {
        titulo.innerText = 'Cadastrar Novo Paciente';
        editId.value = '';
        document.getElementById('grupo-vencimento-orto').classList.add('hidden');
    }
    const modal = document.getElementById('modal-paciente');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function toggleVencimentoOrto() {
    const cat = document.getElementById('paciente-categoria')?.value;
    const grupo = document.getElementById('grupo-vencimento-orto');
    if (cat === 'Ortodontia') grupo.classList.remove('hidden');
    else grupo.classList.add('hidden');
}

function popularSelectPacientes() {
    const select = document.getElementById('agendamento-paciente');
    if (!select) return;
    select.innerHTML = '';
    db.pacientes.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome} (${p.categoria})</option>`;
    });
}

function toggleFormCadastroRapido() {
    const bloco = document.getElementById('container-cadastro-rapido');
    const busca = document.getElementById('container-busca-paciente');
    const btn = document.getElementById('btn-toggle-cadastro-rapido');
    if (bloco.classList.contains('hidden')) {
        bloco.classList.remove('hidden'); busca.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar';
    } else {
        bloco.classList.add('hidden'); busca.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Rápido';
    }
}

function cadastrarPacienteRapido() {
    const nome = document.getElementById('rapido-nome').value.trim().toUpperCase();
    if (!nome) { alertCustomizado('Informe o nome.'); return; }
    const novoId = gerarIdUnico();
    db.pacientes.push({
        id: novoId,
        nome: nome,
        telefone: document.getElementById('rapido-telefone').value.trim(),
        nascimento: '', cpf: '',
        categoria: document.getElementById('rapido-categoria').value,
        vencimento: '', planejamentoEtapas: []
    });
    persistirDB();
    popularSelectPacientes();
    renderizarPacientes();
    document.getElementById('agendamento-paciente').value = novoId;
    toggleFormCadastroRapido();
    alertCustomizado('Paciente cadastrado!');
}

function filtrarPacientesSelect() {
    const termo = document.getElementById('filtro-paciente-busca').value.toLowerCase();
    const select = document.getElementById('agendamento-paciente');
    select.innerHTML = '';
    const filtrados = db.pacientes.filter(p => p.nome.toLowerCase().includes(termo));
    if (filtrados.length === 0) {
        select.innerHTML = '<option value="">Nenhum paciente encontrado</option>';
        return;
    }
    filtrados.forEach(p => { select.innerHTML += `<option value="${p.id}">${p.nome} (${p.categoria})</option>`; });
}

function salvarPaciente(event) {
    event.preventDefault();
    const categoria = document.getElementById('paciente-categoria').value;
    const nome = document.getElementById('paciente-nome').value.trim().toUpperCase();
    const editId = document.getElementById('paciente-edit-id').value;

    if (!nome) { alertCustomizado('O nome é obrigatório.'); return; }
    const dados = {
        nome: nome,
        telefone: document.getElementById('paciente-telefone').value,
        nascimento: document.getElementById('paciente-nascimento').value,
        cpf: document.getElementById('paciente-cpf').value,
        categoria: categoria,
        vencimento: categoria === 'Ortodontia' ? document.getElementById('paciente-vencimento').value : ''
    };

    if (editId) {
        const index = db.pacientes.findIndex(p => p.id === editId);
        if (index !== -1) db.pacientes[index] = { ...db.pacientes[index], ...dados };
    } else {
        db.pacientes.push({ id: gerarIdUnico(), planejamentoEtapas: [], possuiPendenciaManual: false, obsFinanceiraManual: '', ...dados });
    }

    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();
    atualizarCalendario();
    if (editId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(editId, abaOrigem);
    }
    alertCustomizado('Salvo com sucesso!');
}

function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem;
    pacienteAtualId = pacienteId;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    const agendamentosPaciente = db.agendamentos.filter(ag => !ag.isLembrete && !ag.isBloqueio && ag.pacienteId === pacienteId);
    const prontuariosPaciente = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    const pagamentosPaciente = db.pagamentos.filter(pg => pg.pacienteId === pacienteId);
    const container = document.getElementById('detalhes-paciente-container');

    const telLimpo = paciente.telefone ? paciente.telefone.replace(/\D/g, '') : '';
    const btnWp = telLimpo ? `<a href="https://wa.me/55${telLimpo}" target="_blank" class="text-emerald-600 font-bold ml-2"><i class="fa-brands fa-whatsapp"></i></a>` : '';

    let badgePendencia = paciente.possuiPendenciaManual ? 
        `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5"><p class="text-xs font-medium text-amber-900">${paciente.obsFinanceiraManual || 'Pendência financeira.'}</p><button onclick="removerPendenciaManual('${paciente.id}')" class="w-full py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">Baixar</button></div>` :
        `<div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl"><span class="text-xs font-semibold text-emerald-800">Sem pendências</span></div>`;

    let etapas = Array.isArray(paciente.planejamentoEtapas) ? paciente.planejamentoEtapas : [];
    let valorPlano = etapas.reduce((a, c) => a + (parseFloat(c.valor) || 0), 0);

    let htmlItensEtapas = etapas.length === 0 ? '<p class="text-xs text-slate-400 italic p-2">Nenhuma etapa cadastrada.</p>' :
        etapas.map((et, i) => `<div class="flex justify-between items-center p-2.5 bg-white rounded-lg border text-xs gap-2">
            <span class="font-bold text-indigo-600">#${i+1}</span><span class="font-bold">${et.dente || 'Geral'}</span><span class="${et.concluido ? 'line-through text-slate-400' : ''}">${et.procedimento}</span>
            <span class="font-bold">R$ ${Number(et.valor || 0).toFixed(2)}</span>
            <button onclick="alternarStatusEtapa('${paciente.id}', '${et.id}')" class="px-2 py-1 ${et.concluido ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white'} rounded">${et.concluido ? 'Reabrir' : 'Concluir'}</button>
        </div>`).join('');

    container.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div class="bg-white rounded-xl shadow-sm border p-4 space-y-3">
            <h3 class="font-bold text-slate-900 text-base">${paciente.nome}</h3>
            <p class="text-xs">Tel: ${paciente.telefone || '-'} ${btnWp}</p>
            ${badgePendencia}
        </div>
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border p-4 space-y-4">
            <div class="border-b flex space-x-4 text-xs font-semibold">
                <button onclick="abrirSubAbaPaciente('prontuario')" id="btn-subtab-prontuario" class="subtab-btn pb-2 border-b-2 border-blue-600 text-blue-600">Prontuário</button>
                <button onclick="abrirSubAbaPaciente('plano')" id="btn-subtab-plano" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500">Plano</button>
                <button onclick="abrirSubAbaPaciente('caixa')" id="btn-subtab-caixa" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500">Caixa</button>
            </div>
            <div id="subtab-content-prontuario" class="subtab-content space-y-4">
                <form onsubmit="salvarProcedimentoDentista(event, '${paciente.id}')" class="space-y-3 bg-blue-50 p-3 rounded-xl border">
                    <input type="text" id="proc-desc" required placeholder="Procedimento realizado..." class="w-full px-3 py-2 border rounded text-sm bg-white">
                    <input type="text" id="proc-proxima" placeholder="Próxima consulta..." class="w-full px-3 py-2 border rounded text-sm bg-white">
                    <button type="submit" class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold">Salvar</button>
                </form>
                <div id="container-prontuario-timeline" class="space-y-3 max-h-[50vh] overflow-y-auto"></div>
            </div>
            <div id="subtab-content-plano" class="subtab-content hidden space-y-3">
                <div class="space-y-2 max-h-[50vh] overflow-y-auto">${htmlItensEtapas}</div>
                <form onsubmit="adicionarEtapaPlanejamento(event, '${paciente.id}')" class="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t">
                    <input type="text" id="plan-dente" placeholder="Dente" class="px-2 py-1 border rounded text-xs">
                    <input type="text" id="plan-desc" required placeholder="Procedimento" class="px-2 py-1 border rounded text-xs">
                    <input type="number" step="0.01" id="plan-valor" placeholder="R$" class="px-2 py-1 border rounded text-xs">
                    <button type="submit" class="bg-indigo-600 text-white rounded text-xs font-semibold">Add</button>
                </form>
            </div>
            <div id="subtab-content-caixa" class="subtab-content hidden space-y-3">
                <form onsubmit="salvarLancamentoCaixaManual(event, '${paciente.id}')" class="space-y-3 bg-emerald-50 p-3 rounded-xl border">
                    <input type="text" id="caixa-proc-desc" required placeholder="Descrição..." class="w-full px-3 py-2 border rounded text-sm bg-white">
                    <input type="number" step="0.01" id="caixa-valor-pago" placeholder="Valor R$" class="w-full px-3 py-2 border rounded text-sm bg-white">
                    <select id="caixa-forma" class="w-full px-3 py-2 border rounded text-sm bg-white"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option></select>
                    <button type="submit" class="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold">Lançar Pagamento</button>
                </form>
            </div>
        </div></div>`;

    mudarAba('detalhes-paciente');
    renderizarLinhaTempoProntuario(document.getElementById('container-prontuario-timeline'), prontuariosPaciente, paciente.id);
    abrirSubAbaPaciente(subAbaAtualPaciente);
}

// ==========================================
// AGENDA: DETALHES, EDIÇÃO E EXCLUSÃO
// ==========================================
function atualizarHoraFimPadrao() {
    const inputInicio = document.getElementById('agendamento-horario');
    const inputFim = document.getElementById('agendamento-hora-fim');
    if (!inputInicio || !inputFim) return;
    const [h, m] = inputInicio.value.split(':').map(Number);
    let totalMins = (h * 60) + m + 30;
    inputFim.value = `${String(Math.floor(totalMins / 60) % 24).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

async function excluirAgendamento(id, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    db.agendamentos = db.agendamentos.filter(ag => ag.id !== id);
    persistirDB();
    atualizarCalendario();
    if (pacienteId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
    alertCustomizado('Item excluído com sucesso!');
}

function abrirModalDetalhesAgendamento(agendamentoId) {
    const ag = db.agendamentos.find(item => item.id === agendamentoId);
    if (!ag) return;

    const divStatus = document.getElementById('container-status-agendamento');
    const btnVerFicha = document.getElementById('btn-ver-ficha-ag-modal');

    if (ag.isLembrete) {
        document.getElementById('detalhe-ag-paciente').innerText = '🔔 ' + ag.titulo;
        document.getElementById('detalhe-ag-categoria').innerText = 'Lembrete';
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario;
        document.getElementById('detalhe-ag-tipo').innerText = 'Aviso / Nota';
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação registrada.';
        if (divStatus) divStatus.innerHTML = '';
        if (btnVerFicha && btnVerFicha.parentElement) btnVerFicha.parentElement.style.display = 'none';

        document.getElementById('btn-excluir-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); excluirAgendamento(ag.id, null); };
        document.getElementById('btn-editar-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); abrirModalEditarLembrete(ag.id); };
    } else if (ag.isBloqueio) {
        document.getElementById('detalhe-ag-paciente').innerText = '🚫 ' + ag.titulo;
        document.getElementById('detalhe-ag-categoria').innerText = 'Bloqueio de Horário';
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-tipo').innerText = 'Bloqueio de Agenda';
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação registrada.';
        if (divStatus) divStatus.innerHTML = '';
        if (btnVerFicha && btnVerFicha.parentElement) btnVerFicha.parentElement.style.display = 'none';

        document.getElementById('btn-excluir-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); excluirAgendamento(ag.id, null); };
        document.getElementById('btn-editar-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); abrirModalEditarBloqueio(ag.id); };
    } else {
        if (btnVerFicha && btnVerFicha.parentElement) btnVerFicha.parentElement.style.display = 'flex';
        const paciente = db.pacientes.find(p => p.id === ag.pacienteId) || { nome: 'PACIENTE NÃO ENCONTRADO', categoria: 'Geral' };
        
        document.getElementById('detalhe-ag-paciente').innerText = paciente.nome;
        document.getElementById('detalhe-ag-categoria').innerText = paciente.categoria;
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-tipo').innerText = ag.tipo;
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação registrada.';

        const statusAtual = ag.status || 'agendado';
        if (divStatus) {
            divStatus.innerHTML = `
                <button onclick="alterarStatusAgendamento('${ag.id}', 'atendido')" class="py-2 ${statusAtual === 'atendido' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'} font-semibold rounded-lg text-xs transition">Atendido</button>
                <button onclick="alterarStatusAgendamento('${ag.id}', 'faltou')" class="py-2 ${statusAtual === 'faltou' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'} font-semibold rounded-lg text-xs transition">Faltou</button>
                <button onclick="alterarStatusAgendamento('${ag.id}', 'remarcou')" class="py-2 ${statusAtual === 'remarcou' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-700'} font-semibold rounded-lg text-xs transition">Remarcou</button>
            `;
        }

        document.getElementById('btn-excluir-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); excluirAgendamento(ag.id, ag.pacienteId); };
        document.getElementById('btn-editar-ag-modal').onclick = function() { fecharModal('modal-detalhes-agendamento'); abrirModalEditarAgendamento(ag.id); };
        if (btnVerFicha) btnVerFicha.onclick = function() { fecharModal('modal-detalhes-agendamento'); abrirDetalhesPaciente(ag.pacienteId, 'agenda'); };
    }

    const modalDet = document.getElementById('modal-detalhes-agendamento');
    modalDet.classList.remove('hidden'); modalDet.classList.add('flex');
}

function alterarStatusAgendamento(id, status) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (ag && !ag.isLembrete && !ag.isBloqueio) {
        ag.status = (ag.status === status) ? 'agendado' : status;
        persistirDB();
        atualizarCalendario();
        abrirModalDetalhesAgendamento(id);
    }
}

function abrirModalAgendamento(dataPreenchida, horaPreenchida) {
    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-edit-id').value = '';
    if (document.getElementById('filtro-paciente-busca')) document.getElementById('filtro-paciente-busca').value = '';
    document.getElementById('agendamento-obs').value = '';
    document.getElementById('agendamento-data').value = dataPreenchida || dataAgendaAtual || obterDataLocalISO();
    document.getElementById('agendamento-horario').value = horaPreenchida || '09:00';
    atualizarHoraFimPadrao();

    const modal = document.getElementById('modal-agendamento');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function abrirModalEditarAgendamento(agendamentoId) {
    const ag = db.agendamentos.find(a => a.id === agendamentoId);
    if (!ag || ag.isLembrete || ag.isBloqueio) return;

    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Editar Agendamento';
    document.getElementById('agendamento-edit-id').value = ag.id;
    document.getElementById('agendamento-paciente').value = ag.pacienteId;
    document.getElementById('agendamento-data').value = ag.data;
    document.getElementById('agendamento-horario').value = ag.horario;
    document.getElementById('agendamento-hora-fim').value = ag.horaFim || '';
    document.getElementById('agendamento-tipo').value = ag.tipo;
    document.getElementById('agendamento-obs').value = ag.obs || '';

    const modal = document.getElementById('modal-agendamento');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function salvarAgendamento(event) {
    event.preventDefault();
    const pacienteId = document.getElementById('agendamento-paciente').value;
    const editId = document.getElementById('agendamento-edit-id').value;
    if (!pacienteId) { alertCustomizado('Selecione um paciente.'); return; }

    const dataAg = document.getElementById('agendamento-data').value;
    const horaAg = document.getElementById('agendamento-horario').value;
    const horaFimAg = document.getElementById('agendamento-hora-fim').value;

    if (horaFimAg <= horaAg) { alertCustomizado('A Hora Final deve ser posterior à Inicial.'); return; }

    const conflito = db.agendamentos.find(a => 
        a.data === dataAg && a.id !== editId && 
        ((horaAg >= a.horario && horaAg < a.horaFim) || (horaFimAg > a.horario && horaFimAg <= a.horaFim) || (horaAg <= a.horario && horaFimAg >= a.horaFim))
    );

    if (conflito) {
        const nomeConflito = conflito.isBloqueio ? `Bloqueio: ${conflito.titulo}` : (conflito.isLembrete ? conflito.titulo : (db.pacientes.find(p => p.id === conflito.pacienteId)?.nome || 'Outro evento'));
        alertCustomizado(`❌ Conflito de horário com "${nomeConflito}" (${conflito.horario} às ${conflito.horaFim}).`);
        return;
    }

    const dados = {
        isLembrete: false, isBloqueio: false,
        pacienteId: pacienteId, data: dataAg, horario: horaAg, horaFim: horaFimAg,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim(), cor: '#039be5'
    };

    if (editId) {
        const idx = db.agendamentos.findIndex(a => a.id === editId);
        if (idx !== -1) db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), status: 'agendado', ...dados });
    }

    persistirDB();
    fecharModal('modal-agendamento');
    atualizarCalendario();
    if (!document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

// ==========================================
// LEMBRETES & BLOQUEIOS (CORRIGIDOS)
// ==========================================
function abrirModalLembrete(dataPreenchida, horaPreenchida) {
    document.getElementById('titulo-modal-lembrete').innerText = 'Novo Lembrete';
    document.getElementById('lembrete-edit-id').value = '';
    document.getElementById('lembrete-titulo').value = '';
    document.getElementById('lembrete-obs').value = '';
    document.getElementById('lembrete-data').value = dataPreenchida || dataAgendaAtual || obterDataLocalISO();
    document.getElementById('lembrete-horario').value = horaPreenchida || '12:00';

    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function abrirModalEditarLembrete(lembreteId) {
    const ag = db.agendamentos.find(a => a.id === lembreteId);
    if (!ag || !ag.isLembrete) return;

    document.getElementById('titulo-modal-lembrete').innerText = 'Editar Lembrete';
    document.getElementById('lembrete-edit-id').value = ag.id;
    document.getElementById('lembrete-titulo').value = ag.titulo;
    document.getElementById('lembrete-data').value = ag.data;
    document.getElementById('lembrete-horario').value = ag.horario;
    document.getElementById('lembrete-obs').value = ag.obs || '';

    const modal = document.getElementById('modal-lembrete');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function salvarLembrete(event) {
    event.preventDefault();
    const editId = document.getElementById('lembrete-edit-id').value;
    const titulo = document.getElementById('lembrete-titulo').value.trim();
    if (!titulo) { alertCustomizado('Informe o título.'); return; }

    const dados = {
        isLembrete: true, isBloqueio: false,
        titulo: titulo,
        data: document.getElementById('lembrete-data').value,
        horario: document.getElementById('lembrete-horario').value,
        horaFim: document.getElementById('lembrete-horario').value,
        obs: document.getElementById('lembrete-obs').value.trim(),
        cor: '#616161'
    };

    if (editId) {
        const idx = db.agendamentos.findIndex(a => a.id === editId);
        if (idx !== -1) {
            db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
        }
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dados });
    }

    persistirDB();
    fecharModal('modal-lembrete');
    atualizarCalendario();
    alertCustomizado('Lembrete salvo com sucesso!');
}

function abrirModalBloqueio(dataPreenchida, horaPreenchida) {
    document.getElementById('titulo-modal-bloqueio').innerText = 'Novo Bloqueio de Horário';
    document.getElementById('bloqueio-edit-id').value = '';
    document.getElementById('bloqueio-titulo').value = '';
    document.getElementById('bloqueio-obs').value = '';
    document.getElementById('bloqueio-data').value = dataPreenchida || dataAgendaAtual || obterDataLocalISO();
    document.getElementById('bloqueio-horario').value = horaPreenchida || '12:00';
    
    const [h, m] = (horaPreenchida || '12:00').split(':');
    document.getElementById('bloqueio-hora-fim').value = String(parseInt(h) + 1).padStart(2, '0') + ':' + m;

    const modal = document.getElementById('modal-bloqueio');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function abrirModalEditarBloqueio(bloqueioId) {
    const bg = db.agendamentos.find(a => a.id === bloqueioId);
    if (!bg || !bg.isBloqueio) return;

    document.getElementById('titulo-modal-bloqueio').innerText = 'Editar Bloqueio de Horário';
    document.getElementById('bloqueio-edit-id').value = bg.id;
    document.getElementById('bloqueio-titulo').value = bg.titulo;
    document.getElementById('bloqueio-data').value = bg.data;
    document.getElementById('bloqueio-horario').value = bg.horario;
    document.getElementById('bloqueio-hora-fim').value = bg.horaFim || '';
    document.getElementById('bloqueio-obs').value = bg.obs || '';

    const modal = document.getElementById('modal-bloqueio');
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function salvarBloqueio(event) {
    event.preventDefault();
    const editId = document.getElementById('bloqueio-edit-id').value;
    const titulo = document.getElementById('bloqueio-titulo').value.trim();
    const dataBloqueio = document.getElementById('bloqueio-data').value;
    const horaInicio = document.getElementById('bloqueio-horario').value;
    const horaFim = document.getElementById('bloqueio-hora-fim').value;

    if (!titulo) { alertCustomizado('Informe o motivo.'); return; }
    if (horaFim <= horaInicio) { alertCustomizado('A Hora Final deve ser posterior à Inicial.'); return; }

    const dados = {
        isBloqueio: true, isLembrete: false,
        titulo: titulo, data: dataBloqueio, horario: horaInicio, horaFim: horaFim,
        obs: document.getElementById('bloqueio-obs').value.trim(),
        cor: '#e11d48'
    };

    if (editId) {
        const idx = db.agendamentos.findIndex(a => a.id === editId);
        if (idx !== -1) {
            db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
        }
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dados });
    }

    persistirDB();
    fecharModal('modal-bloqueio');
    atualizarCalendario();
    alertCustomizado('Bloqueio salvo com sucesso!');
}

// ==========================================
// TEMPO REAL FIREBASE
// ==========================================
function ativarSincronizacaoEmTempoReal() {
    if (window.usaFirebase && window.firebaseDb) {
        const onSnapshotFunc = window.onSnapshot || (window.firebase && window.firebase.firestore && window.firebase.firestore.onSnapshot);
        const docFunc = window.doc || (window.firebase && window.firebase.firestore && window.firebase.firestore.doc);

        if (onSnapshotFunc && docFunc) {
            const docRef = docFunc(window.firebaseDb, "clinica", "dados_compartilhados");
            onSnapshotFunc(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    db = Object.assign(db, docSnap.data());
                    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
                    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
                    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
                    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
                    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));

                    if (!document.getElementById('tab-agenda').classList.contains('hidden')) renderizarAgendaCards();
                    else if (!document.getElementById('tab-pacientes').classList.contains('hidden')) renderizarPacientes();
                    else if (!document.getElementById('tab-financeiro').classList.contains('hidden')) renderizarFinanceiro();
                }
            });
        }
    }
}
