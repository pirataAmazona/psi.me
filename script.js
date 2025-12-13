// ===============================================
// 🔑 1. CONFIGURAÇÃO SUPABASE
// ===============================================
const SUPABASE_URL = 'https://kvsdsercsgezcdymihjx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2c2RzZXJjc2dlemNkeW1paGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcwOTIsImV4cCI6MjA4MTE2MzA5Mn0.zpcV9L44zRtWlMJlYCK_VIaNSitIpagoGT37IBonq6w';

let supabase = null;
let psicologoLogado = null;

// ===============================================
// 2. INICIALIZAÇÃO DO SUPABASE
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase inicializado com sucesso!');
            
            // Verifica se há psicólogo logado
            verificarLoginAutomatico();
            
            // Configurar eventos
            configurarEventosPorPagina();
            configurarMascaras();
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
    
    if (!supabase) {
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
        const { data: psicologo, error: errorPsicologo } = await supabase
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
        const { data: auth, error: errorAuth } = await supabase
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
            
            await supabase
                .from('auth_psicologos')
                .update({ 
                    tentativas_login: novasTentativas,
                    bloqueado_ate: novasTentativas >= 5 ? new Date(Date.now() + 30*60000).toISOString() : null // 30 minutos
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
        await supabase
            .from('auth_psicologos')
            .update({ 
                tentativas_login: 0,
                bloqueado_ate: null
            })
            .eq('id', auth.id);
        
        // Atualizar último login do psicólogo
        await supabase
            .from('psicologos')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('id', psicologo.id);
        
        // Salvar sessão
        psicologoLogado = psicologo;
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
        psicologoLogado = JSON.parse(sessao);
        console.log('✅ Psicólogo logado:', psicologoLogado.nome);
        
        // Redirecionar da home se já estiver logado
        if (window.location.pathname.includes('home.html') && psicologoLogado) {
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
        psicologoLogado = null;
        window.location.href = 'home.html';
    }
}

function esqueciSenha() {
    const email = prompt('Digite seu email para redefinir a senha:');
    if (email) {
        alert(`Instruções de redefinição enviadas para ${email} (funcionalidade em desenvolvimento).`);
        // Implementar: gerar token, enviar email, etc.
    }
}

// ===============================================
// 5. CADASTRO DE PSICÓLOGO
// ===============================================
async function cadastrarPsicologo() {
    console.log('Função cadastrarPsicologo chamada');
    
    if (!supabase) {
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
        const { data: emailExistente, error: errorEmail } = await supabase
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
        const { data: cpfExistente, error: errorCpf } = await supabase
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
        
        const { data: psicologo, error: errorInsert } = await supabase
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
        
        const { error: errorAuth } = await supabase
            .from('auth_psicologos')
            .insert([authData]);
        
        if (errorAuth) {
            console.error('Erro ao criar credenciais:', errorAuth);
            // Rollback: remover psicólogo criado
            await supabase.from('psicologos').delete().eq('id', psicologo.id);
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
    
    // Página de Cadastro de Psicólogo (cadastro_profissional.html)
    const formCadastroPsicologo = document.getElementById('form-cadastro-psicologo');
    if (formCadastroPsicologo) {
        formCadastroPsicologo.addEventListener('submit', (e) => {
            e.preventDefault();
            cadastrarPsicologo();
        });
    }
    
    // Página de Cadastro de Paciente (pgInicioAdc.html)
    const btnCadastrarPaciente = document.querySelector('button[onclick*="cadastrarNovoPaciente"]');
    if (btnCadastrarPaciente) {
        btnCadastrarPaciente.onclick = cadastrarNovoPaciente;
    }
    
    // Página de Pesquisa (pgPesquisa.html)
    const formPesquisa = document.getElementById('form-pesquisa');
    if (formPesquisa) {
        formPesquisa.addEventListener('submit', function(e) {
            e.preventDefault();
            pesquisarPacientes();
        });
        
        // Carrega todos os pacientes quando a página carrega
        carregarTodosPacientes();
    }
    
    // Página de Prontuário (registro.html)
    const formRelato = document.getElementById('form-novo-relato');
    if (formRelato) {
        const btnSalvar = formRelato.querySelector('button');
        if (btnSalvar) {
            btnSalvar.onclick = salvarRelato;
        }
    }
    
    // Página de Escolha (pgDeEscolha.html)
    const btnContinuar = document.querySelector('button[onclick*="continuarAcao"]');
    if (btnContinuar) {
        btnContinuar.onclick = continuarAcao;
    }
    
    // Home antigo (acessarSistema)
    const btnAcessarSistema = document.querySelector('button[onclick*="acessarSistema"]');
    if (btnAcessarSistema && btnAcessarSistema.onclick) {
        btnAcessarSistema.onclick = fazerLogin;
    }
    
    // Adicionar botão de logout em todas as páginas (exceto home e cadastro)
    if (psicologoLogado && !window.location.pathname.includes('home.html') && 
        !window.location.pathname.includes('cadastro_profissional.html')) {
        setTimeout(() => {
            adicionarBotaoLogout();
        }, 500);
    }
}

function adicionarBotaoLogout() {
    // Verificar se já existe
    if (document.getElementById('btn-logout')) return;
    
    const btnLogout = document.createElement('button');
    btnLogout.id = 'btn-logout';
    btnLogout.textContent = 'Sair';
    btnLogout.style.position = 'fixed';
    btnLogout.style.top = '20px';
    btnLogout.style.right = '20px';
    btnLogout.style.padding = '8px 15px';
    btnLogout.style.fontSize = '0.9rem';
    btnLogout.style.backgroundColor = 'transparent';
    btnLogout.style.color = 'var(--cor-secundaria)';
    btnLogout.style.border = '1px solid var(--cor-secundaria)';
    btnLogout.style.borderRadius = '10px';
    btnLogout.style.cursor = 'pointer';
    btnLogout.style.zIndex = '1000';
    btnLogout.onclick = fazerLogout;
    
    document.body.appendChild(btnLogout);
}

// ===============================================
// 7. FUNÇÕES DE PACIENTE (atualizadas para incluir psicólogo)
// ===============================================
async function cadastrarNovoPaciente() {
    if (!supabase) {
        alert('Sistema não inicializado. Aguarde alguns segundos e tente novamente.');
        return;
    }
    
    // Verificar se está logado
    if (!psicologoLogado) {
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
        psicologo_id: psicologoLogado.id // Vincular ao psicólogo logado
    };
    
    try {
        console.log('Enviando dados do paciente:', novoPaciente);
        
        const { data, error } = await supabase
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
async function carregarTodosPacientes() {
    if (!supabase || !psicologoLogado) return;
    
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    if (!resultadosDiv) return;
    
    resultadosDiv.innerHTML = '<p style="text-align: center;">Carregando pacientes...</p>';
    
    try {
        // Buscar apenas pacientes do psicólogo logado
        const { data: pacientes, error } = await supabase
            .from('pacientes')
            .select('*')
            .eq('psicologo_id', psicologoLogado.id)
            .order('nome', { ascending: true });
        
        if (error) {
            console.error('Erro ao carregar:', error);
            resultadosDiv.innerHTML = `<p style="color: red;">Erro ao carregar: ${error.message}</p>`;
            return;
        }
        
        exibirResultados(pacientes);
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        resultadosDiv.innerHTML = `<p style="color: red;">Erro inesperado</p>`;
    }
}

async function pesquisarPacientes() {
    if (!supabase || !psicologoLogado) {
        alert('Faça login para pesquisar pacientes.');
        window.location.href = 'home.html';
        return;
    }
    
    const termo = document.getElementById('termoPesquisa')?.value.trim();
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    
    if (!resultadosDiv) return;
    
    resultadosDiv.innerHTML = '<p style="text-align: center;">Buscando...</p>';
    
    try {
        let query = supabase
            .from('pacientes')
            .select('*')
            .eq('psicologo_id', psicologoLogado.id);
        
        if (termo && termo.length > 0) {
            // Buscar por nome ou CPF
            query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`);
        }
        
        const { data: pacientes, error } = await query.order('nome', { ascending: true });
        
        if (error) {
            console.error('Erro na pesquisa:', error);
            resultadosDiv.innerHTML = `<p style="color: red;">Erro na busca: ${error.message}</p>`;
            return;
        }
        
        exibirResultados(pacientes);
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        resultadosDiv.innerHTML = `<p style="color: red;">Erro inesperado</p>`;
    }
}

function exibirResultados(pacientes) {
    const resultadosDiv = document.getElementById('resultados-pesquisa');
    if (!resultadosDiv) return;
    
    if (!pacientes || pacientes.length === 0) {
        resultadosDiv.innerHTML = `
            <h3>Resultados da Pesquisa</h3>
            <div style="text-align: center; color: var(--cor-texto); padding: 40px;">
                Nenhum paciente encontrado.
            </div>
        `;
        return;
    }
    
    let html = `<h3>Resultados da Pesquisa (${pacientes.length})</h3>`;
    
    pacientes.forEach(paciente => {
        // Formatar CPF para exibição
        const cpfFormatado = paciente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        
        html += `
        <div class="paciente-card">
            <div>
                <p class="paciente-nome">${paciente.nome}</p>
                <p class="paciente-cpf">CPF: ${cpfFormatado}</p>
                <p style="font-size: 0.9rem; color: #666;">Nasc: ${new Date(paciente.nascimento).toLocaleDateString('pt-BR')}</p>
            </div>
            <a href="#" class="access-link" onclick="acessarProntuario(${paciente.id}, '${paciente.nome.replace(/'/g, "\\'")}'); return false;">
                Acessar Prontuário
            </a>
        </div>
        `;
    });
    
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
    if (!psicologoLogado) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = 'home.html';
        return;
    }
    
    const pacienteInfo = JSON.parse(localStorage.getItem('pacienteAtual') || '{}');
    const relatoTexto = document.getElementById('relato').value.trim();
    
    if (!pacienteInfo.id) {
        alert('Paciente não identificado. Volte e selecione um paciente novamente.');
        window.location.href = 'pgPesquisa.html';
        return;
    }
    
    if (!relatoTexto) {
        alert('Digite o relato da consulta antes de salvar.');
        return;
    }
    
    if (!supabase) {
        alert('Erro de conexão com o banco de dados. Tente novamente.');
        return;
    }
    
    // Objeto para salvar no Supabase (incluindo psicólogo)
    const novaConsulta = {
        paciente_id: pacienteInfo.id,
        psicologo_id: psicologoLogado.id, // Adicionar psicólogo
        relato: relatoTexto,
        data_consulta: new Date().toISOString()
    };
    
    try {
        // Salva no Supabase
        const { data, error } = await supabase
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
        document.getElementById('relato').value = '';
        
        // Recarrega o histórico
        await carregarHistorico();
        
        alert('✅ Relato salvo com sucesso no banco de dados!');
        
    } catch (erro) {
        console.error('Erro inesperado:', erro);
        alert('Erro ao salvar. Tentando salvar localmente...');
        
        // Fallback: salva localmente se o Supabase falhar
        salvarRelatoLocal(pacienteInfo.id, relatoTexto, false);
        document.getElementById('relato').value = '';
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
        const { data: consultas, error } = await supabase
            .from('consultas')
            .select('*')
            .eq('paciente_id', pacienteId)
            .eq('psicologo_id', psicologoLogado.id)
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
            
            html += `
            <div class="relato-card">
                <div class="relato-header">
                    <span>${dataFormatada}</span>
                    <span>${horaFormatada}</span>
                    <span style="color: var(--cor-primaria); font-size: 0.8rem;">(Supabase)</span>
                </div>
                <p class="relato-texto">${consulta.relato.replace(/\n/g, '<br>')}</p>
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
        html += `
        <div class="relato-card">
            <div class="relato-header">
                <span>${registro.data}</span>
                <span>${registro.hora}</span>
                ${registro.sincronizado === false ? 
                    '<span style="color: orange; font-size: 0.8rem;">(Não sincronizado)</span>' : 
                    '<span style="color: green; font-size: 0.8rem;">(Local)</span>'}
            </div>
            <p class="relato-texto">${registro.texto.replace(/\n/g, '<br>')}</p>
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
                psicologo_id: psicologoLogado.id,
                relato: relato.texto,
                data_consulta: dataConsulta.toISOString()
            };
            
            const { error } = await supabase
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

// ===============================================
// 10. FUNÇÕES DE NAVEGAÇÃO
// ===============================================
function acessarSistema() {
    // Redireciona para fazer login
    fazerLogin();
}

function continuarAcao() {
    if (!psicologoLogado) {
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
// 11. FUNÇÕES DE TESTE
// ===============================================
async function testarConexaoSupabase() {
    if (!supabase) {
        console.error('Supabase não inicializado');
        return false;
    }
    
    try {
        // Testa a conexão com uma consulta simples
        const { data, error } = await supabase
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

// Inicializa teste de conexão quando a página carrega
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            testarConexaoSupabase();
        }, 1000);
    });
} else {
    setTimeout(() => {
        testarConexaoSupabase();
    }, 1000);
    // Função para carregar o registro detalhado na página de detalhes
async function carregarRegistroDetalhado() {
    const registroId = localStorage.getItem('registroSelecionado');
    
    if (!registroId) {
        document.getElementById('conteudo-registro').innerHTML = 
            '<p>Nenhum registro selecionado.</p>';
        return;
    }
    
    // Buscar o registro no Supabase
    const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('id', registroId)
        .single();
    
    if (error) {
        console.error('Erro ao buscar registro:', error);
        document.getElementById('conteudo-registro').innerHTML = 
            '<p>Erro ao carregar o registro.</p>';
        return;
    }
    
    const dataFormatada = new Date(data.data).toLocaleDateString('pt-BR');
    const horaFormatada = new Date(data.data).toLocaleTimeString('pt-BR');
    
    document.getElementById('conteudo-registro').innerHTML = `
        <div class="cabecalho-detalhado">
            <h2>Consulta de ${dataFormatada}</h2>
            <p class="hora-registro">${horaFormatada}</p>
        </div>
        <div class="texto-completo">
            ${data.relato.replace(/\n/g, '<br>')}
        </div>
    `;
}
}