// ==========================================================
// VARIÁVEIS GLOBAIS DE CONTROLE DE EDIÇÃO
// ==========================================================
let currentEditId = null; // Para Terapeutas
let currentEditExpenseId = null; // Para Módulo Financeiro (Despesas)
let currentEditTreatmentId = null; // Para Tipos de Tratamento/Serviços
let currentEditRoomId = null; // Para Salas
let currentEditClientId = null; // Para Clientes/Pacientes
let currentEditAppointmentId = null; // Para Agendamentos
let currentEditPacoteId = null; // Para Pacotes de Sessões
let currentSchedulingPacoteId = null; // Para o modal de Grade de Pacotes

// ==========================================================
// FUNÇÕES DE UTILIDADE (LOAD/SAVE DATA E FORMATOS)
// ==========================================================

// ... (Após a função getNextId)

/**
 * Verifica o localStorage para submissões públicas e as salva no DB.
 */
async function processPublicSubmissions() {
    const pendingSubmission = localStorage.getItem('PublicAnamneseSubmission');
    
    if (pendingSubmission) {
        const formData = JSON.parse(pendingSubmission);
        const data = await loadData();
        
        // Prepara os dados no formato do cliente
        let clienteToSave = {
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email,
            anamnese: {
                queixaPrincipal: formData.queixaPrincipal,
                condicoesCronicas: formData.condicoesCronicas,
                gravidez: formData.gravidez,
                cirurgias: formData.cirurgias,
                medicamentosUso: formData.medicamentosUso,
                alergias: formData.alergias,
                observacoesAnamnese: formData.observacoesAnamnese,
                dataPreenchimento: new Date().toISOString().split('T')[0]
            }
        };

        let clienteIndex = data.clientes.findIndex(c => c.email.toLowerCase() === clienteToSave.email.toLowerCase());
        
        if (clienteIndex !== -1) {
            // Cliente Existe: Atualiza a anamnese
            Object.assign(data.clientes[clienteIndex], clienteToSave);
            console.log(`[SYSTEM ALERT] Anamnese atualizada para ${clienteToSave.nome}.`);
        } else {
            // Cliente NOVO: Cria novo registro
            clienteToSave.id = getNextId(data.clientes);
            data.clientes.push(clienteToSave);
            console.log(`[SYSTEM ALERT] Novo Cliente e Anamnese cadastrados: ${clienteToSave.nome}.`);
        }

        saveData(data);
        localStorage.removeItem('PublicAnamneseSubmission'); // Limpa a chave após o salvamento
        
        // Opcional: Alerta o administrador sobre a nova submissão
        alert(`[NOVA FICHA ONBOARDING] Um novo cliente (${clienteToSave.nome}) preencheu a ficha de Anamnese!`);
    }
}

// ... (No bloco DOMContentLoaded do script.js)

// Chame a função antes de carregar o Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // ... (Bloco de login) ...
    
    if (window.location.pathname.endsWith('admin.html')) {
        if (!checkAuthentication()) return; 

        // CRÍTICO: PROCESSA SUBMISSÕES PÚBLICAS ANTES DE CARREGAR QUALQUER DADO
        processPublicSubmissions(); 
        
        loadConfiguracaoEmpresaInitial();
        setupNavigation();
        // ... (restante dos listeners) ...
    }
});

function saveData(data) {
    localStorage.setItem('clinicData', JSON.stringify(data));
}

/**
 * Função Auxiliar: Gera o próximo ID sequencial baseado no array.
 * @param {Array<Object>} array - O array de objetos com propriedade 'id'.
 * @returns {number} O próximo ID disponível.
 */
function getNextId(array) {
    if (!array || array.length === 0) return 1;
    // Garante que todos os IDs são tratados como números antes de encontrar o máximo
    const maxId = Math.max(...array.map(item => parseInt(item.id) || 0));
    return maxId + 1;
}

/**
 * Verifica se os dados necessários para módulos avançados existem.
 */
async function checkModuleReadiness() {
    const data = await loadData();
    
    return {
        hasTerapeutas: data.terapeutas && data.terapeutas.length > 0,
        hasClientes: data.clientes && data.clientes.length > 0,
        hasTratamentos: data.tiposTratamento && data.tiposTratamento.length > 0,
        hasSalas: data.salasAmbientes && data.salasAmbientes.length > 0
    };
}

async function loadData() {
    const localData = localStorage.getItem('clinicData');
    if (localData) {
        return JSON.parse(localData);
    }
    
    // Caminho para o servidor local (padrão)
    // NOTE: Presumi que o caminho correto é db.json no root, pois você não forneceu a estrutura de pastas
    const response = await fetch('db.json'); 
    if (!response.ok) {
        // Tentativa de caminho alternativo se a primeira falhar
        const altResponse = await fetch('assets/data/db.json');
        if (altResponse.ok) {
            const initialData = await altResponse.json();
            saveData(initialData);
            return initialData;
        }
        throw new Error('Falha ao carregar dados iniciais do db.json. Verifique o caminho.');
    }
    const initialData = await response.json();
    
    saveData(initialData);
    return initialData;
}

function formatCurrency(value) {
    if (typeof value !== 'number') return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function populateSelectOptions(selectId, items, valueKey, textKey) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>-- Selecione --</option>';

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
}

// ----------------------------------------------------------
// NOVA FUNÇÃO: IMPRESSÃO DE RELATÓRIOS (REUTILIZÁVEL)
// ----------------------------------------------------------

async function printReport(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) {
        alert('Tabela de dados não encontrada.');
        return;
    }
    
    const data = await loadData();
    const config = data.configuracaoEmpresa || { nome: 'Clínica Administrativa', logoBase64: '' }; 

    // Ajusta para usar logoBase64
    const logoHtml = config.logoBase64 
        ? `<img src="${config.logoBase64}" style="height: 60px; margin-right: 20px;">` 
        : '';
    const nomeEmpresa = config.nome || 'Clínica Administrativa';

    // Conteúdo base da tabela (excluindo a coluna 'Ações' para a impressão)
    const tableClone = table.cloneNode(true);
    tableClone.querySelectorAll('thead th:last-child, tbody td:last-child').forEach(el => el.remove());
    
    const tableHtml = tableClone.outerHTML;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; }
                header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #004c9e; }
                .logo-container { display: flex; align-items: center; }
                h1 { color: #004c9e; font-size: 1.8em; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f2f2f2; color: #333; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    ${logoHtml}
                    <h1>${nomeEmpresa}</h1>
                </div>
                <p style="font-size: 1.2em; font-weight: bold; color: #333;">${title}</p>
            </header>
            ${tableHtml}
            <p style="margin-top: 30px; font-size: 0.8em;">Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


// ==========================================================
// FUNÇÕES DE LOGIN E SEGURANÇA
// ==========================================================

async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;
    const messageElement = document.getElementById('login-message');
    messageElement.style.display = 'none';

    try {
        const data = await loadData(); 
        let user = null;

        if (usernameInput === data.adminUser.username && passwordInput === data.adminUser.password) {
            user = { name: "CEO", email: data.adminUser.username, isAdmin: true, id: 0 };
        }
        
        if (!user) {
            user = data.terapeutas.find(t => t.email === usernameInput && t.senha === passwordInput);
            if (user) {
                user.name = user.nome; 
                user.isAdmin = false;
                user.terapeutaId = user.id;
            }
        }

        if (user) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('loggedInUser', user.email);
            localStorage.setItem('isUserAdmin', user.isAdmin ? 'true' : 'false');
            localStorage.setItem('loggedInUserName', user.name);
            localStorage.setItem('loggedInTerapeutaId', user.terapeutaId || 0);
            
            window.location.href = 'admin.html'; // Redireciona ambos para admin.html (com menu filtrado)
        
        } else {
            messageElement.textContent = 'Usuário (e-mail) ou senha incorretos.';
            messageElement.style.display = 'block';
        }

    } catch (error) {
        console.error('Erro no processo de login:', error);
        messageElement.textContent = 'Erro de conexão. Tente novamente mais tarde.';
        messageElement.style.display = 'block';
    }
}

async function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const path = window.location.pathname;

    if (isAuthenticated !== 'true') {
        if (path.endsWith('admin.html')) {
            alert('Acesso negado! Você precisa fazer login.');
            window.location.href = 'login.html'; 
            return false;
        }
        return false;
    }
    
    // Configuração do Cabeçalho
    const loggedInUser = localStorage.getItem('loggedInUserName');
    const header = document.querySelector('header p');
    if (header) {
         header.textContent = `Bem-vindo(a), ${loggedInUser}. Controle de Clientes e Agenda.`;
    }
    
    // Carregar configurações visuais (Logo e Cor) no carregamento
    await loadConfiguracaoEmpresaInitial(); 
    
    return true;
}

// Função simplificada para carregar logo e cor no login
async function loadConfiguracaoEmpresaInitial() {
    try {
        const data = await loadData();
        const config = data.configuracaoEmpresa || {}; 
        
        // Aplica o nome da clínica
        const titleElement = document.querySelector('header h1');
        if (titleElement) {
             titleElement.textContent = config.nome || 'Central Administrativa';
        }
        
        // Aplica logo e cor
        const logoElement = document.getElementById('header-logo');
        if (logoElement && config.logoBase64) {
            logoElement.src = config.logoBase64;
            logoElement.style.display = 'block';
        }
        
        applyHeaderColor(config.headerColor);

    } catch (e) {
        console.warn('Configurações da empresa não puderam ser carregadas no header inicial.', e);
    }
}


function handleLogout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isUserAdmin');
    localStorage.removeItem('loggedInUserName');
    localStorage.removeItem('loggedInTerapeutaId');
    
    window.location.href = 'login.html';
}


// ==========================================================
// FUNÇÕES MÓDULO DASHBOARD 
// ==========================================================

async function loadDashboard() {
    const upcomingListBody = document.querySelector('#upcoming-list tbody');
    if (!upcomingListBody) return;

    upcomingListBody.innerHTML = '<tr><td colspan="5" style="padding: 15px;">Carregando agendamentos...</td></tr>';
    
    try {
        const data = await loadData();
        
        // --- PROTEÇÃO CRÍTICA ---
        const clientes = data.clientes || [];
        const agendamentos = data.agendamentos || [];
        const despesas = data.despesas || [];
        const terapeutas = data.terapeutas || [];
        const tiposTratamento = data.tiposTratamento || [];

        // --- 1. KPI: Clientes Ativos ---
        const kpiClientes = document.getElementById('kpi-clientes');
        if (kpiClientes) kpiClientes.textContent = clientes.length;

        // --- 2. KPI: Próximas Sessões ---
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        
        const upcoming = agendamentos.filter(a => {
            const appointmentDate = new Date(`${a.data}T${a.hora}:00`);
            return appointmentDate >= new Date() && appointmentDate <= tomorrow && a.status !== 'Cancelado';
        });

        const kpiProximas = document.getElementById('kpi-proximas');
        if (kpiProximas) kpiProximas.textContent = upcoming.length;
        
        // --- 3. KPI: Saldo Financeiro do Mês ---
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        // Calcula o preço por sessão de cada tratamento
        const precoPorTratamento = tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: parseFloat(t.preco) }), {});

        // Calcula o valor por sessão de cada pacote
        const valorPorSessaoPacote = data.pacotes.reduce((map, p) => ({ 
            ...map, 
            [p.id]: parseFloat(p.valorTotal) / parseInt(p.totalSessoes)
        }), {});


        const receitasMes = agendamentos
            .filter(a => a.status === 'Realizado' && a.data.substring(0, 7) === currentMonth)
            .reduce((sum, a) => {
                if (a.pacoteId && a.pacoteId !== 0) {
                    // Receita de Pacote: Usa o valor da sessão do pacote
                    return sum + (valorPorSessaoPacote[a.pacoteId] || 0); 
                }
                // Receita Avulsa: Usa o preço do tratamento
                return sum + (precoPorTratamento[a.tratamentoId] || 0);
            }, 0);

        const despesasMes = despesas
            .filter(d => d.data.substring(0, 7) === currentMonth)
            .reduce((sum, d) => sum + parseFloat(d.valor), 0);
            
        const saldoMes = receitasMes - despesasMes;
        
        const kpiSaldo = document.getElementById('kpi-saldo');
        if (kpiSaldo) {
            kpiSaldo.textContent = formatCurrency(saldoMes);
            kpiSaldo.style.color = saldoMes >= 0 ? 'var(--color-secondary)' : 'var(--color-danger)';
        }
        
        // --- 4. Lista de Próximos 5 Agendamentos (Renderização) ---
        
        // Mapeamentos de Nomes (garantido pela Optional Chaining)
        const clienteMap = clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});
        const terapeutaMap = terapeutas.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
        const tratamentoMap = tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});

        const futureAppointments = agendamentos
            .map(a => ({ ...a, dateTime: new Date(`${a.data}T${a.hora}:00`) }))
            .filter(a => a.dateTime >= now && a.status !== 'Cancelado')
            .sort((a, b) => a.dateTime - b.dateTime)
            .slice(0, 5); 

        upcomingListBody.innerHTML = ''; // Limpa o "Carregando"

        if (futureAppointments.length === 0) {
            upcomingListBody.innerHTML = '<tr><td colspan="5" style="padding: 15px; font-style: italic;">Nenhum agendamento futuro encontrado.</td></tr>';
            return;
        }

        // Renderiza a lista
        futureAppointments.forEach(a => {
            const row = upcomingListBody.insertRow();
            
            row.insertCell().textContent = `${a.data.split('-').reverse().join('/')} às ${a.hora}`;
            row.insertCell().textContent = clienteMap[a.clienteId] || 'N/A'; 
            row.insertCell().textContent = tratamentoMap[a.tratamentoId] || 'N/A';
            row.insertCell().textContent = terapeutaMap[a.terapeutaId] || 'N/A';
            
            const statusCell = row.insertCell();
            statusCell.textContent = a.status;
            statusCell.style.fontWeight = 'bold';
            if (a.status === 'Confirmado') statusCell.style.color = 'var(--color-secondary)';
            else if (a.status === 'Agendado') statusCell.style.color = 'var(--color-primary)';
            else if (a.status === 'Realizado') statusCell.style.color = '#718096'; 
        });

    } catch (error) {
        console.error('Erro irrecuperável no Dashboard:', error);
        upcomingListBody.innerHTML = '<tr><td colspan="5" style="color: red; padding: 15px;">Erro ao carregar lista. Por favor, verifique se os dados iniciais foram cadastrados corretamente.</td></tr>';
    }
}


// ==========================================================
// FUNÇÕES MÓDULO TERAPEUTAS (CRUD)
// ==========================================================

// ... (Dentro do bloco de FUNÇÕES MÓDULO PACOTES)

/**
 * Cria o relatório detalhado de pacotes (datas, status e sessões).
 */
// ... (Dentro do bloco de FUNÇÕES MÓDULO PACOTES)

/**
 * Cria o relatório detalhado de pacotes, filtrando por clienteId, se fornecido.
 * @param {number} [targetClienteId=0] - O ID do cliente para filtrar. Se 0, imprime todos.
 */
async function printPacoteDetalhadoReport(targetClienteId = 0) {
    const data = await loadData();
    
    // Filtra o array de pacotes
    let pacotes = data.pacotes || [];
    let clienteNome = '';

    if (targetClienteId !== 0) {
        pacotes = pacotes.filter(p => p.clienteId === targetClienteId);
        const cliente = data.clientes.find(c => c.id === targetClienteId);
        clienteNome = cliente ? cliente.nome : 'Cliente Não Encontrado';
    }
    
    const tituloRelatorio = targetClienteId !== 0 
        ? `RELATÓRIO DE PACOTES - ${clienteNome}` 
        : `RELATÓRIO DE ACOMPANHAMENTO DE PACOTES (Geral)`;

    // Mapeamentos de Nomes
    const clienteMap = data.clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});
    const terapeutaMap = data.terapeutas.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
    const tratamentoMap = data.tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
    
    const config = data.configuracaoEmpresa || { nome: 'Clínica Administrativa', logoBase64: '' };
    
    const nomeEmpresa = config.nome || 'Clínica Administrativa';
    const logoHtml = config.logoBase64 
        ? `<img src="${config.logoBase64}" style="height: 60px; margin-right: 20px;">` 
        : '';
        
    let reportContentHtml = '';

    if (pacotes.length === 0) {
        reportContentHtml = `<p>Nenhum pacote de sessões encontrado para gerar o relatório (${targetClienteId !== 0 ? 'apenas para este cliente' : 'no sistema'}).</p>`;
    } else {
        pacotes.forEach(p => {
            const agendamentosPacote = data.agendamentos
                .filter(ag => ag.pacoteId === p.id)
                .sort((a, b) => new Date(a.data) - new Date(b.data));

            const realizadas = agendamentosPacote.filter(ag => ag.status === 'Realizado').length;
            const restantes = p.totalSessoes - realizadas;
            const nomeCliente = clienteMap[p.clienteId] || 'Cliente Removido';
            
            reportContentHtml += `
                <div style="margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h3 style="color: #1a4369; border-bottom: 2px solid #34d399; padding-bottom: 5px;">
                        Pacote ID ${p.id}: ${p.nomePacote}
                    </h3>
                    <p style="margin: 5px 0;"><strong>Paciente:</strong> ${nomeCliente}</p>
                    <p style="margin: 5px 0;"><strong>Valor Total:</strong> R$ ${parseFloat(p.valorTotal).toFixed(2).replace('.', ',')}</p>
                    <p style="margin: 5px 0; font-weight: 700;">
                        Sessões Totais: ${p.totalSessoes} | Realizadas: ${realizadas} | Restantes: ${restantes}
                    </p>
                    
                    <h4 style="margin-top: 15px; margin-bottom: 10px; font-size: 1.1em; color: #1f2937;">Grade de Agendamentos:</h4>
                    
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="background-color: #f0f4f8;">
                                <th style="padding: 8px; border: 1px solid #ccc;">#</th>
                                <th style="padding: 8px; border: 1px solid #ccc;">Data/Hora</th>
                                <th style="padding: 8px; border: 1px solid #ccc;">Serviço</th>
                                <th style="padding: 8px; border: 1px solid #ccc;">Terapeuta</th>
                                <th style="padding: 8px; border: 1px solid #ccc;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            if (agendamentosPacote.length > 0) {
                agendamentosPacote.forEach((ag, index) => {
                    const terapeuta = terapeutaMap[ag.terapeutaId] || 'N/A';
                    const tratamento = tratamentoMap[ag.tratamentoId] || 'N/A';
                    
                    reportContentHtml += `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                            <td style="padding: 8px; border: 1px solid #ccc;">${ag.data} às ${ag.hora}</td>
                            <td style="padding: 8px; border: 1px solid #ccc;">${tratamento}</td>
                            <td style="padding: 8px; border: 1px solid #ccc;">${terapeuta}</td>
                            <td style="padding: 8px; border: 1px solid #ccc; font-weight: 600;">${ag.status}</td>
                        </tr>
                    `;
                });
            } else {
                reportContentHtml += `<tr><td colspan="5" style="padding: 8px; border: 1px solid #ccc; font-style: italic;">Nenhum agendamento vinculado ainda.</td></tr>`;
            }

            reportContentHtml += `</tbody></table></div>`;
        });
    }

    // HTML completo para impressão
    const printWindow = window.open('', '', 'height=800,width=900');
    printWindow.document.write(`
        <html>
        <head>
            <title>${tituloRelatorio}</title>
            <style>
                body { font-family: 'Inter', sans-serif; padding: 40px; color: #2d3748; }
                header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px solid #1a4369; }
                .logo-container { display: flex; align-items: center; }
                h1 { color: #1a4369; font-size: 2em; margin: 0; }
                table { border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                th { background-color: #f0f0f0; }
            </style>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    ${logoHtml}
                    <h1>${nomeEmpresa}</h1>
                </div>
                <p style="font-size: 1.2em; font-weight: bold; color: #1a4369;">${tituloRelatorio}</p>
            </header>
            ${reportContentHtml}
            <p style="margin-top: 50px; font-size: 0.8em; text-align: center;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Clínica de Terapias Complementares.</p>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


function prepareFormForEdit(isEditing) {
    const formTitle = document.querySelector('#add-terapeuta-form-container h3');
    const submitButton = document.querySelector('#add-terapeuta-form button[type="submit"]');
    
    if (isEditing) {
        formTitle.textContent = 'Editar Terapeuta Existente';
        submitButton.textContent = 'Salvar Alterações';
    } else {
        formTitle.textContent = 'Cadastro de Novo Terapeuta';
        submitButton.textContent = 'Salvar Terapeuta';
        document.getElementById('add-terapeuta-form').reset();
    }
}

async function handleEditTerapeuta(terapeutaId) {
    const data = await loadData();
    const terapeuta = data.terapeutas.find(t => t.id === terapeutaId);

    if (!terapeuta) return;

    currentEditId = terapeutaId; 
    document.getElementById('nome-terapeuta').value = terapeuta.nome;
    document.getElementById('especialidade-terapeuta').value = terapeuta.especialidade;
    document.getElementById('email-terapeuta').value = terapeuta.email;

    prepareFormForEdit(true);
    document.getElementById('add-terapeuta-form-container').style.display = 'block';
}

/**
 * Lida com o envio do formulário de Terapeuta (Cadastro ou Edição).
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const data = await loadData();
    // CRÍTICO: CORRIGIDO os IDs dos inputs
    const nome = document.getElementById('nome-terapeuta').value;
    const especialidade = document.getElementById('especialidade-terapeuta').value;
    const email = document.getElementById('email-terapeuta').value;
    
    // Adicione um elemento de mensagem no seu admin.html (dentro do form) com ID 'terapeuta-message'
    const formContainer = document.getElementById('add-terapeuta-form-container');
    const messageElement = formContainer.querySelector('p#terapeuta-message'); 

    let isEditing = currentEditId !== null;
    let terapeutaIndex = -1;

    // --- 1. Validação de E-mail Único ---
    const emailExists = data.terapeutas.some(t => {
        return t.email === email && (!isEditing || t.id !== currentEditId);
    });

    if (emailExists) {
        if (messageElement) {
            messageElement.style.color = 'var(--color-danger)';
            messageElement.textContent = 'Este e-mail já está em uso por outro Terapeuta.';
        } else {
             alert('Este e-mail já está em uso por outro Terapeuta.');
        }
        return;
    }
    
    if (isEditing) {
        // --- 2. Lógica de EDIÇÃO ---
        terapeutaIndex = data.terapeutas.findIndex(t => t.id === currentEditId);
        
        if (terapeutaIndex !== -1) {
            data.terapeutas[terapeutaIndex].nome = nome;
            data.terapeutas[terapeutaIndex].especialidade = especialidade;
            data.terapeutas[terapeutaIndex].email = email;
            
            currentEditId = null; // Finaliza o modo de edição
        }
    } else {
        // --- 3. Lógica de CRIAÇÃO (Novo Terapeuta) ---
        const novoTerapeuta = {
            id: getNextId(data.terapeutas), 
            nome: nome,
            especialidade: especialidade,
            email: email,
            senha: "123456" // Senha Padrão
        };
        data.terapeutas.push(novoTerapeuta);
    }

    saveData(data); 

    // Oculta o formulário e recarrega a lista
    document.getElementById('add-terapeuta-form-container').style.display = 'none';
    prepareFormForEdit(false); 
    loadTerapeutas();
    
    if (messageElement) {
        messageElement.style.color = 'var(--color-secondary)';
        messageElement.textContent = `Terapeuta ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso! ${!isEditing ? 'A senha inicial é **123456**.' : ''}`;
        setTimeout(() => messageElement.textContent = '', 5000); 
    }
}

async function handleDeleteTerapeuta(idToDelete) {
    if (!confirm(`Tem certeza que deseja excluir o Terapeuta ID ${idToDelete}? Esta ação é irreversível.`)) {
        return;
    }
    try {
        const data = await loadData();
        const updatedTerapeutas = data.terapeutas.filter(t => t.id !== idToDelete);

        data.terapeutas = updatedTerapeutas;

        saveData(data);
        loadTerapeutas(); 
    } catch (error) {
        console.error('Erro ao excluir terapeuta:', error);
        alert('Ocorreu um erro ao tentar excluir o terapeuta.');
    }
}

async function loadTerapeutas() {
    const tbody = document.querySelector('#terapeutas-list tbody');
    tbody.innerHTML = '<tr><td colspan="5">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const terapeutas = data.terapeutas;
        tbody.innerHTML = ''; 

        if (terapeutas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum terapeuta cadastrado ainda.</td></tr>';
            return;
        }

        terapeutas.forEach(tera => {
            const row = tbody.insertRow();
            row.insertCell().textContent = tera.id;
            row.insertCell().textContent = tera.nome;
            row.insertCell().textContent = tera.especialidade;
            row.insertCell().textContent = tera.email;
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${tera.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${tera.id}">Excluir</button>
            `;
            
            const deleteButton = actionsCell.querySelector('.delete-btn');
            deleteButton.addEventListener('click', () => {
                const terapeutaId = parseInt(deleteButton.getAttribute('data-id'));
                handleDeleteTerapeuta(terapeutaId);
            });

            const editButton = actionsCell.querySelector('.edit-btn');
            editButton.addEventListener('click', () => {
                const terapeutaId = parseInt(editButton.getAttribute('data-id'));
                handleEditTerapeuta(terapeutaId);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar terapeutas:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="color: red;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}


// ==========================================================
// FUNÇÕES MÓDULO PACIENTES (CRUD e MODAL)
// ==========================================================

async function loadClientes() {
    const tbody = document.querySelector('#clientes-list tbody');
    if (!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="5">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const clientes = data.clientes;

        tbody.innerHTML = ''; 

        if (clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum paciente cadastrado.</td></tr>';
            return;
        }

        clientes.forEach(cliente => {
            const row = tbody.insertRow();
            
            // Adiciona evento de clique na célula do nome para abrir o modal
            const nameCell = row.insertCell();
            nameCell.textContent = cliente.nome;
            nameCell.style.cursor = 'pointer'; 
            nameCell.style.fontWeight = 'bold';
            nameCell.style.textDecoration = 'underline';
            nameCell.addEventListener('click', () => {
                openQuickView(cliente.id);
            });


            row.insertCell().textContent = cliente.id; // ID
            row.insertCell().textContent = cliente.email || '-';
            row.insertCell().textContent = cliente.telefone || '-';
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${cliente.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${cliente.id}">Excluir</button>
            `;
            
            actionsCell.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteCliente(parseInt(cliente.id));
            });
            actionsCell.querySelector('.edit-btn').addEventListener('click', () => {
                handleEditCliente(parseInt(cliente.id));
            });
            
        });

    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="color: red;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}

async function handleFormSubmitCliente(event) {
    event.preventDefault();
    
    const data = await loadData();
    const isEditing = currentEditClientId !== null;

    const clienteData = {
        nome: document.getElementById('nome-cliente').value,
        telefone: document.getElementById('telefone-cliente').value,
        email: document.getElementById('email-cliente').value,
        // DADOS DA ANAMNESE COMPLETA
        anamnese: {
            queixaPrincipal: document.getElementById('queixa-principal').value,
            historicoMedico: document.getElementById('historico-medico').value,
            medicamentosUso: document.getElementById('medicamentos-uso').value,
            alergias: document.getElementById('alergias').value,
            observacoesAnamnese: document.getElementById('observacoes-anamnese').value,
            dataPreenchimento: new Date().toISOString().split('T')[0]
        }
    };
    
    if (isEditing) {
        // UPDATE
        const clienteIndex = data.clientes.findIndex(c => c.id === currentEditClientId);
        if (clienteIndex !== -1) {
            data.clientes[clienteIndex].nome = clienteData.nome;
            data.clientes[clienteIndex].telefone = clienteData.telefone;
            data.clientes[clienteIndex].email = clienteData.email;
            data.clientes[clienteIndex].anamnese = clienteData.anamnese;
        }
        currentEditClientId = null; 
    } else {
        // CREATE
        const nextId = getNextId(data.clientes);
        clienteData.id = nextId;
        data.clientes.push(clienteData);
    }

    saveData(data); 
    
    document.getElementById('add-cliente-form-container').style.display = 'none';
    document.getElementById('add-cliente-form').reset();
    
    loadClientes(); 
}

async function handleDeleteCliente(idToDelete) {
    if (!confirm(`Tem certeza que deseja excluir o Paciente ID ${idToDelete}?`)) {
        return;
    }
    try {
        const data = await loadData();
        const updatedClientes = data.clientes.filter(c => c.id !== idToDelete);
        data.clientes = updatedClientes;
        saveData(data);
        loadClientes(); 
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
    }
}

async function handleEditCliente(clienteId) {
    const data = await loadData();
    const cliente = data.clientes.find(c => c.id === clienteId);

    if (!cliente) return;

    currentEditClientId = clienteId; 
    const an = cliente.anamnese || {}; 

    // Preenche campos básicos
    document.getElementById('nome-cliente').value = cliente.nome;
    document.getElementById('telefone-cliente').value = cliente.telefone;
    document.getElementById('email-cliente').value = cliente.email;
    
    // Preenche campos de ANAMNESE
    document.getElementById('queixa-principal').value = an.queixaPrincipal || '';
    document.getElementById('historico-medico').value = an.historicoMedico || '';
    document.getElementById('medicamentos-uso').value = an.medicamentosUso || '';
    document.getElementById('alergias').value = an.alergias || '';
    document.getElementById('observacoes-anamnese').value = an.observacoesAnamnese || '';


    // Exibe o formulário
    const submitButton = document.querySelector('#add-cliente-form button[type="submit"]');
    document.querySelector('#add-cliente-form-container h3').textContent = 'Editar Ficha do Paciente';
    submitButton.textContent = 'Salvar Alterações';
    
    document.getElementById('add-cliente-form-container').style.display = 'block';
}

/**
 * Abre o modal de visualização rápida e preenche com os dados do paciente.
 * @param {number} clienteId - O ID do cliente a ser visualizado.
 */
async function openQuickView(clienteId) {
    const data = await loadData();
    const cliente = data.clientes.find(c => c.id === clienteId);

    if (!cliente) return;

    const modal = document.getElementById('quick-view-modal');
    const infoContent = document.getElementById('info-content');
    const an = cliente.anamnese || {};

    // 1. --- CONTEÚDO DA ABA 1: INFORMAÇÕES BÁSICAS ---
    infoContent.innerHTML = `
        <p><strong>ID:</strong> ${cliente.id}</p>
        <p><strong>Nome:</strong> ${cliente.nome}</p>
        <p><strong>E-mail:</strong> ${cliente.email || 'N/A'}</p>
        <p><strong>Telefone:</strong> ${cliente.telefone || 'N/A'}</p>
        
        <h4 style="margin-top: 20px; color: #00b894;">Anamnese Principal</h4>
        <p><strong>Queixa Principal:</strong> ${an.queixaPrincipal || 'Não preenchida.'}</p>
        <p><strong>Histórico Médico:</strong> ${an.historicoMedico || 'N/A'}</p>
        <p style="font-size: 0.8em; margin-top: 15px;">Ficha preenchida em: ${an.dataPreenchimento || 'N/A'}</p>
    `;

    // 2. --- CONTEÚDO DA ABA 2: HISTÓRICO DE TRATAMENTOS ---
    loadTratamentosHistorico(clienteId, data);


    // --- SETUP DE ABAS INTERNAS ---
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
            
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-content') + '-content').style.display = 'block';
        };
    });


    // --- CONEXÃO COM BOTÕES DE AÇÃO ---
    document.getElementById('modal-edit-btn').onclick = () => {
        closeQuickView();
        handleEditCliente(clienteId); 
    };
    document.getElementById('modal-schedule-btn').onclick = () => {
        scheduleAppointmentFromModal(cliente.id); 
    };

    modal.style.display = 'block';
}

function closeQuickView() {
    document.getElementById('quick-view-modal').style.display = 'none';
}

function loadTratamentosHistorico(clienteId, data) {
    const tbody = document.querySelector('#tratamentos-historico-list tbody');
    const noHistoryMsg = document.querySelector('#historico-content #no-history-message');
    
    const agendamentos = data.agendamentos.filter(ag => ag.clienteId === clienteId);

    const terapeutaMap = data.terapeutas.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
    const tratamentoMap = data.tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
    
    tbody.innerHTML = ''; 
    noHistoryMsg.style.display = 'none';

    if (agendamentos.length === 0) {
        noHistoryMsg.style.display = 'block';
        return;
    }

    agendamentos.forEach(ag => {
        const row = tbody.insertRow();
        row.insertCell().textContent = ag.data;
        row.insertCell().textContent = tratamentoMap[ag.tratamentoId] || 'Serviço Removido';
        row.insertCell().textContent = terapeutaMap[ag.terapeutaId] || 'Terapeuta Removido';
        row.insertCell().textContent = ag.status;
    });
}

// ==========================================================
// FUNÇÕES MÓDULO AGENDAMENTO (CRUD)
// ==========================================================

async function populateAppointmentForm() {
    const data = await loadData();

    populateSelectOptions('cliente-agendamento', data.clientes, 'id', 'nome');
    populateSelectOptions('terapeuta-agendamento', data.terapeutas, 'id', 'nome');
    populateSelectOptions('tratamento-agendamento', data.tiposTratamento, 'id', 'nome');
    populateSelectOptions('sala-agendamento', data.salasAmbientes, 'id', 'nome');
    await populatePackageSelect(); // Chama a função de pacotes
}

async function populatePackageSelect() {
    const data = await loadData();
    const select = document.getElementById('pacote-agendamento');
    if (!select) return;

    // Reseta o select
    select.innerHTML = '<option value="0" selected>Sessão Individual (Avulsa)</option>'; 

    data.pacotes.forEach(p => {
        // Exibe o pacote com o nome do cliente para fácil identificação
        const cliente = data.clientes.find(c => c.id === p.clienteId);
        const nomeCliente = cliente ? cliente.nome : 'Cliente Removido';
        
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `[ID: ${p.id}] ${p.nomePacote} (${nomeCliente})`;
        select.appendChild(option);
    });
}

async function scheduleAppointmentFromModal(clienteId) {
    closeQuickView();

    const agendaLink = document.querySelector('a[href="#agenda"]');
    if (agendaLink) {
        agendaLink.click(); 
    }

    await populateAppointmentForm();
    document.getElementById('add-agendamento-form-container').style.display = 'block';

    const clienteSelect = document.getElementById('cliente-agendamento');
    if (clienteSelect) {
        clienteSelect.value = String(clienteId); 
    }
    
    currentEditAppointmentId = null; 
    document.querySelector('#add-agendamento-form button[type="submit"]').textContent = 'Salvar Agendamento';
    document.querySelector('#add-agendamento-form-container h3').textContent = 'Novo Agendamento (Paciente Selecionado)';
}


async function loadAgendamentos() {
    const tbody = document.querySelector('#agendamentos-list tbody');
    if (!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="8">Carregando Agenda...</td></tr>'; 

    try {
        const data = await loadData(); 
        const agendamentos = data.agendamentos;

        const clienteMap = data.clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});
        const terapeutaMap = data.terapeutas.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
        const tratamentoMap = data.tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
        const salaMap = data.salasAmbientes.reduce((map, s) => ({ ...map, [s.id]: s.nome }), {});

        tbody.innerHTML = ''; 

        if (agendamentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Nenhum agendamento encontrado.</td></tr>';
            return;
        }
        
        const sortedAgendamentos = agendamentos.sort((a, b) => {
            const dateA = new Date(`${a.data}T${a.hora}`);
            const dateB = new Date(`${b.data}T${b.hora}`);
            return dateB - dateA; 
        });


        sortedAgendamentos.forEach(ag => {
            const row = tbody.insertRow();
            row.insertCell().textContent = ag.id;
            row.insertCell().textContent = `${ag.data} às ${ag.hora}`;
            row.insertCell().textContent = clienteMap[ag.clienteId] || 'ID Não Encontrado';
            row.insertCell().textContent = terapeutaMap[ag.terapeutaId] || 'ID Não Encontrado';
            row.insertCell().textContent = tratamentoMap[ag.tratamentoId] || 'ID Não Encontrado';
            row.insertCell().textContent = salaMap[ag.salaId] || 'ID Não Encontrado';
            row.insertCell().textContent = ag.status;
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${ag.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${ag.id}">Excluir</button>
            `;
            
            actionsCell.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteAgendamento(ag.id);
            });
            actionsCell.querySelector('.edit-btn').addEventListener('click', () => {
                handleEditAgendamento(ag.id);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}

async function handleFormSubmitAgendamento(event) {
    event.preventDefault();

    const data = await loadData();
    const isEditing = currentEditAppointmentId !== null;

    const agendamentoData = {
        clienteId: parseInt(document.getElementById('cliente-agendamento').value),
        terapeutaId: parseInt(document.getElementById('terapeuta-agendamento').value),
        tratamentoId: document.getElementById('tratamento-agendamento').value,
        salaId: document.getElementById('sala-agendamento').value,
        data: document.getElementById('data-agendamento').value,
        hora: document.getElementById('hora-agendamento').value,
        status: document.getElementById('status-agendamento').value,
        pacoteId: parseInt(document.getElementById('pacote-agendamento').value), // Salva o ID do pacote (ou 0)
    };
    
    if (isEditing) {
        // UPDATE
        const agendamentoIndex = data.agendamentos.findIndex(ag => ag.id === currentEditAppointmentId);
        if (agendamentoIndex !== -1) {
             Object.assign(data.agendamentos[agendamentoIndex], agendamentoData); 
        }
        currentEditAppointmentId = null;
    } else {
        // CREATE
        const nextId = getNextId(data.agendamentos);
        agendamentoData.id = nextId;
        data.agendamentos.push(agendamentoData);
    }

    saveData(data);
    
    document.getElementById('add-agendamento-form-container').style.display = 'none';
    document.getElementById('add-agendamento-form').reset();
    loadAgendamentos();
}

async function handleDeleteAgendamento(idToDelete) {
    if (!confirm(`Tem certeza que deseja excluir o Agendamento ID ${idToDelete}?`)) {
        return;
    }
    try {
        const data = await loadData();
        const updatedAgendamentos = data.agendamentos.filter(ag => ag.id !== idToDelete);
        data.agendamentos = updatedAgendamentos;
        saveData(data);
        loadAgendamentos(); 
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
    }
}

async function handleEditAgendamento(id) {
    const data = await loadData();
    const agendamento = data.agendamentos.find(ag => ag.id === id);

    if (!agendamento) return;
    
    currentEditAppointmentId = id;
    
    // 1. Popula os selects antes de definir o valor
    await populateAppointmentForm(); 

    // 2. Preenche os campos do formulário
    document.getElementById('cliente-agendamento').value = agendamento.clienteId;
    document.getElementById('terapeuta-agendamento').value = agendamento.terapeutaId;
    document.getElementById('tratamento-agendamento').value = agendamento.tratamentoId;
    document.getElementById('sala-agendamento').value = agendamento.salaId;
    document.getElementById('data-agendamento').value = agendamento.data;
    document.getElementById('hora-agendamento').value = agendamento.hora;
    document.getElementById('status-agendamento').value = agendamento.status;
    document.getElementById('pacote-agendamento').value = agendamento.pacoteId || 0; // Preenche o pacote
    
    // 3. Exibe o formulário
    document.querySelector('#add-agendamento-form-container h3').textContent = `Editar Agendamento: ${id}`;
    document.querySelector('#add-agendamento-form button[type="submit"]').textContent = 'Atualizar Agendamento';
    document.getElementById('add-agendamento-form-container').style.display = 'block';
}

// ==========================================================
// FUNÇÕES MÓDULO CONFIGURAÇÕES: EMPRESA (COM UPLOAD BASE64)
// ==========================================================

// Função para aplicar a cor do cabeçalho
function applyHeaderColor(color) {
    // Se a cor for inválida, usa o fallback --color-primary
    const finalColor = color || getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    
    // Altera a variável CSS que o cabeçalho está usando
    document.documentElement.style.setProperty('--header-bg-color', finalColor);
}

// Função para atualizar o cabeçalho (nome e logo) globalmente
function updateHeader(nome, logoBase64, color) {
    const logoElement = document.getElementById('header-logo');
    const headerTitle = document.querySelector('header h1');
    const pageTitle = document.querySelector('title');

    // 1. Aplicar Cor
    applyHeaderColor(color);
    
    // 2. Atualizar Logo
    if (logoBase64 && logoElement) {
        logoElement.src = logoBase64;
        logoElement.style.display = 'block';
    } else if (logoElement) {
        logoElement.src = '';
        logoElement.style.display = 'none';
    }

    // 3. Atualizar Nome no Título
    const clinicName = nome || 'Clínica Administrativa';
    if (headerTitle) {
        headerTitle.textContent = clinicName; 
    }
    if (pageTitle) {
        pageTitle.textContent = `${clinicName} - Central Administrativa`;
    }
}


async function loadConfiguracaoEmpresa() {
    const data = await loadData();
    // Garante que o fallback existe
    const config = data.configuracaoEmpresa || { nome: '', cnpj: '', logoBase64: '', headerColor: '#004c9e' }; 
    const logoPreview = document.getElementById('preview-logo-upload');
    const colorInput = document.getElementById('header-color');

    document.getElementById('nome-empresa').value = config.nome || '';
    document.getElementById('cnpj-empresa').value = config.cnpj || '';
    
    if (colorInput) {
        colorInput.value = config.headerColor || '#004c9e';
    }

    // Atualiza o cabeçalho (H1 e Cor)
    updateHeader(config.nome, config.logoBase64, config.headerColor);
    
    // Atualiza a pré-visualização no formulário
    if (config.logoBase64) {
        logoPreview.src = config.logoBase64;
        logoPreview.style.display = 'block';
    } else {
        logoPreview.style.display = 'none';
    }
    
    document.getElementById('logo-upload').value = ''; 
}

/**
 * Lida com o envio do formulário, incluindo a leitura e conversão da logo.
 */
async function handleFormSubmitEmpresa(event) {
    event.preventDefault();

    const data = await loadData();
    const nome = document.getElementById('nome-empresa').value;
    const cnpj = document.getElementById('cnpj-empresa').value;
    const headerColor = document.getElementById('header-color').value;
    const logoFile = document.getElementById('logo-upload').files[0];
    const messageElement = document.getElementById('empresa-message');
    
    messageElement.textContent = 'Salvando...';

    // 1. Processamento da Logo (Base64)
    if (logoFile) {
        if (logoFile.size > 500000) { // Limite de 500KB para evitar estourar o localStorage
            messageElement.style.color = 'var(--color-danger)';
            messageElement.textContent = 'O arquivo é muito grande (máx: 500KB). Escolha uma imagem menor.';
            return;
        }

        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(logoFile);
        });

        data.configuracaoEmpresa.logoBase64 = base64String;

    } else if (data.configuracaoEmpresa && !data.configuracaoEmpresa.logoBase64) {
        data.configuracaoEmpresa.logoBase64 = '';
    }

    // 2. Atualiza os dados da empresa (nome e cnpj)
    data.configuracaoEmpresa = data.configuracaoEmpresa || {};
    data.configuracaoEmpresa.nome = nome;
    data.configuracaoEmpresa.cnpj = cnpj;
    data.configuracaoEmpresa.headerColor = headerColor; // SALVANDO A COR
    
    saveData(data);

    // 3. Atualiza a interface e exibe a mensagem de sucesso
    loadConfiguracaoEmpresa(); 
    
    messageElement.style.color = 'var(--color-secondary)';
    messageElement.textContent = 'Configurações da Empresa salvas com sucesso!';
    setTimeout(() => messageElement.textContent = '', 4000); 
}

/**
 * Cria um documento HTML estilizado para impressão e aciona a função de impressão.
 */
async function printReport(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) {
        alert('Tabela de dados não encontrada.');
        return;
    }
    
    const data = await loadData();
    const config = data.configuracaoEmpresa || { nome: 'Clínica Administrativa', logoBase64: '', headerColor: '#004c9e' }; 

    const logoHtml = config.logoBase64 
        ? `<img src="${config.logoBase64}" style="height: 60px; margin-right: 20px;">` 
        : '';
    const nomeEmpresa = config.nome || 'Clínica Administrativa';

    // Conteúdo base da tabela (excluindo a coluna 'Ações' para a impressão)
    const tableClone = table.cloneNode(true);
    tableClone.querySelectorAll('thead th:last-child, tbody td:last-child').forEach(el => el.remove());
    
    const tableHtml = tableClone.outerHTML;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; }
                header { 
                    display: flex; align-items: center; justify-content: space-between; 
                    margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid #004c9e; 
                    background-color: ${config.headerColor || '#004c9e'};
                    color: white; 
                }
                .logo-container { display: flex; align-items: center; }
                h1 { color: white; font-size: 1.8em; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f2f2f2; color: #333; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    ${logoHtml}
                    <h1>${nomeEmpresa}</h1>
                </div>
                <p style="font-size: 1.2em; font-weight: bold; color: white;">${title}</p>
            </header>
            ${tableHtml}
            <p style="margin-top: 30px; font-size: 0.8em;">Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


// ==========================================================
// FUNÇÕES MÓDULO CONFIGURAÇÕES: TRATAMENTOS
// ==========================================================

async function loadTratamentos() {
    const tbody = document.querySelector('#tratamentos-list tbody');
    tbody.innerHTML = '<tr><td colspan="4">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const tratamentos = data.tiposTratamento;

        tbody.innerHTML = ''; 

        if (tratamentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Nenhum serviço cadastrado.</td></tr>';
            return;
        }

        tratamentos.forEach(t => {
            const row = tbody.insertRow();
            row.insertCell().textContent = t.id;
            row.insertCell().textContent = t.nome;
            row.insertCell().textContent = `R$ ${parseFloat(t.preco).toFixed(2).replace('.', ',')}`; // Correção para garantir que preco é um float
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${t.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${t.id}">Excluir</button>
            `;
            
            actionsCell.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteTratamento(t.id);
            });
            actionsCell.querySelector('.edit-btn').addEventListener('click', () => {
                handleEditTratamento(t.id);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar tratamentos:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="color: red;">Erro ao carregar dados.</td></tr>';
    }
}

async function handleFormSubmitTratamento(event) {
    event.preventDefault();

    const data = await loadData();
    const isEditing = currentEditTreatmentId !== null;

    const nome = document.getElementById('nome-tratamento').value;
    const preco = parseFloat(document.getElementById('preco-tratamento').value); 
    
    if (isNaN(preco) || preco <= 0) {
         alert('Por favor, insira um preço válido.');
         return;
    }

    if (isEditing) {
        // UPDATE
        const tratamento = data.tiposTratamento.find(t => t.id === currentEditTreatmentId);
        if (tratamento) {
            tratamento.nome = nome;
            tratamento.preco = preco;
        }
        currentEditTreatmentId = null;
    } else {
        // CREATE
        const nextIdNum = getNextId(data.tiposTratamento);
        const nextId = 'T' + String(nextIdNum).padStart(3, '0');

        const novoTratamento = { id: nextId, nome, preco };
        data.tiposTratamento.push(novoTratamento);
    }

    saveData(data);
    
    document.getElementById('add-tratamento-form-container').style.display = 'none';
    document.getElementById('add-tratamento-form').reset();
    loadTratamentos();
}

async function handleEditTratamento(id) {
    const data = await loadData();
    const tratamento = data.tiposTratamento.find(t => t.id === id);

    if (!tratamento) return;
    
    currentEditTreatmentId = id;
    
    document.getElementById('nome-tratamento').value = tratamento.nome;
    document.getElementById('preco-tratamento').value = tratamento.preco;

    document.querySelector('#add-tratamento-form-container h4').textContent = `Editar Serviço: ${id}`;
    document.querySelector('#add-tratamento-form button[type="submit"]').textContent = 'Atualizar Serviço';
    document.getElementById('add-tratamento-form-container').style.display = 'block';
}

async function handleDeleteTratamento(id) {
    if (!confirm(`Excluir serviço ${id}? Esta ação não pode ser desfeita.`)) return;

    try {
        const data = await loadData();
        data.tiposTratamento = data.tiposTratamento.filter(t => t.id !== id);
        saveData(data);
        loadTratamentos();
    } catch (error) {
        console.error('Erro ao excluir tratamento:', error);
    }
}

// ==========================================================
// FUNÇÕES MÓDULO CONFIGURAÇÕES: SALAS
// ==========================================================

async function loadSalas() {
    const tbody = document.querySelector('#salas-list tbody');
    tbody.innerHTML = '<tr><td colspan="4">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const salas = data.salasAmbientes;

        tbody.innerHTML = ''; 

        if (salas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Nenhuma sala cadastrada.</td></tr>';
            return;
        }

        salas.forEach(s => {
            const row = tbody.insertRow();
            row.insertCell().textContent = s.id;
            row.insertCell().textContent = s.nome;
            row.insertCell().textContent = `${s.capacidade} pessoa(s)`;
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${s.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${s.id}">Excluir</button>
            `;
            
            actionsCell.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteSala(s.id);
            });
            actionsCell.querySelector('.edit-btn').addEventListener('click', () => {
                handleEditSala(s.id);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar salas:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="color: red;">Erro ao carregar dados.</td></tr>';
    }
}

async function handleFormSubmitSala(event) {
    event.preventDefault();

    const data = await loadData();
    const isEditing = currentEditRoomId !== null;

    const nome = document.getElementById('nome-sala').value;
    const capacidade = parseInt(document.getElementById('capacidade-sala').value); 
    
    if (isNaN(capacidade) || capacidade < 1) {
         alert('Por favor, insira uma capacidade válida (mínimo 1).');
         return;
    }

    if (isEditing) {
        // UPDATE
        const sala = data.salasAmbientes.find(s => s.id === currentEditRoomId);
        if (sala) {
            sala.nome = nome;
            sala.capacidade = capacidade;
        }
        currentEditRoomId = null;
    } else {
        // CREATE
        const nextIdNum = getNextId(data.salasAmbientes);
        const nextId = 'S' + String(nextIdNum); // Ex: S3

        const novaSala = { id: nextId, nome, capacidade };
        data.salasAmbientes.push(novaSala);
    }

    saveData(data);
    
    document.getElementById('add-sala-form-container').style.display = 'none';
    document.getElementById('add-sala-form').reset();
    loadSalas();
}

async function handleEditSala(id) {
    const data = await loadData();
    const sala = data.salasAmbientes.find(s => s.id === id);

    if (!sala) return;
    
    currentEditRoomId = id;
    
    document.getElementById('nome-sala').value = sala.nome;
    document.getElementById('capacidade-sala').value = sala.capacidade;

    document.querySelector('#add-sala-form-container h4').textContent = `Editar Sala: ${id}`;
    document.querySelector('#add-sala-form button[type="submit"]').textContent = 'Atualizar Sala';
    document.getElementById('add-sala-form-container').style.display = 'block';
}

async function handleDeleteSala(id) {
    if (!confirm(`Excluir Sala ${id}? Esta ação não pode ser desfeita.`)) return;

    try {
        const data = await loadData();
        data.salasAmbientes = data.salasAmbientes.filter(s => s.id !== id);
        saveData(data);
        loadSalas();
    } catch (error) {
        console.error('Erro ao excluir sala:', error);
    }
}

// ==========================================================
// FUNÇÕES MÓDULO CONFIGURAÇÕES: SENHA
// ==========================================================

async function handleChangePassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const messageElement = document.getElementById('password-message');

    messageElement.style.color = 'red';
    messageElement.textContent = '';

    if (newPassword !== confirmPassword) {
        messageElement.textContent = 'As novas senhas não coincidem!';
        return;
    }
    
    if (newPassword.length < 6) {
        messageElement.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        return;
    }

    try {
        const data = await loadData();
        const loggedInEmail = localStorage.getItem('loggedInUser');
        const isAdmin = localStorage.getItem('isUserAdmin') === 'true';
        let userFound = false;

        if (isAdmin) {
            if (loggedInEmail === data.adminUser.username) {
                data.adminUser.password = newPassword;
                userFound = true;
            }
        } else {
            const terapeutaIndex = data.terapeutas.findIndex(t => t.email === loggedInEmail);
            if (terapeutaIndex !== -1) {
                data.terapeutas[terapeutaIndex].senha = newPassword;
                userFound = true;
            }
        }

        if (userFound) {
            saveData(data); 
            messageElement.style.color = 'var(--color-secondary)';
            messageElement.textContent = 'Senha alterada com sucesso!';
            document.getElementById('change-password-form').reset();
        } else {
            messageElement.textContent = 'Erro: Usuário não encontrado na base de dados.';
        }

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        messageElement.textContent = 'Erro interno ao salvar a nova senha.';
    }
}


// ==========================================================
// FUNÇÕES MÓDULO FINANCEIRO: DESPESAS (EXISTENTE)
// ==========================================================

async function loadDespesas() {
    const tbody = document.querySelector('#despesas-list tbody');
    tbody.innerHTML = '<tr><td colspan="6">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const despesas = data.despesas;

        tbody.innerHTML = ''; 

        if (despesas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Nenhuma despesa lançada.</td></tr>';
            return;
        }

        despesas.forEach(d => {
            const row = tbody.insertRow();
            row.insertCell().textContent = d.id;
            row.insertCell().textContent = d.tipo;
            row.insertCell().textContent = d.descricao;
            row.insertCell().textContent = `R$ ${parseFloat(d.valor).toFixed(2).replace('.', ',')}`; // Correção
            row.insertCell().textContent = d.data;
            
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn edit-btn" data-id="${d.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${d.id}">Excluir</button>
            `;
            
            actionsCell.querySelector('.delete-btn').addEventListener('click', () => {
                handleDeleteDespesa(d.id);
            });
            actionsCell.querySelector('.edit-btn').addEventListener('click', () => {
                handleEditDespesa(d.id);
            });
        });

    } catch (error) {
        console.error('Erro ao carregar despesas:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="color: red;">Erro ao carregar dados.</td></tr>';
    }
}

async function handleFormSubmitDespesa(event) {
    event.preventDefault();

    const data = await loadData();
    const isEditing = currentEditExpenseId !== null;

    const tipo = document.getElementById('tipo-despesa').value;
    const descricao = document.getElementById('descricao-despesa').value;
    const valor = parseFloat(document.getElementById('valor-despesa').value);
    const dataPagamento = document.getElementById('data-despesa').value;
    
     if (isNaN(valor) || valor <= 0) {
         alert('Por favor, insira um valor válido.');
         return;
    }

    if (isEditing) {
        // UPDATE
        const despesa = data.despesas.find(d => d.id === currentEditExpenseId);
        if (despesa) {
            despesa.tipo = tipo;
            despesa.descricao = descricao;
            despesa.valor = valor;
            despesa.data = dataPagamento;
        }
        currentEditExpenseId = null;
    } else {
        // CREATE
        const nextId = getNextId(data.despesas);
        const novaDespesa = { id: nextId, tipo, descricao, valor, data: dataPagamento };
        data.despesas.push(novaDespesa);
    }

    saveData(data);
    
    document.getElementById('add-despesa-form-container').style.display = 'none';
    document.getElementById('add-despesa-form').reset();
    loadDespesas();
}

async function handleEditDespesa(id) {
    const data = await loadData();
    const despesa = data.despesas.find(d => d.id === id);

    if (!despesa) return;
    
    currentEditExpenseId = id;
    
    document.getElementById('tipo-despesa').value = despesa.tipo;
    document.getElementById('descricao-despesa').value = despesa.descricao;
    document.getElementById('valor-despesa').value = despesa.valor;
    document.getElementById('data-despesa').value = despesa.data;

    document.querySelector('#add-despesa-form-container h4').textContent = `Editar Despesa: ${id}`;
    document.querySelector('#add-despesa-form button[type="submit"]').textContent = 'Atualizar Despesa';
    document.getElementById('add-despesa-form-container').style.display = 'block';
}

async function handleDeleteDespesa(id) {
    if (!confirm(`Excluir Despesa ${id}? Esta ação não pode ser desfeita.`)) return;

    try {
        const data = await loadData();
        data.despesas = data.despesas.filter(d => d.id !== id);
        saveData(data);
        loadDespesas();
    } catch (error) {
        console.error('Erro ao excluir despesa:', error);
    }
}

// ==========================================================
// FUNÇÕES MÓDULO PACOTES (RASTREAMENTO)
// ==========================================================

async function loadPacotes() {
    const tbody = document.querySelector('#pacotes-list tbody');
    if (!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="7">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        const pacotes = data.pacotes;
        
        // Mapeamentos para buscar nomes
        const clienteMap = data.clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});

        // Conta as sessões REALIZADAS por pacote
        const sessoesRealizadasMap = data.agendamentos
            .filter(ag => ag.status === 'Realizado' && ag.pacoteId !== 0) // Conta apenas se o pacoteId for definido (não 0/Individual)
            .reduce((map, ag) => {
                map[ag.pacoteId] = (map[ag.pacoteId] || 0) + 1;
                return map;
            }, {});

        tbody.innerHTML = ''; 

        if (pacotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Nenhum pacote de sessões cadastrado.</td></tr>';
            return;
        }

        pacotes.forEach(p => {
            const realizadas = sessoesRealizadasMap[p.id] || 0; // Usa p.id (ID do pacote)
            const restantes = p.totalSessoes - realizadas;
            const status = restantes > 0 ? 'Ativo' : 'Concluído';
            const nomeCliente = clienteMap[p.clienteId] || 'Cliente Removido';

            const row = tbody.insertRow();
            row.insertCell().textContent = p.id;
            row.insertCell().textContent = nomeCliente;
            row.insertCell().textContent = p.nomePacote;
            row.insertCell().textContent = p.totalSessoes;
            row.insertCell().textContent = realizadas;
            
            // Destaque para o campo RESTANTE
            const restantesCell = row.insertCell();
            restantesCell.textContent = restantes;
            restantesCell.style.fontWeight = 'bold';
            restantesCell.style.color = restantes <= 2 && restantes > 0 ? '#ff7f50' : (restantes <= 0 ? '#c53030' : '#38a169');
            
            row.insertCell().textContent = status;
            
            // Coluna de Ações
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn add-button" onclick="handleSchedulePacote(${p.id})">Rastrear Sessões</button>
                <button class="action-btn edit-btn" onclick="handleEditPacote(${p.id})">Editar</button>
                <button class="action-btn delete-btn" onclick="handleDeletePacote(${p.id})">Excluir</button>
            `;
        });

    } catch (error) {
        console.error('Erro ao carregar pacotes:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Erro ao carregar dados.</td></tr>';
    }
}

// ... (Dentro do bloco de FUNÇÕES MÓDULO PACOTES)

async function populateClientFilter() {
    const data = await loadData();
    const select = document.getElementById('filtro-cliente-pacotes');
    if (!select) return;

    select.innerHTML = '<option value="0">-- Mostrar Todos os Pacientes --</option>';

    data.clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome;
        select.appendChild(option);
    });
}

async function loadPacotes() {
    const tbody = document.querySelector('#pacotes-list tbody');
    if (!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="7">Carregando dados...</td></tr>'; 

    try {
        const data = await loadData(); 
        
        // **NOVO: LÊ O VALOR DO FILTRO**
        const filtroClienteId = parseInt(document.getElementById('filtro-cliente-pacotes').value || 0);

        // **NOVO: APLICA O FILTRO**
        let pacotes = data.pacotes;
        if (filtroClienteId !== 0) {
            pacotes = pacotes.filter(p => p.clienteId === filtroClienteId);
        }
        
        // Mapeamentos para buscar nomes
        const clienteMap = data.clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});

        // Conta as sessões REALIZADAS por pacote
        const sessoesRealizadasMap = data.agendamentos
            .filter(ag => ag.status === 'Realizado' && ag.pacoteId !== 0)
            .reduce((map, ag) => {
                map[ag.pacoteId] = (map[ag.pacoteId] || 0) + 1;
                return map;
            }, {});

        tbody.innerHTML = ''; 

        if (pacotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">Nenhum pacote encontrado para os critérios selecionados.</td></tr>';
            return;
        }

        pacotes.forEach(p => {
            const realizadas = sessoesRealizadasMap[p.id] || 0; 
            const restantes = p.totalSessoes - realizadas;
            const status = restantes > 0 ? 'Ativo' : 'Concluído';
            const nomeCliente = clienteMap[p.clienteId] || 'Cliente Removido';
            
            // Lógica de destaque de cor para sessões restantes
            let restantesClass = 'data-highlight';
            if (restantes <= 0) restantesClass += ' critical';
            else if (restantes <= 2) restantesClass += ' warning';
            else restantesClass += ' positive';


            const row = tbody.insertRow();
            row.insertCell().textContent = p.id;
            row.insertCell().textContent = nomeCliente;
            row.insertCell().textContent = p.nomePacote;
            row.insertCell().textContent = p.totalSessoes;
            row.insertCell().textContent = realizadas;
            
            // Destaque do campo RESTANTE
            const restantesCell = row.insertCell();
            restantesCell.innerHTML = `<span class="${restantesClass}">${restantes}</span>`;
            
            row.insertCell().textContent = status;
            
            // Coluna de Ações
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-btn" onclick="handleSchedulePacote(${p.id})">Rastrear Sessões</button>
                <button class="action-btn edit-btn" onclick="handleEditPacote(${p.id})">Editar</button>
                <button class="action-btn delete-btn" onclick="handleDeletePacote(${p.id})">Excluir</button>
            `;
        });

    } catch (error) {
        console.error('Erro ao carregar pacotes:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}


async function populatePacotesFormClients() {
    const data = await loadData();
    populateSelectOptions(
        'cliente-pacote', 
        data.clientes, 
        'id', 
        'nome'
    );
}

async function handleFormSubmitPacote(event) {
    event.preventDefault();

    const data = await loadData();
    const isEditing = currentEditPacoteId !== null;

    const clienteId = parseInt(document.getElementById('cliente-pacote').value);
    const nomePacote = document.getElementById('nome-pacote').value;
    const totalSessoes = parseInt(document.getElementById('total-sessoes').value);
    const valorTotal = parseFloat(document.getElementById('valor-pacote').value);
    
    if (isNaN(clienteId) || clienteId === "") { alert("Selecione um cliente."); return; }
    if (isNaN(totalSessoes) || totalSessoes < 1) { alert("Número de sessões inválido."); return; }
    if (isNaN(valorTotal) || valorTotal <= 0) { alert("Valor total inválido."); return; }
    
    const pacoteData = {
        clienteId,
        nomePacote,
        totalSessoes,
        valorTotal,
        dataCompra: new Date().toISOString().split('T')[0]
    };

    if (isEditing) {
        // UPDATE
        const pacote = data.pacotes.find(p => p.id === currentEditPacoteId);
        if (pacote) {
            Object.assign(pacote, pacoteData); // Atualiza os dados
        }
        currentEditPacoteId = null;
    } else {
        // CREATE
        const nextId = getNextId(data.pacotes);
        pacoteData.id = nextId;
        data.pacotes.push(pacoteData);
    }

    saveData(data);
    
    document.getElementById('add-pacote-form-container').style.display = 'none';
    document.getElementById('add-pacote-form').reset();
    loadPacotes(); // Recarrega a tabela de rastreamento
}

async function handleEditPacote(id) {
    const data = await loadData();
    const pacote = data.pacotes.find(p => p.id === id);

    if (!pacote) return;
    
    currentEditPacoteId = id;
    await populatePacotesFormClients(); // Carrega a lista de clientes

    document.getElementById('cliente-pacote').value = pacote.clienteId;
    document.getElementById('nome-pacote').value = pacote.nomePacote;
    document.getElementById('total-sessoes').value = pacote.totalSessoes;
    document.getElementById('valor-pacote').value = pacote.valorTotal;

    document.querySelector('#add-pacote-form-container h3').textContent = `Editar Pacote ID: ${id}`;
    document.querySelector('#add-pacote-form button[type="submit"]').textContent = 'Atualizar Pacote';
    document.getElementById('add-pacote-form-container').style.display = 'block';
}

async function handleDeletePacote(id) {
    if (!confirm(`Excluir Pacote ID ${id}? Isso não pode ser desfeito.`)) return;

    try {
        const data = await loadData();
        data.pacotes = data.pacotes.filter(p => p.id !== id);
        saveData(data);
        loadPacotes();
    } catch (error) {
        console.error('Erro ao excluir pacote:', error);
    }
}

async function handleSchedulePacote(pacoteId) {
    currentSchedulingPacoteId = pacoteId;
    const data = await loadData();
    const pacote = data.pacotes.find(p => p.id === pacoteId);
    
    const clienteMap = data.clientes.reduce((map, c) => ({ ...map, [c.id]: c.nome }), {});
    const terapeutaMap = data.terapeutas.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});
    const tratamentoMap = data.tiposTratamento.reduce((map, t) => ({ ...map, [t.id]: t.nome }), {});

    if (!pacote) return;

    document.getElementById('pacote-schedule-title').textContent = `Rastreamento de Sessões: ${pacote.nomePacote} (ID: ${pacoteId})`;
    
    const agendamentosPacote = data.agendamentos
        .filter(ag => ag.pacoteId === pacoteId)
        .sort((a, b) => new Date(a.data) - new Date(b.data));

    const realizadas = agendamentosPacote.filter(ag => ag.status === 'Realizado').length;

    renderPackageSessionTracker(pacote, clienteMap, terapeutaMap, tratamentoMap, agendamentosPacote, realizadas);

    document.getElementById('pacote-schedule-modal').style.display = 'block';
}

function renderPackageSessionTracker(pacote, clienteMap, terapeutaMap, tratamentoMap, agendamentosPacote, realizadas) {
    const container = document.getElementById('schedule-grid-container');
    const restantes = pacote.totalSessoes - realizadas;

    container.innerHTML = `
        <p><strong>Paciente:</strong> ${clienteMap[pacote.clienteId] || 'N/A'} | 
        <strong>Total:</strong> ${pacote.totalSessoes} Sessões | 
        <strong>Realizadas:</strong> <span style="color:#38a169; font-weight:bold;">${realizadas}</span> | 
        <strong>Restantes:</strong> <span style="color:#c53030; font-weight:bold;">${pacote.totalSessoes - realizadas}</span></p>
        <hr style="margin: 10px 0;">
        
        <h4>Detalhes das Sessões (Agenda):</h4>
        <div id="pacote-session-list" style="max-height: 400px; overflow-y: auto;">
            </div>
    `;

    const listDiv = document.getElementById('pacote-session-list');

    // 1. Mostrar Sessões Agendadas/Realizadas
    if (agendamentosPacote.length > 0) {
        agendamentosPacote.forEach(ag => {
            const statusColor = ag.status === 'Realizado' ? '#38a169' : (ag.status === 'Cancelado' ? '#c53030' : '#4299e1');
            const terapeuta = terapeutaMap[ag.terapeutaId] || 'N/A';
            const tratamento = tratamentoMap[ag.tratamentoId] || 'N/A';

            listDiv.innerHTML += `
                <div style="border: 1px solid #e2e8f0; padding: 10px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="display:inline-block; width: 140px; font-weight: bold;">${ag.data} às ${ag.hora}</span> | 
                        <span>${tratamento}</span> | 
                        <span>Terapeuta: ${terapeuta}</span>
                    </div>
                    <span style="color: ${statusColor}; font-weight: bold; width: 100px; text-align: right;">${ag.status}</span>
                </div>
            `;
        });
    }


    // 2. Mostrar slots restantes (vagas a preencher)
    const vagasAVincular = pacote.totalSessoes - agendamentosPacote.length;
    if (vagasAVincular > 0) {
        listDiv.innerHTML += `<h5 style="margin-top: 25px; border-top: 1px dashed #a0aec0; padding-top: 15px; color: #0077b6;">${vagasAVincular} Vagas Livres no Pacote:</h5>`;
        for (let i = 0; i < vagasAVincular; i++) {
            listDiv.innerHTML += `
                <div style="border: 1px dashed #a0aec0; background-color: #f7fafc; padding: 10px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Sessão ${agendamentosPacote.length + i + 1} de ${pacote.totalSessoes} (Vaga Livre)</span>
                    <button class="add-button" style="padding: 5px 10px;" 
                            onclick="openAgendaForPacote(${pacote.id}, ${pacote.clienteId})">
                        Agendar Agora
                    </button>
                </div>
            `;
        }
    } else if (agendamentosPacote.length === pacote.totalSessoes) {
         listDiv.innerHTML += `<p style="color: #4299e1; font-weight: bold; margin-top: 15px;">Todas as ${pacote.totalSessoes} sessões já foram registradas (agendadas ou realizadas).</p>`;
    } else {
        listDiv.innerHTML += `<p>Nenhum agendamento encontrado para este pacote.</p>`;
    }
}

function openAgendaForPacote(pacoteId, clienteId) {
    // 1. Fechar o modal de agendamento do pacote
    document.getElementById('pacote-schedule-modal').style.display = 'none';

    // 2. Mudar a navegação para o módulo de Agenda
    document.querySelector('a[href="#agenda"]').click(); 

    // 3. Abrir o formulário de Agendamento e pré-preencher
    setTimeout(async () => {
        // Simula o clique no botão de adicionar
        const addAgendaBtn = document.getElementById('add-agendamento-btn');
        if (addAgendaBtn) addAgendaBtn.click();
        
        // Aguarda a abertura e populagem dos selects
        await new Promise(resolve => setTimeout(resolve, 100)); // Pequeno delay

        document.getElementById('cliente-agendamento').value = clienteId;
        document.getElementById('pacote-agendamento').value = pacoteId;
        
        alert(`Abrindo formulário de Agendamento. Paciente e Pacote (ID: ${pacoteId}) pré-selecionados. Certifique-se de escolher a data/hora, terapeuta e serviço.`);
    }, 50); 
}

// ==========================================================
// FUNÇÕES DE NAVEGAÇÃO INTERNA E SETUP 
// ==========================================================

function setupConfigTabs() {
    const tabsContainer = document.getElementById('config-tabs');
    if (!tabsContainer) return;

    const contentMap = {
        'empresa': 'empresa-content', // NOVO
        'tratamentos': 'tratamentos-content',
        'salas': 'salas-content',
        'senha': 'senha-content'
    };

    const switchTab = (targetId) => {
        const contentId = contentMap[targetId];

        tabsContainer.querySelectorAll('.config-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.config-content').forEach(content => content.style.display = 'none');
        
        document.querySelector(`.config-tab[data-target="${targetId}"]`).classList.add('active');
        const targetContent = document.getElementById(contentId);
        
        if (targetContent) {
            targetContent.style.display = 'block';

            if (targetId === 'empresa') {
                loadConfiguracaoEmpresa();
            } else if (targetId === 'tratamentos') {
                loadTratamentos(); 
            } else if (targetId === 'salas') {
                loadSalas(); 
            }
        }
    };

    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('config-tab')) {
            switchTab(e.target.getAttribute('data-target'));
        }
    });

    const initialTab = tabsContainer.querySelector('.config-tab.active') || tabsContainer.querySelector('.config-tab[data-target="empresa"]');
    if (initialTab) {
        switchTab(initialTab.getAttribute('data-target'));
    }
}

function setupFinanceiroTabs() {
    const tabsContainer = document.getElementById('financeiro-tabs');
    if (!tabsContainer) return;

    const switchTab = (targetId) => {
        document.querySelectorAll('.financeiro-content').forEach(content => content.style.display = 'none');
        tabsContainer.querySelectorAll('.financeiro-tab').forEach(tab => tab.classList.remove('active'));
        
        document.getElementById(targetId + '-content').style.display = 'block';
        document.querySelector(`.financeiro-tab[data-target="${targetId}"]`).classList.add('active');

        if (targetId === 'despesas') {
            loadDespesas();
        }
    };

    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('financeiro-tab')) {
            switchTab(e.target.getAttribute('data-target'));
        }
    });

    switchTab('despesas');
}


function setupNavigation() {
    const navLinks = document.querySelectorAll('#sidebar-menu a');
    const contentArea = document.getElementById('content-area');
    const sidebar = document.getElementById('sidebar-menu');

    // **NOVO: Identifica o tipo de usuário logado**
    const isAdmin = localStorage.getItem('isUserAdmin') === 'true'; 

    // Módulos que DEVEM ser escondidos para Terapeutas
    const restrictedModules = ['terapeutas', 'financeiro', 'config'];
    
    // Filtra links e módulos na sidebar
    navLinks.forEach(link => {
        const targetId = link.getAttribute('href').substring(1);
        if (!isAdmin && restrictedModules.includes(targetId)) {
            // Remove o item de menu se for Terapeuta
            link.parentElement.style.display = 'none';
        }
    });

    // Remove listeners antigos e adiciona o novo para evitar duplicidade
    navLinks.forEach(link => {
        link.removeEventListener('click', handleNavClick); 
        link.addEventListener('click', handleNavClick);
    });

    // Função principal de navegação e checagem de bloqueio
    async function handleNavClick(e) {
        e.preventDefault();
        
        const clickedLink = e.currentTarget; 
        const targetId = clickedLink.getAttribute('href').substring(1); 
        let moduleId = '';
        let readiness = await checkModuleReadiness(); 
        let blockReason = null;

        // ===============================================
        // LÓGICA DE BLOQUEIO SEQUENCIAL
        // ===============================================

        if (targetId === 'clientes' && !readiness.hasTerapeutas && isAdmin) {
            blockReason = "Cadastre pelo menos **um Terapeuta** primeiro. (Módulo Terapeutas)";
        } else if (targetId === 'pacotes' && (!readiness.hasClientes || !readiness.hasTratamentos)) {
            blockReason = "Finalize o cadastro de **Serviços** (Configurações) e **Pacientes** antes.";
        } else if (targetId === 'agenda') {
            if (!readiness.hasTerapeutas) blockReason = "Cadastre os **Terapeutas**.";
            else if (!readiness.hasSalas) blockReason = "Cadastre as **Salas/Ambientes** (em Configurações).";
            else if (!readiness.hasClientes) blockReason = "Cadastre pelo menos **um Paciente**.";

            if (blockReason) {
                blockReason = "Para liberar a Agenda, você deve primeiro: " + blockReason;
            }
        } 
        
        if (blockReason) {
            // MÓDULO BLOQUEADO
            alert('Acesso Bloqueado: ' + blockReason);
            return;
        }

        // MÓDULO LIBERADO - EXECUÇÃO NORMAL
        
        // Mapeamento de IDs de navegação para IDs de Módulo de Conteúdo
        if (targetId === 'dashboard') { moduleId = 'dashboard'; } 
        else if (targetId === 'terapeutas') { moduleId = 'terapeutas-module'; } 
        else if (targetId === 'clientes') { moduleId = 'clientes-module'; }
        else if (targetId === 'pacotes') { moduleId = 'pacotes-module'; }
        else if (targetId === 'agenda') { moduleId = 'agenda-module'; } 
        else if (targetId === 'financeiro') { moduleId = 'financeiro-module'; } 
        else if (targetId === 'config') { moduleId = 'config-module'; }

        // Troca de módulo
        contentArea.querySelectorAll('.content-module').forEach(module => {
            module.style.display = 'none';
        });
        sidebar.querySelectorAll('a').forEach(a => a.classList.remove('active'));

        if (moduleId) {
            const targetModule = document.getElementById(moduleId);
            if (targetModule) {
                targetModule.style.display = 'block';
                clickedLink.classList.add('active'); // Aplica a classe 'active' ao link correto
                
                // Ações de carregamento (filtramos pelo Admin para os módulos restritos)
                if (moduleId === 'terapeutas-module' && isAdmin) { loadTerapeutas(); } 
                else if (moduleId === 'clientes-module') { loadClientes(); }
                else if (moduleId === 'pacotes-module') { loadPacotes(); }
                else if (moduleId === 'agenda-module') { loadAgendamentos(); } 
                else if (moduleId === 'financeiro-module' && isAdmin) { setupFinanceiroTabs(); } 
                else if (moduleId === 'config-module' && isAdmin) { setupConfigTabs(); }
                // Se for terapeuta e estiver no dashboard, ele carrega o dashboard
                else if (moduleId === 'dashboard') { /* Ações abaixo */ } 
                
                // CRÍTICO DO DASHBOARD
                if (moduleId === 'dashboard') {
                    const upcomingListBody = document.querySelector('#upcoming-list tbody');
                    if (upcomingListBody) {
                        upcomingListBody.innerHTML = '<tr><td colspan="5" style="padding: 15px;">Carregando agendamentos...</td></tr>';
                    }
                    setTimeout(loadDashboard, 50); 
                }
            }
        }
    }
    
    // Assegura que o Dashboard esteja ativo e carregue na inicialização (sem checagem)
    const dashboardModule = document.getElementById('dashboard');
    if (dashboardModule) dashboardModule.style.display = 'block';

    const initialLink = document.querySelector('#sidebar-menu a[href="#dashboard"]');
    if (initialLink) {
        initialLink.classList.add('active');
        setTimeout(loadDashboard, 50);
    }
}


// ==========================================================
// CHAMADA PRINCIPAL (DOMCONTENTLOADED)
// ==========================================================

// LISTENERS DO NOVO FILTRO E RELATÓRIO POR CLIENTE
document.getElementById('filtro-cliente-pacotes')?.addEventListener('change', loadPacotes);

document.getElementById('print-pacotes-cliente-btn')?.addEventListener('click', () => {
    const selectedId = parseInt(document.getElementById('filtro-cliente-pacotes').value);
    if (selectedId === 0) {
        alert("Selecione um paciente específico para gerar o relatório detalhado.");
        return;
    }
    printPacoteDetalhadoReport(selectedId);
});

document.getElementById('print-pacotes-btn')?.addEventListener('click', () => {
    // Agora o botão de resumo chama a função com ID 0
    printPacoteDetalhadoReport(0);
});

// **CRÍTICO:** Adicione a chamada para popular o filtro e carregar a lista
loadPacotes(); 
populateClientFilter(); // Chama a nova função para preencher o filtro na inicialização


document.getElementById('print-pacotes-btn')?.addEventListener('click', () => {
    printPacoteDetalhadoReport();
});


document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuração do Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 2. Configuração do Painel Administrativo
    if (window.location.pathname.endsWith('admin.html')) {
        
        if (!checkAuthentication()) return; 
        
        // CHAMA O LOAD DA CONFIGURAÇÃO DA EMPRESA LOGO NO INÍCIO PARA PREENCHER O CABEÇALHO
        loadConfiguracaoEmpresaInitial(); 

        setupNavigation();

        // LISTENERS DE LOGOUT (CONEXÃO CORRETA E FINAL)
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout); 

        // NOVO LISTENER PARA O FORM DE EMPRESA
        document.getElementById('empresa-form')?.addEventListener('submit', handleFormSubmitEmpresa);

        // LISTENERS MÓDULO PACOTES 
        document.getElementById('add-pacote-btn')?.addEventListener('click', async () => {
            currentEditPacoteId = null;
            document.querySelector('#add-pacote-form-container h3').textContent = 'Criar Novo Pacote';
            document.querySelector('#add-pacote-form button[type="submit"]').textContent = 'Salvar Pacote';
            document.getElementById('add-pacote-form').reset();
            // CHAMA A FUNÇÃO DE POPULAR CLIENTES ANTES DE ABRIR
            await populatePacotesFormClients(); 
            document.getElementById('add-pacote-form-container').style.display = 'block';
        });

        document.getElementById('cancel-pacote-btn')?.addEventListener('click', () => {
            currentEditPacoteId = null;
            document.getElementById('add-pacote-form-container').style.display = 'none';
        });

        document.getElementById('add-pacote-form')?.addEventListener('submit', handleFormSubmitPacote);

        // LISTENERS MÓDULO TERAPEUTAS
        document.getElementById('add-terapeuta-btn')?.addEventListener('click', () => {
            currentEditId = null; 
            prepareFormForEdit(false); 
            document.getElementById('add-terapeuta-form-container').style.display = 'block';
        });

        document.getElementById('cancel-add-btn')?.addEventListener('click', () => {
            currentEditId = null; 
            document.getElementById('add-terapeuta-form-container').style.display = 'none';
            prepareFormForEdit(false); 
        });
        document.getElementById('add-terapeuta-form')?.addEventListener('submit', handleFormSubmit);

        // NOVO LISTENER: IMPRESSÃO DE TERAPEUTAS
        document.getElementById('print-terapeutas-btn')?.addEventListener('click', () => {
            printReport('terapeutas-list', 'Relatório de Terapeutas Cadastrados');
        });


        // LISTENERS MÓDULO PACIENTES
        document.getElementById('add-cliente-btn')?.addEventListener('click', () => {
            currentEditClientId = null;
            document.querySelector('#add-cliente-form-container h3').textContent = 'Cadastro de Novo Paciente';
            document.querySelector('#add-cliente-form button[type="submit"]').textContent = 'Salvar Paciente';
            document.getElementById('add-cliente-form').reset();
            document.getElementById('add-cliente-form-container').style.display = 'block';
        });
        
        document.getElementById('cancel-cliente-btn')?.addEventListener('click', () => {
            currentEditClientId = null;
            document.getElementById('add-cliente-form-container').style.display = 'none';
            document.getElementById('add-cliente-form').reset();
        });

        document.getElementById('add-cliente-form')?.addEventListener('submit', handleFormSubmitCliente);

        // LISTENERS DO MODAL
        document.getElementById('close-modal-btn')?.addEventListener('click', closeQuickView);
        document.getElementById('close-schedule-modal-btn')?.addEventListener('click', () => { // FECHAR MODAL DO PACOTE
            document.getElementById('pacote-schedule-modal').style.display = 'none';
        });
        document.getElementById('modal-close-schedule-btn')?.addEventListener('click', () => { // FECHAR MODAL DO PACOTE
            document.getElementById('pacote-schedule-modal').style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            const modal = document.getElementById('quick-view-modal');
            const pacoteModal = document.getElementById('pacote-schedule-modal');
            if (event.target === modal) {
                closeQuickView();
            }
            if (event.target === pacoteModal) {
                 document.getElementById('pacote-schedule-modal').style.display = 'none';
            }
        });


        // LISTENERS MÓDULO AGENDAMENTO
        document.getElementById('add-agendamento-btn')?.addEventListener('click', async () => {
            currentEditAppointmentId = null;
            document.querySelector('#add-agendamento-form-container h3').textContent = 'Detalhes da Sessão';
            document.querySelector('#add-agendamento-form button[type="submit"]').textContent = 'Salvar Agendamento';
            document.getElementById('add-agendamento-form').reset();
            await populateAppointmentForm(); // Carrega os selects
            document.getElementById('add-agendamento-form-container').style.display = 'block';
        });

        document.getElementById('cancel-agendamento-btn')?.addEventListener('click', () => {
            currentEditAppointmentId = null;
            document.getElementById('add-agendamento-form-container').style.display = 'none';
        });

        document.getElementById('add-agendamento-form')?.addEventListener('submit', handleFormSubmitAgendamento);


        // LISTENERS MÓDULO CONFIGURAÇÕES: TRATAMENTOS
        document.getElementById('add-tratamento-btn')?.addEventListener('click', () => {
            currentEditTreatmentId = null;
            document.querySelector('#add-tratamento-form-container h4').textContent = 'Detalhes do Serviço';
            document.querySelector('#add-tratamento-form button[type="submit"]').textContent = 'Salvar';
            document.getElementById('add-tratamento-form-container').style.display = 'block';
            document.getElementById('add-tratamento-form').reset();
        });

        document.getElementById('cancel-tratamento-btn')?.addEventListener('click', () => {
            currentEditTreatmentId = null;
            document.getElementById('add-tratamento-form-container').style.display = 'none';
        });

        document.getElementById('add-tratamento-form')?.addEventListener('submit', handleFormSubmitTratamento);

        // LISTENERS MÓDULO CONFIGURAÇÕES: SALAS
        document.getElementById('add-sala-btn')?.addEventListener('click', () => {
            currentEditRoomId = null;
            document.querySelector('#add-sala-form-container h4').textContent = 'Detalhes da Sala';
            document.querySelector('#add-sala-form button[type="submit"]').textContent = 'Salvar';
            document.getElementById('add-sala-form-container').style.display = 'block';
            document.getElementById('add-sala-form').reset();
        });

        document.getElementById('cancel-sala-btn')?.addEventListener('click', () => {
            currentEditRoomId = null;
            document.getElementById('add-sala-form-container').style.display = 'none';
        });

        document.getElementById('add-sala-form')?.addEventListener('submit', handleFormSubmitSala);

        // LISTENERS MÓDULO FINANCEIRO
        document.getElementById('add-despesa-btn')?.addEventListener('click', () => {
            currentEditExpenseId = null;
            document.querySelector('#add-despesa-form-container h4').textContent = 'Detalhes da Despesa';
            document.querySelector('#add-despesa-form button[type="submit"]').textContent = 'Salvar Despesa';
            document.getElementById('add-despesa-form-container').style.display = 'block';
            document.getElementById('add-despesa-form').reset();
        });

        document.getElementById('cancel-despesa-btn')?.addEventListener('click', () => {
            currentEditExpenseId = null;
            document.getElementById('add-despesa-form-container').style.display = 'none';
        });

        document.getElementById('add-despesa-form')?.addEventListener('submit', handleFormSubmitDespesa);

        // LISTENERS MÓDULO CONFIGURAÇÕES: SENHA
        document.getElementById('change-password-form')?.addEventListener('submit', handleChangePassword);
    }
});