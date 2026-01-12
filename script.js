// ===============================================
// 🔑 1. CONFIGURAÇÃO SUPABASE (GLOBAL)
// ===============================================
const SUPABASE_URL = 'https://kvsdsercsgezcdymihjx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2c2RzZXJjc2dlemNkeW1paGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcwOTIsImV4cCI6MjA4MTE2MzA5Mn0.zpcV9L44zRtWlMJlYCK_VIaNSitIpagoGT37IBonq6w';

// Instância global do Supabase
window.supabaseClient = null;
window.psicologoLogado = null;
let modalRelato = null;
let modalAberto = false;

// Variáveis Globais para o Carrossel
let slideIndex = 0;
let totalSlides = 0;

// ===============================================
// 2. INICIALIZAÇÃO DO SUPABASE
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase inicializado com sucesso!');
            
            // Verifica se há psicólogo logado
            verificarLoginAutomatico();
            
            // Configurar eventos
            configurarEventosPorPagina();
            configurarMascaras();
            
            // Inicializar contadores
            inicializarContadores();
            
            // Adicionar botão de voltar
            adicionarBotaoVoltarGlobal();
            
            // Testar conexão
            setTimeout(() => {
                testarConexaoSupabase();
            }, 1000);
        } else {
            console.error('❌ Supabase não carregado.');
        }
    } catch (e) {
        console.error('Erro na inicialização:', e);
    }
});

// ===============================================
// 3. FUNÇÕES DE SUPORTE
// ===============================================
function mostrarAlertaGlobal(mensagem) {
    alert(mensagem);
}

function getRegistros() {
    const registros = localStorage.getItem('pacienteRegistros');
    return registros ? JSON.parse(registros) : {};
}

function setRegistros(registros) {
    localStorage.setItem('pacienteRegistros', JSON.stringify(registros));
}

function configurarMascaras() {
    // Máscara para CPF
    const cpfInput = document.getElementById('cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
            e.target.value = value;
        });
    }
    
    // Máscara para telefone
    const telefoneInput = document.getElementById('telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            
            if (value.length > 10) {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (value.length > 6) {
                value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else if (value.length > 2) {
                value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            } else if (value.length > 0) {
                value = value.replace(/(\d{0,2})/, '($1');
            }
            e.target.value = value;
        });
    }
}

// Validação de CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Algoritmo de validação de CPF
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

// Função hashPassword (simplificada para desenvolvimento)
async function hashPassword(senha) {
    try {
        // Método simples usando TextEncoder e SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(senha);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (erro) {
        console.error('Erro ao fazer hash:', erro);
        // Fallback simples (NÃO usar em produção)
        return btoa(senha); // Apenas para desenvolvimento
    }
}

// ===============================================
// 4. AUTENTICAÇÃO - LOGIN/LOGOUT
// ===============================================
async function fazerLogin() {
    const email = document.getElementById('email')?.value.trim();
    const senha = document.getElementById('senha')?.value;
    const lembrar = document.getElementById('lembrar-me')?.checked;
    
    if (!email || !senha) {
        alert('Por favor, preencha email e senha.');
        return;
    }
    
    if (!window.supabaseClient) {
        alert('Sistema não inicializado. Tente novamente.');
        return;
    }
    
    // Mostrar loading
    const btnLogin = document.querySelector('button[onclick*="fazerLogin"]');
    const originalText = btnLogin?.textContent || 'Entrar';
    if (btnLogin) {
        btnLogin.textContent = 'Entrando...';
        btnLogin.disabled = true;
    }
    
    try {
        // 1. Buscar o psicólogo pelo email
        const { data: psicologo, error: errorPsicologo } = await window.supabaseClient
            .from('psicologos')
            .select('*')
            .eq('email', email)
            .single();
        
        if (errorPsicologo || !psicologo) {
            alert('Email não cadastrado.');
            if (btnLogin) {
                btnLogin.textContent = originalText;
                btnLogin.disabled = false;
            }
            return;
        }
        
        // 2. Buscar as credenciais de autenticação
        const { data: auth, error: errorAuth } = await window.supabaseClient
            .from('auth_psicologos')
            .select('*')
            .eq('psicologo_id', psicologo.id)
            .single();
        
        if (errorAuth || !auth) {
            alert('Erro nas credenciais. Contate o administrador.');
            if (btnLogin) {
                btnLogin.textContent = originalText;
                btnLogin.disabled = false;
            }
            return;
        }
        
        // 3. Verificar se está bloqueado
        if (auth.bloqueado_ate && new Date(auth.bloqueado_ate) > new Date()) {
            const bloqueadoAte = new Date(auth.bloqueado_ate).toLocaleString('pt-BR');
            alert(`Conta bloqueada até ${bloqueadoAte}. Tente novamente mais tarde.`);
            if (btnLogin) {
                btnLogin.textContent = originalText;
                btnLogin.disabled = false;
            }
            return;
        }
        
        // 4. Verificar senha
        const senhaHash = await hashPassword(senha);
        
        if (senhaHash !== auth.password_hash) {
            // Incrementar tentativas
            const novasTentativas = (auth.tentativas_login || 0) + 1;
            
            await window.supabaseClient
                .from('auth_psicologos')
                .update({ 
                    tentativas_login: novasTentativas,
                    bloqueado_ate: novasTentativas >= 5 ? new Date(Date.now() + 30*60000).toISOString() : null
                })
                .eq('id', auth.id);
            
            const tentativasRestantes = 5 - novasTentativas;
            if (tentativasRestantes > 0) {
                alert(`Senha incorreta. ${tentativasRestantes} tentativa(s) restante(s).`);
            } else {
                alert('Muitas tentativas falhas. Conta bloqueada por 30 minutos.');
            }
            
            if (btnLogin) {
                btnLogin.textContent = originalText;
                btnLogin.disabled = false;
            }
            return;
        }
        
        // 5. LOGIN BEM-SUCEDIDO
        // Resetar tentativas
        await window.supabaseClient
            .from('auth_psicologos')
            .update({ 
                tentativas_login: 0,
                bloqueado_ate: null
            })
            .eq('id', auth.id);
        
        // Atualizar último login do psicólogo
        await window.supabaseClient
            .from('psicologos')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('id', psicologo.id);
        
        // Salvar sessão
        window.psicologoLogado = psicologo;
        salvarSessao(psicologo, lembrar);
        
        // Redirecionar
        alert(`Bem-vindo(a), ${psicologo.nome_completo}!`);
        window.location.href = 'pgDeEscolha.html';
        
    } catch (erro) {
        console.error('Erro no login:', erro);
        alert('Erro ao fazer login. Tente novamente.');
        if (btnLogin) {
            btnLogin.textContent = originalText;
            btnLogin.disabled = false;
        }
    }
}

function salvarSessao(psicologo, lembrar) {
    const sessao = {
        id: psicologo.id,
        email: psicologo.email,
        nome: psicologo.nome_completo,
        timestamp: new Date().getTime()
    };
    
    if (lembrar) {
        // Salvar por 30 dias
        localStorage.setItem('psi_me_sessao', JSON.stringify(sessao));
        localStorage.setItem('psi_me_sessao_expira', (Date.now() + 30*24*60*60*1000).toString());
    } else {
        // Salvar apenas para a sessão atual
        sessionStorage.setItem('psi_me_sessao', JSON.stringify(sessao));
    }
}

function verificarLoginAutomatico() {
    // Verificar sessionStorage primeiro
    let sessao = sessionStorage.getItem('psi_me_sessao');
    let expira = null;
    
    if (!sessao) {
        // Verificar localStorage
        sessao = localStorage.getItem('psi_me_sessao');
        expira = localStorage.getItem('psi_me_sessao_expira');
        
        if (expira && Date.now() > parseInt(expira)) {
            // Sessão expirada
            localStorage.removeItem('psi_me_sessao');
            localStorage.removeItem('psi_me_sessao_expira');
            sessao = null;
        }
    }
    
    if (sessao) {
        window.psicologoLogado = JSON.parse(sessao);
        console.log('✅ Psicólogo logado:', window.psicologoLogado.nome);
        
        // Redirecionar da home se já estiver logado
        if (window.location.pathname.includes('home.html') && window.psicologoLogado) {
            setTimeout(() => {
                window.location.href = 'pgDeEscolha.html';
            }, 500);
        }
    } else if (!window.location.pathname.includes('home.html') && 
               !window.location.pathname.includes('cadastro_profissional.html')) {
        // Se não está logado e não está na home ou cadastro, redirecionar
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 500);
    }
}

function fazerLogout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.removeItem('psi_me_sessao');
        localStorage.removeItem('psi_me_sessao');
        localStorage.removeItem('psi_me_sessao_expira');
        window.psicologoLogado = null;
        window.location.href = 'home.html';
    }
}

function esqueciSenha() {
    const email = prompt('Digite seu email para redefinir a senha:');
    if (email) {
        alert(`Instruções de redefinição enviadas para ${email} (funcionalidade em desenvolvimento).`);
    }
}

// ===============================================
// 5. CADASTRO DE PSICÓLOGO
// ===============================================
async function cadastrarPsicologo() {
    console.log('Função cadastrarPsicologo chamada');
    
    if (!window.supabaseClient) {
        alert('Sistema não inicializado. Recarregue a página.');
        return;
    }
    
    const form = document.getElementById('form-cadastro-psicologo');
    if (!form) {
        console.error('Formulário não encontrado');
        return;
    }
    
    // Coletar dados do formulário
    const dados = {
        nome_completo: form.nomeCompleto?.value.trim() || '',
        data_nascimento: form.dataNascimento?.value || '',
        cpf: form.cpf?.value.replace(/\D/g, '') || '',
        crp: form.crp?.value.trim() || '',
        estado_crp: form.estadoCrp?.value || '',
        email: form.email?.value.trim() || '',
        senha: form.senha?.value || '',
        confirmarSenha: form.confirmarSenha?.value || ''
    };
    
    console.log('Dados coletados:', dados);
    
    // VALIDAÇÕES
    const camposObrigatorios = ['nome_completo', 'data_nascimento', 'cpf', 'crp', 'estado_crp', 'email', 'senha'];
    for (const campo of camposObrigatorios) {
        if (!dados[campo]) {
            alert(`O campo ${campo.replace('_', ' ')} é obrigatório.`);
            return;
        }
    }
    
    if (dados.senha !== dados.confirmarSenha) {
        alert('As senhas não coincidem.');
        return;
    }
    
    if (dados.senha.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
    }
    
    if (dados.cpf.length !== 11) {
        alert('CPF inválido. Deve conter 11 dígitos.');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dados.email)) {
        alert('Email inválido.');
        return;
    }
    
    // Mostrar loading
    const btnCadastrar = form.querySelector('button[type="submit"]');
    const originalText = btnCadastrar.textContent;
    btnCadastrar.textContent = 'Cadastrando...';
    btnCadastrar.disabled = true;
    
    try {
        // 1. Verificar se email já existe
        console.log('Verificando email...');
        const { data: emailExistente, error: errorEmail } = await window.supabaseClient
            .from('psicologos')
            .select('id')
            .eq('email', dados.email)
            .maybeSingle();
        
        if (emailExistente) {
            alert('Email já cadastrado.');
            btnCadastrar.textContent = originalText;
            btnCadastrar.disabled = false;
            return;
        }
        
        // 2. Verificar se CPF já existe
        console.log('Verificando CPF...');
        const { data: cpfExistente, error: errorCpf } = await window.supabaseClient
            .from('psicologos')
            .select('id')
            .eq('cpf', dados.cpf)
            .maybeSingle();
        
        if (cpfExistente) {
            alert('CPF já cadastrado.');
            btnCadastrar.textContent = originalText;
            btnCadastrar.disabled = false;
            return;
        }
        
        // 3. Criar psicólogo
        console.log('Criando psicólogo...');
        const novoPsicologo = {
            email: dados.email,
            nome_completo: dados.nome_completo,
            cpf: dados.cpf,
            crp: dados.crp,
            estado_crp: dados.estado_crp,
            data_nascimento: dados.data_nascimento
        };
        
        console.log('Dados do psicólogo:', novoPsicologo);
        
        const { data: psicologo, error: errorInsert } = await window.supabaseClient
            .from('psicologos')
            .insert([novoPsicologo])
            .select()
            .single();
        
        if (errorInsert) {
            console.error('Erro ao cadastrar psicólogo:', errorInsert);
            alert(`Erro ao cadastrar: ${errorInsert.message}`);
            btnCadastrar.textContent = originalText;
            btnCadastrar.disabled = false;
            return;
        }
        
        console.log('Psicólogo criado:', psicologo);
        
        // 4. Criar hash da senha
        console.log('Criando hash da senha...');
        const senhaHash = await hashPassword(dados.senha);
        
        // 5. Criar credenciais de autenticação
        console.log('Criando auth...');
        const authData = {
            psicologo_id: psicologo.id,
            email: psicologo.email,
            password_hash: senhaHash
        };
        
        const { error: errorAuth } = await window.supabaseClient
            .from('auth_psicologos')
            .insert([authData]);
        
        if (errorAuth) {
            console.error('Erro ao criar credenciais:', errorAuth);
            // Rollback: remover psicólogo criado
            await window.supabaseClient.from('psicologos').delete().eq('id', psicologo.id);
            alert('Erro ao criar conta. Tente novamente.');
            btnCadastrar.textContent = originalText;
            btnCadastrar.disabled = false;
            return;
        }
        
        // 6. SUCESSO
        console.log('Cadastro realizado com sucesso!');
        alert(`✅ Cadastro realizado com sucesso, ${psicologo.nome_completo}! Agora faça login.`);
        
        // Limpar formulário
        form.reset();
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
        
    } catch (erro) {
        console.error('Erro no cadastro:', erro);
        alert('Erro inesperado. Verifique o console (F12) para detalhes.');
        btnCadastrar.textContent = originalText;
        btnCadastrar.disabled = false;
    }
}

// ===============================================
// 6. CONFIGURAÇÃO DE EVENTOS
// ===============================================
function configurarEventosPorPagina() {
    // Página de Login (home.html)
    const btnLogin = document.querySelector('button[onclick*="fazerLogin"]');
    if (btnLogin) {
        btnLogin.onclick = fazerLogin;
        
        // Permitir login com Enter
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                fazerLogin();
            });
        }
    }
    
    // Página de Cadastro de Psicólogo
    const formCadastroPsicologo = document.getElementById('form-cadastro-psicologo');
    if (formCadastroPsicologo) {
        formCadastroPsicologo.addEventListener('submit', (e) => {
            e.preventDefault();
            cadastrarPsicologo();
        });
    }
    
    // Página de Cadastro de Paciente
    const btnCadastrarPaciente = document.querySelector('button[onclick*="cadastrarNovoPaciente"]');
    if (btnCadastrarPaciente) {
        btnCadastrarPaciente.onclick = cadastrarNovoPaciente;
    }
    
    // Página de Pesquisa
    const formPesquisa = document.getElementById('form-pesquisa');
    if (formPesquisa) {
        formPesquisa.addEventListener('submit', function(e) {
            e.preventDefault();
            pesquisarPacientes();
        });
        
        // Adicionar evento para limpar resultados
        const termoInput = document.getElementById('termoPesquisa');
        if (termoInput) {
            termoInput.addEventListener('input', function(e) {
                if (e.target.value.trim() === '') {
                    limparResultadosPesquisa();
                }
            });
        }
    }
    
    // Adicionar atalho Enter no campo de pesquisa
    const termoPesquisa = document.getElementById('termoPesquisa');
    if (termoPesquisa) {
        termoPesquisa.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                pesquisarPacientes();
            }
        });
    }
    
    // Página de Prontuário
    const formRelato = document.getElementById('form-novo-relato');
    if (formRelato) {
        const btnSalvar = formRelato.querySelector('button');
        if (btnSalvar) {
            btnSalvar.onclick = salvarRelato;
        }
    }
    
    // Página de Escolha
    const btnContinuar = document.querySelector('button[onclick*="continuarAcao"]');
    if (btnContinuar) {
        btnContinuar.onclick = continuarAcao;
    }
    
    // Adicionar botão de logout em todas as páginas (exceto home e cadastro)
    if (window.psicologoLogado && !window.location.pathname.includes('home.html') && 
        !window.location.pathname.includes('cadastro_profissional.html')) {
        setTimeout(() => {
            adicionarBotaoLogout();
        }, 500);
    }
}



// ===============================================
// 7. FUNÇÕES DE PACIENTE
// ===============================================
async function cadastrarNovoPaciente() {
    if (!window.supabaseClient) {
        alert('Sistema não inicializado. Aguarde alguns segundos e tente novamente.');
        return;
    }
    
    // Verificar se está logado
    if (!window.psicologoLogado) {
        alert('Faça login para cadastrar pacientes.');
        window.location.href = 'home.html';
        return;
    }
    
    const form = document.getElementById('form-cadastro-paciente');
    if (!form) {
        alert('Formulário não encontrado!');
        return;
    }
    
    // Validação básica
    if (!form.nomeCompleto.value.trim() || !form.cpf.value.trim() || !form.dataNascimento.value) {
        alert('Nome completo, CPF e Data de Nascimento são obrigatórios.');
        return;
    }
    
    // Formatar CPF (remover pontos e traço se existir)
    const cpfFormatado = form.cpf.value.replace(/\D/g, '');
    
    // Validação de CPF
    if (!validarCPF(cpfFormatado)) {
        alert('CPF inválido. Por favor, verifique o número digitado.');
        return;
    }
    
    // Objeto do paciente (incluindo psicólogo logado)
    const novoPaciente = {
        nome: form.nomeCompleto.value.trim(),
        cpf: cpfFormatado,
        nascimento: form.dataNascimento.value,
        endereco: form.endereco.value || '',
        posto: form.postoDeAtendimento.value || '',
        telefone: form.telefone.value ? form.telefone.value.replace(/\D/g, '') : '',
        email: form.email.value || '',
        obs: form.obs.value || '',
        psicologo_id: window.psicologoLogado.id
    };
    
    try {
        console.log('Enviando dados do paciente:', novoPaciente);
        
        const { data, error } = await window.supabaseClient
            .from('pacientes')
            .insert([novoPaciente])
            .select();
        
        if (error) {
            console.error('Erro detalhado do Supabase:', error);
            
            // Mensagens de erro amigáveis
            if (error.code === '23505') {
                alert('❌ CPF já cadastrado no sistema!');
            } else if (error.code === '42501') {
                alert('🔒 Permissão negada. Verifique as políticas RLS no Supabase.');
            } else if (error.message.includes('column')) {
                alert(`📋 Erro de coluna: ${error.message}. Verifique se todas as colunas existem na tabela.`);
            } else {
                alert(`⚠️ Erro ao cadastrar: ${error.message}`);
            }
            return;
        }
        
        console.log('Resposta do Supabase:', data);
        alert(`✅ Paciente "${novoPaciente.nome}" cadastrado com sucesso!`);
        form.reset();
        
        // Redireciona após 1 segundo
        setTimeout(() => {
            window.location.href = 'pgPesquisa.html';
        }, 1000);
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        alert('🚨 Erro inesperado. Verifique o console (F12 > Console) para detalhes.');
    }
}

// ===============================================
// 8. FUNÇÕES DE PESQUISA DE PACIENTES
// ===============================================
function limparResultadosPesquisa() {
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    if (resultadosDiv) {
        resultadosDiv.innerHTML = `
            <div class="texto-centralizado" style="padding: 40px;">
                <p style="color: var(--cor-texto); font-size: 1.1rem;">
                    Digite um nome ou CPF para pesquisar pacientes
                </p>
                <p style="color: var(--cor-texto-claro); font-size: 0.95rem; margin-top: 10px;">
                    Os resultados aparecerão aqui após a pesquisa
                </p>
            </div>
        `;
    }
}

async function pesquisarPacientes() {
    if (!window.supabaseClient || !window.psicologoLogado) {
        alert('Faça login para pesquisar pacientes.');
        window.location.href = 'home.html';
        return;
    }
    
    const termo = document.getElementById('termoPesquisa')?.value.trim();
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    
    if (!resultadosDiv) return;
    
    // Validação: precisa ter pelo menos 2 caracteres para pesquisar
    if (!termo || termo.length < 2) {
        resultadosDiv.innerHTML = `
            <div class="texto-centralizado" style="padding: 40px;">
                <p style="color: var(--cor-alerta); font-size: 1.1rem;">
                    Digite pelo menos 2 caracteres para pesquisar
                </p>
                <p style="color: var(--cor-texto-claro); font-size: 0.95rem; margin-top: 10px;">
                    Exemplo: "Maria" ou "123.456.789-00"
                </p>
            </div>
        `;
        return;
    }
    
    resultadosDiv.innerHTML = '<div style="text-align: center; padding: 30px;"><p>🔍 Buscando pacientes...</p></div>';
    
    try {
        let query = window.supabaseClient
            .from('pacientes')
            .select('*')
            .eq('psicologo_id', window.psicologoLogado.id);
        
        // Buscar por nome ou CPF
        query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`);
        
        const { data: pacientes, error } = await query.order('nome', { ascending: true });
        
        if (error) {
            console.error('Erro na pesquisa:', error);
            resultadosDiv.innerHTML = `
                <div class="texto-centralizado" style="padding: 40px;">
                    <p style="color: var(--cor-alerta);">Erro na busca: ${error.message}</p>
                    <button onclick="pesquisarPacientes()" class="btn-pequeno margem-superior">
                        Tentar novamente
                    </button>
                </div>
            `;
            return;
        }
        
        exibirResultados(pacientes, termo);
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        resultadosDiv.innerHTML = `
            <div class="texto-centralizado" style="padding: 40px;">
                <p style="color: var(--cor-alerta);">Erro inesperado ao buscar pacientes</p>
                <button onclick="pesquisarPacientes()" class="btn-pequeno margem-superior">
                    Tentar novamente
                </button>
            </div>
        `;
    }
}

function exibirResultados(pacientes, termoPesquisa = '') {
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    if (!resultadosDiv) return;
    
    if (!pacientes || pacientes.length === 0) {
        resultadosDiv.innerHTML = `
            <div class="container-livro">
                <div class="texto-centralizado" style="padding: 50px;">
                    <p style="color: var(--cor-texto); font-size: 1.1rem;">
                        Nenhum paciente encontrado para: "<strong>${termoPesquisa}</strong>"
                    </p>
                    <p style="color: var(--cor-texto-claro); font-size: 0.95rem; margin-top: 10px;">
                        Tente buscar por nome completo ou CPF
                    </p>
                </div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="container-livro">
            <div style="margin-bottom: 30px;">
                <h3 style="color: var(--cor-secundaria);">
                    Resultados para: "${termoPesquisa}" (${pacientes.length} encontrados)
                </h3>
            </div>
            <div class="grid-colunas">
    `;
    
    pacientes.forEach(paciente => {
        const cpfFormatado = paciente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        const dataNasc = new Date(paciente.nascimento).toLocaleDateString('pt-BR');
        
        html += `
            <div class="coluna">
                <div class="paciente-info">
                    <h4 style="color: var(--cor-primaria); margin-bottom: 10px;">${paciente.nome}</h4>
                    <p style="color: #7f8c8d; font-size: 0.9rem;">
                        📄 CPF: ${cpfFormatado}<br>
                        🎂 Nascimento: ${dataNasc}<br>
                        📞 ${paciente.telefone || 'Não informado'}<br>
                        📧 ${paciente.email || 'Não informado'}
                    </p>
                </div>
                <div style="margin-top: 20px;">
                    <button onclick="acessarProntuario(${paciente.id}, '${paciente.nome.replace(/'/g, "\\'")}')"
                            class="largura-total">
                        📋 Acessar Prontuário
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    resultadosDiv.innerHTML = html;
}

// ===============================================
// 9. FUNÇÕES DE PRONTUÁRIO
// ===============================================
function acessarProntuario(idPaciente, nomePaciente) {
    localStorage.setItem('pacienteAtual', JSON.stringify({
        id: idPaciente,
        nome: nomePaciente,
        timestamp: new Date().getTime()
    }));
    window.location.href = 'registro.html';
}

function carregarProntuario() {
    const pacienteInfo = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    
    if (pacienteInfo.nome) {
        document.getElementById('paciente-nome-titulo').textContent = pacienteInfo.nome;
    } else {
        alert('Paciente não selecionado. Redirecionando...');
        window.location.href = 'pgPesquisa.html';
        return;
    }
    
    // Carrega o histórico de consultas
    carregarHistorico();
}

async function salvarRelato() {
    // Verificar se está logado
    if (!window.psicologoLogado) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = 'home.html';
        return;
    }
    
    const pacienteInfo = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    const relatoTexto = document.getElementById('relato')?.value.trim();
    
    if (!pacienteInfo.id) {
        alert('Paciente não identificado. Volte e selecione um paciente novamente.');
        window.location.href = 'pgPesquisa.html';
        return;
    }
    
    if (!relatoTexto) {
        alert('Digite o relato da consulta antes de salvar.');
        return;
    }
    
    if (!window.supabaseClient) {
        alert('Erro de conexão com o banco de dados. Tente novamente.');
        return;
    }
    
    // Objeto para salvar no Supabase (incluindo psicólogo)
    const novaConsulta = {
        paciente_id: pacienteInfo.id,
        psicologo_id: window.psicologoLogado.id,
        relato: relatoTexto,
        data_consulta: new Date().toISOString()
    };
    
    try {
        // Salva no Supabase
        const { data, error } = await window.supabaseClient
            .from('consultas')
            .insert([novaConsulta])
            .select();
        
        if (error) {
            console.error('Erro ao salvar consulta:', error);
            
            // Tenta salvar localmente se o Supabase falhar
            salvarRelatoLocal(pacienteInfo.id, relatoTexto, false);
            alert(`⚠️ Erro ao salvar no banco. Dados salvos localmente. Erro: ${error.message}`);
            
            document.getElementById('relato').value = '';
            carregarHistoricoLocal(pacienteInfo.id);
            return;
        }
        
        console.log('Consulta salva com sucesso no Supabase:', data);
        
        // Também salva localmente para cache offline
        salvarRelatoLocal(pacienteInfo.id, relatoTexto, true);
        
        // Limpa o campo
        if (document.getElementById('relato')) {
            document.getElementById('relato').value = '';
        }
        
        // Recarrega o histórico
        await carregarHistorico();
        
        alert('✅ Relato salvo com sucesso no banco de dados!');
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        alert('Erro ao salvar. Tentando salvar localmente...');
        
        // Fallback: salva localmente se o Supabase falhar
        salvarRelatoLocal(pacienteInfo.id, relatoTexto, false);
        if (document.getElementById('relato')) {
            document.getElementById('relato').value = '';
        }
        carregarHistoricoLocal(pacienteInfo.id);
    }
}

// Função auxiliar para salvar localmente (cache/offline)
function salvarRelatoLocal(pacienteId, relatoTexto, sincronizado = false) {
    const registros = getRegistros();
    
    if (!registros[pacienteId]) {
        registros[pacienteId] = [];
    }
    
    const novoRegistro = {
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        texto: relatoTexto,
        sincronizado: sincronizado,
        data_completa: new Date().toISOString()
    };
    
    registros[pacienteId].unshift(novoRegistro);
    setRegistros(registros);
}

// ===============================================
// 10. FUNÇÕES DE HISTÓRICO
// ===============================================
async function carregarHistorico() {
    const pacienteInfo = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    const pacienteId = pacienteInfo.id;
    const historicoDiv = document.getElementById('lista-historico');
    
    if (!historicoDiv || !pacienteId) {
        console.error('Elemento #lista-historico não encontrado ou pacienteId inválido');
        return;
    }
    
    historicoDiv.innerHTML = '<p style="text-align: center;">Carregando histórico...</p>';
    
    try {
        // Busca do Supabase (apenas consultas do psicólogo logado)
        const { data: consultas, error } = await window.supabaseClient
            .from('consultas')
            .select('*')
            .eq('paciente_id', pacienteId)
            .eq('psicologo_id', window.psicologoLogado.id)
            .order('data_consulta', { ascending: false });
        
        if (error) {
            console.error('Erro ao carregar consultas do Supabase:', error);
            // Fallback: carrega do localStorage
            carregarHistoricoLocal(pacienteId);
            return;
        }
        
        // Se não houver consultas no Supabase, tenta do localStorage
        if (!consultas || consultas.length === 0) {
            console.log('Nenhuma consulta encontrada no Supabase, tentando localStorage...');
            carregarHistoricoLocal(pacienteId);
            
            // Tenta sincronizar relatos locais não sincronizados
            await sincronizarRelatosLocais(pacienteId);
            return;
        }
        
        // Exibe as consultas do Supabase
        let html = '';
        consultas.forEach(consulta => {
            const data = new Date(consulta.data_consulta);
            const dataFormatada = data.toLocaleDateString('pt-BR');
            const horaFormatada = data.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Resumo do texto (apenas primeiros 200 caracteres)
            const textoResumido = consulta.relato.length > 200 ? 
                consulta.relato.substring(0, 200) + '...' : 
                consulta.relato;
            
            // Escapar aspas para evitar problemas no onclick
            const textoEscapado = consulta.relato.replace(/'/g, "\\'").replace(/"/g, '\\"');
            
            html += `
            <div class="relato-card" style="cursor: pointer;" 
                 onclick="abrirRelatoCompleto('${consulta.id}', '${dataFormatada}', '${horaFormatada}', '${textoEscapado}')">
                <div class="relato-header">
                    <span>${dataFormatada}</span>
                    <span>${horaFormatada}</span>
                    <span style="color: var(--cor-secundaria); font-size: 0.9rem; margin-left: 10px;">📖 Clique para ver completo</span>
                </div>
                <p class="relato-texto" style="color: #666; margin-top: 10px;">
                    ${textoResumido.replace(/\n/g, '<br>')}
                </p>
            </div>
            `;
        });
        
        historicoDiv.innerHTML = html;
        
        // Sincroniza relatos locais não sincronizados
        await sincronizarRelatosLocais(pacienteId);
        
        // Atualiza os registros locais com dados do Supabase
        atualizarRegistrosLocaisComSupabase(consultas, pacienteId);
        
    } catch (erro) {
        console.error('Erro ao carregar histórico:', erro);
        // Fallback para localStorage
        carregarHistoricoLocal(pacienteId);
    }
}

// Função para carregar do localStorage (fallback)
function carregarHistoricoLocal(pacienteId) {
    const registros = getRegistros();
    const historicoDiv = document.getElementById('lista-historico');
    
    if (!historicoDiv) return;
    
    if (!registros[pacienteId] || registros[pacienteId].length === 0) {
        historicoDiv.innerHTML = '<p style="text-align: center; font-style: italic;">Nenhum registro anterior encontrado.</p>';
        return;
    }
    
    // Ordena por data mais recente
    registros[pacienteId].sort((a, b) => {
        return new Date(b.data_completa || b.data) - new Date(a.data_completa || a.data);
    });
    
    let html = '';
    registros[pacienteId].forEach(registro => {
        // Resumo do texto (apenas primeiros 200 caracteres)
        const textoResumido = registro.texto.length > 200 ? 
            registro.texto.substring(0, 200) + '...' : 
            registro.texto;
        
        // Escapar aspas para evitar problemas no onclick
        const textoEscapado = registro.texto.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        html += `
        <div class="relato-card" style="cursor: pointer;" 
             onclick="abrirRelatoCompleto('local_${Date.now()}', '${registro.data}', '${registro.hora}', '${textoEscapado}')">
            <div class="relato-header">
                <span>${registro.data}</span>
                <span>${registro.hora}</span>
                <span style="color: var(--cor-secundaria); font-size: 0.9rem; margin-left: 10px;">📖 Clique para ver completo</span>
                ${registro.sincronizado === false ? 
                    '<span style="color: orange; font-size: 0.8rem;">(Não sincronizado)</span>' : 
                    '<span style="color: green; font-size: 0.8rem;">(Local)</span>'}
            </div>
            <p class="relato-texto" style="color: #666; margin-top: 10px;">
                ${textoResumido.replace(/\n/g, '<br>')}
            </p>
        </div>
        `;
    });
    
    historicoDiv.innerHTML = html;
}

// Função para sincronizar relatos locais com o Supabase
async function sincronizarRelatosLocais(pacienteId) {
    const registros = getRegistros();
    
    if (!registros[pacienteId]) return;
    
    // Filtra relatos não sincronizados
    const relatosParaSincronizar = registros[pacienteId].filter(r => r.sincronizado === false);
    
    if (relatosParaSincronizar.length === 0) return;
    
    console.log(`Sincronizando ${relatosParaSincronizar.length} relatos locais...`);
    
    for (const relato of relatosParaSincronizar) {
        try {
            // Tenta criar uma data a partir dos campos separados
            let dataConsulta;
            try {
                if (relato.data_completa) {
                    dataConsulta = new Date(relato.data_completa);
                } else {
                    // Tenta combinar data e hora
                    const [dia, mes, ano] = relato.data.split('/');
                    const [hora, minuto] = relato.hora.split(':');
                    dataConsulta = new Date(ano, mes - 1, dia, hora, minuto);
                }
            } catch (e) {
                dataConsulta = new Date();
            }
            
            const novaConsulta = {
                paciente_id: pacienteId,
                psicologo_id: window.psicologoLogado.id,
                relato: relato.texto,
                data_consulta: dataConsulta.toISOString()
            };
            
            const { error } = await window.supabaseClient
                .from('consultas')
                .insert([novaConsulta]);
            
            if (!error) {
                // Marca como sincronizado
                relato.sincronizado = true;
                console.log('Relato sincronizado com sucesso:', relato.texto.substring(0, 50) + '...');
            } else {
                console.error('Erro ao sincronizar relato:', error);
            }
        } catch (erro) {
            console.error('Erro na sincronização:', erro);
        }
    }
    
    // Atualiza o localStorage
    setRegistros(registros);
}

// Atualiza registros locais com dados do Supabase
function atualizarRegistrosLocaisComSupabase(consultasSupabase, pacienteId) {
    const registros = getRegistros();
    
    if (!registros[pacienteId]) {
        registros[pacienteId] = [];
    }
    
    // Para cada consulta do Supabase, verifica se já existe localmente
    consultasSupabase.forEach(consulta => {
        const dataConsulta = new Date(consulta.data_consulta);
        const dataFormatada = dataConsulta.toLocaleDateString('pt-BR');
        const horaFormatada = dataConsulta.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Verifica se já existe um registro local equivalente
        const existeLocal = registros[pacienteId].some(reg => 
            reg.texto === consulta.relato && 
            reg.data === dataFormatada &&
            reg.sincronizado === true
        );
        
        if (!existeLocal) {
            // Adiciona ao localStorage como já sincronizado
            registros[pacienteId].push({
                data: dataFormatada,
                hora: horaFormatada,
                texto: consulta.relato,
                sincronizado: true,
                data_completa: consulta.data_consulta
            });
        }
    });
    
    // Ordena por data
    registros[pacienteId].sort((a, b) => {
        return new Date(b.data_completa || b.data) - new Date(a.data_completa || a.data);
    });
    
    setRegistros(registros);
}

// Função para abrir relatório completo (CORRIGIDA)
function abrirRelatorioCompleto() {
    const pacienteStorage = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    
    if (pacienteStorage.id) {
        // Abre a página de relatório passando o ID do paciente
        window.open(`relatorio_paciente.html?pacienteId=${pacienteStorage.id}`, '_blank');
    } else {
        alert('Nenhum paciente selecionado para gerar relatório.');
    }
}

// Função para abrir relato completo (NOVA FUNÇÃO)
function abrirRelatoCompleto(relatoId, data, hora, texto = '') {
    // Codificar parâmetros para URL
    const textoCodificado = texto ? encodeURIComponent(texto) : '';
    const dataHora = encodeURIComponent(`${data} às ${hora}`);
    
    // Montar URL
    let url = `pg_relato.html?data=${dataHora}`;
    
    // Adicionar ID se tiver
    if (relatoId && !relatoId.startsWith('local_')) {
        url += `&id=${relatoId}`;
    }
    
    // Adicionar texto se tiver (para relatos locais)
    if (textoCodificado) {
        url += `&texto=${textoCodificado}`;
    }
    
    // Abrir em nova aba
    window.open(url, '_blank');
}

// ===============================================
// 12. FUNÇÕES DE NAVEGAÇÃO
// ===============================================
function acessarSistema() {
    // Redireciona para fazer login
    fazerLogin();
}

function continuarAcao() {
    if (!window.psicologoLogado) {
        alert('Faça login para continuar.');
        window.location.href = 'home.html';
        return;
    }
    
    const radios = document.getElementsByName('acao');
    let acaoSelecionada = '';
    
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            acaoSelecionada = radios[i].value;
            break;
        }
    }
    
    if (acaoSelecionada === 'novo') {
        window.location.href = 'pgInicioAdc.html';
    } else if (acaoSelecionada === 'pesquisar') {
        window.location.href = 'pgPesquisa.html';
    } else {
        alert('Por favor, selecione uma opção antes de continuar.');
    }
}

// ===============================================
// 13. FUNÇÕES DE TESTE
// ===============================================
async function testarConexaoSupabase() {
    if (!window.supabaseClient) {
        console.error('Supabase não inicializado');
        return false;
    }
    
    try {
        // Testa a conexão com uma consulta simples
        const { data, error } = await window.supabaseClient
            .from('pacientes')
            .select('count')
            .limit(1);
        
        if (error) {
            console.error('Teste de conexão falhou:', error);
            return false;
        }
        
        console.log('✅ Conexão com Supabase estabelecida com sucesso');
        return true;
    } catch (erro) {
        console.error('Erro no teste de conexão:', erro);
        return false;
    }
}

// ===============================================
// 14. FUNÇÕES DE CARROSSEL
// ===============================================
function mudarSlide(n) {
    slideIndex += n;
    const wrapper = document.getElementById('historico-wrapper');
    
    if (!wrapper) return;
    
    totalSlides = wrapper.children.length;
    
    // Garante que o índice não saia dos limites
    if (slideIndex >= totalSlides) {
        slideIndex = 0;
    }
    if (slideIndex < 0) {
        slideIndex = totalSlides - 1;
    }
    
    // Calcula a translação horizontal necessária
    wrapper.style.transform = `translateX(${-slideIndex * 100}%)`;
}

// ===============================================
// FUNÇÃO PARA ADICIONAR BOTÃO DE VOLTAR
// ===============================================
function adicionarBotaoVoltarGlobal() {
    // Não adicionar botão de voltar nas páginas iniciais
    if (window.location.pathname.includes('home.html') || 
        window.location.pathname.includes('cadastro_profissional.html')) {
        return;
    }
    
    // Verifica se já existe um botão de voltar
    if (document.querySelector('.btn-voltar-global')) return;
    
    // Determina a página de destino baseada na página atual
    let destino = 'javascript:history.back()';
    let texto = '← Voltar';
    
    if (window.location.pathname.includes('pgPesquisa.html')) {
        destino = 'pgDeEscolha.html';
         texto = '← Sair'
    } else if (window.location.pathname.includes('registro.html')) {
        destino = 'pgPesquisa.html';
        let texto = '← Voltar'
    } else if (window.location.pathname.includes('pgInicioAdc.html')) {
        destino = 'pgDeEscolha.html';
         texto = '← Sair'
    } else if (window.location.pathname.includes('pgDeEscolha.html')) {
        destino = 'home.html';
        texto = '← Sair';
    }
    
    // Cria o botão
    const btnVoltar = document.createElement('a');
    btnVoltar.className = 'btn-voltar-global';
    btnVoltar.href = destino;
    btnVoltar.innerHTML = texto;
    btnVoltar.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background-color: transparent;
        color: var(--cor-secundaria);
        border: 1px solid var(--cor-secundaria);
        padding: 8px 15px;
        border-radius: 10px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        z-index: 1000;
    `;
    
    // Adiciona hover effect
    btnVoltar.onmouseover = function() {
        this.style.backgroundColor = 'var(--cor-secundaria)';
        this.style.color = 'white';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    };
    
    btnVoltar.onmouseout = function() {
        this.style.backgroundColor = 'transparent';
        this.style.color = 'var(--cor-secundaria)';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    };
    
    document.body.appendChild(btnVoltar);
    
    // Ajusta margem do título para não sobrepor
    const h1 = document.querySelector('h1');
    if (h1) {
        h1.style.marginTop = '60px';
    }
}

// ================================================
// FUNÇÕES ADICIONAIS PARA REGISTRO.HTML
// ================================================

// Função de feedback para salvar relato (para registro.html)
async function salvarRelatoComFeedback() {
    const btnSalvar = document.querySelector('.btn-salvar');
    const statusDiv = document.getElementById('status-salvamento');
    const relatoTexto = document.getElementById('relato')?.value.trim();
    
    if (!relatoTexto) {
        if (statusDiv) {
            statusDiv.className = 'status-salvamento status-erro';
            statusDiv.textContent = 'Digite o relato da consulta antes de salvar.';
        }
        return;
    }
    
    // Desabilitar botão durante o salvamento
    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '⏳ Salvando...';
    }
    
    if (statusDiv) {
        statusDiv.className = 'status-salvamento';
        statusDiv.textContent = '';
    }
    
    try {
        // Chamar função original de salvarRelato
        await salvarRelato();
        
        // Feedback de sucesso
        if (statusDiv) {
            statusDiv.className = 'status-salvamento status-sucesso';
            statusDiv.textContent = '✅ Relato salvo com sucesso! Atualizando histórico...';
        }
        
        // Limpar campo
        const campoRelato = document.getElementById('relato');
        if (campoRelato) {
            campoRelato.value = '';
        }
        
        // Recarregar histórico após salvar
        setTimeout(async () => {
            await carregarHistorico();
            
            if (statusDiv) {
                statusDiv.textContent = '✅ Relato salvo e histórico atualizado!';
                
                // Limpar status após 3 segundos
                setTimeout(() => {
                    statusDiv.className = 'status-salvamento';
                    statusDiv.textContent = '';
                }, 3000);
            }
        }, 1000);
        
    } catch (erro) {
        console.error('Erro ao salvar relato:', erro);
        if (statusDiv) {
            statusDiv.className = 'status-salvamento status-erro';
            statusDiv.textContent = '❌ Erro ao salvar relato: ' + (erro.message || 'Tente novamente.');
        }
    } finally {
        // Reabilitar botão
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '💾 Salvar Consulta';
        }
    }
}

// Função para gerar relatório (para registro.html)
function gerarRelatorioPaciente() {
    const pacienteStorage = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    
    if (pacienteStorage.id) {
        // Armazenar o ID do paciente para a página de relatório
        localStorage.setItem('pacienteParaRelatorio', JSON.stringify(pacienteStorage));
        
        // Redirecionar para a página de relatório
        window.location.href = 'relatorio_paciente.html';
    } else {
        alert('❌ Nenhum paciente selecionado.');
    }
    // ================================================
// FUNÇÕES DE AGENDAMENTO
// ================================================

// Função para acessar agendamento a partir do prontuário
// ================================================
// FUNÇÃO DE AGENDAMENTO - ADICIONE ISSO NO FINAL DO ARQUIVO
// ================================================

function acessarAgendamento() {
    console.log('Função acessarAgendamento chamada');
    
    // Verificar se há paciente selecionado
    const pacienteStorage = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    
    if (!pacienteStorage || !pacienteStorage.id) {
        alert('❌ Selecione um paciente primeiro.');
        window.location.href = 'pgPesquisa.html';
        return;
    }
    
    // Verificar se está logado
    if (!window.psicologoLogado) {
        alert('🔒 Faça login para acessar o agendamento.');
        window.location.href = 'home.html';
        return;
    }
    
    console.log('Redirecionando para agendamento...');
    window.location.href = 'agendamento.html';
}

// EXPORTAR PARA USO GLOBAL
window.acessarAgendamento = acessarAgendamento;

// Adicionar botão de agendamento na página de registro
function adicionarBotaoAgendamento() {
    if (!window.location.pathname.includes('registro.html')) return;
    
    // Verificar se já existe
    if (document.getElementById('btn-agendar-consulta')) return;
    
    const btnAgendar = document.createElement('button');
    btnAgendar.id = 'btn-agendar-consulta';
    btnAgendar.innerHTML = '📅 Agendar Consulta';
    btnAgendar.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background-color: var(--cor-primaria);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 10px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        box-shadow: var(--sombra-suave);
    `;
    
    btnAgendar.onclick = acessarAgendamento;
    btnAgendar.onmouseover = function() {
        this.style.backgroundColor = 'var(--cor-primaria-escura)';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    };
    
    btnAgendar.onmouseout = function() {
        this.style.backgroundColor = 'var(--cor-primaria)';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'var(--sombra-suave)';
    };
    
    document.body.appendChild(btnAgendar);
}

// Chamar na inicialização
document.addEventListener('DOMContentLoaded', () => {
    // ... código existente ...
    
    // Adicionar botão de agendamento na página de registro
    adicionarBotaoAgendamento();
});
}

// ================================================
// EXPORTAÇÃO GLOBAL DAS FUNÇÕES
// ================================================

// Exportar funções para uso global
window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;
window.cadastrarNovoPaciente = cadastrarNovoPaciente;
window.pesquisarPacientes = pesquisarPacientes;
window.acessarProntuario = acessarProntuario;
window.salvarRelato = salvarRelato;
window.carregarHistorico = carregarHistorico;
window.abrirRelatorioCompleto = abrirRelatorioCompleto;
window.abrirRelatoCompleto = abrirRelatoCompleto;
window.continuarAcao = continuarAcao;
window.esqueciSenha = esqueciSenha;
window.cadastrarPsicologo = cadastrarPsicologo;
window.salvarRelatoComFeedback = salvarRelatoComFeedback;
window.gerarRelatorioPaciente = gerarRelatorioPaciente;
window.acessarAgendamento = acessarAgendamento; // <-- ADICIONE ESTA LINHA