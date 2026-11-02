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
// UTILITÁRIOS E IDENTIFICAÇÃO DO USUÁRIO
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
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 60);
    db.auditoria = db.auditoria.filter(log => new Date(log.data) >= dataLimite);
}

function abrirModalAuditoria() {
    const logs = db.auditoria.slice().sort((a, b) => new Date(b.data) - new Date(a.data));
    let html = '<div class="space-y-2 max-h-[60vh] overflow-y-auto">';
    if(logs.length === 0) {
        html += '<p class="text-sm text-slate-400">Nenhum registro nos últimos 60 dias.</p>';
    } else {
        logs.forEach(log => {
            const dataFmt = new Date(log.data).toLocaleString('pt-BR');
            html += `<div class="p-2 border-b border-slate-100 text-xs">
                        <div class="flex justify-between items-center font-bold text-slate-700">
                            <span>${log.acao}</span>
                            <span class="text-slate-400">${dataFmt}</span>
                        </div>
                        <div class="text-slate-500 mt-1">${log.detalhes}</div>
                        <div class="text-blue-600 mt-1"><i class="fa-solid fa-pen text-[10px]"></i> ${log.usuario}</div>
                     </div>`;
        });
    }
    html += '</div>';
    mostrarModalPersonalizado("Auditoria de Sistema (Últimos 60 dias)", html, `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-slate-200 rounded text-slate-700 font-bold text-xs">Fechar</button>`);
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
    mostrarModalPersonalizado("Aviso", `<p class="text-slate-700">${mensagem}</p>`, `<button onclick="fecharModalPersonalizado()" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">OK</button>`);
}

// ==========================================
// PERSISTÊNCIA DE DADOS
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

async function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));
    localStorage.setItem('odonto_auditoria', JSON.stringify(db.auditoria));

    if (window.usaFirebase && window.firebaseDb && window.setDoc) {
        try { await window.setDoc(window.doc(window.firebaseDb, "clinica", "dados_compartilhados"), db); } 
        catch (e) { console.warn("Falha ao sincronizar Firebase.", e); }
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
        } catch (e) { console.warn("Falha ao puxar Firebase.", e); }
    }
}

carregarDadosLocais();

let usuarioAtual = null;
let abaOrigem = 'agenda';
let subAbaAtualPaciente = 'prontuario';
let pacienteAtualId = null;
let exibiApenasInativos = false;
let dataAgendaAtual = obterDataLocalISO();

// ==========================================
// LOGIN & INICIALIZAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.usaFirebase && window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged(async (user) => {
                if (user) processarUsuarioLogado(user);
            });
        }
    }, 1000);
});

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

async function processarUsuarioLogado(user) {
    try {
        const userDoc = await window.getDoc(window.doc(window.firebaseDb, "usuarios", user.email));
        usuarioAtual = { perfil: userDoc.exists() ? userDoc.data().perfil : 'secretaria', email: user.email };
    } catch (e) {
        usuarioAtual = { perfil: 'secretaria', email: user.email };
    }
    iniciarSessaoSistema();
    registrarAuditoria('Login de Usuário', 'Acesso ao sistema.');
}

async function iniciarSessaoSistema() {
    document.getElementById('login-screen')?.classList.replace('flex', 'hidden');
    await sincronizarDadosNuvem();
    document.getElementById('main-header')?.classList.remove('hidden');
    document.getElementById('main-nav')?.classList.remove('hidden');
    document.getElementById('main-content')?.classList.remove('hidden');
    configurarNavbar();
    inicializarSistema();
}

function configurarNavbar() {
    const navTabs = document.getElementById('nav-tabs');
    const badge = document.getElementById('header-user-badge');
    if (badge && usuarioAtual) {
        badge.innerText = `Logado como: ${obterUsuarioAssinatura()}`;
        badge.className = 'inline-block px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800 rounded-full mt-0.5';
    }
    // Auditoria button adicionado via HTML direto na topbar, ou via JS aqui
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
// AGENDA & CÁLCULO DE BURACOS (ENCAIXE)
// ==========================================
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

function calcularHoraMinutos(horaStr) {
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
}

function renderizarAgendaCards() {
    const container = document.getElementById('agenda-cards-container');
    const displayData = document.getElementById('data-agenda-display');
    if (!container || !displayData) return;

    // Garante que o container aja como lista vertical contínua
    container.className = "flex flex-col gap-2 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin scrollbar-thumb-slate-300";

    const dataObj = new Date(dataAgendaAtual + 'T12:00:00');
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    displayData.innerText = dataAgendaAtual === obterDataLocalISO() 
        ? `Hoje, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}` 
        : `${diasSemana[dataObj.getDay()]}, ${String(dataObj.getDate()).padStart(2,'0')} de ${meses[dataObj.getMonth()]}`;

    container.innerHTML = '';
    const eventos = db.agendamentos.filter(a => a.data === dataAgendaAtual);
    eventos.sort((a, b) => a.horario.localeCompare(b.horario));

    let ultimaHoraFim = "08:00"; // Início padrão do expediente

    if (eventos.length === 0) {
        container.innerHTML = '<div class="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400"><p class="font-medium">Nenhum evento. Agenda totalmente livre.</p></div>';
        return;
    }

    eventos.forEach(ag => {
        // Renderiza Buracos Tracejados para Encaixe
        if (ag.horario > ultimaHoraFim) {
            container.innerHTML += `
            <div class="border-2 border-dashed border-slate-200 bg-slate-50/50 p-2 rounded flex justify-between items-center text-slate-400 hover:bg-slate-100 transition">
                <span class="text-[11px] font-bold uppercase tracking-wide"><i class="fa-regular fa-clock"></i> ${ultimaHoraFim} às ${ag.horario} (Livre)</span>
                <button onclick="abrirModalAgendamento('${dataAgendaAtual}', '${ultimaHoraFim}')" class="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold shadow-sm hover:border-blue-400 transition">+ Encaixar</button>
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

        // Card Ultra-compacto
        container.innerHTML += `
        <div class="relative bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex cursor-pointer hover:shadow-md transition active:scale-[0.98] min-h-[60px]" onclick="abrirModalDetalhesAgendamento('${ag.id}')">
            <div class="w-1.5 shrink-0" style="background-color: ${corFundo};"></div>
            <div class="p-2.5 flex-grow flex flex-col justify-center min-w-0">
                <span class="font-extrabold text-slate-800 text-[11px] mb-0.5"><i class="fa-regular fa-clock text-slate-400"></i> ${ag.horario} às ${ag.horaFim || '?'}</span>
                <h4 class="font-bold text-slate-900 text-sm leading-tight truncate">${titulo}</h4>
                <p class="text-[10px] text-slate-500 truncate mt-0.5">${subtitulo}</p>
            </div>
            <div class="w-10 bg-slate-50 border-l border-slate-100 flex justify-center items-center shrink-0">
                 <i class="fa-solid fa-chevron-right text-blue-600 text-xs"></i>
            </div>
        </div>`;

        if (ag.horaFim && ag.horaFim > ultimaHoraFim) {
            ultimaHoraFim = ag.horaFim;
        }
    });
}

function abrirModalDetalhesAgendamento(id) {
    const ag = db.agendamentos.find(item => item.id === id);
    if (!ag) return;

    if (ag.tipoEvento === 'lembrete' || ag.tipoEvento === 'bloqueio') {
        const icone = ag.tipoEvento === 'bloqueio' ? '🔒' : '📌';
        document.getElementById('detalhe-ag-paciente').innerText = icone + ' ' + ag.titulo;
        document.getElementById('detalhe-ag-categoria').innerText = ag.tipoEvento.toUpperCase();
        document.getElementById('detalhe-ag-datahora').innerText = ag.data.split('-').reverse().join('/') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        
        const containerAcoes = document.getElementById('container-status-agendamento') || document.getElementById('botoes-acao-detalhe');
        containerAcoes.innerHTML = `
            <div class="flex gap-2 w-full justify-end mt-4 pt-3 border-t">
                <button onclick="fecharModal('modal-detalhes-agendamento'); abrirModalEditarLembrete('${ag.id}')" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}')" class="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded transition" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        document.getElementById('modal-detalhes-agendamento').classList.replace('hidden', 'flex');
        return;
    }

    const paciente = db.pacientes.find(p => p.id === ag.pacienteId) || { nome: 'DESCONHECIDO' };
    document.getElementById('detalhe-ag-paciente').innerText = paciente.nome;
    document.getElementById('detalhe-ag-datahora').innerText = ag.data.split('-').reverse().join('/') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
    
    // Botões puros (Apenas Ícones) - Refinamento Visual
    const containerAcoes = document.getElementById('botoes-acao-detalhe') || document.getElementById('container-status-agendamento');
    containerAcoes.innerHTML = `
        <div class="flex gap-2 mt-4 pt-3 border-t w-full justify-between items-center">
            <div class="flex gap-2">
                <button onclick="alterarStatusAgendamento('${ag.id}', 'atendido')" class="w-8 h-8 flex justify-center items-center rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Atendido"><i class="fa-solid fa-check"></i></button>
                <button onclick="alterarStatusAgendamento('${ag.id}', 'faltou')" class="w-8 h-8 flex justify-center items-center rounded bg-rose-100 text-rose-700 hover:bg-rose-200" title="Faltou"><i class="fa-solid fa-user-xmark"></i></button>
            </div>
            <div class="flex gap-2">
                <button onclick="fecharModal('modal-detalhes-agendamento'); abrirDetalhesPaciente('${ag.pacienteId}', 'agenda')" class="w-8 h-8 flex justify-center items-center rounded bg-blue-100 text-blue-700 hover:bg-blue-200" title="Ficha do Paciente"><i class="fa-solid fa-eye"></i></button>
                <button onclick="fecharModal('modal-detalhes-agendamento'); abrirModalEditarAgendamento('${ag.id}')" class="w-8 h-8 flex justify-center items-center rounded bg-slate-100 text-slate-700 hover:bg-slate-200" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="fecharModal('modal-detalhes-agendamento'); excluirAgendamento('${ag.id}')" class="w-8 h-8 flex justify-center items-center rounded bg-rose-50 text-rose-600 hover:bg-rose-100" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    
    document.getElementById('modal-detalhes-agendamento').classList.replace('hidden', 'flex');
}

function alterarStatusAgendamento(id, status) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (ag) {
        ag.status = status;
        persistirDB();
        renderizarAgendaCards();
        abrirModalDetalhesAgendamento(id);
    }
}

// ==========================================
// SALVAR E EXCLUIR EVENTOS NA AGENDA
// ==========================================
async function excluirAgendamento(id) {
    if (!(await verificarSenhaExclusao())) return;
    const ag = db.agendamentos.find(a => a.id === id);
    if (!ag) return;

    db.agendamentos = db.agendamentos.filter(a => a.id !== id);
    registrarAuditoria('Exclusão de Evento', `Item excluído: ${ag.tipoEvento || 'agendamento'} do dia ${ag.data}`);
    persistirDB();
    renderizarAgendaCards();
    alertCustomizado('Item excluído com sucesso!');
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

    // Verifica Conflitos com Bloqueios e Outros Agendamentos
    const conflito = db.agendamentos.find(a => a.data === dataAg && ((a.horario >= horaAg && a.horario < horaFimAg) || (a.horaFim > horaAg && a.horaFim <= horaFimAg)) && a.id !== editId);
    
    if (conflito) {
        if (conflito.tipoEvento === 'bloqueio') {
            return alertCustomizado(`⛔ O horário de ${conflito.horario} às ${conflito.horaFim} está rigidamente BLOQUEADO: ${conflito.titulo}`);
        }
        if (!confirm(`⚠️ Já existe um evento neste horário. Deseja sobrepor?`)) return;
    }

    const dados = {
        tipoEvento: 'agendamento',
        pacienteId: pacienteId,
        data: dataAg,
        horario: horaAg,
        horaFim: horaFimAg,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim()
    };

    if (editId) {
        const index = db.agendamentos.findIndex(a => a.id === editId);
        if (index !== -1) db.agendamentos[index] = { ...db.agendamentos[index], ...dados };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), status: 'agendado', ...dados });
    }

    registrarAuditoria('Agendamento', editId ? 'Edição de agendamento.' : 'Novo agendamento criado.');
    persistirDB();
    fecharModal('modal-agendamento');
    renderizarAgendaCards();
}

function salvarLembrete(event) {
    event.preventDefault();
    const editId = document.getElementById('lembrete-edit-id').value;
    const titulo = document.getElementById('lembrete-titulo').value.trim();
    const isBloqueio = document.getElementById('lembrete-is-bloqueio').checked; // Checkbox inserido no HTML do modal
    
    const dados = {
        tipoEvento: isBloqueio ? 'bloqueio' : 'lembrete',
        titulo: titulo,
        data: document.getElementById('lembrete-data').value,
        horario: document.getElementById('lembrete-horario').value,
        horaFim: document.getElementById('lembrete-hora-fim').value,
        obs: document.getElementById('lembrete-obs').value.trim()
    };

    if (editId) {
        const idx = db.agendamentos.findIndex(a => a.id === editId);
        db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dados });
    }

    registrarAuditoria('Lembrete/Bloqueio', isBloqueio ? `Bloqueio gerado: ${titulo}` : `Lembrete criado: ${titulo}`);
    persistirDB();
    fecharModal('modal-lembrete');
    renderizarAgendaCards();
}

// ==========================================
// PACIENTES (LISTA VERTICAL PURA)
// ==========================================
function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes-container');
    if (!container) return;
    
    // Força layout de lista empilhada no Desktop e Mobile
    container.className = "flex flex-col gap-3 overflow-y-auto max-h-[75vh] pr-2"; 
    container.innerHTML = '';
    
    db.pacientes.forEach(p => {
        container.innerHTML += `
        <div class="bg-white rounded-lg p-3 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 relative hover:shadow-md transition">
            <div class="flex-grow">
                <h4 class="font-bold text-slate-900 text-sm">${p.nome}</h4>
                <p class="text-xs text-slate-500"><i class="fa-solid fa-phone w-4"></i> ${p.telefone || '-'}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="abrirModalPaciente('${p.id}')" class="w-8 h-8 flex justify-center items-center bg-amber-50 text-amber-700 rounded"><i class="fa-solid fa-pen"></i></button>
                <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="px-3 h-8 flex justify-center items-center bg-blue-50 text-blue-600 rounded text-xs font-bold gap-1"><i class="fa-solid fa-eye"></i> Ficha</button>
            </div>
        </div>`;
    });
}

function salvarPaciente(event) {
    event.preventDefault();
    const id = document.getElementById('paciente-edit-id').value;
    const nome = document.getElementById('paciente-nome').value.trim().toUpperCase();
    
    const dados = {
        nome, 
        telefone: document.getElementById('paciente-telefone').value,
        nascimento: document.getElementById('paciente-nascimento').value,
        cpf: document.getElementById('paciente-cpf').value,
        categoria: document.getElementById('paciente-categoria').value
    };

    if (id) {
        const idx = db.pacientes.findIndex(p => p.id === id);
        db.pacientes[idx] = { ...db.pacientes[idx], ...dados };
    } else {
        db.pacientes.push({ id: gerarIdUnico(), ...dados });
    }

    registrarAuditoria('Cadastro de Paciente', `Paciente ${nome} salvo/editado.`);
    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();
}

async function excluirPaciente(pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    const p = db.pacientes.find(p => p.id === pacienteId);
    db.pacientes = db.pacientes.filter(p => p.id !== pacienteId);
    registrarAuditoria('Exclusão de Paciente', `Paciente ${p.nome} excluído.`);
    persistirDB();
    renderizarPacientes();
    voltarParaOrigem();
}

// ==========================================
// PRONTUÁRIO & ASSINATURA LIMPA
// ==========================================
function renderizarLinhaTempoProntuario(container, prontuarios, pacienteId) {
    if (!container) return;
    container.innerHTML = '';
    prontuarios.slice().sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(pr => {
        const assinatura = pr.assinatura || 'dr.mikeias';
        container.innerHTML += `
            <div class="p-3 bg-white rounded-lg border border-slate-100 shadow-sm relative">
                <button onclick="excluirProntuario('${pr.id}', '${pacienteId}')" class="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                <div class="text-[10px] text-slate-400 font-bold mb-1">${pr.data.split('-').reverse().join('/')}</div>
                <p class="text-slate-800 text-sm mb-2">${pr.procedimento}</p>
                <div class="mt-2 pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-medium text-right flex justify-end items-center gap-1">
                    <i class="fa-solid fa-pen text-slate-300"></i> ${assinatura}
                </div>
            </div>`;
    });
}

function salvarProcedimentoDentista(event, pacienteId) {
    event.preventDefault();
    const procedimento = document.getElementById('proc-desc').value;
    db.prontuarios.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        procedimento: procedimento,
        assinatura: obterUsuarioAssinatura() // Assinatura salva diretamente sem "usuário"
    });
    registrarAuditoria('Evolução Clínica', `Evolução adicionada para o paciente ID: ${pacienteId}`);
    persistirDB();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

// ==========================================
// ORÇAMENTO EM PDF COM CABEÇALHO OFICIAL
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
