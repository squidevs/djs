/**
 * Fluxo Principal de Conversação
 * Controla o fluxo principal do chatbot e roteamento de mensagens
 */

const stateManager = require('../core/stateManager');
const cacheSystem = require('../core/cacheSystem');
const utils = require('../core/utils');
const whatsappService = require('../services/whatsappService');
const menuService = require('../services/menuService');
const cotacaoFlow = require('./cotacaoFlow');

class MainFlow {
    constructor() {
        this.flows = new Map();
        this.initializeFlows();
    }

    /**
     * Inicializa os fluxos disponíveis
     */
    initializeFlows() {
        // Registra os handlers de fluxo
        this.flows.set('welcome', this.handleWelcome.bind(this));
        this.flows.set('welcome_response', this.handleWelcomeResponse.bind(this));
        this.flows.set('main_menu', this.handleMainMenu.bind(this));
        this.flows.set('cotacao', this.handleCotacao.bind(this));
        this.flows.set('renovacao', this.handleRenovacao.bind(this));
        this.flows.set('sinistro', this.handleSinistro.bind(this));
        this.flows.set('segunda_via', this.handleSegundaVia.bind(this));
        this.flows.set('pagamento', this.handlePagamento.bind(this));
        this.flows.set('seguradoras', this.handleSeguradoras.bind(this));
        this.flows.set('seguradora_info', this.handleSeguradoraInfo.bind(this));
        this.flows.set('atendimento', this.handleAtendimento.bind(this));
    }

    /**
     * Processa mensagem recebida
     * @param {Object} message - Mensagem do WhatsApp
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async processMessage(message) {
        try {
            const messageInfo = whatsappService.extractMessageInfo(message);
            const { from, body, id, listResponse } = messageInfo;

            // Verifica duplicação de mensagem
            if (cacheSystem.isMessageProcessed(from, id)) {
                console.log(`Mensagem duplicada ignorada: ${id}`);
                return false;
            }

            // Marca mensagem como lida
            await whatsappService.markAsRead(id);

            // Marca mensagem como processada
            cacheSystem.markMessageProcessed(from, id);

            // Incrementa contador de mensagens
            stateManager.incrementMessageCount();

            // Verifica se bot está ativo
            if (!stateManager.isBotActive() && !utils.isMenuCommand(body)) {
                console.log(`Bot inativo, ignorando mensagem de ${from}: ${utils.truncateText(body)}`);
                return false;
            }

            // Processa comandos globais primeiro
            if (await this.handleGlobalCommands(from, body)) {
                return true;
            }

            // Obtém sessão do usuário
            const session = stateManager.getUserSession(from);
            const currentFlow = session.currentFlow || 'welcome';

            // Envia indicador de digitação
            await whatsappService.sendTyping(from, 1500);

            // Roteamento por fluxo
            const flowHandler = this.flows.get(currentFlow);
            if (flowHandler) {
                const userInput = listResponse || body || '';
                return await flowHandler(from, userInput, session);
            } else {
                console.error(`Fluxo não encontrado: ${currentFlow}`);
                return await this.handleUnknownFlow(from);
            }

        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            await this.handleError(message.from, error);
            return false;
        }
    }

    /**
     * Trata comandos globais
     * @param {string} from - Número do usuário
     * @param {string} body - Corpo da mensagem
     * @returns {Promise<boolean>} True se comando foi processado
     */
    async handleGlobalCommands(from, body) {
        const normalizedBody = utils.normalizeText(body);

        // Comando de menu/início
        if (utils.isMenuCommand(normalizedBody)) {
            stateManager.enableBot();
            stateManager.updateUserSession(from, { 
                currentFlow: 'welcome',
                currentStep: 'inicio',
                data: {}
            });
            return await this.sendWelcome(from);
        }

        // Saudações
        if (utils.isGreeting(normalizedBody)) {
            stateManager.updateUserSession(from, { 
                currentFlow: 'welcome',
                currentStep: 'inicio'
            });
            return await this.sendWelcome(from);
        }

        // Despedidas
        if (utils.isFarewell(normalizedBody)) {
            await whatsappService.sendText(from, 
                'Obrigado por entrar em contato com a DJS Corretora! 😊\n\n' +
                'Estamos sempre à disposição para te ajudar.\n\n' +
                '💡 Digite "menu" a qualquer momento para reiniciar o atendimento.'
            );
            return true;
        }

        // Solicitação de atendente humano
        if (utils.isRequestingHuman(normalizedBody)) {
            return await this.transferToHuman(from);
        }

        return false;
    }

    /**
     * Envia mensagem de boas-vindas
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendWelcome(from) {
        const menu = menuService.welcomeMenu();
        stateManager.updateUserSession(from, { 
            currentFlow: 'welcome_response',
            currentStep: 'aguardando_escolha'
        });
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de boas-vindas
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleWelcome(from, input, session) {
        return await this.sendWelcome(from);
    }

    /**
     * Manipula resposta das boas-vindas
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleWelcomeResponse(from, input, session) {
        const normalized = utils.normalizeText(input);
        const optionNumber = utils.extractOptionNumber(input);

        // Opção 1: Já sou cliente
        if (input.includes('option_1') || 
            input.includes('cliente') || 
            normalized.includes('cliente') || 
            normalized.includes('ja sou cliente') ||
            optionNumber === 1) {
            
            stateManager.updateUserSession(from, { 
                currentFlow: 'main_menu',
                currentStep: 'menu_principal',
                data: { ...session.data, tipo_usuario: 'cliente' }
            });
            return await this.sendMainMenu(from);
        }

        // Opção 2: Quero cotar
        if (input.includes('option_2') || 
            input.includes('cotacao') || 
            normalized.includes('cotar') || 
            normalized.includes('quero cotar') ||
            normalized.includes('cotacao') ||
            optionNumber === 2) {
            
            return await cotacaoFlow.start(from);
        }

        // Opção inválida
        await whatsappService.sendText(from, 
            '❓ Opção não reconhecida.\n\n' +
            'Por favor, escolha uma das opções do menu ou digite "menu" para recomeçar.'
        );
        return false;
    }

    /**
     * Envia menu principal
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendMainMenu(from) {
        const menu = menuService.mainMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula menu principal
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleMainMenu(from, input, session) {
        const normalized = utils.normalizeText(input);

        // Nova cotação - múltiplas formas de identificar
        if (input.includes('option_1') || 
            input.includes('nova_cotacao') || 
            normalized.includes('nova cotacao') ||
            normalized.includes('cotacao') ||
            normalized.includes('quero uma nova cotacao') ||
            utils.extractOptionNumber(input) === 1) {
            return await cotacaoFlow.start(from);
        }

        // Renovação
        if (input.includes('option_2') ||
            input.includes('renovacao') || 
            normalized.includes('renovacao') ||
            normalized.includes('informacoes sobre renovacao') ||
            utils.extractOptionNumber(input) === 2) {
            stateManager.updateUserSession(from, { currentFlow: 'renovacao' });
            return await this.sendRenovacaoMenu(from);
        }

        // Sinistro
        if (input.includes('option_3') ||
            input.includes('sinistro') || 
            normalized.includes('sinistro') ||
            normalized.includes('comunicar sinistro') ||
            utils.extractOptionNumber(input) === 3) {
            stateManager.updateUserSession(from, { currentFlow: 'sinistro' });
            return await this.sendSinistroMenu(from);
        }

        // Segunda via
        if (input.includes('option_4') ||
            input.includes('segunda_via') || 
            normalized.includes('segunda via') ||
            normalized.includes('2a via') ||
            normalized.includes('documentos') ||
            utils.extractOptionNumber(input) === 4) {
            stateManager.updateUserSession(from, { currentFlow: 'segunda_via' });
            return await this.sendSegundaViaMenu(from);
        }

        // Pagamento
        if (input.includes('option_5') ||
            input.includes('pagamento') || 
            normalized.includes('pagamento') ||
            normalized.includes('informacoes de pagamento') ||
            utils.extractOptionNumber(input) === 5) {
            stateManager.updateUserSession(from, { currentFlow: 'pagamento' });
            return await this.sendPagamentoMenu(from);
        }

        // Seguradoras
        if (input.includes('option_6') ||
            input.includes('seguradoras') || 
            normalized.includes('seguradora') ||
            normalized.includes('contatos das seguradoras') ||
            utils.extractOptionNumber(input) === 6) {
            stateManager.updateUserSession(from, { currentFlow: 'seguradoras' });
            return await this.sendSeguradorasMenu(from);
        }

        // Atendimento
        if (input.includes('option_7') ||
            input.includes('atendimento') || 
            normalized.includes('atendente') ||
            normalized.includes('falar com atendente') ||
            utils.extractOptionNumber(input) === 7) {
            return await this.transferToHuman(from);
        }

        return await this.handleInvalidOption(from);
    }

    /**
     * Envia menu de cotação
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendCotacaoMenu(from) {
        const menu = menuService.cotacaoMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de cotação
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleCotacao(from, input, session) {
        // Delega para o fluxo específico de cotação
        return await cotacaoFlow.processInput(from, input);
    }

    /**
     * Envia menu de renovação
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendRenovacaoMenu(from) {
        const menu = menuService.renovacaoMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de renovação
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleRenovacao(from, input, session) {
        const normalized = utils.normalizeText(input);

        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        if (input.includes('contato') || normalized.includes('corretor')) {
            return await this.transferToHuman(from);
        }

        // Informações gerais sobre renovação
        await whatsappService.sendText(from,
            '🔄 *Renovação de Apólice*\n\n' +
            '📋 *Documentos geralmente necessários:*\n' +
            '• Apólice atual\n' +
            '• RG e CPF\n' +
            '• Comprovante de residência atualizado\n\n' +
            '⏰ *Prazos importantes:*\n' +
            '• Renovação deve ser feita até 30 dias antes do vencimento\n' +
            '• Após vencimento, pode haver carência\n\n' +
            '💡 Para informações específicas da sua apólice, vou te conectar com nosso atendimento especializado.'
        );

        return await this.transferToHuman(from);
    }

    /**
     * Envia menu de sinistro
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendSinistroMenu(from) {
        const menu = menuService.sinistroMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de sinistro
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSinistro(from, input, session) {
        const normalized = utils.normalizeText(input);

        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        await whatsappService.sendText(from,
            '🚨 *Comunicação de Sinistro*\n\n' +
            '⚠️ *IMPORTANTE: Em caso de emergência, ligue imediatamente para:*\n' +
            '🚑 SAMU: 192\n' +
            '🚒 Bombeiros: 193\n' +
            '👮 Polícia: 190\n\n' +
            '📞 *Para comunicar sinistro:*\n' +
            '1️⃣ Entre em contato direto com sua seguradora\n' +
            '2️⃣ Tenha em mãos sua apólice\n' +
            '3️⃣ Relate todos os detalhes do ocorrido\n\n' +
            '🏢 Vou te conectar com nosso atendimento para te orientar sobre os próximos passos.'
        );

        return await this.transferToHuman(from);
    }

    /**
     * Envia menu de segunda via
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendSegundaViaMenu(from) {
        const menu = menuService.segundaViaMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de segunda via
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSegundaVia(from, input, session) {
        const normalized = utils.normalizeText(input);

        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        await whatsappService.sendText(from,
            '📄 *Segunda Via de Documentos*\n\n' +
            'Para solicitar a segunda via dos seus documentos, nosso atendimento precisará verificar:\n\n' +
            '📋 *Informações necessárias:*\n' +
            '• Número da apólice\n' +
            '• CPF do segurado\n' +
            '• Tipo de documento solicitado\n\n' +
            '⏱️ *Prazo de entrega:* Até 2 dias úteis\n\n' +
            '💡 Vou te conectar com nosso atendimento para processar sua solicitação.'
        );

        return await this.transferToHuman(from);
    }

    /**
     * Envia menu de pagamento
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendPagamentoMenu(from) {
        const menu = menuService.pagamentoMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de pagamento
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handlePagamento(from, input, session) {
        const normalized = utils.normalizeText(input);

        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        await whatsappService.sendText(from,
            '💰 *Informações de Pagamento*\n\n' +
            '💳 *Formas de pagamento aceitas:*\n' +
            '• Cartão de crédito (até 12x)\n' +
            '• Débito automático\n' +
            '• Boleto bancário\n' +
            '• PIX\n\n' +
            '📊 *Parcelamento:*\n' +
            '• À vista com desconto\n' +
            '• Parcelado conforme modalidade\n\n' +
            '🏦 *Débito automático:*\n' +
            '• Desconto adicional\n' +
            '• Sem risco de atraso\n\n' +
            '💡 Para configurar sua forma de pagamento ou tirar dúvidas específicas, vou te conectar com nosso atendimento.'
        );

        return await this.transferToHuman(from);
    }

    /**
     * Envia menu de seguradoras
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendSeguradorasMenu(from) {
        const menu = menuService.seguradorasMenu();
        return await whatsappService.sendListMessage(from, menu);
    }

    /**
     * Manipula fluxo de seguradoras
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSeguradoras(from, input, session) {
        const normalized = utils.normalizeText(input);

        if (input.includes('voltar') || normalized.includes('voltar')) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        // Extrai ID da seguradora do input
        const seguradoraMatch = input.match(/seg_(\w+)/);
        if (seguradoraMatch) {
            const seguradoraId = seguradoraMatch[1];
            const info = menuService.getSeguradoraInfo(seguradoraId);
            
            await whatsappService.sendText(from, info);
            
            // Oferece voltar ao menu
            setTimeout(async () => {
                await whatsappService.sendText(from, 
                    '💡 Digite "menu" para voltar ao início ou "seguradoras" para ver outras seguradoras.'
                );
            }, 2000);
            
            return true;
        }

        // Se não encontrou seguradora específica, mostra lista completa
        const allSeguradoras = menuService.getAllSeguradorasText();
        await whatsappService.sendText(from, allSeguradoras);
        return true;
    }

    /**
     * Manipula informações de seguradora específica
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSeguradoraInfo(from, input, session) {
        // Volta para o menu de seguradoras
        stateManager.updateUserSession(from, { currentFlow: 'seguradoras' });
        return await this.sendSeguradorasMenu(from);
    }

    /**
     * Manipula solicitação de atendimento humano
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleAtendimento(from, input, session) {
        return await this.transferToHuman(from);
    }

    /**
     * Transfere para atendimento humano
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso da transferência
     */
    async transferToHuman(from) {
        // Desativa o bot temporariamente
        stateManager.disableBot(60); // 60 minutos

        // Limpa a sessão do usuário
        stateManager.updateUserSession(from, { 
            currentFlow: 'atendimento',
            currentStep: 'transferido',
            data: { transferred_at: Date.now() }
        });

        await whatsappService.sendText(from,
            '👨‍💼 *Transferindo para Atendente*\n\n' +
            '⏳ Aguarde um momento, você será atendido por um de nossos corretores especializados.\n\n' +
            '📞 *Enquanto isso, você também pode nos contatar:*\n' +
            '• WhatsApp: (11) 9999-9999\n' +
            '• Telefone: (11) 3333-3333\n' +
            '• E-mail: contato@djscorretora.com.br\n\n' +
            '💡 *Para retornar ao atendimento automático, digite "menu" a qualquer momento.*'
        );

        return true;
    }

    /**
     * Manipula opção inválida
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async handleInvalidOption(from) {
        await whatsappService.sendText(from,
            '❓ *Opção não reconhecida*\n\n' +
            'Por favor, escolha uma das opções do menu ou use os comandos:\n\n' +
            '🔸 "menu" - Voltar ao início\n' +
            '🔸 "atendente" - Falar com corretor\n' +
            '🔸 "seguradoras" - Ver contatos\n\n' +
            'Ou escolha uma opção do menu anterior.'
        );
        return false;
    }

    /**
     * Manipula fluxo desconhecido
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do tratamento
     */
    async handleUnknownFlow(from) {
        console.error(`Fluxo desconhecido para usuário ${from}`);
        
        // Reset para o início
        stateManager.updateUserSession(from, { 
            currentFlow: 'welcome',
            currentStep: 'inicio',
            data: {}
        });
        
        await whatsappService.sendText(from,
            '🔄 *Reiniciando atendimento*\n\n' +
            'Houve um problema técnico. Vamos recomeçar do início.'
        );
        
        return await this.sendWelcome(from);
    }

    /**
     * Manipula erros gerais
     * @param {string} from - Número do usuário
     * @param {Error} error - Erro ocorrido
     * @returns {Promise<boolean>} Sucesso do tratamento
     */
    async handleError(from, error) {
        console.error(`Erro no fluxo para ${from}:`, error);
        
        await whatsappService.sendText(from,
            '⚠️ *Ops! Algo deu errado*\n\n' +
            'Tivemos um problema técnico momentâneo.\n\n' +
            '💡 Digite "menu" para recomeçar ou "atendente" para falar com nosso suporte.'
        );
        
        return false;
    }
}

// Singleton instance
const mainFlow = new MainFlow();

module.exports = mainFlow;
