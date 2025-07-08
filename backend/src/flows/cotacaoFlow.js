/**
 * Fluxo de Cotação de Seguros
 * Implementa o processo completo de coleta de dados para cotação
 */

const stateManager = require('../core/stateManager');
const whatsappService = require('../services/whatsappService');
const menuService = require('../services/menuService');
const utils = require('../core/utils');
const csvService = require('../services/csvService');

// Importa o Google Sheets Service se disponível
let googleSheetsService = null;
try {
    googleSheetsService = require('../services/googleSheetsService');
} catch (error) {
    console.log('📊 Google Sheets Service não encontrado. Funcionando sem integração.');
}

class CotacaoFlow {
    constructor() {
        this.steps = new Map();
        this.initializeSteps();
    }

    /**
     * Inicializa os passos do fluxo de cotação
     */
    initializeSteps() {
        this.steps.set('tipo_seguro', this.handleTipoSeguro.bind(this));
        this.steps.set('dados_pessoais', this.handleDadosPessoais.bind(this));
        this.steps.set('coleta_nome', this.handleColetaNome.bind(this));
        this.steps.set('coleta_email', this.handleColetaEmail.bind(this));
        this.steps.set('coleta_cpf', this.handleColetaCPF.bind(this));
        this.steps.set('dados_veiculo', this.handleDadosVeiculo.bind(this));
        this.steps.set('resumo', this.handleResumo.bind(this));
        this.steps.set('finalizado', this.handleFinalizado.bind(this));
    }

    /**
     * Inicia o fluxo de cotação
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async start(from) {
        const menu = menuService.cotacaoMenu();
        stateManager.updateUserSession(from, {
            currentFlow: 'cotacao',
            currentStep: 'tipo_seguro',
            data: { cotacao: {} }
        });
        
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Processa entrada do usuário no fluxo de cotação
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async processInput(from, input) {
        const session = stateManager.getUserSession(from);
        const currentStep = session.currentStep || 'tipo_seguro';
        
        const stepHandler = this.steps.get(currentStep);
        if (stepHandler) {
            return await stepHandler(from, input, session);
        }
        
        console.error(`Passo não encontrado no fluxo de cotação: ${currentStep}`);
        return false;
    }

    /**
     * Manipula seleção do tipo de seguro
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleTipoSeguro(from, input, session) {
        const normalized = utils.normalizeText(input);

        // Voltar ao menu anterior
        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            const mainFlow = require('./mainFlow');
            return await mainFlow.sendMainMenu(from);
        }

        let tipoSeguro = '';
        
        // Identifica o tipo de seguro selecionado
        if (input.includes('auto') || normalized.includes('auto') || normalized.includes('veiculo')) {
            tipoSeguro = 'auto';
        } else if (input.includes('residencial') || normalized.includes('casa') || normalized.includes('residencia')) {
            tipoSeguro = 'residencial';
        } else if (input.includes('vida') || normalized.includes('vida')) {
            tipoSeguro = 'vida';
        } else if (input.includes('empresarial') || normalized.includes('empresa')) {
            tipoSeguro = 'empresarial';
        } else if (input.includes('outros') || normalized.includes('outros')) {
            tipoSeguro = 'outros';
        } else {
            await whatsappService.sendText(from, 
                '❓ Tipo de seguro não reconhecido.\n\n' +
                'Por favor, selecione uma das opções do menu ou digite o tipo desejado:\n' +
                '🚗 Auto\n🏠 Residencial\n❤️ Vida\n🏢 Empresarial'
            );
            return false;
        }

        // Atualiza sessão com o tipo selecionado
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                tipo_seguro: tipoSeguro
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'dados_pessoais',
            data: updatedData
        });

        // Confirma tipo e solicita dados pessoais
        const tipoTexto = this.getTipoSeguroTexto(tipoSeguro);
        await whatsappService.sendText(from,
            `✅ *Cotação de ${tipoTexto}*\n\n` +
            'Ótima escolha! Para fazer sua cotação personalizada, preciso de alguns dados.\n\n' +
            '📝 *Vamos começar:*'
        );

        // Avança para coleta de dados pessoais
        return await this.solicitarNome(from);
    }

    /**
     * Manipula coleta de dados pessoais
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleDadosPessoais(from, input, session) {
        // Redireciona para o passo específico baseado no que está coletando
        const dadosPendentes = this.verificarDadosPendentes(session.data.cotacao);
        
        if (dadosPendentes.includes('nome')) {
            return await this.handleColetaNome(from, input, session);
        } else if (dadosPendentes.includes('email')) {
            return await this.handleColetaEmail(from, input, session);
        } else if (dadosPendentes.includes('cpf')) {
            return await this.handleColetaCPF(from, input, session);
        }
        
        // Se todos os dados pessoais foram coletados, avança
        return await this.avancarParaProximoPasso(from, session);
    }

    /**
     * Manipula coleta do nome
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaNome(from, input, session) {
        const nome = input.trim();
        
        if (nome.length < 2) {
            await whatsappService.sendText(from, 
                '❌ Nome muito curto. Por favor, digite seu nome completo:'
            );
            return false;
        }

        // Valida se parece com um nome
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(nome)) {
            await whatsappService.sendText(from, 
                '❌ Nome inválido. Use apenas letras e espaços:'
            );
            return false;
        }

        // Salva o nome
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                nome: nome
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'coleta_email',
            data: updatedData
        });

        return await this.solicitarEmail(from);
    }

    /**
     * Manipula coleta do email
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaEmail(from, input, session) {
        const email = input.trim().toLowerCase();
        
        if (!utils.isValidEmail(email)) {
            await whatsappService.sendText(from, 
                '❌ Email inválido. Por favor, digite um email válido:\n\n' +
                'Exemplo: seuemail@exemplo.com.br'
            );
            return false;
        }

        // Salva o email
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                email: email
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'coleta_cpf',
            data: updatedData
        });

        return await this.solicitarCPF(from);
    }

    /**
     * Manipula coleta do CPF
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaCPF(from, input, session) {
        const cpf = input.replace(/\D/g, ''); // Remove caracteres não numéricos
        
        if (!utils.isValidCPF(cpf)) {
            await whatsappService.sendText(from, 
                '❌ CPF inválido. Por favor, digite um CPF válido:\n\n' +
                'Exemplo: 123.456.789-00 ou 12345678900'
            );
            return false;
        }

        // Salva o CPF
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                cpf: cpf
            }
        };

        stateManager.updateUserSession(from, {
            data: updatedData
        });

        // Avança para próximo passo baseado no tipo de seguro
        return await this.avancarParaProximoPasso(from, session);
    }

    /**
     * Avança para o próximo passo baseado no tipo de seguro
     * @param {string} from - Número do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async avancarParaProximoPasso(from, session) {
        const tipoSeguro = session.data.cotacao.tipo_seguro;

        switch (tipoSeguro) {
            case 'auto':
                stateManager.updateUserSession(from, { currentStep: 'dados_veiculo' });
                return await this.solicitarDadosVeiculo(from);
            
            case 'residencial':
            case 'vida':
            case 'empresarial':
            case 'outros':
            default:
                stateManager.updateUserSession(from, { currentStep: 'resumo' });
                return await this.mostrarResumo(from, session);
        }
    }

    /**
     * Solicita dados do veículo (para seguro auto)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async solicitarDadosVeiculo(from) {
        await whatsappService.sendText(from,
            '🚗 *Dados do Veículo*\n\n' +
            'Agora preciso de informações sobre seu veículo.\n\n' +
            '📝 Digite a *marca* do seu carro:\n\n' +
            'Exemplo: Volkswagen, Fiat, Chevrolet, etc.'
        );
        return true;
    }

    /**
     * Manipula coleta de dados do veículo
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleDadosVeiculo(from, input, session) {
        // Implementação simplificada - na prática seria mais complexa
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                veiculo_info: input.trim()
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'resumo',
            data: updatedData
        });

        return await this.mostrarResumo(from, { ...session, data: updatedData });
    }

    /**
     * Mostra resumo da cotação
     * @param {string} from - Número do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async mostrarResumo(from, session) {
        const cotacao = session.data.cotacao;
        const tipoTexto = this.getTipoSeguroTexto(cotacao.tipo_seguro);
        
        let resumo = `📋 *Resumo da Cotação*\n\n`;
        resumo += `🎯 *Tipo:* ${tipoTexto}\n`;
        resumo += `👤 *Nome:* ${cotacao.nome}\n`;
        resumo += `📧 *Email:* ${cotacao.email}\n`;
        resumo += `🆔 *CPF:* ${this.formatCPF(cotacao.cpf)}\n`;
        
        if (cotacao.veiculo_info) {
            resumo += `🚗 *Veículo:* ${cotacao.veiculo_info}\n`;
        }
        
        resumo += `\n✅ *Dados confirmados!*\n\n`;
        resumo += `📞 *Próximos passos:*\n`;
        resumo += `• Um corretor especializado entrará em contato\n`;
        resumo += `• Você receberá sua cotação personalizada\n`;
        resumo += `• Poderá comparar opções e escolher a melhor\n\n`;
        resumo += `⏱️ *Tempo estimado:* Até 2 horas úteis`;

        await whatsappService.sendText(from, resumo);

        // Salva dados no CSV
        await this.salvarCotacaoCSV(from, cotacao);

        // Salva dados no Google Sheets
        await this.salvarCotacaoGoogleSheets(from, cotacao);

        // Finaliza o processo
        stateManager.updateUserSession(from, { 
            currentStep: 'finalizado',
            currentFlow: 'main_menu'
        });

        // Oferece continuar ou falar com atendente
        setTimeout(async () => {
            await whatsappService.sendText(from,
                '🎉 *Cotação solicitada com sucesso!*\n\n' +
                'Obrigado por escolher a DJS Corretora!\n\n' +
                '💡 Digite "menu" para voltar ao início ou "atendente" para falar conosco agora.'
            );
        }, 2000);

        return true;
    }

    /**
     * Salva dados da cotação no Google Sheets
     * @param {string} from - Número do usuário
     * @param {Object} cotacao - Dados da cotação
     */
    async salvarCotacaoGoogleSheets(from, cotacao) {
        try {
            if (!googleSheetsService.isReady()) {
                console.log('⚠️ Google Sheets não configurado. Dados da cotação não foram salvos.');
                return;
            }

            // Prepara dados para o Google Sheets
            const dadosParaSalvar = {
                nome: cotacao.nome,
                email: cotacao.email,
                telefone: from.replace(/\D/g, ''), // Remove caracteres não numéricos
                cpf: cotacao.cpf,
                tipoSeguro: this.getTipoSeguroTexto(cotacao.tipo_seguro),
                veiculo: cotacao.veiculo_info || '',
                cep: cotacao.cep || '',
                observacoes: this.formatarObservacoes(cotacao),
                whatsapp: from
            };

            // Salva no Google Sheets
            const salvou = await googleSheetsService.salvarCotacao(dadosParaSalvar);
            
            if (salvou) {
                console.log(`✅ Cotação de ${cotacao.nome} salva no Google Sheets`);
            } else {
                console.log(`❌ Erro ao salvar cotação de ${cotacao.nome} no Google Sheets`);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar no Google Sheets:', error.message);
        }
    }

    /**
     * Salva dados da cotação no arquivo CSV
     * @param {string} from - Número do usuário
     * @param {Object} cotacao - Dados da cotação
     */
    async salvarCotacaoCSV(from, cotacao) {
        try {
            // Prepara dados para o CSV
            const dadosParaSalvar = {
                nome: cotacao.nome,
                email: cotacao.email,
                telefone: from.replace(/\D/g, ''), // Remove caracteres não numéricos
                cpf: cotacao.cpf,
                tipoSeguro: this.getTipoSeguroTexto(cotacao.tipo_seguro),
                veiculo: cotacao.veiculo_info || '',
                cep: cotacao.cep || '',
                observacoes: this.formatarObservacoes(cotacao),
                whatsapp: from
            };

            // Salva no CSV
            const salvou = csvService.salvarLead(dadosParaSalvar);
            
            if (salvou) {
                console.log(`✅ Lead ${cotacao.nome} salvo em leads.csv`);
            } else {
                console.log(`❌ Erro ao salvar lead ${cotacao.nome} no CSV`);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar no CSV:', error.message);
        }
    }

    /**
     * Formata observações adicionais para salvar
     * @param {Object} cotacao - Dados da cotação
     * @returns {string} Observações formatadas
     */
    formatarObservacoes(cotacao) {
        let obs = [];
        
        if (cotacao.tipo_seguro) {
            obs.push(`Tipo: ${cotacao.tipo_seguro}`);
        }
        
        if (cotacao.veiculo_info) {
            obs.push(`Veículo: ${cotacao.veiculo_info}`);
        }
        
        if (cotacao.finalidade) {
            obs.push(`Finalidade: ${cotacao.finalidade}`);
        }
        
        return obs.join(' | ');
    }

    /**
     * Solicita nome do usuário
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarNome(from) {
        await whatsappService.sendText(from,
            '👤 *Qual é o seu nome completo?*\n\n' +
            'Digite seu nome para personalizar o atendimento:'
        );
        
        stateManager.updateUserSession(from, { currentStep: 'coleta_nome' });
        return true;
    }

    /**
     * Solicita email do usuário
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarEmail(from) {
        await whatsappService.sendText(from,
            '📧 *Qual é o seu email?*\n\n' +
            'Precisamos do seu email para enviar a cotação:\n\n' +
            'Exemplo: seuemail@exemplo.com.br'
        );
        return true;
    }

    /**
     * Solicita CPF do usuário
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarCPF(from) {
        await whatsappService.sendText(from,
            '🆔 *Qual é o seu CPF?*\n\n' +
            'Pode digitar com ou sem formatação:\n\n' +
            'Exemplo: 123.456.789-00'
        );
        return true;
    }

    /**
     * Verifica quais dados ainda precisam ser coletados
     * @param {Object} cotacao - Dados da cotação
     * @returns {Array} Lista de dados pendentes
     */
    verificarDadosPendentes(cotacao) {
        const pendentes = [];
        
        if (!cotacao.nome) pendentes.push('nome');
        if (!cotacao.email) pendentes.push('email');
        if (!cotacao.cpf) pendentes.push('cpf');
        
        return pendentes;
    }

    /**
     * Obtém texto amigável para tipo de seguro
     * @param {string} tipo - Tipo de seguro
     * @returns {string} Texto formatado
     */
    getTipoSeguroTexto(tipo) {
        const tipos = {
            'auto': 'Seguro Auto',
            'residencial': 'Seguro Residencial',
            'vida': 'Seguro de Vida',
            'empresarial': 'Seguro Empresarial',
            'outros': 'Outros Seguros'
        };
        
        return tipos[tipo] || 'Seguro';
    }

    /**
     * Formata CPF para exibição
     * @param {string} cpf - CPF sem formatação
     * @returns {string} CPF formatado
     */
    formatCPF(cpf) {
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Manipula exibição do resumo
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleResumo(from, input, session) {
        // Se chegou aqui, mostra o resumo
        return await this.mostrarResumo(from, session);
    }

    /**
     * Manipula estado finalizado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleFinalizado(from, input, session) {
        // Redireciona para o menu principal
        const mainFlow = require('./mainFlow');
        stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
        return await mainFlow.sendMainMenu(from);
    }
}

// Singleton instance
const cotacaoFlow = new CotacaoFlow();

module.exports = cotacaoFlow;
