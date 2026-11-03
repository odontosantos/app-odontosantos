let db = {
    pacientes: [],
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
        db.prontuarios = JSON.parse(localStorage.getItem('odonto_prontuarios')) || [];
        db.pagamentos = JSON.parse(localStorage.getItem('odonto_pagamentos')) || [];
        db.despesas = JSON.parse(localStorage.getItem('odonto_despesas')) || [];
    } catch (e) {
        console.error("Erro ao carregar dados locais.", e);
    }
}

carregarDadosLocais();

let usuarioAtual = null;
let abaOrigem = 'pacientes';
let subAbaAtualPaciente = 'prontuario';
let pacienteAtualId = null;

function gerarIdUnico() {
    return Date.now().toString() + '-' + Math.floor(Math.random() * 10000);
}

// ==========================================
// SINCRONIZAÇÃO E PERSISTÊNCIA DE SESSÃO
// ==========================================
async function persistirDB() {
    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
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

// ==========================================
// AUTENTICAÇÃO E PERSISTÊNCIA DE SESSÃO (CORRIGIDO)
// ==========================================
async function fazerLoginFirebase(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (!window.usaFirebase || !window.firebaseAuth) {
        alertCustomizado("⚠️ O Firebase ainda está carregando. Aguarde um segundo e tente novamente.");
        return;
    }

    try {
        // Tratamento seguro da persistência
        try {
            if (window.firebase && window.firebase.auth && window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
                await window.firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
            } else if (window.setPersistence && window.browserLocalPersistence) {
                await window.setPersistence(window.firebaseAuth, window.browserLocalPersistence);
            }
        } catch (e) {
            console.warn("Aviso na persistência:", e);
        }

        // Execução do login compatível com SDK Modular ou Compat
        let userCredential;
        if (typeof window.signInWithEmailAndPassword === 'function') {
            userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, senha);
        } else if (window.firebaseAuth && typeof window.firebaseAuth.signInWithEmailAndPassword === 'function') {
            userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, senha);
        } else {
            throw new Error("Método de autenticação não encontrado.");
        }

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
            if (typeof window.onAuthStateChanged === 'function') {
                window.onAuthStateChanged(window.firebaseAuth, async (user) => {
                    if (user) processarUsuarioLogado(user);
                });
            } else if (typeof window.firebaseAuth.onAuthStateChanged === 'function') {
                window.firebaseAuth.onAuthStateChanged(async (user) => {
                    if (user) processarUsuarioLogado(user);
                });
            }
        }
    }, 1000);
});

async function processarUsuarioLogado(user) {
    try {
        let perfilEncontrado = 'secretaria';

        if (window.getDoc && window.doc && window.firebaseDb) {
            const docRef = window.doc(window.firebaseDb, "usuarios", user.email);
            const userDoc = await window.getDoc(docRef);
            if (userDoc.exists()) {
                perfilEncontrado = userDoc.data().perfil || 'secretaria';
            }
        } else if (window.firebaseDb && typeof window.firebaseDb.collection === 'function') {
            const userDoc = await window.firebaseDb.collection("usuarios").doc(user.email).get();
            if (userDoc.exists) {
                perfilEncontrado = userDoc.data().perfil || 'secretaria';
            }
        }

        usuarioAtual = { perfil: perfilEncontrado, email: user.email };
        iniciarSessaoSistema();
    } catch (e) {
        usuarioAtual = { perfil: 'secretaria', email: user.email };
        iniciarSessaoSistema();
    }
}

// ==========================================
// PACIENTES (TELA GERAL APRIMORADA)
// ==========================================
function definirFiltroCategoria(categoria) {
    window._categoriaSelecionada = categoria;
    
    ['todos', 'clinico', 'orto'].forEach(cat => {
        const btn = document.getElementById('tag-filtro-' + cat);
        if (btn) {
            if (cat === categoria) {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition bg-blue-600 text-white shadow-sm flex items-center gap-1.5';
            } else {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5';
            }
        }
    });

    renderizarPacientes();
}

function renderizarPacientes() {
    const container = document.getElementById('lista-pacientes-container');
    if (!container) return;
    
    const termoBusca = (document.getElementById('busca-pacientes-tabela')?.value || '').toLowerCase().trim();
    const opcaoCategoria = window._categoriaSelecionada || 'todos';

    container.innerHTML = '';
    let total = db.pacientes.length, clinicos = 0, orto = 0;

    db.pacientes.forEach(p => {
        p.categoria === 'Ortodontia' ? orto++ : clinicos++;
    });

    const kpiTotal = document.getElementById('kpi-total-pacientes');
    const kpiClinico = document.getElementById('kpi-clinico-pacientes');
    const kpiOrto = document.getElementById('kpi-orto-pacientes');

    if (kpiTotal) kpiTotal.innerText = total;
    if (kpiClinico) kpiClinico.innerText = clinicos;
    if (kpiOrto) kpiOrto.innerText = orto;

    // Filtra os pacientes conforme busca e categoria
    const listaExibicao = db.pacientes.filter(p => {
        const bateuBusca = (p.nome || '').toLowerCase().includes(termoBusca) || 
                           (p.cpf || '').includes(termoBusca) ||
                           (p.telefone || '').includes(termoBusca);
        if (!bateuBusca) return false;
        if (opcaoCategoria === 'clinico' && p.categoria === 'Ortodontia') return false;
        if (opcaoCategoria === 'orto' && p.categoria !== 'Ortodontia') return false;
        return true;
    });

    // ORDENAÇÃO ALFABÉTICA (A-Z)
    listaExibicao.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    if (listaExibicao.length === 0) {
        container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm"><i class="fa-solid fa-users-slash text-4xl mb-3 text-slate-300"></i><p class="font-medium text-sm">Nenhum paciente encontrado.</p></div>';
        return;
    }

    listaExibicao.forEach(p => {
        const badgeClass = p.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200';
        const inicial = (p.nome && p.nome.trim().length > 0) ? p.nome.trim().charAt(0).toUpperCase() : '?';
        const venc = p.categoria === 'Ortodontia' ? (p.vencimento ? p.vencimento.split('-').reverse().join('/') : 'Não definida') : null;
        const nascFmt = p.nascimento ? p.nascimento.split('-').reverse().join('/') : null;
        
        const telefoneLimpo = p.telefone ? p.telefone.replace(/\D/g, '') : '';
        const btnWhatsapp = telefoneLimpo ? `<a href="https://wa.me/55${telefoneLimpo}" target="_blank" class="text-emerald-600 hover:text-emerald-700 font-semibold ml-1.5 inline-flex items-center gap-1 text-xs" title="Conversar no WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i> WhatsApp</a>` : '';

        let htmlPendencia = '';
        if (p.possuiPendenciaManual) {
            htmlPendencia = `<div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
                <span class="truncate">${p.obsFinanceiraManual || 'Pendência financeira'}</span>
            </div>`;
        }

        container.innerHTML += `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between gap-3 hover:shadow-md transition">
            <div class="space-y-3">
                <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div class="flex items-center space-x-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-base shrink-0 border border-blue-100">
                            ${inicial}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-slate-900 text-base leading-tight truncate">${p.nome}</h4>
                            <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
                                ${p.categoria}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="text-xs text-slate-600 space-y-1.5">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-400 font-medium"><i class="fa-solid fa-phone w-4 text-center mr-1"></i> Telefone:</span>
                        <span class="font-semibold text-slate-800">${p.telefone || '-'} ${btnWhatsapp}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-400 font-medium"><i class="fa-solid fa-id-card w-4 text-center mr-1"></i> CPF:</span>
                        <span class="font-semibold text-slate-800">${p.cpf || '-'}</span>
                    </div>
                    ${nascFmt ? `
                    <div class="flex items-center justify-between">
                        <span class="text-slate-400 font-medium"><i class="fa-solid fa-cake-candles w-4 text-center mr-1"></i> Nascimento:</span>
                        <span class="font-semibold text-slate-800">${nascFmt}</span>
                    </div>` : ''}
                    ${venc ? `
                    <div class="flex items-center justify-between">
                        <span class="text-slate-400 font-medium"><i class="fa-solid fa-calendar-day w-4 text-center mr-1"></i> Venc. Mensal:</span>
                        <span class="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">${venc}</span>
                    </div>` : ''}
                </div>

                ${htmlPendencia}
            </div>

            <div class="pt-3 border-t border-slate-100 flex gap-2">
                <button onclick="abrirModalPaciente('${p.id}')" class="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5" title="Editar Dados">
                    <i class="fa-solid fa-pen-to-square"></i> Editar
                </button>
                <button onclick="abrirDetalhesPaciente('${p.id}', 'pacientes')" class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition flex-grow flex justify-center items-center gap-2 shadow-sm">
                    <i class="fa-solid fa-folder-open"></i> Abrir Ficha
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
            db.prontuarios = db.prontuarios.filter(pr => pr.pacienteId !== pacienteId);

            db.pagamentos.forEach(pg => {
                if (pg.pacienteId === pacienteId) {
                    pg.pacienteId = null; 
                    pg.descricao = `[Paciente Excluído: ${paciente.nome}] ` + pg.descricao;
                }
            });

            persistirDB();
            renderizarPacientes();
            alertCustomizado('Paciente excluído com sucesso!');
            voltarParaOrigem();
        }
    };
    mostrarModalPersonalizado("Excluir Paciente", corpo, botoes);
}

async function excluirProntuario(prontuarioId, pacienteId) {
    if (!(await verificarSenhaExclusao())) return;
    db.prontuarios = db.prontuarios.filter(pr => pr.id !== prontuarioId);
    persistirDB();
    abrirDetalhesPaciente(pacienteId, abaOrigem);
}

// ==========================================
// FINANCEIRO & CAIXA (BUSCA E ESTORNO CORRIGIDOS)
// ==========================================
function popularSelectPacientesCaixa() {
    const select = document.getElementById('caixa-financeiro-paciente');
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">-- Selecione o Paciente --</option>';
    db.pacientes.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome} (${p.categoria})</option>`;
    });
    if (valorAtual) select.value = valorAtual;
}

function filtrarPacientesCaixaSelect() {
    const inputFiltro = document.getElementById('filtro-caixa-paciente-busca');
    const select = document.getElementById('caixa-financeiro-paciente');
    if (!inputFiltro || !select) return;

    const termo = inputFiltro.value.toLowerCase().trim();
    select.innerHTML = '<option value="">-- Selecione o Paciente --</option>';
    
    const filtrados = db.pacientes.filter(p => 
        (p.nome || '').toLowerCase().includes(termo) ||
        (p.cpf || '').includes(termo) ||
        (p.telefone || '').includes(termo)
    );

    if (filtrados.length === 0) {
        select.innerHTML = '<option value="">Nenhum paciente encontrado</option>';
        return;
    }

    filtrados.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome} (${p.categoria})</option>`;
    });

    if (filtrados.length === 1) {
        select.selectedIndex = 1;
    }
}

function salvarLancamentoCaixaAbaFinanceiro(event) {
    event.preventDefault();
    const pacienteId = document.getElementById('caixa-financeiro-paciente').value;
    const desc = document.getElementById('caixa-fin-desc').value.trim();
    const valor = parseFloat(document.getElementById('caixa-fin-valor').value) || 0;
    const forma = document.getElementById('caixa-fin-forma').value;
    const obs = document.getElementById('caixa-fin-obs').value.trim();
    const temPendencia = document.getElementById('caixa-fin-marca-pendencia').checked;

    if (!pacienteId) { alertCustomizado('Selecione um paciente.'); return; }
    if (!desc) { alertCustomizado('Informe a descrição ou procedimento.'); return; }

    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (paciente) {
        paciente.possuiPendenciaManual = temPendencia;
        if (obs) paciente.obsFinanceiraManual = obs;
    }

    if (valor > 0) {
        let descFinal = desc;
        if (obs) descFinal += ' (Obs: ' + obs + ')';
        
        db.pagamentos.push({
            id: gerarIdUnico(),
            pacienteId: pacienteId,
            data: obterDataLocalISO(),
            valor: valor,
            forma: forma,
            descricao: descFinal
        });
    }

    persistirDB();
    renderizarFinanceiro();
    alertCustomizado('Lançamento de Caixa registrado com sucesso!');
    
    document.getElementById('caixa-fin-desc').value = '';
    document.getElementById('caixa-fin-valor').value = '';
    document.getElementById('caixa-fin-obs').value = '';
    document.getElementById('caixa-fin-marca-pendencia').checked = false;
}

function estornarPagamento(pagamentoId, pacienteId) {
    const pagamentoOriginal = db.pagamentos.find(pg => pg.id === pagamentoId);
    if (!pagamentoOriginal) return;

    const corpo = `<p class="text-slate-600 mb-2">Digite o motivo do estorno do pagamento (Obrigatório):</p>
                   <input type="text" id="input-motivo-estorno" class="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500" placeholder="Ex: Cobrança indevida, desistência...">`;
    const botoes = `<button onclick="fecharModalPersonalizado()" class="px-3 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancelar</button>
                    <button onclick="confirmarEExecutarEstorno('${pagamentoId}', '${pacienteId}')" class="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold shadow hover:bg-amber-700">Avançar</button>`;
    mostrarModalPersonalizado("Motivo do Estorno", corpo, botoes);
}

function confirmarEExecutarEstorno(pagamentoId, pacienteId) {
    const inputMotivo = document.getElementById('input-motivo-estorno');
    const motivo = inputMotivo ? inputMotivo.value.trim() : '';
    if (!motivo) {
        alertCustomizado("⚠️ O motivo do estorno é obrigatório.");
        return;
    }
    fecharModalPersonalizado();
    executarEstorno(pagamentoId, pacienteId, motivo);
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
    popularSelectPacientesCaixa();

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
// FICHA DO PACIENTE & MODAIS AUXILIARES
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
            
            htmlItens += '<div class="p-3 bg-white rounded-lg border border-slate-100 space-y-1 shadow-sm flex justify-between items-start gap-2">' +
                '<div class="space-y-1 flex-grow">' +
                    '<div class="flex justify-between text-xs text-slate-500"><span>Data: <strong>' + (pr.data ? pr.data.split('-').reverse().join('/') : '-') + '</strong></span></div>' +
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
                    persistirDB();
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

    persistirDB();
    fecharModal('modal-paciente');
    renderizarPacientes();

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

    let htmlItensEtapas = etapas.length === 0 ? '<p class="text-xs text-slate-400 italic p-2">Nenhuma etapa cadastrada no plano de tratamento.</p>' :
        etapas.map((et, index) => {
            const numEtapa = index + 1;
            const statusBg = et.concluido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
            const statusTexto = et.concluido ? 'Concluído' : 'Pendente';
            const estiloTexto = et.concluido ? 'line-through text-slate-400' : 'text-slate-800 font-medium';
            const valorFmt = et.valor ? 'R$ ' + Number(et.valor).toFixed(2) : 'R$ 0,00';

            const btnCheck = usuarioAtual && usuarioAtual.perfil === 'dentista' ? '<button type="button" onclick="alternarStatusEtapa(\'' + paciente.id + '\', \'' + et.id + '\')" class="px-2 py-1 ' + (et.concluido ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white') + ' text-xs font-semibold rounded hover:opacity-90 transition"><i class="fa-solid ' + (et.concluido ? 'fa-rotate-left' : 'fa-check') + '"></i> ' + (et.concluido ? 'Reabrir' : 'Concluir') + '</button>' : '';
            const btnLixo = usuarioAtual && usuarioAtual.perfil === 'dentista' ? '<button type="button" onclick="excluirEtapaPlanejamento(\'' + paciente.id + '\', \'' + et.id + '\')" class="text-slate-400 hover:text-red-600 text-xs p-1" title="Excluir Etapa"><i class="fa-solid fa-trash"></i></button>' : '';

            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-lg border border-indigo-100 text-xs gap-2 shadow-sm">' +
                '<div class="flex items-center space-x-2 flex-grow min-w-0">' +
                    '<span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">#' + numEtapa + '</span>' +
                    '<span class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">' + (et.dente || 'Geral') + '</span>' +
                    '<span class="' + estiloTexto + ' truncate">' + et.procedimento + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between sm:justify-end space-x-2 whitespace-nowrap pt-1 sm:pt-0 border-t sm:border-0 border-slate-100">' +
                    '<span class="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">' + valorFmt + '</span>' +
                    '<span class="px-2 py-0.5 text-[10px] font-bold rounded-full ' + statusBg + '">' + statusTexto + '</span>' + btnCheck + btnLixo +
                '</div></div>';
        }).join('');

    let htmlFormAdicionarEtapa = '';
    if (usuarioAtual && usuarioAtual.perfil === 'dentista') {
        htmlFormAdicionarEtapa = '<form onsubmit="adicionarEtapaPlanejamento(event, \'' + paciente.id + '\')" class="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-indigo-100">' +
            '<div class="sm:col-span-2"><input type="text" id="plan-dente" placeholder="Dente (16)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-5"><input type="text" id="plan-desc" required placeholder="Procedimento (ex: Restauração)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-3"><input type="number" step="0.01" id="plan-valor" placeholder="Valor (R$)" class="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none"></div>' +
            '<div class="sm:col-span-2"><button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow flex items-center justify-center gap-1"><i class="fa-solid fa-plus"></i> Add</button></div></form>';
    }

    let htmlPlanoTratamento = '<div class="space-y-3 bg-indigo-50/20 p-3 rounded-xl border border-indigo-100">' +
        '<div class="flex justify-between items-center text-xs font-bold text-indigo-900"><span>Itens do Plano</span><span>Total: R$ ' + valorTotalPlano.toFixed(2) + '</span></div>' +
        '<div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">' + htmlItensEtapas + '</div>' + htmlFormAdicionarEtapa + '</div>';

    let htmlFormProntuario = '';
    if (usuarioAtual && usuarioAtual.perfil === 'dentista') {
        htmlFormProntuario = '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm mb-4">' +
            '<h4 class="font-bold text-blue-900 text-sm flex items-center gap-2"><i class="fa-solid fa-stethoscope text-blue-600"></i> Registrar Evolução do Prontuário</h4>' +
            '<form onsubmit="salvarProcedimentoDentista(event, \'' + paciente.id + '\')" class="space-y-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Procedimento Realizado *</label><input type="text" id="proc-desc" required placeholder="Ex: Restauração Resina Dente 16" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">O que fazer no Próximo Retorno?</label><input type="text" id="proc-proxima" placeholder="Ex: Moldagem e ajuste de oclusão" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Prontuário</button></form></div>';
    }

    let htmlFormCaixa = '<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 shadow-sm mb-4">' +
        '<h4 class="font-bold text-emerald-900 text-sm flex items-center gap-2"><i class="fa-solid fa-cash-register text-emerald-600"></i> Lançamento & Observação Financeira</h4>' +
        '<form onsubmit="salvarLancamentoCaixaManual(event, \'' + paciente.id + '\')" class="space-y-3">' +
            '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Descrição do Procedimento *</label><input type="text" id="caixa-proc-desc" required placeholder="Ex: Manutenção Orto, Clareamento..." class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Valor do Pagamento (R$)</label><input type="number" step="0.01" id="caixa-valor-pago" placeholder="0.00" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
                '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Forma de Pagamento</label><select id="caixa-forma" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"><option value="Pix">Pix</option><option value="Cartão de Crédito">Cartão de Crédito</option><option value="Cartão de Débito">Cartão de Débito</option><option value="Dinheiro">Dinheiro</option></select></div>' +
            '</div>' +
            '<div><label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Observação (Pendências ou Créditos)</label><input type="text" id="caixa-obs-manual" placeholder="Ex: Acerto combinado, valor pendente, crédito..." value="' + (paciente.obsFinanceiraManual || '') + '" class="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none"></div>' +
            '<div class="flex items-center gap-2 pt-1">' +
                '<input type="checkbox" id="caixa-marca-pendencia" class="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" ' + (paciente.possuiPendenciaManual ? 'checked' : '') + '>' +
                '<label for="caixa-marca-pendencia" class="text-xs font-semibold text-slate-700 cursor-pointer">Marcar paciente com pendência/débito financeiro</label>' +
            '</div>' +
            '<button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow transition">Salvar Lançamento</button></form></div>';

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
                '<button onclick="alternarAccordion(\'' + accId + '\')" class="w-full px-4 py-3 text-left font-bold text-slate-800 flex justify-between items-center hover:bg-slate-100 transition text-sm"><span><i class="fa-solid fa-receipt mr-2 text-emerald-600"></i>' + mesAno + ' (' + gruposPg[mesAno].length + ' pagamentos)</span><i class="fa-solid fa-chevron-down text-xs text-slate-400"></i></button>' +
                '<div id="' + accId + '" class="' + (estaAberto ? '' : 'hidden') + ' p-3 space-y-2 border-t border-slate-200">' + htmlItensPg + '</div></div>';
            idxPg++;
        });
    }

    container.innerHTML = '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">' +
        '<div class="lg:col-span-1 space-y-4">' +
            '<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">' +
                '<div class="flex items-center space-x-3 border-b pb-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-base">' + paciente.nome.charAt(0) + '</div><div><h3 class="font-bold text-slate-900 text-base leading-tight">' + paciente.nome + '</h3><span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ' + (paciente.categoria === 'Ortodontia' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700') + ' mt-0.5">' + paciente.categoria + '</span></div></div>' +
                '<div class="space-y-1.5 text-xs">' +
                    '<div><span class="font-semibold text-slate-400">Telefone:</span> <span class="font-medium text-slate-800">' + (paciente.telefone || '-') + '</span>' + btnWhatsapp + '</div>' +
                    '<div><span class="font-semibold text-slate-400">CPF:</span> <span class="font-medium text-slate-800">' + (paciente.cpf || '-') + '</span></div>' +
                    '<div><span class="font-semibold text-slate-400">Nascimento:</span> <span class="font-medium text-slate-800">' + (paciente.nascimento ? paciente.nascimento.split('-').reverse().join('/') : '-') + '</span></div>' +
                    (paciente.categoria === 'Ortodontia' ? '<div><span class="font-semibold text-slate-400">Vencimento:</span> <span class="font-medium text-slate-800">' + (paciente.vencimento ? paciente.vencimento.split('-').reverse().join('/') : 'Não definida') + '</span></div>' : '') +
                '</div>' + badgePendencia +
                '<div class="pt-2 border-t flex gap-2">' +
                    '<button onclick="abrirModalPaciente(\'' + paciente.id + '\')" class="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"><i class="fa-solid fa-user-pen"></i> Editar</button>' +
                    '<button onclick="excluirPaciente(\'' + paciente.id + '\')" class="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"><i class="fa-solid fa-user-xmark"></i> Excluir</button>' +
                '</div></div></div>' +
        '<div class="lg:col-span-2 space-y-4">' +
            '<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">' +
                '<div class="border-b border-slate-200 flex space-x-4 text-xs sm:text-sm font-semibold overflow-x-auto scrollbar-none">' +
                    '<button onclick="abrirSubAbaPaciente(\'prontuario\')" id="btn-subtab-prontuario" class="subtab-btn pb-2 border-b-2 border-blue-600 text-blue-600 flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-notes-medical"></i> Prontuário</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'plano\')" id="btn-subtab-plano" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-clipboard-list"></i> Plano de Tratamento</button>' +
                    '<button onclick="abrirSubAbaPaciente(\'caixa\')" id="btn-subtab-caixa" class="subtab-btn pb-2 border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-cash-register"></i> Caixa & Pagamentos</button>' +
                '</div>' +
                '<div id="subtab-content-prontuario" class="subtab-content space-y-4">' +
                    htmlFormProntuario +
                    '<input type="text" id="busca-prontuario-input" oninput="filtrarProntuarioLinhaTempo(\'' + paciente.id + '\')" placeholder="🔍 Pesquisar no histórico..." class="w-full px-3 py-2 border rounded-lg text-xs sm:text-sm bg-slate-50">' +
                    '<div id="container-prontuario-timeline" class="space-y-3 max-h-[50vh] overflow-y-auto pr-1"></div>' +
                '</div>' +
                '<div id="subtab-content-plano" class="subtab-content hidden space-y-3">' + htmlPlanoTratamento + '</div>' +
                '<div id="subtab-content-caixa" class="subtab-content hidden space-y-3 max-h-[60vh] overflow-y-auto pr-1">' + htmlFormCaixa + '<div class="space-y-2">' + htmlPagamentosTimeline + '</div></div>' +
            '</div></div></div>';

    mudarAba('detalhes-paciente');
    renderizarLinhaTempoProntuario(document.getElementById('container-prontuario-timeline'), prontuariosPaciente, paciente.id);
    abrirSubAbaPaciente(subAbaAtualPaciente);
}

// ==========================================
// SINCRONIZAÇÃO EM TEMPO REAL CORRIGIDA
// ==========================================
function ativarSincronizacaoEmTempoReal() {
    if (window.usaFirebase && window.firebaseDb) {
        const onSnapshotFunc = window.onSnapshot || (window.firebase && window.firebase.firestore && window.firebase.firestore.onSnapshot);
        const docFunc = window.doc || (window.firebase && window.firebase.firestore && window.firebase.firestore.doc);

        if (onSnapshotFunc && docFunc) {
            const docRef = docFunc(window.firebaseDb, "clinica", "dados_compartilhados");
            
            onSnapshotFunc(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const dadosNuvem = docSnap.data();
                    db = Object.assign(db, dadosNuvem);
                    
                    localStorage.setItem('odonto_pacientes', JSON.stringify(db.pacientes));
                    localStorage.setItem('odonto_prontuarios', JSON.stringify(db.prontuarios));
                    localStorage.setItem('odonto_pagamentos', JSON.stringify(db.pagamentos));
                    localStorage.setItem('odonto_despesas', JSON.stringify(db.despesas));

                    if (!document.getElementById('tab-pacientes').classList.contains('hidden')) {
                        renderizarPacientes();
                    } else if (!document.getElementById('tab-financeiro').classList.contains('hidden')) {
                        renderizarFinanceiro();
                    }
                }
            });
        }
    }
}
