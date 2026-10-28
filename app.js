let db = {
    pacientes: [],
    agendamentos: [],
    prontuarios: [],
    pagamentos: [],
    despesas: []
};

const SENHA_EXCLUSAO = '1234';

function verificarSenhaExclusao() {
    const senhaDigitada = prompt('🔒 Ação restrita. Digite a senha de exclusão para confirmar:');
    if (senhaDigitada === null) return false;
    if (senhaDigitada !== SENHA_EXCLUSAO) {
        alert('❌ Senha incorreta! A ação foi cancelada.');
        return false;
    }
    return true;
}

function carregarDadosLocais() {
    try {
        db.pacientes = JSON.parse(localStorage.getItem('odonto_pacientes')) || [
            { id: '1', nome: 'ANA SOUZA', telefone: '(11) 98888-7777', nascimento: '1992-05-14', cpf: '123.456.789-00', categoria: 'Ortodontia', vencimento: '2026-11-10', planejamentoEtapas: [] }
        ];
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
let calendar = null;
let pacienteAtualId = null;
let exibiApenasInativos = false;

function gerarIdUnico() {
    return Date.now().toString() + '-' + Math.floor(Math.random() * 10000);
}

function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
    localStorage.setItem('odonto_agendamentos', JSON.stringify(db.agendamentos));
    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));

    if (usaFirebase) {
        // Futura sincronização com Firestore
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

function abrirModalDetalhesAgendamento(agendamentoId) {
    const ag = db.agendamentos.find(item => item.id === agendamentoId);
    if (!ag) return;

    const paciente = db.pacientes.find(p => p.id === ag.pacienteId) || { nome: 'PACIENTE NÃO ENCONTRADO', categoria: 'Geral' };
    
    document.getElementById('detalhe-ag-paciente').innerText = paciente.nome;
    document.getElementById('detalhe-ag-categoria').innerText = paciente.categoria;
    document.getElementById('detalhe-ag-datahora').innerText = (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' às ' + ag.horario;
    document.getElementById('detalhe-ag-tipo').innerText = ag.tipo + ' (' + (ag.duracao || '30') + ' min)';
    document.getElementById('detalhe-ag-obs').innerText = ag.obs || 'Nenhuma observação registrada.';

    document.getElementById('btn-excluir-ag-modal').onclick = function() {
        fecharModal('modal-detalhes-agendamento');
        excluirAgendamento(ag.id, ag.pacienteId);
    };

    document.getElementById('btn-editar-ag-modal').onclick = function() {
        fecharModal('modal-detalhes-agendamento');
        abrirModalEditarAgendamento(ag.id);
    };

    document.getElementById('btn-ver-ficha-ag-modal').onclick = function() {
        fecharModal('modal-detalhes-agendamento');
        abrirDetalhesPaciente(ag.pacienteId, 'agenda');
    };

    document.getElementById('modal-detalhes-agendamento').classList.remove('hidden');
    document.getElementById('modal-detalhes-agendamento').classList.add('flex');
}

function abrirModalEditarAgendamento(agendamentoId) {
    const ag = db.agendamentos.find(a => a.id === agendamentoId);
    if (!ag) return;

    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Editar Agendamento';
    document.getElementById('agendamento-edit-id').value = ag.id;
    document.getElementById('agendamento-paciente').value = ag.pacienteId;
    document.getElementById('agendamento-data').value = ag.data;
    document.getElementById('agendamento-horario').value = ag.horario;
    document.getElementById('agendamento-duracao').value = ag.duracao || '30';
    document.getElementById('agendamento-tipo').value = ag.tipo;
    document.getElementById('agendamento-obs').value = ag.obs || '';

    document.getElementById('container-cadastro-rapido').classList.add('hidden');
    document.getElementById('container-busca-paciente').classList.remove('hidden');

    document.getElementById('modal-agendamento').classList.remove('hidden');
    document.getElementById('modal-agendamento').classList.add('flex');
}

function excluirAgendamento(id, pacienteId) {
    if (!verificarSenhaExclusao()) return;
    if (!confirm('Deseja realmente cancelar/excluir este agendamento?')) return;
    db.agendamentos = db.agendamentos.filter(ag => ag.id !== id);
    persistirDB();
    atualizarCalendario();
    if (pacienteId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
    alert('Agendamento excluído com sucesso!');
}

function excluirPaciente(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    if (!verificarSenhaExclusao()) return;
    if (confirm(`⚠️ Tem certeza que deseja EXCLUIR permanentemente o paciente "${paciente.nome}"?`)) {
        db.pacientes = db.pacientes.filter(p => p.id !== pacienteId);
        db.agendamentos = db.agendamentos.filter(a => a.pacienteId !== pacienteId);
        db.prontuarios = db.prontuarios.filter(pr => pr.pacienteId !== pacienteId);
        db.pagamentos = db.pagamentos.filter(pg => pg.pacienteId !== pacienteId);

        persistirDB();
        atualizarCalendario();
        renderizarPacientes();
        alert('Paciente e registros excluídos com sucesso!');
        voltarParaOrigem();
    }
}

function excluirProntuario(prontuarioId, pacienteId) {
    if (!verificarSenhaExclusao()) return;
    if (!confirm('Deseja realmente remover esta evolução do prontuário?')) return;
    db.prontuarios = db.prontuarios.filter(pr => pr.id !== prontuarioId);
    persistirDB();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function estornarPagamento(pagamentoId, pacienteId) {
    const pagamentoOriginal = db.pagamentos.find(pg => pg.id === pagamentoId);
    if (!pagamentoOriginal) return;

    const motivo = prompt('🔄 Motivo do estorno do pagamento (Obrigatório):');
    if (!motivo || motivo.trim() === '') {
        alert('O estorno foi cancelado porque o motivo é obrigatório.');
        return;
    }

    if (!verificarSenhaExclusao()) return;
    if (!confirm(`Deseja confirmar o estorno de R$ ${Number(pagamentoOriginal.valor).toFixed(2)}?`)) return;

    db.pagamentos.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        valor: -Math.abs(parseFloat(pagamentoOriginal.valor)),
        forma: 'Estorno',
        descricao: `ESTORNO: ${pagamentoOriginal.descricao} - Motivo: ${motivo}`
    });

    persistirDB();
    alert('Estorno realizado com sucesso!');
    if (pacienteId) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    } else {
        renderizarFinanceiro();
    }
}

function voltarParaOrigem() {
    mudarAba(abaOrigem || 'pacientes');
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
                    alert('Backup restaurado com sucesso!');
                }
            } else {
                alert('Arquivo de backup inválido.');
            }
        } catch (err) {
            alert('Erro ao ler o arquivo JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function sincronizarValorPago() {
    const valorCobrado = parseFloat(document.getElementById('caixa-valor-cobrado').value) || 0;
    if (!pacienteAtualId) {
        document.getElementById('caixa-valor-pago').value = valorCobrado.toFixed(2);
        return;
    }

    const saldoAtual = calcularPendenciaPaciente(pacienteAtualId);
    if (saldoAtual < 0) {
        const credito = Math.abs(saldoAtual);
        const restanteAPagar = Math.max(0, valorCobrado - credito);
        document.getElementById('caixa-valor-pago').value = restanteAPagar.toFixed(2);
    } else {
        document.getElementById('caixa-valor-pago').value = valorCobrado.toFixed(2);
    }
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
    const idxMes = parseInt(partes[1], 10) - 1;
    return (meses[idxMes] || 'Mês') + ' de ' + partes[0];
}

async function fazerLoginFirebase(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    // Verificação global segura
    if (!window.usaFirebase || !window.firebaseAuth) {
        alert("⚠️ O Firebase ainda está carregando. Aguarde um segundo e tente novamente.");
        return;
    }

    try {
        // 1. Autentica no Firebase Auth global
        const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
        const user = userCredential.user;

        // 2. Busca o perfil na coleção 'usuarios' do Firestore
        const docRef = window.doc(window.firebaseDb, "usuarios", user.email);
        const userDoc = await window.getDoc(docRef);

        let perfilEncontrado = 'secretaria'; // Padrão caso não ache o documento
        if (userDoc.exists()) {
            perfilEncontrado = userDoc.data().perfil || 'secretaria';
        } else {
            console.warn("⚠️ E-mail autenticado, mas o documento não existe na coleção 'usuarios'. Definindo como secretaria.");
        }

        usuarioAtual = { perfil: perfilEncontrado, email: user.email };
        iniciarSessaoSistema();

    } catch (error) {
        console.error("Erro no login:", error);
        
        let mensagemErro = error.message;
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            mensagemErro = "E-mail ou senha incorretos.";
        }
        
        alert("❌ Erro no login: " + mensagemErro);
    }
}

function iniciarSessaoSistema() {
    const telaLogin = document.getElementById('login-screen');
    telaLogin.style.display = 'none';
    telaLogin.classList.remove('flex');
    telaLogin.classList.add('hidden');

    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('main-content').classList.add('flex-grow');
    
    configurarNavbar();
    inicializarSistema();
}

function logout() {
    if (usaFirebase) {
        firebase.auth().signOut();
    }
    usuarioAtual = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-screen').classList.remove('hidden');
    
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
}

function logout() {
    if (usaFirebase) {
        firebase.auth().signOut();
    }
    usuarioAtual = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-screen').classList.remove('hidden');
    
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
}

function configurarNavbar() {
    const navTabs = document.getElementById('nav-tabs');
    const badge = document.getElementById('header-user-badge');
    navTabs.innerHTML = '';

    if (usuarioAtual.perfil === 'secretaria') {
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

    document.getElementById('tab-' + nomeAba).classList.remove('hidden');
    const ativoBtn = document.getElementById('btn-tab-' + nomeAba);
    if (ativoBtn) {
        ativoBtn.classList.remove('border-transparent', 'text-slate-400');
        ativoBtn.classList.add('border-blue-500', 'text-white');
    }

    if (nomeAba === 'agenda' && calendar) {
        setTimeout(() => calendar.updateSize(), 100);
    }
    if (nomeAba === 'pacientes') renderizarPacientes();
    if (nomeAba === 'financeiro') renderizarFinanceiro();
}

function inicializarSistema() {
    popularSelectPacientes();
    mudarAba('agenda');
    if (!calendar) {
        inicializarCalendario();
    } else {
        atualizarCalendario();
    }
}

function calcularHoraFim(horaInicio, duracaoMinutos) {
    if (!horaInicio || typeof horaInicio !== 'string') return '00:00';
    const partes = horaInicio.split(':').map(Number);
    const horas = partes[0] || 0;
    const minutos = partes[1] || 0;
    const totalMinutos = horas * 60 + minutos + parseInt(duracaoMinutos || 30);
    const hFim = Math.floor(totalMinutos / 60) % 24;
    const mFim = totalMinutos % 60;
    return String(hFim).padStart(2, '0') + ':' + String(mFim).padStart(2, '0');
}

function inicializarCalendario() {
    const calendarEl = document.getElementById('calendar');
    const eventosFormatados = db.agendamentos.map(ag => {
        const paciente = db.pacientes.find(p => p.id === ag.pacienteId);
        if (!paciente || !ag.data || !ag.horario) return null;

        const duracao = ag.duracao || '30';
        const horaFim = calcularHoraFim(ag.horario, duracao);

        return {
            id: ag.id,
            title: paciente.nome + ' (' + ag.tipo + ')',
            start: ag.data + 'T' + ag.horario,
            end: ag.data + 'T' + horaFim,
            extendedProps: { pacienteId: ag.pacienteId, tipo: ag.tipo, obs: ag.obs }
        };
    }).filter(event => event !== null);

    const isMobile = window.innerWidth < 768;

    calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'pt-br',
        initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        allDaySlot: false,
        selectable: true,
        eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false },
        windowResize: function() {
            if (window.innerWidth < 768) calendar.changeView('timeGridDay');
            else calendar.changeView('timeGridWeek');
        },
        select: function(info) {
            const dataStr = info.startStr.split('T')[0];
            let horaStr = '08:00';
            if (info.startStr.split('T')[1]) {
                const partesHora = info.startStr.split('T')[1].substring(0, 5).split(':');
                let h = partesHora[0];
                let m = parseInt(partesHora[1], 10);
                m = Math.round(m / 15) * 15;
                if (m === 60) {
                    h = String(parseInt(h, 10) + 1).padStart(2, '0');
                    m = 0;
                }
                horaStr = h + ':' + String(m).padStart(2, '0');
            }
            abrirModalAgendamento(dataStr, horaStr);
            calendar.unselect();
        },
        events: eventosFormatados,
        eventClick: function(info) {
            abrirModalDetalhesAgendamento(info.event.id);
        }
    });
    calendar.render();
}

function atualizarCalendario() {
    if (!calendar) return;
    calendar.removeAllEvents();
    db.agendamentos.forEach(ag => {
        if (!ag.data || !ag.horario) return;

        const paciente = db.pacientes.find(p => p.id === ag.pacienteId);
        if (!paciente) return;

        const duracao = ag.duracao || '30';
        const horaFim = calcularHoraFim(ag.horario, duracao);

        calendar.addEvent({
            id: ag.id,
            title: paciente.nome + ' (' + ag.tipo + ')',
            start: ag.data + 'T' + ag.horario,
            end: ag.data + 'T' + horaFim,
            extendedProps: { pacienteId: ag.pacienteId, tipo: ag.tipo, obs: ag.obs }
        });
    });
}

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
    const selectCat = document.getElementById('filtro-categoria-pacientes');
    if (selectCat) selectCat.value = categoria;
    exibiApenasInativos = false;
    atualizarBotaoInativos();
    renderizarPacientes();
}

function alternarFiltroInativos() {
    exibiApenasInativos = !exibiApenasInativos;
    atualizarBotaoInativos();
    renderizarPacientes();
}

function atualizarBotaoInativos() {
    const btn = document.getElementById('btn-filtro-inativos');
    if (!btn) return;
    if (exibiApenasInativos) {
        btn.className = 'px-3 py-2 bg-amber-600 text-white text-xs sm:text-sm font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap';
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Removendo Inativos (> 30d)';
    } else {
        btn.className = 'px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs sm:text-sm font-semibold rounded-lg border border-amber-200 transition flex items-center justify-center gap-1.5 whitespace-nowrap';
        btn.innerHTML = '<i class="fa-solid fa-filter"></i> Mostrar Inativos (> 30 dias)';
    }
}

function renderizarPacientes() {
    const tbody = document.getElementById('tabela-pacientes-body');
    const termoBusca = (document.getElementById('busca-pacientes-tabela')?.value || '').toLowerCase().trim();
    const opcaoCategoria = document.getElementById('filtro-categoria-pacientes')?.value || 'todos';

    tbody.innerHTML = '';

    let total = db.pacientes.length;
    let clinicos = 0;
    let orto = 0;
    let inativosCount = 0;

    db.pacientes.forEach(p => {
        if (p.categoria === 'Ortodontia') orto++;
        else clinicos++;

        const ultimaData = obterUltimaConsultaPaciente(p.id);
        if (ultimaData) {
            const dias = calcularDiasDesdeUltimaConsulta(ultimaData);
            if (dias > 30) inativosCount++;
        }
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
            const ultimaData = obterUltimaConsultaPaciente(p.id);
            if (!ultimaData) return false;
            const dias = calcularDiasDesdeUltimaConsulta(ultimaData);
            return dias > 30;
        }

        return true;
    });

    if (listaExibicao.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Nenhum paciente encontrado.</td></tr>';
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
            if (dias > 30) {
                htmlUltimaConsulta = '<span class="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">' + dataFmt + ' (' + dias + 'd)</span>';
            } else {
                htmlUltimaConsulta = '<span class="text-slate-700 font-medium">' + dataFmt + '</span>';
            }
        } else {
            htmlUltimaConsulta = '<span class="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Nunca se consultou</span>';
        }

        tbody.innerHTML += '<tr class="hover:bg-slate-50 transition border-b border-slate-100">' +
            '<td class="p-3 sm:p-4 font-medium text-slate-800">' + p.nome + '</td>' +
            '<td class="p-3 sm:p-4">' + (p.telefone || '-') + '</td>' +
            '<td class="p-3 sm:p-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ' + badgeClass + '">' + p.categoria + '</span></td>' +
            '<td class="p-3 sm:p-4">' + htmlUltimaConsulta + '</td>' +
            '<td class="p-3 sm:p-4">' + venc + '</td>' +
            '<td class="p-3 sm:p-4 text-right space-x-1 whitespace-nowrap">' +
                '<button onclick="abrirModalPaciente(\'' + p.id + '\')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition" title="Editar Cadastrais">' +
                    '<i class="fa-solid fa-pen-to-square"></i>' +
                '</button>' +
                '<button onclick="abrirDetalhesPaciente(\'' + p.id + '\', \'pacientes\')" class="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition">' +
                    '<i class="fa-solid fa-eye mr-1"></i> Ficha' +
                '</button>' +
            '</td>' +
        '</tr>';
    });
}

function calcularPendenciaPaciente(pacienteId) {
    let totalCobrado = 0;
    db.prontuarios.filter(pr => pr.pacienteId === pacienteId).forEach(pr => totalCobrado += parseFloat(pr.valorCobrado || 0));

    let totalPago = 0;
    db.pagamentos.filter(pg => pg.pacienteId === pacienteId).forEach(pg => totalPago += parseFloat(pg.valor || 0));

    return Math.round((totalCobrado - totalPago) * 100) / 100;
}

function ajustarSaldoPaciente(pacienteId) {
    const saldoAtual = calcularPendenciaPaciente(pacienteId);

    if (saldoAtual === 0) {
        alert('Este paciente já está com o saldo zerado!');
        return;
    }

    const mensagem = saldoAtual > 0 
        ? `O paciente possui um DÉBITO de R$ ${saldoAtual.toFixed(2)}.\nDeseja realizar um lançamento de ajuste (Desconto/Perdão) para ZERAR o saldo?`
        : `O paciente possui um CRÉDITO de R$ ${Math.abs(saldoAtual).toFixed(2)}.\nDeseja realizar um lançamento de ajuste de estorno para ZERAR o saldo?`;

    if (!confirm(mensagem)) return;
    if (!verificarSenhaExclusao()) return;

    const motivo = prompt('Informe o motivo do ajuste (ex: Desconto concedido, Acordo, Ajuste manual):', 'Ajuste de Saldo');
    if (!motivo) return;

    const hoje = obterDataLocalISO();

    if (saldoAtual > 0) {
        db.pagamentos.push({
            id: gerarIdUnico(),
            pacienteId: pacienteId,
            data: hoje,
            valor: saldoAtual,
            forma: 'Ajuste / Desconto',
            descricao: `Ajuste de Saldo (Abatimento): ${motivo}`
        });
    } else {
        const creditoAbsoluto = Math.abs(saldoAtual);
        db.prontuarios.push({
            id: gerarIdUnico(),
            pacienteId: pacienteId,
            data: hoje,
            procedimento: `Ajuste de Saldo (Estorno de Crédito): ${motivo}`,
            valorCobrado: creditoAbsoluto,
            proximaConsulta: ''
        });
    }

    persistirDB();
    alert('Saldo ajustado e zerado com sucesso!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function quitarPendenciaPaciente(pacienteId) {
    const saldoDevedor = calcularPendenciaPaciente(pacienteId);
    const valorSugerido = saldoDevedor > 0 ? saldoDevedor.toFixed(2) : '0.00';
    let valorStr = prompt('Valor a pagar / quitar no Caixa (R$):', valorSugerido);
    if (!valorStr) return;
    valorStr = valorStr.replace(',', '.');
    const valorQuitar = parseFloat(valorStr);
    if (isNaN(valorQuitar) || valorQuitar <= 0) {
        alert('Valor inválido.');
        return;
    }

    const forma = prompt('Forma de Pagamento (Pix, Cartão de Crédito, Cartão de Débito, Dinheiro):', 'Pix');
    
    db.pagamentos.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: obterDataLocalISO(),
        valor: valorQuitar,
        forma: forma || 'Pix',
        descricao: 'Recebimento / Quitação de Débito'
    });

    persistirDB();
    alert('Pagamento lançado com sucesso!');
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

    if (!desc) {
        alert('Informe a descrição do procedimento.');
        return;
    }

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        if (!Array.isArray(paciente.planejamentoEtapas)) {
            paciente.planejamentoEtapas = [];
        }

        paciente.planejamentoEtapas.push({
            id: gerarIdUnico(),
            dente: dente,
            procedimento: desc,
            valor: valor,
            concluido: false
        });

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

function excluirEtapaPlanejamento(pacienteId, etapaId) {
    if (!verificarSenhaExclusao()) return;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente && Array.isArray(paciente.planejamentoEtapas)) {
        paciente.planejamentoEtapas = paciente.planejamentoEtapas.filter(e => e.id !== etapaId);
        persistirDB();
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

function alternarAccordion(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function alternarSecaoMobile(secaoId) {
    const el = document.getElementById(secaoId);
    if (!el) return;
    const estaOculto = el.classList.contains('hidden');
    
    document.querySelectorAll('.secao-clinica-mobile').forEach(s => s.classList.add('hidden'));

    if (estaOculto) {
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

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
    const termo = document.getElementById('busca-prontuario-input').value.toLowerCase();
    const container = document.getElementById('container-prontuario-timeline');
    const prontuarios = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);

    if (prontuarios.length === 0) return;

    const prontuariosFiltrados = prontuarios.filter(pr => (pr.procedimento || '').toLowerCase().includes(termo) || (pr.data || '').includes(termo));
    renderizarLinhaTempoProntuario(container, prontuariosFiltrados, pacienteId);
}

function renderizarLinhaTempoProntuario(container, prontuarios, pacienteId) {
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
            const valorHtml = pr.valorCobrado ? '<span class="text-xs font-bold text-slate-600">Valor: R$ ' + Number(pr.valorCobrado).toFixed(2) + '</span>' : '';
            
            htmlItens += '<div class="p-3 bg-white rounded-lg border border-slate-100 space-y-1 shadow-sm flex justify-between items-start gap-2">' +
                '<div class="space-y-1 flex-grow">' +
                    '<div class="flex justify-between text-xs text-slate-500"><span>Data: <strong>' + (pr.data ? pr.data.split('-').reverse().join('/') : '-') + '</strong></span>' + valorHtml + '</div>' +
                    '<p class="text-slate-800 font-medium">Descrição: ' + pr.procedimento + '</p>' +
                    proxHtml +
                '</div>' +
                '<button onclick="excluirProntuario(\'' + pr.id + '\', \'' + pacienteId + '\')" class="text-slate-400 hover:text-red-600 text-xs p-1" title="Excluir Prontuário"><i class="fa-solid fa-trash"></i></button>' +
            '</div>';
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

function abrirDetalhesPaciente(pacienteId, origem) {
    abaOrigem = origem;
    pacienteAtualId = pacienteId;
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    const agendamentosPaciente = db.agendamentos.filter(ag => ag.pacienteId === pacienteId);
    const prontuariosPaciente = db.prontuarios.filter(pr => pr.pacienteId === pacienteId);
    const pagamentosPaciente = db.pagamentos.filter(pg => pg.pacienteId === pacienteId);
    
    const saldoFinanceiro = calcularPendenciaPaciente(pacienteId);
    const container = document.getElementById('detalhes-paciente-container');

    const telefoneLimpo = paciente.telefone ? paciente.telefone.replace(/\D/g, '') : '';
    const btnWhatsapp = telefoneLimpo ? '<a href="https://wa.me/55' + telefoneLimpo + '" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-bold ml-2 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp text-base"></i> Conversar</a>' : '';

    let badgePendencia = '';
    if (saldoFinanceiro > 0) {
        badgePendencia = '<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">' +
            '<div class="flex items-center justify-between">' +
                '<span class="text-xs uppercase font-bold text-amber-600 tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Pendência Devedora</span>' +
                '<span class="text-base font-extrabold text-amber-900">R$ ' + saldoFinanceiro.toFixed(2) + '</span>' +
            '</div>' +
            '<p class="text-xs text-amber-700">O paciente possui débitos em aberto.</p>' +
            '<div class="flex gap-2 pt-1">' +
                '<button onclick="quitarPendenciaPaciente(\'' + paciente.id + '\')" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1"><i class="fa-solid fa-check-double"></i> Quitar Débito</button>' +
                '<button onclick="ajustarSaldoPaciente(\'' + paciente.id + '\')" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition" title="Lançar Ajuste / Conceder Desconto"><i class="fa-solid fa-sliders"></i> Ajustar</button>' +
            '</div>' +
        '</div>';
    } else if (saldoFinanceiro < 0) {
        const credito = Math.abs(saldoFinanceiro);
        badgePendencia = '<div class="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">' +
            '<div class="flex items-center justify-between">' +
                '<span class="text-xs uppercase font-bold text-blue-600 tracking-wider"><i class="fa-solid fa-hand-holding-dollar mr-1"></i> Crédito Ativo</span>' +
                '<span class="text-base font-extrabold text-blue-900">R$ ' + credito.toFixed(2) + '</span>' +
            '</div>' +
            '<p class="text-xs text-blue-700">Saldo acumulado para futuros procedimentos.</p>' +
            '<button onclick="ajustarSaldoPaciente(\'' + paciente.id + '\')" class="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition"><i class="fa-solid fa-sliders mr-1"></i> Zerar / Ajustar Crédito</button>' +
        '</div>';
    } else {
        badgePendencia = '<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">' +
            '<div><span class="text-xs uppercase font-bold text-emerald-600 block">Financeiro</span><span class="text-xs font-semibold text-emerald-800">Sem pendências ou débitos</span></div>' +
        '</div>';
    }

    let etapas = [];
    if (Array.isArray(paciente.planejamentoEtapas)) {
        etapas = paciente.planejamentoEtapas;
    } else if (typeof paciente.planejamento === 'string' && paciente.planejamento.trim() !== '') {
        etapas = [{ id: gerarIdUnico(), dente: 'Geral', procedimento: paciente.planejamento, valor: 0, concluido: false }];
        paciente.planejamentoEtapas = etapas;
        persistirDB();
    }

    const concluidasCount = etapas.filter(e => e.concluido).length;
    const valorTotalPlano = etapas.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

    let htmlItensEtapas = '';
    if (etapas.length === 0) {
        htmlItensEtapas = '<p class="text-xs text-slate-400 italic p-2">Nenhuma etapa cadastrada no plano de tratamento.</p>';
    } else {
        htmlItensEtapas = etapas.map((et, index) => {
            const numEtapa = index + 1;
            const statusBg = et.concluido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
            const statusTexto = et.concluido ? 'Concluído' : 'Pendente';
            const estiloTexto = et.concluido ? 'line-through text-slate-400' : 'text-slate-800 font-medium';
            const valorFmt = et.valor ? 'R$ ' + Number(et.valor).toFixed(2) : 'R$ 0,00';

            const btnCheck = usuarioAtual.perfil === 'dentista' ? 
                '<button type="button" onclick="alternarStatusEtapa(\'' + paciente.id + '\', \'' + et.id + '\')" class="px-2 py-1 ' + (et.concluido ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white') + ' text-xs font-semibold rounded hover:opacity-90 transition"><i class="fa-solid ' + (et.concluido ? 'fa-rotate-left' : 'fa-check') + '"></i> ' + (et.concluido ? 'Reabrir' : 'Concluir') + '</button>' : '';

            const btnLixo = usuarioAtual.perfil === 'dentista' ? 
                '<button type="button" onclick="excluirEtapaPlanejamento(\'' + paciente.id + '\', \'' + et.id + '\')" class="text-slate-400 hover:text-red-600 text-xs p-1" title="Excluir Etapa"><i class="fa-solid fa-trash"></i></button>' : '';

            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-indigo-100 text-xs gap-2 shadow-sm">' +
                '<div class="flex items-center space-x-2 flex-grow min-w-0">' +
                    '<span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">#' + numEtapa + '</span>' +
                    '<span class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">' + (et.dente || 'Geral') + '</span>' +
                    '<span class="' + estiloTexto + ' truncate">' + et.procedimento + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between sm:justify-end space-x-2 whitespace-nowrap pt-1 sm:pt-0 border-t sm:border-0 border-slate-100">' +
                    '<span class="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">' + valorFmt + '</span>' +
                    '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full ' + statusBg + '">' + statusTexto + '</span>' +
                    btnCheck +
                    btnLixo +
                '</div>' +
            '</div>';
        }).join('');
    }

    let htmlFormAdicionarEtapa = '';
    if (usuarioAtual.perfil === 'dentista') {
        htmlFormAdicionarEtapa = '<form onsubmit="adicionarEtapaPlanejamento(event, \'' + paciente.id + '\')" class="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100">' +
            '<div class="sm:col-span-2"><input type="text" id="plan-dente" placeholder="Dente (16)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-5"><input type="text" id="plan-desc" required placeholder="Procedimento (ex: Restauração)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-3"><input type="number" step="0.01" id="plan-valor" placeholder="Valor (R$)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-2"><button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow flex items-center justify-center gap-1"><i class="fa-solid fa-plus"></i> Add</button></div>' +
        '</form>';
    }

    let htmlPlanejamentoTratamento = '<div id="sec-plano-tratamento" class="secao-clinica-mobile hidden md:block border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30 shadow-sm">' +
        '<div class="px-4 py-3 font-bold text-indigo-900 flex justify-between items-center bg-indigo-100/50 text-sm">' +
            '<span class="flex items-center gap-2"><i class="fa-solid fa-clipboard-list text-indigo-600"></i> Plano de Tratamento (' + etapas.length + ' itens)</span>' +
            '<div class="flex items-center gap-2">' +
                '<span class="text-xs font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">Total: R$ ' + valorTotalPlano.toFixed(2) + '</span>' +
                '<span class="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">' + concluidasCount + ' / ' + etapas.length + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="p-4 space-y-3 bg-indigo-50/20">' +
            '<div class="space-y-2 max-h-60 overflow-y-auto pr-1">' + htmlItensEtapas + '</div>' +
            htmlFormAdicionarEtapa +
        '</div>' +
    '</div>';

    let htmlFormDentista = '';
    if (usuarioAtual.perfil === 'dentista') {
        htmlFormDentista = '<div id="sec-evolucao-prontuario" class="secao-clinica-mobile hidden md:block bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm">' +
            '<h4 class="font-bold text-blue-900 text-sm flex items-center gap-2"><i class="fa-solid fa-stethoscope text-blue-600"></i> Registrar Evolução do Prontuário</h4>' +
            '<form onsubmit="salvarProcedimentoDentista(event, \'' + paciente.id + '\')" class="space-y-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Procedimento Realizado *</label><input type="text" id="proc-desc" required placeholder="Ex: Restauração Resina Dente 16" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">O que fazer no Próximo Retorno?</label><input type="text" id="proc-proxima" placeholder="Ex: Moldagem e ajuste de oclusão" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Prontuário</button>' +
            '</form>' +
        '</div>';
    }

   let htmlFormCaixa = '<div id="sec-lancar-caixa" class="secao-clinica-mobile hidden md:block bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-sm">' +
        '<h4 class="font-bold text-emerald-900 text-sm flex items-center gap-2"><i class="fa-solid fa-cash-register text-emerald-600"></i> Lançamento & Observação Financeira</h4>' +
        '<form onsubmit="salvarLancamentoCaixaManual(event, \'' + paciente.id + '\')" class="space-y-3">' +
            '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Descrição / Observação Financeira</label><input type="text" id="caixa-obs-manual" placeholder="Ex: Acerto combinado, valor pendente, crédito..." class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Valor do Pagamento (R$)</label><input type="number" step="0.01" id="caixa-valor-pago" placeholder="0.00" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Forma Pagamento</label><select id="caixa-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"><option value="Pix">Pix</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option><option value="Dinheiro">Dinheiro</option></select></div>' +
            '</div>' +
            '<div class="flex items-center gap-2 pt-1">' +
                '<input type="checkbox" id="caixa-marca-pendencia" class="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500">' +
                '<label for="caixa-marca-pendencia" class="text-xs font-semibold text-slate-700 cursor-pointer">Marcar paciente com pendência/débito financeiro (Exibir na aba Financeiro)</label>' +
            '</div>' +
            '<button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Lançamento</button>' +
        '</form>' +
    '</div>';

    let htmlAgendamentos = '';
    if (agendamentosPaciente.length === 0) {
        htmlAgendamentos = '<p class="text-sm text-slate-400 p-2">Nenhum agendamento futuro.</p>';
    } else {
        agendamentosPaciente.forEach(ag => {
            const dur = ag.duracao || '30';
            const obsHtml = ag.obs ? '<p class="text-xs text-slate-500 mt-0.5">Obs: ' + ag.obs + '</p>' : '';
            htmlAgendamentos += '<div class="p-3 bg-white rounded-lg border border-slate-200 text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm">' +
                '<div><p class="font-semibold text-slate-800">' + ag.tipo + ' (' + dur + ' min) • ' + (ag.data ? ag.data.split('-').reverse().join('/') : '') + ' às ' + ag.horario + '</p>' + obsHtml + '</div>' +
                '<div class="flex gap-2 self-end sm:self-auto">' +
                    '<button onclick="abrirModalEditarAgendamento(\'' + ag.id + '\')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold transition flex items-center gap-1"><i class="fa-solid fa-pen-to-square"></i> Editar</button>' +
                    '<button onclick="excluirAgendamento(\'' + ag.id + '\', \'' + paciente.id + '\')" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-semibold transition flex items-center gap-1"><i class="fa-solid fa-trash"></i> Excluir</button>' +
                '</div>' +
            '</div>';
        });
    }

    let htmlPagamentosTimeline = '';
    if (pagamentosPaciente.length === 0) {
        htmlPagamentosTimeline = '<p class="text-sm text-slate-400 p-2">Nenhum pagamento registrado.</p>';
    } else {
        const gruposPg = {};
        const pagamentosOrdenados = pagamentosPaciente.slice().sort((a, b) => new Date(b.data) - new Date(a.data));
        
        pagamentosOrdenados.forEach(pg => {
            const mesAno = formatarMesAno(pg.data);
            if (!gruposPg[mesAno]) gruposPg[mesAno] = [];
            gruposPg[mesAno].push(pg);
        });

        let idxPg = 0;
        const mesAtualFormatado = formatarMesAno(obterDataLocalISO());

        Object.keys(gruposPg).forEach(mesAno => {
            const accId = 'acc-pagamento-' + idxPg;
            const estaAberto = (mesAno === mesAtualFormatado) || (idxPg === 0);
            
            let htmlItensPg = '';
            gruposPg[mesAno].forEach(pg => {
                const isEstorno = pg.valor < 0;
                const corBg = isEstorno ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100';
                const corTexto = isEstorno ? 'text-rose-900' : 'text-emerald-900';
                const corValor = isEstorno ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold';

                const btnEstornar = !isEstorno ? '<button onclick="estornarPagamento(\'' + pg.id + '\', \'' + pacienteId + '\')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold transition flex items-center gap-1" title="Estornar Lançamento"><i class="fa-solid fa-rotate-left"></i> Estornar</button>' : '';

                htmlItensPg += '<div class="p-3 ' + corBg + ' border rounded-lg text-sm flex justify-between items-center">' +
                    '<div><p class="font-semibold ' + corTexto + '">' + pg.descricao + '</p><span class="text-xs text-slate-500">' + (pg.data ? pg.data.split('-').reverse().join('/') : '-') + ' • ' + pg.forma + '</span></div>' +
                    '<div class="flex items-center gap-2"><span class="' + corValor + '">R$ ' + Number(pg.valor).toFixed(2) + '</span>' + btnEstornar + '</div>' +
                '</div>';
            });

            htmlPagamentosTimeline += '<div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">' +
                '<button onclick="alternarAccordion(\'' + accId + '\')" class="w-full px-4 py-3 text-left font-bold text-slate-800 flex justify-between items-center hover:bg-slate-100 transition text-sm">' +
                    '<span><i class="fa-solid fa-receipt mr-2 text-emerald-600"></i>' + mesAno + ' (' + gruposPg[mesAno].length + ' pagamentos)</span>' +
                    '<i class="fa-solid fa-chevron-down text-xs text-slate-400"></i>' +
                '</button>' +
                '<div id="' + accId + '" class="' + (estaAberto ? '' : 'hidden') + ' p-3 space-y-2 border-t border-slate-200">' + htmlItensPg + '</div>' +
            '</div>';

            idxPg++;
        });
    }

    const hubMobile = '<div class="grid grid-cols-2 gap-2.5 md:hidden mb-4">' +
        '<button onclick="alternarSecaoMobile(\'sec-plano-tratamento\')" class="p-3 bg-indigo-600 text-white rounded-xl shadow font-semibold text-xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition">' +
            '<i class="fa-solid fa-clipboard-list text-lg"></i> Plano Tratamento' +
        '</button>' +
        (usuarioAtual.perfil === 'dentista' ? 
            '<button onclick="alternarSecaoMobile(\'sec-evolucao-prontuario\')" class="p-3 bg-blue-600 text-white rounded-xl shadow font-semibold text-xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition">' +
                '<i class="fa-solid fa-stethoscope text-lg"></i> Evoluir Prontuário' +
            '</button>' : '') +
        '<button onclick="alternarSecaoMobile(\'sec-lancar-caixa\')" class="p-3 bg-emerald-600 text-white rounded-xl shadow font-semibold text-xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition">' +
            '<i class="fa-solid fa-cash-register text-lg"></i> Lançar Caixa' +
        '</button>' +
        '<button onclick="alternarSecaoMobile(\'sec-historico-abas\')" class="p-3 bg-slate-800 text-white rounded-xl shadow font-semibold text-xs flex flex-col items-center justify-center text-center gap-1.5 active:scale-95 transition">' +
            '<i class="fa-solid fa-clock-rotate-left text-lg"></i> Históricos' +
        '</button>' +
    '</div>';

    container.innerHTML = '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">' +
        '<div class="lg:col-span-1 space-y-4">' +
            '<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">' +
                '<div class="flex items-center space-x-3 border-b pb-4">' +
                    '<div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">' + paciente.nome.charAt(0) + '</div>' +
                    '<div><h3 class="font-bold text-slate-900 text-lg leading-tight">' + paciente.nome + '</h3><span class="inline-block text-xs font-semibold px-2 py-0.5 rounded-full ' + (paciente.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700') + ' mt-1">' + paciente.categoria + '</span></div>' +
                '</div>' +
                '<div class="space-y-2 text-sm">' +
                    '<div><span class="text-xs uppercase font-semibold text-slate-400 block">Telefone</span><span class="font-medium text-slate-800">' + (paciente.telefone || '-') + '</span>' + btnWhatsapp + '</div>' +
                    '<div><span class="text-xs uppercase font-semibold text-slate-400 block">CPF</span><span class="font-medium text-slate-800">' + (paciente.cpf || '-') + '</span></div>' +
                    '<div><span class="text-xs uppercase font-semibold text-slate-400 block">Nascimento</span><span class="font-medium text-slate-800">' + (paciente.nascimento ? paciente.nascimento.split('-').reverse().join('/') : '-') + '</span></div>' +
                    (paciente.categoria === 'Ortodontia' ? '<div><span class="text-xs uppercase font-semibold text-slate-400 block">Vencimento Mensalidade</span><span class="font-medium text-slate-800">' + (paciente.vencimento ? paciente.vencimento.split('-').reverse().join('/') : 'Não definida') + '</span></div>' : '') +
                '</div>' +
                badgePendencia +
                '<div class="pt-2 border-t flex flex-col gap-2">' +
                    '<button onclick="abrirModalPaciente(\'' + paciente.id + '\')" class="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-user-pen"></i> Editar Dados Cadastrais</button>' +
                    '<button onclick="excluirPaciente(\'' + paciente.id + '\')" class="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"><i class="fa-solid fa-user-xmark"></i> Excluir Paciente</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="lg:col-span-2 space-y-4">' +
            hubMobile +
            htmlPlanejamentoTratamento +
            htmlFormDentista +
            htmlFormCaixa +
            '<div id="sec-historico-abas" class="secao-clinica-mobile bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4 md:block">' +
                '<div class="border-b border-slate-200 flex space-x-4 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">' +
                    '<button onclick="abrirSubAbaPaciente(\'prontuario\')" id="btn-subtab-prontuario" class="subtab-btn pb-2 border-b-2 border-blue-600 text-blue-600 flex items-center gap-2 whitespace-nowrap"><i class="fa-solid fa-notes-medical"></i> Prontuário & Evolução</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'pagamentos\')" id="btn-subtab-pagamentos" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap"><i class="fa-solid fa-wallet"></i> Histórico do Caixa</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'agendamentos\')" id="btn-subtab-agendamentos" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-2 whitespace-nowrap"><i class="fa-solid fa-calendar-check"></i> Agendamentos Futuros</button>' +
                '</div>' +
                '<div id="subtab-content-prontuario" class="subtab-content space-y-4">' +
                    '<input type="text" id="busca-prontuario-input" oninput="filtrarProntuarioLinhaTempo(\'' + paciente.id + '\')" placeholder="🔍 Pesquisar no histórico..." class="w-full px-3 py-2 border rounded-lg text-xs sm:text-sm bg-slate-50">' +
                    '<div id="container-prontuario-timeline" class="space-y-3"></div>' +
                '</div>' +
                '<div id="subtab-content-pagamentos" class="subtab-content hidden space-y-3">' + htmlPagamentosTimeline + '</div>' +
                '<div id="subtab-content-agendamentos" class="subtab-content hidden space-y-3">' + htmlAgendamentos + '</div>' +
            '</div>' +
        '</div>' +
    '</div>';

    mudarAba('detalhes-paciente');
    renderizarLinhaTempoProntuario(document.getElementById('container-prontuario-timeline'), prontuariosPaciente, paciente.id);
    abrirSubAbaPaciente(subAbaAtualPaciente);
}

function salvarProcedimentoDentista(event, pacienteId) {
    event.preventDefault();
    const procedimento = document.getElementById('proc-desc').value;
    const proximaConsulta = document.getElementById('proc-proxima').value;
    const hoje = obterDataLocalISO();

    db.prontuarios.push({
        id: gerarIdUnico(),
        pacienteId: pacienteId,
        data: hoje,
        procedimento: procedimento,
        valorCobrado: 0,
        proximaConsulta: proximaConsulta
    });

    persistirDB();
    alert('Evolução do Prontuário salva!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function salvarLancamentoCaixaCompleto(event, pacienteId) {
    event.preventDefault();
    const descricao = document.getElementById('caixa-proc-desc').value;
    const valorCobrado = parseFloat(document.getElementById('caixa-valor-cobrado').value) || 0;
    const valorPago = parseFloat(document.getElementById('caixa-valor-pago').value) || 0;
    const forma = document.getElementById('caixa-forma').value;
    const hoje = obterDataLocalISO();

    if (valorCobrado <= 0 && valorPago <= 0) {
        alert('Informe os valores corretos.');
        return;
    }

    // REGISTRA APENAS O PAGAMENTO NO CAIXA (Evita duplicar procedimentos no prontuário clínico)
    if (valorPago > 0) {
        db.pagamentos.push({ 
            id: gerarIdUnico(), 
            pacienteId: pacienteId, 
            data: hoje, 
            valor: valorPago, 
            forma: forma, 
            descricao: 'Pagamento / Recebimento: ' + descricao 
        });
    }

    // Se houver um valor cobrado que difere de um registro estrito de evolução, 
    // mantemos o controle financeiro isolado na aba de pagamentos/saldo do paciente.
    persistirDB();
    alert('Lançamento financeiro realizado com sucesso!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

function lancarDespesa() {
    const desc = prompt('Descrição da despesa:');
    if (!desc) return;
    let valorStr = prompt('Valor da despesa (R$):');
    if (!valorStr) return;
    valorStr = valorStr.replace(',', '.');
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido.');
        return;
    }

    const categoria = prompt('Categoria:', 'Operacional');

    db.despesas.push({
        id: gerarIdUnico(),
        data: obterDataLocalISO(),
        descricao: desc,
        valor: valor,
        categoria: categoria || 'Operacional'
    });

    persistirDB();
    alert('Despesa lançada!');
    renderizarFinanceiro();
}

function excluirDespesa(id) {
    if (!verificarSenhaExclusao()) return;
    if (!confirm('Deseja realmente excluir esta despesa?')) return;
    db.despesas = db.despesas.filter(d => d.id !== id);
    persistirDB();
    renderizarFinanceiro();
    alert('Despesa excluída!');
}

function fecharCaixaDiario() {
    const hoje = obterDataLocalISO();
    const pagamentosHoje = db.pagamentos.filter(pg => pg.data === hoje);
    const despesasHoje = db.despesas.filter(d => d.data === hoje);

    let totalEntradas = 0;
    pagamentosHoje.forEach(pg => totalEntradas += parseFloat(pg.valor || 0));

    let totalSaidas = 0;
    despesasHoje.forEach(d => totalSaidas += parseFloat(d.valor || 0));

    let saldoDia = totalEntradas - totalSaidas;

    let resumo = '=== FECHAMENTO DE CAIXA (' + hoje.split('-').reverse().join('/') + ') ===\n\n';
    resumo += '📥 Total Entradas/Movimentos: R$ ' + totalEntradas.toFixed(2) + '\n';
    resumo += '📤 Total Despesas: R$ ' + totalSaidas.toFixed(2) + '\n';
    resumo += '💰 Saldo Líquido do Dia: R$ ' + saldoDia.toFixed(2) + '\n\n';

    resumo += 'Formas de Pagamento:\n';
    const porForma = {};
    pagamentosHoje.forEach(pg => {
        porForma[pg.forma] = (porForma[pg.forma] || 0) + parseFloat(pg.valor || 0);
    });
    for (let forma in porForma) {
        resumo += '• ' + forma + ': R$ ' + porForma[forma].toFixed(2) + '\n';
    }

    alert(resumo);
}

function renderizarFinanceiro() {
    const listaPendencias = document.getElementById('lista-pendencias-financeiras');
    const listaFluxo = document.getElementById('lista-pagamentos-realizados');
    const filtroPeriodo = document.getElementById('filtro-periodo-financeiro').value;
    
    listaPendencias.innerHTML = '';
    listaFluxo.innerHTML = '';

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
    const prefixoMes = anoAtual + '-' + mesAtual;
    const hojeIso = obterDataLocalISO();

    let faturamentoMes = 0;
    db.pagamentos.forEach(pg => { if (pg.data && pg.data.startsWith(prefixoMes)) faturamentoMes += parseFloat(pg.valor || 0); });

    let despesasMes = 0;
    db.despesas.forEach(d => { if (d.data && d.data.startsWith(prefixoMes)) despesasMes += parseFloat(d.valor || 0); });

    let saldoLiquidoMes = faturamentoMes - despesasMes;

    let contasAReceber = 0;
    db.pacientes.forEach(p => {
        const s = calcularPendenciaPaciente(p.id);
        if (s > 0) contasAReceber += s;
    });

    document.getElementById('kpi-faturamento').innerText = 'R$ ' + faturamentoMes.toFixed(2);
    document.getElementById('kpi-despesas').innerText = 'R$ ' + despesasMes.toFixed(2);
    document.getElementById('kpi-saldo-liquido').innerText = 'R$ ' + saldoLiquidoMes.toFixed(2);
    document.getElementById('kpi-receber').innerText = 'R$ ' + contasAReceber.toFixed(2);

    let encontrouPendencia = false;
    db.pacientes.forEach(paciente => {
        const saldo = calcularPendenciaPaciente(paciente.id);
        if (saldo !== 0) {
            encontrouPendencia = true;
            if (saldo > 0) {
                listaPendencias.innerHTML += '<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm flex justify-between items-center">' +
                    '<div><p class="font-semibold text-amber-900">' + paciente.nome + '</p><span class="text-xs text-amber-700">Débito em aberto</span></div>' +
                    '<div class="text-right flex items-center gap-2"><div><span class="font-bold text-amber-800 block">R$ ' + saldo.toFixed(2) + '</span><button onclick="abrirDetalhesPaciente(\'' + paciente.id + '\', \'financeiro\')" class="text-xs text-blue-600 hover:underline">Ver Ficha</button></div><button onclick="quitarPendenciaPaciente(\'' + paciente.id + '\')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow transition">Quitar</button></div>' +
                '</div>';
            } else {
                const credito = Math.abs(saldo);
                listaPendencias.innerHTML += '<div class="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm flex justify-between items-center">' +
                    '<div><p class="font-semibold text-blue-900">' + paciente.nome + '</p><span class="text-xs text-blue-700">Possui saldo credor</span></div>' +
                    '<div class="text-right flex items-center gap-2"><div><span class="font-bold text-blue-800 block">+ R$ ' + credito.toFixed(2) + '</span><button onclick="abrirDetalhesPaciente(\'' + paciente.id + '\', \'financeiro\')" class="text-xs text-blue-600 hover:underline">Ver Ficha</button></div></div>' +
                '</div>';
            }
        }
    });

    if (!encontrouPendencia) {
        listaPendencias.innerHTML = '<p class="text-sm text-slate-400">Nenhum débito ou crédito registrado em aberto.</p>';
    }

    let transacoes = [];
    db.pagamentos.forEach(pg => transacoes.push({ id: pg.id, tipo: 'entrada', data: pg.data, valor: pg.valor, forma: pg.forma, descricao: pg.descricao, pacienteId: pg.pacienteId }));
    db.despesas.forEach(d => transacoes.push({ id: d.id, tipo: 'saida', data: d.data, valor: d.valor, forma: 'Despesa', descricao: d.descricao + ' (' + d.categoria + ')', pacienteId: null }));

    transacoes = transacoes.filter(t => {
        if (!t.data) return false;
        if (filtroPeriodo === 'hoje') return t.data === hojeIso;
        if (filtroPeriodo === 'mes') return t.data.startsWith(prefixoMes);
        return true;
    });

    transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    if (transacoes.length === 0) {
        listaFluxo.innerHTML = '<p class="text-sm text-slate-400">Nenhum lançamento registrado para este período.</p>';
    } else {
        transacoes.forEach(t => {
            if (t.tipo === 'entrada') {
                const paciente = db.pacientes.find(p => p.id === t.pacienteId) || { nome: 'PACIENTE AVULSO' };
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

function abrirModalPagamentoAvulso() {
    const valorStr = prompt('Digite o valor do pagamento (R$):');
    if (!valorStr) return;
    const valor = parseFloat(valorStr.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
        alert('Valor inválido.');
        return;
    }
    const descricao = prompt('Digite a descrição:', 'Consulta / Procedimento');
    const forma = prompt('Forma de pagamento (Dinheiro, Pix, Cartão):', 'Pix');
    db.pagamentos.push({ id: gerarIdUnico(), pacienteId: null, data: obterDataLocalISO(), valor: valor, forma: forma || 'Pix', descricao: descricao || 'Pagamento Avulso' });
    persistirDB();
    alert('Pagamento lançado!');
    renderizarFinanceiro();
}

function abrirModalAgendamento(dataPreenchida, horaPreenchida) {
    popularSelectPacientes();
    document.getElementById('titulo-modal-agendamento').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-edit-id').value = '';
    document.getElementById('filtro-paciente-busca').value = '';
    document.getElementById('agendamento-obs').value = '';
    document.getElementById('agendamento-duracao').value = '30';
    document.getElementById('container-cadastro-rapido').classList.add('hidden');
    document.getElementById('container-busca-paciente').classList.remove('hidden');
    document.getElementById('btn-toggle-cadastro-rapido').innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Rápido';

    document.getElementById('agendamento-data').value = dataPreenchida || obterDataLocalISO();
    document.getElementById('agendamento-horario').value = horaPreenchida || '09:00';
    document.getElementById('modal-agendamento').classList.remove('hidden');
    document.getElementById('modal-agendamento').classList.add('flex');
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

    filtrados.forEach(p => {
        select.innerHTML += '<option value="' + p.id + '">' + p.nome + ' (' + p.categoria + ')</option>';
    });
}

function toggleFormCadastroRapido() {
    const bloco = document.getElementById('container-cadastro-rapido');
    const busca = document.getElementById('container-busca-paciente');
    const btn = document.getElementById('btn-toggle-cadastro-rapido');

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

    if (!nome) {
        alert('Informe o nome.');
        return;
    }

    const novoId = gerarIdUnico();
    db.pacientes.push({ id: novoId, nome: nome, telefone: telefone, nascimento: '', cpf: '', categoria: categoria, vencimento: '', planejamentoEtapas: [] });
    persistirDB();

    popularSelectPacientes();
    renderizarPacientes();
    document.getElementById('agendamento-paciente').value = novoId;
    toggleFormCadastroRapido();
    alert('Paciente cadastrado!');
}

function abrirModalPaciente(pacienteId) {
    document.getElementById('form-paciente').reset();
    const titulo = document.getElementById('titulo-modal-paciente');
    const editId = document.getElementById('paciente-edit-id');

    if (pacienteId) {
        const paciente = db.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;

        titulo.innerText = 'Editar Cadastro do Paciente';
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

    document.getElementById('modal-paciente').classList.remove('hidden');
    document.getElementById('modal-paciente').classList.add('flex');
}

function fecharModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
}

function toggleVencimentoOrto() {
    const categoria = document.getElementById('paciente-categoria').value;
    const grupoOrto = document.getElementById('grupo-vencimento-orto');
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

function salvarAgendamento(event) {
    event.preventDefault();
    const pacienteId = document.getElementById('agendamento-paciente').value;
    const editId = document.getElementById('agendamento-edit-id').value;

    if (!pacienteId) {
        alert('Selecione um paciente.');
        return;
    }

    const dataAg = document.getElementById('agendamento-data').value;
    const horaAg = document.getElementById('agendamento-horario').value;

    const conflito = db.agendamentos.find(a => a.data === dataAg && a.horario === horaAg && a.id !== editId);
    if (conflito) {
        const pacienteConflito = db.pacientes.find(p => p.id === conflito.pacienteId) || { nome: 'Outro paciente' };
        if (!confirm(`⚠️ Já existe agendamento para "${pacienteConflito.nome}" nesse horário. Agendar mesmo assim?`)) return;
    }

    const dadosAgendamento = {
        pacienteId: pacienteId,
        data: dataAg,
        horario: horaAg,
        duracao: document.getElementById('agendamento-duracao').value,
        tipo: document.getElementById('agendamento-tipo').value,
        obs: document.getElementById('agendamento-obs').value.trim()
    };

    if (editId) {
        const index = db.agendamentos.findIndex(a => a.id === editId);
        if (index !== -1) db.agendamentos[index] = { ...db.agendamentos[index], ...dadosAgendamento };
    } else {
        db.agendamentos.push({ id: gerarIdUnico(), ...dadosAgendamento });
    }

    persistirDB();
    fecharModal('modal-agendamento');
    atualizarCalendario();

    if (!document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(pacienteId, abaOrigem);
    }
}

function salvarPaciente(event) {
    event.preventDefault();
    const categoria = document.getElementById('paciente-categoria').value;
    const nomeCaixaAlta = document.getElementById('paciente-nome').value.trim().toUpperCase();
    const editId = document.getElementById('paciente-edit-id').value;

    if (!nomeCaixaAlta) {
        alert('O nome do paciente é obrigatório.');
        return;
    }

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
        db.pacientes.push({ id: gerarIdUnico(), planejamentoEtapas: [], ...dadosPaciente });
    }

    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();
    atualizarCalendario();

    if (editId && !document.getElementById('tab-detalhes-paciente').classList.contains('hidden')) {
        abrirDetalhesPaciente(editId, abaOrigem);
    }

    alert('Dados do paciente salvos!');
}

function salvarLancamentoCaixaManual(event, pacienteId) {
    event.preventDefault();
    const observacao = document.getElementById('caixa-obs-manual').value.trim();
    const valorPago = parseFloat(document.getElementById('caixa-valor-pago').value) || 0;
    const forma = document.getElementById('caixa-forma').value;
    const temPendencia = document.getElementById('caixa-marca-pendencia').checked;
    const hoje = obterDataLocalISO();

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) return;

    paciente.possuiPendenciaManual = temPendencia;
    paciente.obsFinanceiraManual = observacao;

    if (valorPago > 0) {
        db.pagamentos.push({ 
            id: gerarIdUnico(), 
            pacienteId: pacienteId, 
            data: hoje, 
            valor: valorPago, 
            forma: forma, 
            descricao: observacao ? 'Pagamento: ' + observacao : 'Pagamento avulso' 
        });
    }

    persistirDB();
    alert('Lançamento financeiro atualizado com sucesso!');
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}
