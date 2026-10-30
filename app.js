let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: []
};

const SENHA_EXCLUSAO = '1234';
let usuarioAtual = null;
let abaOrigem = 'agenda';
let subAbaAtualPaciente = 'prontuario';
let calendar = null;
let pacienteAtualId = null;
let exibiApenasInativos = false;

function verificarSenhaExclusao() {
    const senha = prompt('🔒 Ação restrita. Digite a senha de exclusão para confirmar:');
    if (senha === null) return false;
    if (senha !== SENHA_EXCLUSAO) {
        alert('❌ Senha incorreta! Ação cancelada.');
        return false;
    }
    return true;
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

function gerarIdUnico() {
    return Date.now().toString() + '-' + Math.floor(Math.random() * 10000);
}

function obterDataLocalISO() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
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

// ==========================================
// UTILITÁRIOS E MÁSCARAS
// ==========================================
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

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function fazerLoginFirebase(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (!window.usaFirebase || !window.firebaseAuth) {
        alert("⚠️ Firebase carregando. Aguarde e tente novamente.");
        return;
    }

    try {
        const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
        usuarioAtual = { email: userCredential.user.email, perfil: 'dentista' };
        iniciarSessaoSistema();
    } catch (error) {
        console.error(error);
        alert("❌ Erro no login: Verifique suas credenciais.");
    }
}

async function iniciarSessaoSistema() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('flex');
    await sincronizarDadosNuvem();
    
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('main-content').classList.add('flex-grow');
    
    configurarNavbar();
    mudarAba('agenda');
    if (!calendar) inicializarCalendario();
    else atualizarCalendario();
    popularSelectPacientes();
}

function logout() {
    if (window.usaFirebase && window.signOut) window.signOut(window.firebaseAuth);
    usuarioAtual = null;
    location.reload();
}

// ==========================================
// NAVEGAÇÃO
// ==========================================
function configurarNavbar() {
    const navTabs = document.getElementById('nav-tabs');
    navTabs.innerHTML = `
        <button onclick="mudarAba('agenda')" id="btn-tab-agenda" class="px-4 py-3 text-sm font-semibold border-b-2 border-blue-500 text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-calendar-days"></i> Agenda</button>
        <button onclick="mudarAba('pacientes')" id="btn-tab-pacientes" class="px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-users"></i> Pacientes</button>
        <button onclick="mudarAba('financeiro')" id="btn-tab-financeiro" class="px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-file-invoice-dollar"></i> Financeiro</button>
    `;
    document.getElementById('header-user-badge').innerText = 'Dentista/Clínico';
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
    if (fab) fab.classList.toggle('hidden', nomeAba !== 'agenda');

    if (nomeAba === 'agenda' && calendar) setTimeout(() => calendar.updateSize(), 100);
    if (nomeAba === 'pacientes') renderizarPacientes();
    if (nomeAba === 'financeiro') renderizarFinanceiro();
}

function voltarParaOrigem() { mudarAba(abaOrigem || 'pacientes'); }

// ==========================================
// AGENDA E CALENDÁRIO
// ==========================================
function inicializarCalendario() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    const isMobile = window.innerWidth < 768;
    calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'pt-br',
        initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'timeGridDay,listMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: { today: 'Hoje', listMonth: 'Lista', timeGridDay: 'Dia', timeGridWeek: 'Semana', dayGridMonth: 'Mês' },
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        selectable: true,
        select: function(info) {
            const dataStr = info.startStr.split('T')[0];
            let horaStr = info.startStr.split('T')[1] ? info.startStr.split('T')[1].substring(0, 5) : '08:00';
            abrirModalAgendamento(dataStr, horaStr);
            calendar.unselect();
        },
        events: db.agendamentos.map(formatarEventoCalendario).filter(e => e !== null),
        eventClick: function(info) { abrirModalDetalhesAgendamento(info.event.id); },
        eventDrop: function(info) { atualizarHorarioEventoArraste(info); },
        eventResize: function(info) { atualizarHorarioEventoArraste(info); }
    });
    calendar.render();
}

function formatarEventoCalendario(ag) {
    if (ag.isLembrete) {
        return {
            id: ag.id, title: '📌 ' + ag.titulo, start: ag.data + 'T' + ag.horario, end: ag.data + 'T' + (ag.horaFim || ag.horario), backgroundColor: ag.cor || '#616161', borderColor: ag.cor || '#616161', extendedProps: { isLembrete: true, obs: ag.obs }
        };
    }
    const p = db.pacientes.find(x => x.id === ag.pacienteId);
    if (!p) return null;
    return {
        id: ag.id, title: p.nome + ' (' + ag.tipo + ')', start: ag.data + 'T' + ag.horario, end: ag.data + 'T' + (ag.horaFim || ag.horario), backgroundColor: ag.cor || '#039be5', borderColor: ag.cor || '#039be5', extendedProps: { status: ag.status || 'agendado', obs: ag.obs, pacienteId: ag.pacienteId }
    };
}

function atualizarCalendario() {
    if (!calendar) return;
    calendar.removeAllEvents();
    db.agendamentos.map(formatarEventoCalendario).filter(e => e !== null).forEach(ev => calendar.addEvent(ev));
}

function filtrarAgendaRapida() {
    const termo = (document.getElementById('busca-agenda-input')?.value || '').toLowerCase();
    if (!calendar) return;
    calendar.removeAllEvents();
    const evs = db.agendamentos.map(formatarEventoCalendario).filter(e => e !== null);
    if (!termo) { evs.forEach(e => calendar.addEvent(e)); return; }
    evs.filter(e => e.title.toLowerCase().includes(termo) || (e.extendedProps.obs && e.extendedProps.obs.toLowerCase().includes(termo))).forEach(e => calendar.addEvent(e));
}

function atualizarHorarioEventoArraste(info) {
    const ag = db.agendamentos.find(a => a.id === info.event.id);
    if (ag) {
        ag.data = info.event.startStr.split('T')[0];
        ag.horario = info.event.startStr.split('T')[1] ? info.event.startStr.split('T')[1].substring(0, 5) : ag.horario;
        if (info.event.endStr) ag.horaFim = info.event.endStr.split('T')[1].substring(0, 5);
        persistirDB();
    }
}

function atualizarHoraFimPadrao() {
    const hIn = document.getElementById('agendamento-horario')?.value;
    if (hIn) {
        let [h, m] = hIn.split(':').map(Number);
        m += 30; h += Math.floor(m / 60); m %= 60;
        document.getElementById('agendamento-hora-fim').value = String(h % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
}

// ==========================================
// MODAIS DE AGENDAMENTO E LEMBRETE
// ==========================================
function abrirModalAgendamento(data, hora) {
    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-edit-id').value = '';
    document.getElementById('agendamento-data').value = data || obterDataLocalISO();
    document.getElementById('agendamento-horario').value = hora || '08:00';
    document.getElementById('agendamento-obs').value = '';
    atualizarHoraFimPadrao();
    document.getElementById('modal-agendamento').classList.remove('hidden');
    document.getElementById('modal-agendamento').classList.add('flex');
}

function salvarAgendamento(event) {
    event.preventDefault();
    const id = document.getElementById('agendamento-edit-id').value;
    const dados = {
        isLembrete: false,
        pacienteId: document.getElementById('agendamento-paciente').value,
        data: document.getElementById('agendamento-data').value,
        horario: document.getElementById('agendamento-horario').value,
        horaFim: document.getElementById('agendamento-hora-fim').value,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim(),
        cor: '#039be5'
    };
    if (id) {
        const idx = db.agendamentos.findIndex(a => a.id === id);
        if (idx > -1) db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), status: 'agendado', ...dados });
    }
    persistirDB();
    atualizarCalendario();
    fecharModal('modal-agendamento');
}

function abrirModalLembrete(data, hora) {
    document.getElementById('titulo-modal-lembrete').innerText = 'Novo Lembrete / Bloqueio';
    document.getElementById('lembrete-edit-id').value = '';
    document.getElementById('lembrete-titulo').value = '';
    document.getElementById('lembrete-data').value = data || obterDataLocalISO();
    document.getElementById('lembrete-horario').value = hora || '12:00';
    document.getElementById('lembrete-hora-fim').value = '13:00';
    document.getElementById('lembrete-obs').value = '';
    document.getElementById('modal-lembrete').classList.remove('hidden');
    document.getElementById('modal-lembrete').classList.add('flex');
}

function abrirModalEditarLembrete(id) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (!ag || !ag.isLembrete) return;
    document.getElementById('titulo-modal-lembrete').innerText = 'Editar Lembrete / Bloqueio';
    document.getElementById('lembrete-edit-id').value = ag.id;
    document.getElementById('lembrete-titulo').value = ag.titulo;
    document.getElementById('lembrete-data').value = ag.data;
    document.getElementById('lembrete-horario').value = ag.horario;
    document.getElementById('lembrete-hora-fim').value = ag.horaFim || '';
    document.getElementById('lembrete-obs').value = ag.obs || '';
    document.getElementById('modal-lembrete').classList.remove('hidden');
    document.getElementById('modal-lembrete').classList.add('flex');
}

function salvarLembrete(event) {
    event.preventDefault();
    const id = document.getElementById('lembrete-edit-id').value;
    const dados = {
        isLembrete: true,
        titulo: document.getElementById('lembrete-titulo').value.trim(),
        data: document.getElementById('lembrete-data').value,
        horario: document.getElementById('lembrete-horario').value,
        horaFim: document.getElementById('lembrete-hora-fim').value,
        obs: document.getElementById('lembrete-obs').value.trim(),
        cor: '#616161'
    };
    if (id) {
        const idx = db.agendamentos.findIndex(a => a.id === id);
        if (idx > -1) db.agendamentos[idx] = { ...db.agendamentos[idx], ...dados };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dados });
    }
    persistirDB();
    atualizarCalendario();
    fecharModal('modal-lembrete');
}

function abrirModalDetalhesAgendamento(id) {
    const ag = db.agendamentos.find(item => item.id === id);
    if (!ag) return;

    const divStatus = document.getElementById('container-status-agendamento');
    const btnVerFicha = document.getElementById('btn-ver-ficha-ag-modal');

    if (ag.isLembrete) {
        document.getElementById('detalhe-ag-paciente').innerText = '📌 ' + ag.titulo;
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Sem observações.';
        
        if (divStatus) divStatus.innerHTML = '';
        btnVerFicha.classList.add('hidden');

        document.getElementById('btn-editar-ag-modal').onclick = () => { fecharModal('modal-detalhes-agendamento'); abrirModalEditarLembrete(ag.id); };
        document.getElementById('btn-excluir-ag-modal').onclick = () => { fecharModal('modal-detalhes-agendamento'); excluirAgendamento(ag.id); };
    } else {
        const p = db.pacientes.find(x => x.id === ag.pacienteId) || { nome: 'DESCONHECIDO' };
        document.getElementById('detalhe-ag-paciente').innerText = p.nome + ' (' + ag.tipo + ')';
        document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' • ' + ag.horario + ' às ' + (ag.horaFim || '?');
        document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Sem observações.';
        
        if (divStatus) {
            divStatus.innerHTML = `
                <div class="grid grid-cols-3 gap-2 mt-2">
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'atendido')" class="p-2 bg-emerald-100 text-emerald-800 rounded font-bold text-xs">Atendido</button>
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'faltou')" class="p-2 bg-rose-100 text-rose-800 rounded font-bold text-xs">Faltou</button>
                    <button onclick="alterarStatusAgendamento('${ag.id}', 'remarcou')" class="p-2 bg-slate-200 text-slate-800 rounded font-bold text-xs">Remarcou</button>
                </div>
            `;
        }
        btnVerFicha.classList.remove('hidden');
        btnVerFicha.onclick = () => { fecharModal('modal-detalhes-agendamento'); abrirDetalhesPaciente(ag.pacienteId, 'agenda'); };
        
        document.getElementById('btn-editar-ag-modal').onclick = () => { fecharModal('modal-detalhes-agendamento'); abrirModalEditarAgendamento(ag.id); };
        document.getElementById('btn-excluir-ag-modal').onclick = () => { fecharModal('modal-detalhes-agendamento'); excluirAgendamento(ag.id); };
    }

    document.getElementById('modal-detalhes-agendamento').classList.remove('hidden');
    document.getElementById('modal-detalhes-agendamento').classList.add('flex');
}

function excluirAgendamento(id) {
    if (!confirm('Deseja excluir este evento?')) return;
    db.agendamentos = db.agendamentos.filter(a => a.id !== id);
    persistirDB();
    atualizarCalendario();
    fecharModal('modal-detalhes-agendamento');
}

function alterarStatusAgendamento(id, status) {
    const ag = db.agendamentos.find(a => a.id === id);
    if (ag) { ag.status = status; ag.cor = status === 'faltou' ? '#ef4444' : (status === 'remarcou' ? '#94a3b8' : '#039be5'); persistirDB(); atualizarCalendario(); fecharModal('modal-detalhes-agendamento'); }
}

// ==========================================
// PACIENTES (CRUD & VIEW)
// ==========================================
function renderizarPacientes() {
    const tbody = document.getElementById('tabela-pacientes-body');
    if (!tbody) return;
    const termo = (document.getElementById('busca-pacientes-tabela')?.value || '').toLowerCase();
    const cat = document.getElementById('filtro-categoria-pacientes')?.value || 'todos';

    tbody.innerHTML = '';
    const lista = db.pacientes.filter(p => {
        if (termo && !p.nome.toLowerCase().includes(termo)) return false;
        if (cat !== 'todos' && p.categoria.toLowerCase() !== cat) return false;
        return true;
    });

    if (lista.length === 0) {
        tbody.innerHTML = '<tr class="block sm:table-row"><td colspan="5" class="p-4 text-center text-slate-500">Nenhum paciente encontrado.</td></tr>';
        return;
    }

    lista.forEach(p => {
        const venc = p.categoria === 'Ortodontia' ? (p.vencimento ? p.vencimento.split('-').reverse().join('/') : '-') : '-';
        tbody.innerHTML += `
            <tr class="block sm:table-row bg-white sm:bg-transparent rounded-xl shadow-sm sm:shadow-none p-4 sm:p-0 mb-3 sm:mb-0 border border-slate-100 sm:border-b hover:bg-slate-50">
                <td class="block sm:table-cell p-1 sm:p-4 font-bold text-lg sm:text-sm text-slate-800 border-b sm:border-0 mb-2 sm:mb-0">${p.nome}</td>
                <td class="flex sm:table-cell justify-between p-1 sm:p-4"><span class="sm:hidden text-slate-400 text-xs">Telefone:</span> ${p.telefone || '-'}</td>
                <td class="flex sm:table-cell justify-between p-1 sm:p-4"><span class="sm:hidden text-slate-400 text-xs">Categoria:</span> <span class="px-2 py-1 bg-slate-100 rounded text-xs font-bold">${p.categoria}</span></td>
                <td class="flex sm:table-cell justify-between p-1 sm:p-4"><span class="sm:hidden text-slate-400 text-xs">Vencimento:</span> ${venc}</td>
                <td class="flex sm:table-cell gap-2 p-1 sm:p-4 pt-3 sm:pt-4 text-right">
                    <button onclick="abrirModalPaciente('${p.id}')" class="flex-1 sm:flex-none py-2 px-3 bg-amber-100 text-amber-800 font-bold rounded-lg text-sm"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="flex-1 sm:flex-none py-2 px-3 bg-blue-600 text-white font-bold rounded-lg text-sm"><i class="fa-solid fa-folder-open"></i> Ficha</button>
                </td>
            </tr>
        `;
    });
}

function popularSelectPacientes() {
    const sel = document.getElementById('agendamento-paciente');
    if (sel) {
        sel.innerHTML = '';
        db.pacientes.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nome} (${p.categoria})</option>`);
    }
}

function abrirModalPaciente(id = null) {
    const form = document.getElementById('form-paciente');
    if (form) form.reset();
    document.getElementById('paciente-edit-id').value = id || '';
    if (id) {
        const p = db.pacientes.find(x => x.id === id);
        if (p) {
            document.getElementById('paciente-nome').value = p.nome;
            document.getElementById('paciente-telefone').value = p.telefone || '';
            document.getElementById('paciente-categoria').value = p.categoria;
        }
    }
    document.getElementById('modal-paciente').classList.remove('hidden');
    document.getElementById('modal-paciente').classList.add('flex');
}

function salvarPaciente(event) {
    event.preventDefault();
    const id = document.getElementById('paciente-edit-id').value;
    const dados = {
        nome: document.getElementById('paciente-nome').value.trim().toUpperCase(),
        telefone: document.getElementById('paciente-telefone').value,
        categoria: document.getElementById('paciente-categoria').value,
    };
    if (id) {
        const idx = db.pacientes.findIndex(p => p.id === id);
        if (idx > -1) db.pacientes[idx] = { ...db.pacientes[idx], ...dados };
    } else {
        db.pacientes.push({ id: gerarIdUnico(), ...dados });
    }
    persistirDB();
    popularSelectPacientes();
    renderizarPacientes();
    fecharModal('modal-paciente');
}

function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem;
    const p = db.pacientes.find(x => x.id === pacienteId);
    if (!p) return;
    
    document.getElementById('detalhes-paciente-container').innerHTML = `
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h2 class="text-2xl font-bold">${p.nome}</h2>
            <p class="text-slate-500">${p.categoria} | ${p.telefone}</p>
            <div class="mt-4 flex gap-2">
                <button onclick="excluirPaciente('${p.id}')" class="px-4 py-2 bg-rose-600 text-white rounded font-bold">Excluir Paciente</button>
            </div>
        </div>
    `;
    mudarAba('detalhes-paciente');
}

function excluirPaciente(id) {
    if (!verificarSenhaExclusao()) return;
    if (!confirm('Deseja excluir permanentemente este paciente e todos os seus vínculos?')) return;
    db.pacientes = db.pacientes.filter(p => p.id !== id);
    db.agendamentos = db.agendamentos.filter(a => a.pacienteId !== id);
    persistirDB();
    atualizarCalendario();
    voltarParaOrigem();
}

// ==========================================
// FINANCEIRO
// ==========================================
function renderizarFinanceiro() {
    const list = document.getElementById('lista-pagamentos-realizados');
    if (!list) return;
    list.innerHTML = '';
    const todos = [...db.pagamentos, ...db.despesas].sort((a,b) => new Date(b.data) - new Date(a.data));
    todos.forEach(t => {
        list.innerHTML += `<div class="p-3 bg-slate-50 border rounded-lg mb-2 flex justify-between"><span>${t.descricao || 'Despesa'}</span><span class="font-bold">R$ ${t.valor}</span></div>`;
    });
}
function fecharCaixaDiario() { alert("Caixa diário fechado."); }
