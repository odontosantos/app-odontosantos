// SISTEMA CONSULTÓRIO ODONTOLÓGICO - LÓGICA COMPLETA DE NEGÓCIO E INTERFACE

// 1. ESTADO GLOBAL DA APLICAÇÃO (BANCO DE DADOS LOCAL E SESSÃO)
const db = {
    pacientes: [],
    procedimentos: [],
    pagamentos: [],
    prontuarios: [],
    gastos: []
};

let usuarioLogado = null;
let filtroCategoria = 'todos'; // 'todos', 'clinico', 'orto'
let apenasInativos = false;
let origemVisualizacao = 'pacientes'; // 'pacientes' ou 'financeiro'

// Função auxiliar para remover acentos na busca
function removerAcentos(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// 2. INICIALIZAÇÃO E AUTENTICAÇÃO FIREBASE
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                usuarioLogado = user;
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('main-header').classList.remove('hidden');
                document.getElementById('main-nav').classList.remove('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                
                const badge = document.getElementById('header-user-badge');
                if (badge) badge.innerText = `Usuário: ${user.email}`;

                carregarDadosFirebase();
                renderizarNavegacao();
                trocarAba('pacientes');
            } else {
                usuarioLogado = null;
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('main-header').classList.add('hidden');
                document.getElementById('main-nav').classList.add('hidden');
                document.getElementById('main-content').classList.add('hidden');
            }
        });
    } else {
        console.warn("Firebase SDK não detectado ou em ambiente offline local.");
        carregarDadosLocalStorage();
        renderizarNavegacao();
        trocarAba('pacientes');
    }
});

function fazerLoginFirebase(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(email, senha)
            .catch(error => {
                exibirModalCustomizado("Erro no Login", `Não foi possível autenticar: ${error.message}`);
            });
    } else {
        usuarioLogado = { email: email || 'admin@consultorio.com' };
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-header').classList.remove('hidden');
        document.getElementById('main-nav').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        carregarDadosLocalStorage();
        renderizarNavegacao();
        trocarAba('pacientes');
    }
}

function logout() {
    exibirModalCustomizado(
        "Confirmar Saída",
        "Deseja realmente sair do sistema?",
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            { 
                texto: "Sair", 
                classe: "bg-rose-600 text-white", 
                acao: () => {
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        firebase.auth().signOut();
                    } else {
                        location.reload();
                    }
                } 
            }
        ]
    );
}

// 3. PERSISTÊNCIA DE DADOS (FIRESTORE COM FALLBACK LOCALSTORAGE)
function carregarDadosFirebase() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const firestore = firebase.firestore();
        
        firestore.collection("pacientes").onSnapshot(snapshot => {
            db.pacientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarTelas();
        }, err => console.error("Erro pacientes:", err));

        firestore.collection("procedimentos").onSnapshot(snapshot => {
            db.procedimentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarTelas();
        }, err => console.error("Erro procedimentos:", err));

        firestore.collection("pagamentos").onSnapshot(snapshot => {
            db.pagamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarTelas();
        }, err => console.error("Erro pagamentos:", err));

        firestore.collection("prontuarios").onSnapshot(snapshot => {
            db.prontuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarTelas();
        }, err => console.error("Erro prontuarios:", err));

        firestore.collection("gastos").onSnapshot(snapshot => {
            db.gastos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarTelas();
        }, err => console.error("Erro gastos:", err));
    } else {
        carregarDadosLocalStorage();
    }
}

function carregarDadosLocalStorage() {
    db.pacientes = JSON.parse(localStorage.getItem('odonto_pacientes') || '[]');
    db.procedimentos = JSON.parse(localStorage.getItem('odonto_procedimentos') || '[]');
    db.pagamentos = JSON.parse(localStorage.getItem('odonto_pagamentos') || '[]');
    db.prontuarios = JSON.parse(localStorage.getItem('odonto_prontuarios') || '[]');
    db.gastos = JSON.parse(localStorage.getItem('odonto_gastos') || '[]');
    atualizarTelas();
}

function salvarColecao(colecao) {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const firestore = firebase.firestore();
        db[colecao].forEach(item => {
            if (item.id) {
                firestore.collection(colecao).doc(item.id).set(item, { merge: true });
            }
        });
    } else {
        localStorage.setItem(`odonto_${colecao}`, JSON.stringify(db[colecao]));
    }
}

function atualizarTelas() {
    renderizarPacientes();
    popularSelectPacientesCaixa();
    renderizarFinanceiro();
}

// 4. SISTEMA DE NAVEGAÇÃO ENTRE ABAS
const ABAS = [
    { id: 'pacientes', titulo: 'Pacientes', icone: 'fa-users' },
    { id: 'financeiro', titulo: 'Financeiro / Caixa', icone: 'fa-wallet' }
];

function renderizarNavegacao() {
    const navContainer = document.getElementById('nav-tabs');
    if (!navContainer) return;
    
    navContainer.innerHTML = ABAS.map(aba => `
        <button onclick="trocarAba('${aba.id}')" id="nav-btn-${aba.id}" class="px-4 py-3 font-semibold text-xs sm:text-sm flex items-center space-x-2 border-b-2 border-transparent hover:text-blue-400 transition whitespace-nowrap">
            <i class="fa-solid ${aba.icone}"></i>
            <span>${aba.titulo}</span>
        </button>
    `).join('');
}

function trocarAba(abaId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    ABAS.forEach(aba => {
        const btn = document.getElementById(`nav-btn-${aba.id}`);
        if (btn) {
            btn.classList.remove('border-blue-500', 'text-blue-400', 'bg-slate-800');
            btn.classList.add('border-transparent');
        }
    });

    const abaAtiva = document.getElementById(`tab-${abaId}`);
    if (abaAtiva) abaAtiva.classList.remove('hidden');

    const btnAtivo = document.getElementById(`nav-btn-${abaId}`);
    if (btnAtivo) {
        btnAtivo.classList.add('border-blue-500', 'text-blue-400', 'bg-slate-800');
        btnAtivo.classList.remove('border-transparent');
    }

    if (abaId === 'pacientes') renderizarPacientes();
    if (abaId === 'financeiro') {
        popularSelectPacientesCaixa();
        renderizarFinanceiro();
    }
}

// 5. ABA 1: GESTÃO DE PACIENTES
function definirFiltroCategoria(cat) {
    filtroCategoria = cat;
    apenasInativos = false;
    atualizarBotoesFiltroPacientes();
    renderizarPacientes();
}

function alternarFiltroInativos() {
    apenasInativos = !apenasInativos;
    atualizarBotoesFiltroPacientes();
    renderizarPacientes();
}

function atualizarBotoesFiltroPacientes() {
    const btnTodos = document.getElementById('tag-filtro-todos');
    const btnClinico = document.getElementById('tag-filtro-clinico');
    const btnOrto = document.getElementById('tag-filtro-orto');
    const btnInativos = document.getElementById('btn-filtro-inativos');

    if (btnTodos) btnTodos.className = `px-3.5 py-1.5 rounded-full text-xs font-bold transition ${filtroCategoria === 'todos' && !apenasInativos ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
    if (btnClinico) btnClinico.className = `px-3.5 py-1.5 rounded-full text-xs font-bold transition ${filtroCategoria === 'clinico' && !apenasInativos ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
    if (btnOrto) btnOrto.className = `px-3.5 py-1.5 rounded-full text-xs font-bold transition ${filtroCategoria === 'orto' && !apenasInativos ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
    if (btnInativos) btnInativos.className = `px-3.5 py-1.5 rounded-full text-xs font-bold transition ${apenasInativos ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-800 border border-amber-200'}`;
}

function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes-container');
    if (!container) return;

    const termoBuscaInput = document.getElementById('busca-pacientes-tabela');
    const termoBusca = removerAcentos((termoBuscaInput ? termoBuscaInput.value : '').toLowerCase().trim());

    const total = db.pacientes.length;
    const totalClinico = db.pacientes.filter(p => (p.categoria || '').toLowerCase() === 'clínico' || (p.categoria || '').toLowerCase() === 'clinico').length;
    const totalOrto = db.pacientes.filter(p => (p.categoria || '').toLowerCase() === 'ortodontia').length;

    const hoje = new Date();
    const totalInativos = db.pacientes.filter(p => {
        if (!p.ultimaConsulta) return true;
        const diffDias = Math.floor((hoje - new Date(p.ultimaConsulta)) / (1000 * 60 * 60 * 24));
        return diffDias > 30;
    }).length;

    if (document.getElementById('kpi-total-pacientes')) document.getElementById('kpi-total-pacientes').innerText = total;
    if (document.getElementById('kpi-clinico-pacientes')) document.getElementById('kpi-clinico-pacientes').innerText = totalClinico;
    if (document.getElementById('kpi-orto-pacientes')) document.getElementById('kpi-orto-pacientes').innerText = totalOrto;
    if (document.getElementById('kpi-inativos-pacientes')) document.getElementById('kpi-inativos-pacientes').innerText = totalInativos;

    let listaFiltrada = db.pacientes.filter(p => {
        const nomeNorm = removerAcentos((p.nome || '').toLowerCase());
        const cpfNorm = (p.cpf || '').toLowerCase();
        const atendeBusca = nomeNorm.includes(termoBusca) || cpfNorm.includes(termoBusca);
        
        let atendeCategoria = true;
        if (filtroCategoria === 'clinico') {
            atendeCategoria = (p.categoria || '').toLowerCase() === 'clínico' || (p.categoria || '').toLowerCase() === 'clinico';
        } else if (filtroCategoria === 'orto') {
            atendeCategoria = (p.categoria || '').toLowerCase() === 'ortodontia';
        }

        let atendeInativo = true;
        if (apenasInativos) {
            if (!p.ultimaConsulta) atendeInativo = true;
            else {
                const diff = Math.floor((hoje - new Date(p.ultimaConsulta)) / (1000 * 60 * 60 * 24));
                atendeInativo = diff > 30;
            }
        }

        return atendeBusca && atendeCategoria && atendeInativo;
    });

    if (listaFiltrada.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-xl text-center border border-slate-200">
                <i class="fa-solid fa-user-slash text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium text-sm">Nenhum paciente localizado com os filtros selecionados.</p>
            </div>`;
        return;
    }

    container.innerHTML = listaFiltrada.map(p => {
        const totalProcedimentos = db.procedimentos.filter(proc => proc.pacienteId === p.id).reduce((acc, proc) => acc + (Number(proc.valor) || 0), 0);
        const totalPago = db.pagamentos.filter(pag => pag.pacienteId === p.id).reduce((acc, pag) => acc + (Number(pag.valor) || 0), 0);
        const saldo = totalProcedimentos - totalPago;

        const dataConsultaFormatada = p.ultimaConsulta ? new Date(p.ultimaConsulta + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem registro';

        return `
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="space-y-1 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="font-bold text-slate-900 text-base leading-snug">${p.nome || 'SEM NOME'}</h3>
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${p.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                            ${p.categoria || 'Clínico'}
                        </span>
                        ${p.temPendencia ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700"><i class="fa-solid fa-triangle-exclamation"></i> Pendência Caixa</span>` : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                        <span><i class="fa-solid fa-phone text-slate-400 mr-1"></i>${p.telefone || 'Sem Tel'}</span>
                        <span><i class="fa-solid fa-id-card text-slate-400 mr-1"></i>${p.cpf || 'Sem CPF'}</span>
                        <span><i class="fa-solid fa-calendar-day text-slate-400 mr-1"></i>Última: ${dataConsultaFormatada}</span>
                        ${p.categoria === 'Ortodontia' && p.diaVencimentoOrto ? `<span class="text-purple-600 font-semibold"><i class="fa-solid fa-clock text-purple-400 mr-1"></i>Venc. Orto: Dia ${p.diaVencimentoOrto}</span>` : ''}
                    </div>
                </div>

                <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div class="text-left sm:text-right">
                        <span class="text-[10px] uppercase font-bold text-slate-400 block">Saldo Paciente</span>
                        <span class="text-sm font-extrabold ${saldo > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                            ${saldo > 0 ? `Débito: R$ ${saldo.toFixed(2)}` : 'Em dia / Quitado'}
                        </span>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button onclick="verDetalhesPaciente('${p.id}', 'pacientes')" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition flex items-center gap-1">
                            <i class="fa-solid fa-folder-open"></i> Prontuário
                        </button>
                        <button onclick="editarPaciente('${p.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition" title="Editar Cadastro">
                            <i class="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        <button onclick="excluirPaciente('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition" title="Excluir Paciente">
                            <i class="fa-solid fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 6. CADASTRO E EDIÇÃO DE PACIENTES
function abrirModalPaciente() {
    document.getElementById('form-paciente').reset();
    document.getElementById('paciente-edit-id').value = '';
    document.getElementById('titulo-modal-paciente').innerText = 'Cadastrar Novo Paciente';
    toggleVencimentoOrto();
    abrirModal('modal-paciente');
}

function toggleVencimentoOrto() {
    const cat = document.getElementById('paciente-categoria').value;
    const grupo = document.getElementById('grupo-vencimento-orto');
    if (cat === 'Ortodontia') {
        grupo.classList.remove('hidden');
    } else {
        grupo.classList.add('hidden');
    }
}

function salvarPaciente(e) {
    e.preventDefault();
    const id = document.getElementById('paciente-edit-id').value;
    const nome = document.getElementById('paciente-nome').value.trim().toUpperCase();
    const telefone = document.getElementById('paciente-telefone').value.trim();
    const nascimento = document.getElementById('paciente-nascimento').value;
    const cpf = document.getElementById('paciente-cpf').value.trim();
    const categoria = document.getElementById('paciente-categoria').value;
    const dataVenc = document.getElementById('paciente-vencimento').value;

    let diaVencimentoOrto = null;
    if (categoria === 'Ortodontia' && dataVenc) {
        diaVencimentoOrto = new Date(dataVenc + 'T00:00:00').getDate();
    }

    if (id) {
        const idx = db.pacientes.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.pacientes[idx] = {
                ...db.pacientes[idx],
                nome, telefone, nascimento, cpf, categoria,
                diaVencimentoOrto: diaVencimentoOrto || db.pacientes[idx].diaVencimentoOrto
            };
        }
    } else {
        const novoId = 'pac_' + Date.now();
        db.pacientes.push({
            id: novoId,
            nome,
            telefone,
            nascimento,
            cpf,
            categoria,
            diaVencimentoOrto,
            ultimaConsulta: new Date().toISOString().split('T')[0],
            temPendencia: false
        });
    }

    salvarColecao('pacientes');
    fecharModal('modal-paciente');
    renderizarPacientes();
    popularSelectPacientesCaixa();
}

function editarPaciente(id) {
    const paciente = db.pacientes.find(p => p.id === id);
    if (!paciente) return;

    document.getElementById('paciente-edit-id').value = paciente.id;
    document.getElementById('paciente-nome').value = paciente.nome || '';
    document.getElementById('paciente-telefone').value = paciente.telefone || '';
    document.getElementById('paciente-nascimento').value = paciente.nascimento || '';
    document.getElementById('paciente-cpf').value = paciente.cpf || '';
    document.getElementById('paciente-categoria').value = paciente.categoria || 'Clínico';

    toggleVencimentoOrto();
    document.getElementById('titulo-modal-paciente').innerText = 'Editar Paciente';
    abrirModal('modal-paciente');
}

function excluirPaciente(id) {
    exibirModalCustomizado(
        "Excluir Paciente",
        "Tem certeza que deseja remover este paciente? Registros vinculados serão mantidos no histórico.",
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            { 
                texto: "Sim, Excluir", 
                classe: "bg-rose-600 text-white", 
                acao: () => {
                    db.pacientes = db.pacientes.filter(p => p.id !== id);
                    if (typeof firebase !== 'undefined' && firebase.firestore) {
                        firebase.firestore().collection('pacientes').doc(id).delete();
                    } else {
                        salvarColecao('pacientes');
                    }
                    renderizarPacientes();
                    popularSelectPacientesCaixa();
                } 
            }
        ]
    );
}

// 7. ABA 2: FINANCEIRO E CAIXA COM PESQUISA DE PACIENTES CORRIGIDA
function popularSelectPacientesCaixa() {
    const select = document.getElementById('caixa-financeiro-paciente');
    if (!select) return;

    const inputFiltro = document.getElementById('filtro-caixa-paciente-busca');
    if (inputFiltro && inputFiltro.value.trim() !== '') {
        filtrarPacientesCaixaSelect();
        return;
    }

    select.innerHTML = '<option value="">-- Selecione o Paciente --</option>';
    if (Array.isArray(db.pacientes)) {
        db.pacientes.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nome || 'SEM NOME'} (${p.categoria || 'Clínico'})</option>`;
        });
    }
}

function filtrarPacientesCaixaSelect() {
    const inputFiltro = document.getElementById('filtro-caixa-paciente-busca');
    const select = document.getElementById('caixa-financeiro-paciente');
    if (!inputFiltro || !select) return;

    const termo = removerAcentos((inputFiltro.value || '').toLowerCase().trim());
    select.innerHTML = '<option value="">-- Selecione o Paciente --</option>';

    if (!Array.isArray(db.pacientes)) return;

    const filtrados = db.pacientes.filter(p => {
        const nomeNorm = removerAcentos((p.nome || '').toLowerCase());
        const cpfNorm = (p.cpf || '').toLowerCase();
        return nomeNorm.includes(termo) || cpfNorm.includes(termo);
    });

    if (filtrados.length === 0) {
        select.innerHTML = '<option value="">Nenhum paciente encontrado com esse nome</option>';
        return;
    }

    filtrados.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome || 'SEM NOME'} (${p.categoria || 'Clínico'})</option>`;
    });

    if (filtrados.length === 1) {
        select.value = filtrados[0].id;
    }
}

function salvarLancamentoCaixaAbaFinanceiro(e) {
    e.preventDefault();
    const pacienteId = document.getElementById('caixa-financeiro-paciente').value;
    const descricao = document.getElementById('caixa-fin-desc').value.trim();
    const valor = parseFloat(document.getElementById('caixa-fin-valor').value) || 0;
    const formaPagamento = document.getElementById('caixa-fin-forma').value;
    const obs = document.getElementById('caixa-fin-obs').value.trim();
    const marcaPendencia = document.getElementById('caixa-fin-marca-pendencia').checked;

    if (!pacienteId) {
        exibirModalCustomizado("Atenção", "Por favor, selecione um paciente.");
        return;
    }

    const dataHoje = new Date().toISOString().split('T')[0];

    if (valor > 0) {
        const novoPagamento = {
            id: 'pag_' + Date.now(),
            pacienteId,
            descricao,
            valor,
            formaPagamento,
            obs,
            data: dataHoje
        };
        db.pagamentos.push(novoPagamento);
        salvarColecao('pagamentos');
    }

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        paciente.temPendencia = marcaPendencia;
        paciente.ultimaConsulta = dataHoje;
        salvarColecao('pacientes');
    }

    document.getElementById('caixa-fin-desc').value = '';
    document.getElementById('caixa-fin-valor').value = '';
    document.getElementById('caixa-fin-obs').value = '';
    document.getElementById('caixa-fin-marca-pendencia').checked = false;

    exibirModalCustomizado("Sucesso", "Lançamento de caixa registrado com sucesso!");
    renderizarFinanceiro();
    renderizarPacientes();
}

function lancarDespesa() {
    exibirModalCustomizado(
        "Lançar Despesa / Saída",
        `
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Descrição da Despesa *</label>
                <input type="text" id="modal-despesa-desc" placeholder="Ex: Material Dental, Conta de Luz..." class="w-full px-3 py-2 border rounded-lg text-sm outline-none">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" id="modal-despesa-valor" placeholder="0.00" class="w-full px-3 py-2 border rounded-lg text-sm outline-none">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Categoria / Observação</label>
                <input type="text" id="modal-despesa-cat" placeholder="Ex: Insumos, Aluguel, Manutenção" class="w-full px-3 py-2 border rounded-lg text-sm outline-none">
            </div>
        </div>
        `,
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            {
                texto: "Salvar Despesa",
                classe: "bg-rose-600 text-white",
                acao: () => {
                    const desc = document.getElementById('modal-despesa-desc').value.trim();
                    const valor = parseFloat(document.getElementById('modal-despesa-valor').value) || 0;
                    const cat = document.getElementById('modal-despesa-cat').value.trim();

                    if (!desc || valor <= 0) {
                        exibirModalCustomizado("Erro", "Preencha a descrição e um valor válido para a despesa.");
                        return;
                    }

                    const novaDespesa = {
                        id: 'gasto_' + Date.now(),
                        descricao: desc,
                        valor: valor,
                        categoria: cat,
                        data: new Date().toISOString().split('T')[0]
                    };

                    db.gastos.push(novaDespesa);
                    salvarColecao('gastos');
                    renderizarFinanceiro();
                    exibirModalCustomizado("Sucesso", "Despesa lançada com sucesso!");
                }
            }
        ]
    );
}

function abrirModalPagamentoAvulso() {
    popularSelectPacientesCaixa();
    exibirModalCustomizado(
        "Pagamento Avulso / Recebimento",
        `
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Selecionar Paciente *</label>
                <select id="modal-avulso-paciente" class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    ${db.pacientes.map(p => `<option value="${p.id}">${p.nome} (${p.categoria})</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Descrição</label>
                <input type="text" id="modal-avulso-desc" placeholder="Ex: Quitação de débito, Parcela Orto" class="w-full px-3 py-2 border rounded-lg text-sm">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" id="modal-avulso-valor" placeholder="0.00" class="w-full px-3 py-2 border rounded-lg text-sm">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Forma de Pagamento</label>
                <select id="modal-avulso-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                </select>
            </div>
        </div>
        `,
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            {
                texto: "Registrar Pagamento",
                classe: "bg-emerald-600 text-white",
                acao: () => {
                    const pacienteId = document.getElementById('modal-avulso-paciente').value;
                    const desc = document.getElementById('modal-avulso-desc').value.trim() || 'Pagamento Avulso';
                    const valor = parseFloat(document.getElementById('modal-avulso-valor').value) || 0;
                    const forma = document.getElementById('modal-avulso-forma').value;

                    if (!pacienteId || valor <= 0) {
                        exibirModalCustomizado("Erro", "Selecione o paciente e um valor válido.");
                        return;
                    }

                    db.pagamentos.push({
                        id: 'pag_' + Date.now(),
                        pacienteId,
                        descricao: desc,
                        valor,
                        formaPagamento: forma,
                        data: new Date().toISOString().split('T')[0]
                    });

                    const p = db.pacientes.find(pac => pac.id === pacienteId);
                    if (p) {
                        p.temPendencia = false;
                        salvarColecao('pacientes');
                    }

                    salvarColecao('pagamentos');
                    renderizarFinanceiro();
                    renderizarPacientes();
                    exibirModalCustomizado("Sucesso", "Pagamento avulso registrado com sucesso!");
                }
            }
        ]
    );
}

function alternarFiltroPersonalizadoFinanceiro() {
    const tipo = document.getElementById('filtro-periodo-financeiro').value;
    const containerDatas = document.getElementById('container-datas-personalizadas');
    if (tipo === 'personalizado') {
        containerDatas.classList.remove('hidden');
        containerDatas.classList.add('flex');
    } else {
        containerDatas.classList.add('hidden');
        containerDatas.classList.remove('flex');
    }
    renderizarFinanceiro();
}

function renderizarFinanceiro() {
    const periodo = document.getElementById('filtro-periodo-financeiro') ? document.getElementById('filtro-periodo-financeiro').value : 'mes';
    const hoje = new Date();
    const dataHojeStr = hoje.toISOString().split('T')[0];

    let pagamentosFiltrados = [...db.pagamentos];
    let gastosFiltrados = [...db.gastos];

    if (periodo === 'hoje') {
        pagamentosFiltrados = pagamentosFiltrados.filter(p => p.data === dataHojeStr);
        gastosFiltrados = gastosFiltrados.filter(g => g.data === dataHojeStr);
    } else if (periodo === 'mes') {
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        pagamentosFiltrados = pagamentosFiltrados.filter(p => {
            if (!p.data) return false;
            const d = new Date(p.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        });
        gastosFiltrados = gastosFiltrados.filter(g => {
            if (!g.data) return false;
            const d = new Date(g.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        });
    } else if (periodo === 'personalizado') {
        const dataInicio = document.getElementById('data-inicio-fin').value;
        const dataFim = document.getElementById('data-fim-fin').value;
        if (dataInicio) {
            pagamentosFiltrados = pagamentosFiltrados.filter(p => p.data >= dataInicio);
            gastosFiltrados = gastosFiltrados.filter(g => g.data >= dataInicio);
        }
        if (dataFim) {
            pagamentosFiltrados = pagamentosFiltrados.filter(p => p.data <= dataFim);
            gastosFiltrados = gastosFiltrados.filter(g => g.data <= dataFim);
        }
    }

    const faturamento = pagamentosFiltrados.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const despesas = gastosFiltrados.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const saldoLiquido = faturamento - despesas;
    const qtdPendentes = db.pacientes.filter(p => p.temPendencia).length;

    if (document.getElementById('kpi-saldo-liquido')) document.getElementById('kpi-saldo-liquido').innerText = `R$ ${saldoLiquido.toFixed(2)}`;
    if (document.getElementById('kpi-faturamento')) document.getElementById('kpi-faturamento').innerText = `R$ ${faturamento.toFixed(2)}`;
    if (document.getElementById('kpi-despesas')) document.getElementById('kpi-despesas').innerText = `R$ ${despesas.toFixed(2)}`;
    if (document.getElementById('kpi-receber')) document.getElementById('kpi-receber').innerText = `${qtdPendentes} Paciente(s)`;

    const containerPendencias = document.getElementById('lista-pendencias-financeiras');
    if (containerPendencias) {
        const pacientesComPendencia = db.pacientes.filter(p => {
            const totalProc = db.procedimentos.filter(proc => proc.pacienteId === p.id).reduce((acc, proc) => acc + (Number(proc.valor) || 0), 0);
            const totalPag = db.pagamentos.filter(pag => pag.pacienteId === p.id).reduce((acc, pag) => acc + (Number(pag.valor) || 0), 0);
            return p.temPendencia || (totalProc - totalPag > 0);
        });

        if (pacientesComPendencia.length === 0) {
            containerPendencias.innerHTML = `<p class="text-xs text-slate-400 font-medium py-3 text-center">Nenhuma pendência financeira pendente.</p>`;
        } else {
            containerPendencias.innerHTML = pacientesComPendencia.map(p => {
                const totalProc = db.procedimentos.filter(proc => proc.pacienteId === p.id).reduce((acc, proc) => acc + (Number(proc.valor) || 0), 0);
                const totalPag = db.pagamentos.filter(pag => pag.pacienteId === p.id).reduce((acc, pag) => acc + (Number(pag.valor) || 0), 0);
                const saldoDevido = totalProc - totalPag;

                return `
                    <div class="p-3 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                        <div>
                            <span class="font-bold text-slate-800 block">${p.nome}</span>
                            <span class="text-slate-500">${p.categoria} ${p.temPendencia ? '• <span class="text-amber-600 font-semibold">Pendência marcada</span>' : ''}</span>
                        </div>
                        <div class="text-right">
                            <span class="font-bold text-rose-600 block">${saldoDevido > 0 ? `R$ ${saldoDevido.toFixed(2)}` : 'Sinalizado'}</span>
                            <button onclick="verDetalhesPaciente('${p.id}', 'financeiro')" class="text-[11px] text-blue-600 font-semibold hover:underline">Ver Prontuário</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    const containerHistorico = document.getElementById('lista-pagamentos-realizados');
    if (containerHistorico) {
        const movimentacoes = [
            ...pagamentosFiltrados.map(p => ({ ...p, tipoMov: 'entrada' })),
            ...gastosFiltrados.map(g => ({ ...g, tipoMov: 'saida' }))
        ].sort((a, b) => new Date(b.data) - new Date(a.data));

        if (movimentacoes.length === 0) {
            containerHistorico.innerHTML = `<p class="text-xs text-slate-400 font-medium py-3 text-center">Nenhuma movimentação registrada no período.</p>`;
        } else {
            containerHistorico.innerHTML = movimentacoes.map(m => {
                const isEntrada = m.tipoMov === 'entrada';
                const paciente = isEntrada ? db.pacientes.find(p => p.id === m.pacienteId) : null;
                const nomeCliente = paciente ? paciente.nome : (m.descricao || 'Despesa');

                return `
                    <div class="p-3 rounded-lg border border-slate-100 bg-white flex justify-between items-center text-xs">
                        <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isEntrada ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                                <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                            </div>
                            <div>
                                <span class="font-bold text-slate-800 block">${nomeCliente}</span>
                                <span class="text-slate-400 text-[11px]">${m.descricao || 'Lançamento'} • ${m.formaPagamento || m.categoria || 'Geral'}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="font-extrabold block ${isEntrada ? 'text-emerald-600' : 'text-rose-600'}">
                                ${isEntrada ? '+' : '-'} R$ ${(Number(m.valor) || 0).toFixed(2)}
                            </span>
                            <span class="text-[10px] text-slate-400">${m.data ? new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// 8. ABA 3: PRONTUÁRIO COMPLETO DO PACIENTE COM PROCEDIMENTOS
function verDetalhesPaciente(id, origem = 'pacientes') {
    origemVisualizacao = origem;
    const paciente = db.pacientes.find(p => p.id === id);
    if (!paciente) return;

    trocarAba('detalhes-paciente');
    const container = document.getElementById('detalhes-paciente-container');
    if (!container) return;

    const procs = db.procedimentos.filter(p => p.pacienteId === id);
    const pags = db.pagamentos.filter(p => p.pacienteId === id);
    const pronts = db.prontuarios.filter(p => p.pacienteId === id);

    const totalProcedimentos = procs.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const totalPagamentos = pags.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const saldo = totalProcedimentos - totalPagamentos;

    container.innerHTML = `
        <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <div class="flex items-center gap-2">
                    <h2 class="text-xl font-bold text-slate-900">${paciente.nome}</h2>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${paciente.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${paciente.categoria}</span>
                </div>
                <p class="text-xs text-slate-500 mt-1">CPF: ${paciente.cpf || 'Não informado'} • Tel: ${paciente.telefone || 'Não informado'} • Nasc: ${paciente.nascimento || 'Não informado'}</p>
            </div>
            <div class="bg-slate-50 p-3 rounded-lg border text-right w-full sm:w-auto">
                <span class="text-[10px] uppercase font-bold text-slate-400 block">Balanço do Paciente</span>
                <span class="text-base font-extrabold ${saldo > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                    ${saldo > 0 ? `Débito: R$ ${saldo.toFixed(2)}` : 'Sem débitos pendentes'}
                </span>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <div class="flex justify-between items-center border-b pb-2">
                    <h4 class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-tooth text-blue-600 mr-2"></i> Procedimentos & Tratamentos</h4>
                    <button onclick="adicionarProcedimentoProntuario('${paciente.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition">
                        + Procedimento
                    </button>
                </div>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    ${procs.length === 0 ? '<p class="text-xs text-slate-400 py-2">Nenhum procedimento registrado.</p>' : procs.map(proc => `
                        <div class="p-3 bg-slate-50 rounded-lg border text-xs flex justify-between items-center">
                            <div>
                                <span class="font-bold text-slate-800 block">${proc.descricao}</span>
                                <span class="text-slate-400 text-[11px]">${proc.data ? new Date(proc.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span>
                            </div>
                            <span class="font-bold text-slate-900">R$ ${(Number(proc.valor) || 0).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <div class="flex justify-between items-center border-b pb-2">
                    <h4 class="font-bold text-slate-800 text-sm"><i class="fa-solid fa-notes-medical text-emerald-600 mr-2"></i> Evolução / Anotações Clínicas</h4>
                    <button onclick="adicionarAnotacaoProntuario('${paciente.id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition">
                        + Anotação
                    </button>
                </div>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    ${pronts.length === 0 ? '<p class="text-xs text-slate-400 py-2">Nenhuma anotação médica registrada.</p>' : pronts.map(pront => `
                        <div class="p-3 bg-slate-50 rounded-lg border text-xs space-y-1">
                            <div class="flex justify-between text-[11px] text-slate-400 border-b pb-1">
                                <span><i class="fa-regular fa-clock mr-1"></i>${pront.data ? new Date(pront.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span>
                                <span>Por: ${pront.usuario || 'Dentista'}</span>
                            </div>
                            <p class="text-slate-700 whitespace-pre-wrap">${pront.texto}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function voltarParaOrigem() {
    trocarAba(origemVisualizacao || 'pacientes');
}

function adicionarProcedimentoProntuario(pacienteId) {
    exibirModalCustomizado(
        "Novo Procedimento Odontológico",
        `
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Descrição do Procedimento *</label>
                <input type="text" id="modal-proc-desc" placeholder="Ex: Restauração Resina, Limpeza, Extração" class="w-full px-3 py-2 border rounded-lg text-sm">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" id="modal-proc-valor" placeholder="0.00" class="w-full px-3 py-2 border rounded-lg text-sm">
            </div>
        </div>
        `,
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            {
                texto: "Adicionar Procedimento",
                classe: "bg-blue-600 text-white",
                acao: () => {
                    const desc = document.getElementById('modal-proc-desc').value.trim();
                    const valor = parseFloat(document.getElementById('modal-proc-valor').value) || 0;
                    if (!desc || valor <= 0) {
                        exibirModalCustomizado("Erro", "Preencha uma descrição e um valor válido.");
                        return;
                    }

                    db.procedimentos.push({
                        id: 'proc_' + Date.now(),
                        pacienteId,
                        descricao: desc,
                        valor,
                        data: new Date().toISOString().split('T')[0]
                    });

                    salvarColecao('procedimentos');
                    verDetalhesPaciente(pacienteId, origemVisualizacao);
                    renderizarPacientes();
                }
            }
        ]
    );
}

function adicionarAnotacaoProntuario(pacienteId) {
    exibirModalCustomizado(
        "Adicionar Evolução Clínica",
        `
        <div>
            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Anotações do Atendimento *</label>
            <textarea id="modal-pront-texto" rows="4" placeholder="Descreva os achados, procedimento realizado, queixas do paciente..." class="w-full px-3 py-2 border rounded-lg text-sm outline-none"></textarea>
        </div>
        `,
        [
            { texto: "Cancelar", classe: "bg-slate-200 text-slate-700" },
            {
                texto: "Salvar Anotação",
                classe: "bg-emerald-600 text-white",
                acao: () => {
                    const texto = document.getElementById('modal-pront-texto').value.trim();
                    if (!texto) {
                        exibirModalCustomizado("Erro", "O texto da anotação não pode ficar em branco.");
                        return;
                    }

                    db.prontuarios.push({
                        id: 'pront_' + Date.now(),
                        pacienteId,
                        texto,
                        usuario: usuarioLogado ? usuarioLogado.email : 'Dentista',
                        data: new Date().toISOString().split('T')[0]
                    });

                    salvarColecao('prontuarios');
                    verDetalhesPaciente(pacienteId, origemVisualizacao);
                }
            }
        ]
    );
}

// 9. FECHAMENTO DE CAIXA DIÁRIO
function abrirModalCaixaDiario() {
    const dataHoje = new Date().toISOString().split('T')[0];
    document.getElementById('input-data-caixa-diario').value = dataHoje;
    carregarFechamentoCaixaData();
    abrirModal('modal-fechamento-caixa');
}

function carregarFechamentoCaixaData() {
    const dataSel = document.getElementById('input-data-caixa-diario').value;
    const container = document.getElementById('conteudo-fechamento-caixa');
    if (!container || !dataSel) return;

    const pagamentos = db.pagamentos.filter(p => p.data === dataSel);
    const despesas = db.gastos.filter(g => g.data === dataSel);

    const totalEntradas = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const totalSaidas = despesas.reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
    const saldoDia = totalEntradas - totalSaidas;

    container.innerHTML = `
        <div class="grid grid-cols-3 gap-2 text-center my-2">
            <div class="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <span class="text-[10px] font-bold uppercase text-emerald-700 block">Entradas</span>
                <span class="font-extrabold text-emerald-700 text-xs sm:text-sm">R$ ${totalEntradas.toFixed(2)}</span>
            </div>
            <div class="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <span class="text-[10px] font-bold uppercase text-rose-700 block">Saídas</span>
                <span class="font-extrabold text-rose-700 text-xs sm:text-sm">R$ ${totalSaidas.toFixed(2)}</span>
            </div>
            <div class="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                <span class="text-[10px] font-bold uppercase text-blue-700 block">Saldo Dia</span>
                <span class="font-extrabold text-blue-700 text-xs sm:text-sm">R$ ${saldoDia.toFixed(2)}</span>
            </div>
        </div>

        <div class="space-y-3 pt-2">
            <h5 class="font-bold text-xs uppercase text-slate-500">Recebimentos (${pagamentos.length})</h5>
            ${pagamentos.length === 0 ? '<p class="text-xs text-slate-400">Nenhum recebimento nesta data.</p>' : pagamentos.map(p => {
                const pac = db.pacientes.find(item => item.id === p.pacienteId);
                return `
                    <div class="p-2 bg-slate-50 rounded border text-xs flex justify-between">
                        <span><strong>${pac ? pac.nome : 'Paciente'}</strong> (${p.formaPagamento})</span>
                        <span class="font-bold text-emerald-600">+ R$ ${(Number(p.valor) || 0).toFixed(2)}</span>
                    </div>
                `;
            }).join('')}

            <h5 class="font-bold text-xs uppercase text-slate-500 pt-2 border-t">Saídas / Gastos (${despesas.length})</h5>
            ${despesas.length === 0 ? '<p class="text-xs text-slate-400">Nenhuma saída nesta data.</p>' : despesas.map(g => `
                <div class="p-2 bg-slate-50 rounded border text-xs flex justify-between">
                    <span><strong>${g.descricao}</strong> (${g.categoria || 'Geral'})</span>
                    <span class="font-bold text-rose-600">- R$ ${(Number(g.valor) || 0).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// 10. IMPORTAÇÃO E EXPORTAÇÃO DE BACKUP JSON
function exportarBackup() {
    const dados = JSON.stringify(db, null, 2);
    const blob = new Blob([dados], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_consultorio_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importado = JSON.parse(event.target.result);
            if (importado.pacientes && importado.procedimentos) {
                db.pacientes = importado.pacientes || [];
                db.procedimentos = importado.procedimentos || [];
                db.pagamentos = importado.pagamentos || [];
                db.prontuarios = importado.prontuarios || [];
                db.gastos = importado.gastos || [];

                salvarColecao('pacientes');
                salvarColecao('procedimentos');
                salvarColecao('pagamentos');
                salvarColecao('prontuarios');
                salvarColecao('gastos');

                atualizarTelas();
                exibirModalCustomizado("Backup Restaurado", "Todos os dados foram importados com sucesso!");
            } else {
                exibirModalCustomizado("Erro no Arquivo", "Formato de arquivo de backup inválido.");
            }
        } catch (err) {
            exibirModalCustomizado("Erro de Leitura", "Falha ao ler arquivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 11. UTILITÁRIOS DE MÁSCARA E MODAL CUSTOMIZADO
function mascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 6) {
        input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
        input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else {
        input.value = v;
    }
}

function mascaraCPF(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9) {
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    } else if (v.length > 6) {
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    } else if (v.length > 3) {
        input.value = `${v.slice(0, 3)}.${v.slice(3)}`;
    } else {
        input.value = v;
    }
}

function abrirModal(idModal) {
    const el = document.getElementById(idModal);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function fecharModal(idModal) {
    const el = document.getElementById(idModal);
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

function exibirModalCustomizado(titulo, corpoHTML, botoes = null) {
    document.getElementById('modal-custom-titulo').innerText = titulo;
    document.getElementById('modal-custom-corpo').innerHTML = typeof corpoHTML === 'string' ? `<p class="text-slate-600">${corpoHTML}</p>` : '';
    if (typeof corpoHTML !== 'string') {
        document.getElementById('modal-custom-corpo').appendChild(corpoHTML);
    }

    const containerBotoes = document.getElementById('modal-custom-botoes');
    containerBotoes.innerHTML = '';

    if (!botoes) {
        botoes = [{ texto: "OK", classe: "bg-blue-600 text-white", acao: null }];
    }

    botoes.forEach(btn => {
        const button = document.createElement('button');
        button.className = `px-4 py-2 text-xs font-semibold rounded-lg shadow transition ${btn.classe}`;
        button.innerText = btn.texto;
        button.onclick = () => {
            fecharModal('modal-customizado');
            if (btn.acao) btn.acao();
        };
        containerBotoes.appendChild(button);
    });

    abrirModal('modal-customizado');
}
