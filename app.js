async function gerarPdfPlanoTratamento(pacienteId) {
    const paciente = db.pacientes.find(p => p.id === pacienteId);
    if (!paciente) {
        alertCustomizado("❌ Paciente não encontrado.");
        return;
    }

    const etapas = Array.isArray(paciente.planejamentoEtapas) ? paciente.planejamentoEtapas : [];
    if (etapas.length === 0) {
        alertCustomizado("⚠️ Este paciente ainda não possui etapas cadastradas no plano de tratamento.");
        return;
    }

    const totalPlano = etapas.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

    // 1. Elemento fixado no canto superior esquerdo (left: 0) sem flexbox
    const elTemp = document.createElement('div');
    elTemp.style.position = 'absolute';
    elTemp.style.top = '0';
    elTemp.style.left = '0';
    elTemp.style.width = '750px';
    elTemp.style.backgroundColor = '#ffffff';
    elTemp.style.padding = '30px';
    elTemp.style.fontFamily = 'Arial, sans-serif';
    elTemp.style.color = '#334155';
    elTemp.style.boxSizing = 'border-box';
    elTemp.style.zIndex = '99999';

    const linhasTabela = etapas.map((et, index) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 6px; font-weight: bold; text-align: center; color: #4f46e5; vertical-align: middle;">#${index + 1}</td>
            <td style="padding: 10px 6px; text-align: center; font-weight: bold; vertical-align: middle; word-break: break-word;">${et.dente || 'Geral'}</td>
            <td style="padding: 10px 6px; text-align: left; vertical-align: middle; word-break: break-word;">${et.procedimento}</td>
            <td style="padding: 10px 6px; text-align: right; font-weight: bold; vertical-align: middle; white-space: nowrap;">R$ ${Number(et.valor || 0).toFixed(2)}</td>
            <td style="padding: 10px 6px; text-align: center; vertical-align: middle;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; ${et.concluido ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fef3c7; color: #92400e;'}">
                    ${et.concluido ? 'Concluído' : 'Pendente'}
                </span>
            </td>
        </tr>
    `).join('');

    elTemp.innerHTML = `
        <div style="display: block; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px;">
            <table style="width: 100%; table-layout: fixed; border-collapse: collapse;">
                <tr>
                    <td style="width: 70%; text-align: left; vertical-align: top;">
                        <h1 style="margin: 0; font-size: 20px; color: #1e293b; font-weight: bold;">Plano de Tratamento Odontológico</h1>
                        <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">Dr. Mikeias Santos - Cirurgião Dentista & Ortodontista</p>
                        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">R. Assis Dória, 61 Centro - Marituba | Tel: (91) 98219-9272 / 98490-3292</p>
                    </td>
                    <td style="width: 30%; text-align: right; vertical-align: top; font-size: 10px; color: #64748b;">
                        <p style="margin: 0;"><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    </td>
                </tr>
            </table>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 12px; line-height: 1.5;">
            <p style="margin: 0 0 4px 0;"><strong>Paciente:</strong> ${paciente.nome}</p>
            <p style="margin: 0 0 4px 0;"><strong>Telefone:</strong> ${paciente.telefone || '-'}</p>
            <p style="margin: 0;"><strong>Categoria:</strong> ${paciente.categoria}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; margin-bottom: 16px;">
            <thead>
                <tr style="background-color: #4f46e5; color: white;">
                    <th style="width: 10%; padding: 8px 4px; text-align: center;">Etapa</th>
                    <th style="width: 18%; padding: 8px 4px; text-align: center;">Dente/Região</th>
                    <th style="width: 42%; padding: 8px 4px; text-align: left;">Procedimento</th>
                    <th style="width: 15%; padding: 8px 4px; text-align: right;">Valor</th>
                    <th style="width: 15%; padding: 8px 4px; text-align: center;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${linhasTabela}
            </tbody>
        </table>

        <div style="text-align: right; font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 16px; padding-top: 8px; border-top: 2px solid #e2e8f0;">
            Valor Total Previsto: R$ ${totalPlano.toFixed(2)}
        </div>
    `;

    document.body.appendChild(elTemp);

    // Pausa técnica para renderização no navegador
    await new Promise(resolve => setTimeout(resolve, 300));

    const opcoes = {
        margin: [10, 10, 10, 10],
        filename: `Plano_Tratamento_${paciente.nome.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            width: 750,
            windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opcoes).from(elTemp).save();
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        alertCustomizado("❌ Erro ao gerar o PDF. Tente novamente.");
    } finally {
        if (document.body.contains(elTemp)) {
            document.body.removeChild(elTemp);
        }
    }
}
