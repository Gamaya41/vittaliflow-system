// ==========================================================
// FUNÇÕES AUXILIARES PÚBLICAS
// ==========================================================

function getClientData() {
    // Simula a coleta de dados do formulário público
    return {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        telefone: document.getElementById('telefone').value,
        queixaPrincipal: document.getElementById('queixa-principal').value,
        condicoesCronicas: document.getElementById('condicoes-cronicas').value,
        gravidez: document.getElementById('gravidez').value,
        cirurgias: document.getElementById('cirurgias').value,
        medicamentosUso: document.getElementById('medicamentos-uso').value,
        alergias: document.getElementById('alergias').value,
        observacoesAnamnese: document.getElementById('observacoes-anamnese').value,
    };
}

// ==========================================================
// LÓGICA DE ENVIO (SIMULAÇÃO DE POST-BACK ENDEREÇADO)
// ==========================================================

function handleSubmitAnamnese(event) {
    event.preventDefault();
    const data = getClientData();
    const messageElement = document.getElementById('message');
    
    // CRIA UMA CHAVE DE ARMAZENAMENTO TEMPORÁRIO COM OS DADOS
    try {
        if (!data.email) {
            messageElement.textContent = "O e-mail é obrigatório.";
            // CORREÇÃO 1 & 2: Uso de string hexadecimal em vez de var(--...)
            messageElement.style.color = '#ef4444'; // Cor Danger
            return;
        }

        // Armazena os dados brutos no localStorage com uma chave de fácil reconhecimento
        localStorage.setItem('PublicAnamneseSubmission', JSON.stringify(data));
        
        // Limpa o formulário e exibe a mensagem de sucesso para o cliente
        document.getElementById('anamnese-form').reset();
        
        messageElement.textContent = "Sua ficha foi enviada com sucesso! O(a) terapeuta entrará em contato.";
        // CORREÇÃO 3 & 4: Uso de string hexadecimal para sucesso
        messageElement.style.color = '#34d399'; // Cor Secondary/Success
        
        // CORREÇÃO 5: Removida a referência var(--color-danger) da linha 17
        
        document.querySelector('button[type="submit"]').disabled = true;

    } catch (error) {
        messageElement.textContent = "Erro ao enviar a ficha. Tente novamente.";
        // CORREÇÃO 6: Uso de string hexadecimal para erro
        messageElement.style.color = '#ef4444'; // Cor Danger
        console.error("Erro no envio público:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('anamnese-form')?.addEventListener('submit', handleSubmitAnamnese);
});