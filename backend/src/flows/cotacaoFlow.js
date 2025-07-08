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
        this.steps.set('dados_iniciais', this.handleDadosIniciais.bind(this));
        this.steps.set('coleta_nome', this.handleColetaNome.bind(this));
        this.steps.set('coleta_email', this.handleColetaEmail.bind(this));
        this.steps.set('continuacao', this.handleContinuacao.bind(this));
        this.steps.set('coleta_cpf', this.handleColetaCPF.bind(this));
        this.steps.set('dados_veiculo', this.handleDadosVeiculo.bind(this));
        this.steps.set('coleta_placa_chassi', this.handleColetaPlacaChassi.bind(this));
        this.steps.set('coleta_cep_pernoite', this.handleColetaCepPernoite.bind(this));
        this.steps.set('resumo', this.handleResumo.bind(this));
        this.steps.set('finalizado', this.handleFinalizado.bind(this));
    }

    /**
     * Inicia o fluxo de cotação - Direcionamento otimizado
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async start(from) {
        stateManager.updateUserSession(from, {
            currentFlow: 'cotacao',
            currentStep: 'coleta_nome',
            data: { cotacao: {} }
        });
        
        // CORREÇÃO: Vai direto para coleta de nome (Passo 1)
        return await this.solicitarNome(from);
    }

    /**
     * Força reinício do fluxo do zero (limpa dados anteriores)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async forceRestart(from) {
        stateManager.updateUserSession(from, {
            currentFlow: 'cotacao',
            currentStep: 'coleta_nome',
            data: { cotacao: {} }
        });
        
        // CORREÇÃO: Vai direto para coleta de nome (Passo 1)
        return await this.solicitarNome(from);
    }

    /**
     * Processa entrada do usuário no fluxo de cotação
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async processInput(from, input) {
        try {
            const session = stateManager.getUserSession(from);
            const currentStep = session.currentStep || 'coleta_nome';
            
            const stepHandler = this.steps.get(currentStep);
            if (stepHandler) {
                return await stepHandler(from, input, session);
            }
            
            console.error(`Passo não encontrado no fluxo de cotação: ${currentStep}`);
            
            // CORREÇÃO: Tratamento antifalha
            await whatsappService.sendText(from,
                '🔧 *Ops! Algo deu errado*\n\n' +
                'Vamos recomeçar sua cotação do início.\n\n' +
                '💡 Digite "menu" para voltar ao menu principal'
            );
            
            return await this.start(from);
            
        } catch (error) {
            console.error('❌ Erro no processamento de cotação:', error);
            
            await whatsappService.sendText(from,
                '🔧 *Erro técnico momentâneo*\n\n' +
                'Estamos resolvendo rapidamente!\n\n' +
                '💡 Digite "atendente" para falar com nosso suporte.'
            );
            
            // Volta ao menu principal em caso de erro
            const mainFlow = require('./mainFlow');
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await mainFlow.sendMainMenu(from);
        }
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

        // Voltar ao CPF
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'coleta_cpf' });
            return await this.solicitarCPF(from);
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
                '🚗 Auto\n🏠 Residencial\n❤️ Vida\n🏢 Empresarial\n\n' +
                '⬅️ *Digite "voltar" para retornar ao CPF*'
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
            data: updatedData
        });

        // Avança para próximo passo baseado no tipo de seguro
        return await this.avancarParaProximoPasso(from, { ...session, data: updatedData });
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
        const normalized = utils.normalizeText(input);
        
        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            const mainFlow = require('./mainFlow');
            return await mainFlow.sendMainMenu(from);
        }
        
        const nome = input.trim();
        
        if (nome.length < 2) {
            await whatsappService.sendText(from, 
                '❌ Nome muito curto. Por favor, digite seu nome completo:\n\n' +
                '⬅️ *Digite "voltar" para retornar ao menu principal*'
            );
            return false;
        }

        // Valida se parece com um nome
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(nome)) {
            await whatsappService.sendText(from, 
                '❌ Nome inválido. Use apenas letras e espaços:\n\n' +
                '⬅️ *Digite "voltar" para retornar ao menu principal*'
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
     * Oferece opções de continuação após coletar nome e email
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async oferecerContinuacao(from) {
        await whatsappService.sendText(from,
            '✅ *Dados recebidos!*\n\n' +
            'Obrigado! Preciso de mais alguns dados para completar sua cotação.\n\n' +
            '📋 *Por favor, escolha uma opção abaixo:*\n\n' +
            '1️⃣ Continuar e fornecer mais informações\n' +
            '2️⃣ Falar com um atendente\n\n' +
            '💡 *Digite 1 ou 2 para escolher*\n' +
            '⬅️ *Digite "voltar" para retornar ao email*'
        );

        stateManager.updateUserSession(from, { currentStep: 'continuacao' });
        return true;
    }

    /**
     * Manipula escolha de continuação
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleContinuacao(from, input, session) {
        const normalized = utils.normalizeText(input);
        const optionNumber = utils.extractOptionNumber(input);

        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'coleta_email' });
            return await this.solicitarEmail(from);
        }

        // Opção 1: Continuar com mais informações
        if (optionNumber === 1 || 
            normalized.includes('continuar') || 
            normalized.includes('informacoes') ||
            normalized.includes('1')) {
            
            // CORREÇÃO: Memória de fluxo - avança para CPF sem repetir dados
            await whatsappService.sendText(from,
                '📝 *Continuando sua cotação...*\n\n' +
                '✅ Nome e e-mail já coletados!'
            );
            
            stateManager.updateUserSession(from, { currentStep: 'coleta_cpf' });
            return await this.solicitarCPF(from);
        }

        // Opção 2: Falar com atendente
        if (optionNumber === 2 || 
            normalized.includes('atendente') || 
            normalized.includes('corretor') ||
            normalized.includes('2')) {
            
            const mainFlow = require('./mainFlow');
            return await mainFlow.transferToHuman(from, 'Cotação - Solicitou atendente');
        }

        // Opção inválida
        await whatsappService.sendText(from,
            '❓ *Opção não reconhecida.*\n\n' +
            'Por favor, digite:\n' +
            '• *1* para continuar\n' +
            '• *2* para falar com atendente\n\n' +
            '⬅️ *Digite "voltar" para retornar ao email*'
        );
        
        return false;
    }

    /**
     * Manipula coleta do email
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaEmail(from, input, session) {
        const normalized = utils.normalizeText(input);
        
        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'coleta_nome' });
            return await this.solicitarNome(from);
        }
        
        const email = input.trim().toLowerCase();
        
        if (!utils.isValidEmail(email)) {
            await whatsappService.sendText(from, 
                '❌ Email inválido. Por favor, digite um email válido:\n\n' +
                'Exemplo: seuemail@exemplo.com.br\n\n' +
                '⬅️ *Digite "voltar" para retornar ao nome*'
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
            currentStep: 'continuacao',
            data: updatedData
        });

        // CORREÇÃO: Após email, oferece continuação (Passo 2 do requisito)
        return await this.oferecerContinuacao(from);
    }

    /**
     * Manipula coleta do CPF
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaCPF(from, input, session) {
        const normalized = utils.normalizeText(input);
        
        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'continuacao' });
            return await this.oferecerContinuacao(from);
        }
        
        // CORREÇÃO: Validação melhorada de CPF com máscara
        const inputOriginal = input.trim();
        const cpfLimpo = inputOriginal.replace(/[^\d]/g, ''); // Remove tudo que não é número
        
        // Valida o CPF usando a entrada original (permite máscara)
        if (!utils.isValidCPF(inputOriginal)) {
            await whatsappService.sendText(from, 
                '❌ *CPF inválido*\n\n' +
                'Por favor, digite novamente (com ou sem máscara):\n\n' +
                '📝 *Exemplos válidos:*\n' +
                '• 12345678900\n' +
                '• 123.456.789-00\n\n' +
                '💡 Verificque se digitou corretamente\n' +
                '⬅️ Digite "voltar" para retornar às opções'
            );
            return false;
        }

        // CORREÇÃO: Salva CPF limpo (sem máscara) para padronização
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                cpf: cpfLimpo // Armazena sempre sem máscara
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'tipo_seguro',
            data: updatedData
        });

        // Confirma e avança
        await whatsappService.sendText(from,
            '✅ *CPF confirmado!*\n\n' +
            'Agora preciso saber que tipo de seguro você deseja cotar:'
        );
        
        const menu = menuService.cotacaoMenu();
        return await whatsappService.sendListMessage(from, menu);
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
     * Solicita dados do veículo (para seguro auto) - Melhorado
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async solicitarDadosVeiculo(from) {
        await whatsappService.sendText(from,
            '🚗 *Dados do Veículo*\n\n' +
            'Agora preciso de informações sobre seu veículo.\n\n' +
            '🏷️ *Marca do seu carro* (opcional):\n\n' +
            'Exemplo: Volkswagen, Fiat, Chevrolet, etc.\n\n' +
            '💡 *Ou digite "pular" para prosseguir sem informar a marca*\n' +
            '⬅️ *Digite "voltar" para retornar ao tipo de seguro*'
        );
        return true;
    }

    /**
     * Manipula coleta de dados do veículo - Atualizado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleDadosVeiculo(from, input, session) {
        const normalized = utils.normalizeText(input);
        
        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'tipo_seguro' });
            const menu = menuService.cotacaoMenu();
            await whatsappService.sendText(from, 'Que tipo de seguro você deseja cotar?');
            return await whatsappService.sendListMessage(from, menu);
        }
        
        // Se usuário pulou a marca
        if (normalized.includes('pular') || normalized.includes('sem marca') || normalized.includes('nao sei')) {
            input = 'Não informado';
        }

        // Salva a marca (ou "Não informado")
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                veiculo_marca: input.trim()
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'coleta_placa_chassi',
            data: updatedData
        });

        // Solicita placa ou chassi
        await whatsappService.sendText(from,
            '🔖 *Placa ou Chassi do Veículo*\n\n' +
            'Preciso da *placa* ou *chassi* do seu veículo (pelo menos um é obrigatório):\n\n' +
            '📝 *Placa:* ABC-1234 ou ABC1D34\n' +
            '📝 *Chassi:* 9BD12345678901234\n\n' +
            '💡 *Digite a placa ou o chassi*\n' +
            '⬅️ *Digite "voltar" para retornar à marca*'
        );

        return true;
    }

    /**
     * Manipula coleta de placa ou chassi
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaPlacaChassi(from, input, session) {
        const normalized = utils.normalizeText(input);
        
        // Voltar para dados do veículo (marca)
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(input)) {
            stateManager.updateUserSession(from, { currentStep: 'dados_veiculo' });
            return await this.solicitarDadosVeiculo(from);
        }
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'dados_veiculo' });
            return await this.solicitarDadosVeiculo(from);
        }
        
        const inputLimpo = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        // Valida se é placa ou chassi
        const isPlaca = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(inputLimpo);
        const isChassi = /^[A-HJ-NPR-Z0-9]{17}$/.test(inputLimpo);
        
        if (!isPlaca && !isChassi) {
            await whatsappService.sendText(from,
                '❌ *Formato inválido.*\n\n' +
                'Por favor, digite uma placa ou chassi válido:\n\n' +
                '📝 *Placa:* ABC-1234 ou ABC1D34\n' +
                '📝 *Chassi:* 17 dígitos\n\n' +
                'Exemplo: ABC1234 ou 9BD12345678901234\n\n' +
                '⬅️ *Digite "voltar" para retornar à marca*'
            );
            return false;
        }

        // Salva placa ou chassi
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                veiculo_placa_chassi: inputLimpo,
                tipo_identificacao: isPlaca ? 'placa' : 'chassi'
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'coleta_cep_pernoite',
            data: updatedData
        });

        // Solicita CEP de pernoite
        await whatsappService.sendText(from,
            '🏠 *CEP de Pernoite*\n\n' +
            'Qual o CEP onde o veículo fica guardado durante a noite?\n\n' +
            '📍 *Digite o CEP:*\n' +
            'Exemplo: 13015-900 ou 13015900\n\n' +
            '⬅️ *Digite "voltar" para retornar à placa/chassi*'
        );

        return true;
    }

    /**
     * Manipula coleta do CEP de pernoite
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleColetaCepPernoite(from, input, session) {
        const normalized = utils.normalizeText(input);
        
        // Opção voltar
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentStep: 'coleta_placa_chassi' });
            await whatsappService.sendText(from,
                '🔖 *Placa ou Chassi do Veículo*\n\n' +
                'Preciso da *placa* ou *chassi* do seu veículo (pelo menos um é obrigatório):\n\n' +
                '📝 *Placa:* ABC-1234 ou ABC1D34\n' +
                '📝 *Chassi:* 9BD12345678901234\n\n' +
                '💡 *Digite a placa ou o chassi*\n' +
                '⬅️ *Digite "voltar" para retornar à marca*'
            );
            return true;
        }
        
        const cep = input.replace(/\D/g, '');
        
        if (cep.length !== 8) {
            await whatsappService.sendText(from,
                '❌ *CEP inválido.*\n\n' +
                'Por favor, digite um CEP válido com 8 dígitos:\n\n' +
                'Exemplo: 13015-900 ou 13015900\n\n' +
                '⬅️ *Digite "voltar" para retornar à placa/chassi*'
            );
            return false;
        }

        // Salva CEP
        const updatedData = {
            ...session.data,
            cotacao: {
                ...session.data.cotacao,
                cep_pernoite: cep
            }
        };

        stateManager.updateUserSession(from, {
            currentStep: 'resumo',
            data: updatedData
        });

        return await this.mostrarResumo(from, { ...session, data: updatedData });
    }

    /**
     * Mostra resumo da cotação - Melhorado
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
        
        if (cotacao.veiculo_marca) {
            resumo += `🚗 *Marca:* ${cotacao.veiculo_marca}\n`;
        }
        
        if (cotacao.veiculo_placa_chassi) {
            const tipo = cotacao.tipo_identificacao === 'placa' ? 'Placa' : 'Chassi';
            resumo += `🔖 *${tipo}:* ${cotacao.veiculo_placa_chassi}\n`;
        }
        
        if (cotacao.cep_pernoite) {
            resumo += `🏠 *CEP Pernoite:* ${this.formatCEP(cotacao.cep_pernoite)}\n`;
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
            currentFlow: 'finalization'
        });

        // Oferece menu de finalização padronizado
        setTimeout(async () => {
            await whatsappService.sendText(from,
                '🎉 *Cotação solicitada com sucesso!*\n\n' +
                'Obrigado por escolher a DJS Corretora!'
            );
            
            const menuService = require('../services/menuService');
            const finalizationMenu = menuService.finalizationMenu();
            await whatsappService.sendListMessage(from, finalizationMenu);
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
                veiculo: cotacao.veiculo_marca || '',
                cep: cotacao.cep_pernoite || '',
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
                veiculo: cotacao.veiculo_marca || '',
                cep: cotacao.cep_pernoite || '',
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
     * Formata observações adicionais para salvar - Atualizado
     * @param {Object} cotacao - Dados da cotação
     * @returns {string} Observações formatadas
     */
    formatarObservacoes(cotacao) {
        let obs = [];
        
        if (cotacao.tipo_seguro) {
            obs.push(`Tipo: ${cotacao.tipo_seguro}`);
        }
        
        if (cotacao.veiculo_marca && cotacao.veiculo_marca !== 'Não informado') {
            obs.push(`Marca: ${cotacao.veiculo_marca}`);
        }
        
        if (cotacao.veiculo_placa_chassi) {
            const tipo = cotacao.tipo_identificacao === 'placa' ? 'Placa' : 'Chassi';
            obs.push(`${tipo}: ${cotacao.veiculo_placa_chassi}`);
        }
        
        if (cotacao.cep_pernoite) {
            obs.push(`CEP Pernoite: ${this.formatCEP(cotacao.cep_pernoite)}`);
        }
        
        return obs.join(' | ');
    }

    /**
     * Solicita nome do usuário (Passo 1 do fluxo)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarNome(from) {
        await whatsappService.sendText(from,
            '📝 *Iniciando sua Cotação*\n\n' +
            'Para começar, preciso de algumas informações básicas.\n\n' +
            '👤 *Digite seu nome completo:*\n\n' +
            '⬅️ Digite "voltar" para retornar ao menu'
        );
        return true;
    }

    /**
     * Solicita email do usuário (Passo 1 do fluxo)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarEmail(from) {
        await whatsappService.sendText(from,
            '📧 *Agora seu e-mail:*\n\n' +
            'Digite um e-mail válido para receber sua cotação:\n\n' +
            'Exemplo: seuemail@exemplo.com.br\n\n' +
            '⬅️ Digite "voltar" para retornar ao menu'
        );
        return true;
    }

    /**
     * Solicita CPF do usuário (Passo 3 do fluxo)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarCPF(from) {
        await whatsappService.sendText(from,
            '🆔 *CPF:*\n\n' +
            'Digite seu CPF (com ou sem máscara):\n\n' +
            '📝 Exemplos válidos:\n' +
            '• 12345678900\n' +
            '• 123.456.789-00\n\n' +
            '⬅️ Digite "voltar" para alterar o e-mail'
        );
        return true;
    }

    /**
     * Solicita dados iniciais (Nome e Email primeiro)
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async solicitarDadosIniciais(from) {
        await whatsappService.sendText(from,
            '💰 *Nova Cotação de Seguro*\n\n' +
            'Vou te ajudar a solicitar uma cotação personalizada!\n\n' +
            '📝 Para começar, preciso de algumas informações básicas.\n\n' +
            '👤 *Qual é o seu nome completo?*'
        );
        
        stateManager.updateUserSession(from, { currentStep: 'coleta_nome' });
        return true;
    }

    /**
     * Manipula coleta de dados iniciais
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleDadosIniciais(from, input, session) {
        // Redireciona para o passo específico baseado no que está coletando
        const dadosPendentes = this.verificarDadosPendentes(session.data.cotacao);
        
        if (dadosPendentes.includes('nome')) {
            return await this.handleColetaNome(from, input, session);
        } else if (dadosPendentes.includes('email')) {
            return await this.handleColetaEmail(from, input, session);
        }
        
        // Se dados básicos coletados, oferece continuação
        return await this.oferecerContinuacao(from);
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
     * Formata CEP para exibição
     * @param {string} cep - CEP sem formatação
     * @returns {string} CEP formatado
     */
    formatCEP(cep) {
        return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
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
     * Manipula estado finalizado - Atualizado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleFinalizado(from, input, session) {
        // Redireciona para o fluxo de finalização
        const mainFlow = require('./mainFlow');
        stateManager.updateUserSession(from, { currentFlow: 'finalization' });
        return await mainFlow.handleFinalization(from, input, session);
    }

    /**
     * Verifica se os dados básicos (nome e email) já foram coletados
     * @param {Object} cotacaoData - Dados da cotação
     * @returns {boolean} True se nome e email já estão preenchidos
     */
    /**
     * Verifica se dados básicos já foram coletados
     * @param {Object} cotacaoData - Dados da cotação
     * @returns {boolean} Se tem dados básicos
     */
    hasBasicData(cotacaoData) {
        return cotacaoData?.nome && cotacaoData?.email;
    }
}

// Singleton instance
const cotacaoFlow = new CotacaoFlow();

module.exports = cotacaoFlow;
