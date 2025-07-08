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
        this.flows.set('seguradoras', this.handleSeguradoras.bind(this));
        this.flows.set('seguradora_info', this.handleSeguradoraInfo.bind(this));
        this.flows.set('atendimento', this.handleAtendimento.bind(this));
        this.flows.set('finalization', this.handleFinalization.bind(this));
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

        // Opção 1: Já sou cliente - Simplificado
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
            
            // Envia mensagem simplificada para clientes
            await whatsappService.sendText(from, menuService.getExistingClientMessage());
            return await this.sendMainMenu(from);
        }

        // Opção 2: Quero cotar - Direcionamento direto
        if (input.includes('option_2') || 
            input.includes('cotacao') || 
            normalized.includes('cotar') || 
            normalized.includes('quero cotar') ||
            normalized.includes('cotacao') ||
            optionNumber === 2) {
            
            // Direcionamento DIRETO para cotação sem redirecionamentos
            return await cotacaoFlow.start(from);
        }

        // Opção inválida - Tratamento melhorado
        await whatsappService.sendText(from, 
            '❓ *Opção não reconhecida.*\n\n' +
            'Escolha uma das opções abaixo:\n\n' +
            '🔹 Tentar novamente\n' +
            '🔹 Voltar ao menu anterior\n' +
            '🔹 Encerrar atendimento\n\n' +
            '💡 Digite "menu" para recomeçar.'
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

        // Tratamento global de voltar
        if (utils.isRequestingBack(normalized)) {
            return await this.sendWelcome(from);
        }

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

        // Segunda via - Transfere IMEDIATAMENTE para atendente
        if (input.includes('option_4') ||
            input.includes('segunda_via') || 
            normalized.includes('segunda via') ||
            normalized.includes('2a via') ||
            normalized.includes('documentos') ||
            normalized.includes('boleto') ||
            utils.extractOptionNumber(input) === 4) {
            
            await whatsappService.sendText(from, 
                '📄 *2ª Via de Documento/Boleto*\n\n' +
                'Entendi! Estou te transferindo para um atendente para ajudar com sua 2ª via.\n\n' +
                '⏳ Aguarde um momento...'
            );
            
            return await this.transferToHuman(from, '2ª Via de Documento/Boleto');
        }

        // Seguradoras  
        if (input.includes('option_5') ||
            input.includes('seguradoras') || 
            normalized.includes('seguradora') ||
            normalized.includes('contatos das seguradoras') ||
            utils.extractOptionNumber(input) === 5) {
            stateManager.updateUserSession(from, { currentFlow: 'seguradoras' });
            return await this.sendSeguradorasMenu(from);
        }

        // Atendimento
        if (input.includes('option_6') ||
            input.includes('atendimento') || 
            normalized.includes('atendente') ||
            normalized.includes('falar com atendente') ||
            utils.extractOptionNumber(input) === 6) {
            return await this.transferToHuman(from, 'Solicitação direta');
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
     * Manipula fluxo de renovação - Simplificado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleRenovacao(from, input, session) {
        const normalized = utils.normalizeText(input);

        // Voltar ao menu principal
        if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        // Falar com atendente
        if (input.includes('contato') || normalized.includes('atendente') || normalized.includes('corretor')) {
            return await this.transferToHuman(from, 'Renovação de Apólice');
        }

        // Qualquer outra opção, transfere para atendente
        return await this.transferToHuman(from, 'Renovação de Apólice');
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
     * Manipula fluxo de sinistro - Reestruturado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSinistro(from, input, session) {
        try {
            const normalized = utils.normalizeText(input);

            // Voltar ao menu principal
            if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
                stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
                return await this.sendMainMenu(from);
            }

            // CORREÇÃO: Detecção aprimorada com tratamento antifalha
            const seguradoras = require('../data/seguradoras.json');
            let seguradoraSelecionada = null;

            // Procura por option_number
            const optionMatch = input.match(/option_(\d+)/);
            if (optionMatch) {
                const optionNumber = parseInt(optionMatch[1]) - 1;
                if (optionNumber >= 0 && optionNumber < seguradoras.length) {
                    seguradoraSelecionada = seguradoras[optionNumber];
                }
            } else {
                // Procura por ID ou nome da seguradora
                seguradoraSelecionada = seguradoras.find(seg => 
                    input.includes(seg.id) || 
                    normalized.includes(seg.nome.toLowerCase()) ||
                    normalized.includes(seg.id)
                );
            }

            if (seguradoraSelecionada) {
                // Mostra contatos formatados para sinistro
                const seguradoraInfo = menuService.getSeguradoraInfo(seguradoraSelecionada.id);
                await whatsappService.sendText(from, seguradoraInfo);

                // Finalização padronizada
                setTimeout(async () => {
                    const finalizationMenu = menuService.finalizationMenu();
                    stateManager.updateUserSession(from, { 
                        currentFlow: 'finalization',
                        currentStep: 'menu_finalizacao' 
                    });
                    await whatsappService.sendListMessage(from, finalizationMenu);
                }, 2000);

                return true;
            }

            // CORREÇÃO: Tratamento de input inválido
            await whatsappService.sendText(from,
                '❓ *Seguradora não reconhecida*\n\n' +
                'Por favor, selecione uma seguradora da lista ou:\n\n' +
                '💡 Digite "menu" para voltar ao menu principal\n' +
                '💡 Digite "atendente" para falar com um corretor'
            );

            // Reexibe o menu de sinistro
            return await this.sendSinistroMenu(from);
            
        } catch (error) {
            console.error('❌ Erro no fluxo de sinistro:', error);
            
            // CORREÇÃO: Tratamento antifalha
            await whatsappService.sendText(from,
                '🔧 *Erro técnico momentâneo*\n\n' +
                'Estamos resolvendo rapidamente!\n\n' +
                '💡 Digite "atendente" para falar com nosso suporte.'
            );
            
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }
    }

    /**
     * Manipula fluxo de seguradoras
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleSeguradoras(from, input, session) {
        try {
            const normalized = utils.normalizeText(input);

            // Voltar ao menu principal
            if (input.includes('voltar') || normalized.includes('voltar') || utils.isRequestingBack(normalized)) {
                stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
                return await this.sendMainMenu(from);
            }

            // CORREÇÃO: Detecção aprimorada e tratamento antifalha
            const seguradoras = require('../data/seguradoras.json');
            let seguradoraSelecionada = null;
            
            // Procura por option_number
            const optionMatch = input.match(/option_(\d+)/);
            if (optionMatch) {
                const optionNumber = parseInt(optionMatch[1]) - 1;
                if (optionNumber >= 0 && optionNumber < seguradoras.length) {
                    seguradoraSelecionada = seguradoras[optionNumber];
                }
            } else {
                // Procura por ID ou nome da seguradora
                seguradoraSelecionada = seguradoras.find(seg => 
                    input.includes(seg.id) || 
                    normalized.includes(seg.nome.toLowerCase()) ||
                    normalized.includes(seg.id)
                );
            }
            
            if (seguradoraSelecionada) {
                // Mostra contatos da seguradora formatados
                const info = menuService.getSeguradoraInfo(seguradoraSelecionada.id);
                await whatsappService.sendText(from, info);
                
                // CORREÇÃO: Finalização padronizada após 2 segundos
                setTimeout(async () => {
                    const finalizationMenu = menuService.finalizationMenu();
                    stateManager.updateUserSession(from, { 
                        currentFlow: 'finalization',
                        currentStep: 'menu_finalizacao' 
                    });
                    await whatsappService.sendListMessage(from, finalizationMenu);
                }, 2000);
                
                return true;
            }

            // CORREÇÃO: Tratamento de input inválido
            await whatsappService.sendText(from,
                '❓ *Opção não reconhecida*\n\n' +
                'Por favor, selecione uma seguradora da lista ou:\n\n' +
                '💡 Digite "menu" para voltar ao menu principal\n' +
                '💡 Digite "atendente" para falar com um corretor'
            );
            
            // Reexibe o menu de seguradoras
            return await this.sendSeguradorasMenu(from);
            
        } catch (error) {
            console.error('❌ Erro no fluxo de seguradoras:', error);
            
            // CORREÇÃO: Tratamento antifalha
            await whatsappService.sendText(from,
                '🔧 *Ops! Algo deu errado*\n\n' +
                'Estamos ajustando rapidinho!\n\n' +
                '💡 Tente novamente ou digite "atendente" para falar com nosso suporte.'
            );
            
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }
    }

    /**
     * Envia menu de seguradoras parceiras
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendSeguradorasMenu(from) {
        try {
            const menu = menuService.seguradorasMenu();
            stateManager.updateUserSession(from, { 
                currentFlow: 'seguradoras',
                currentStep: 'selecao_seguradora'
            });
            return await whatsappService.sendListMessage(from, menu);
        } catch (error) {
            console.error('❌ Erro ao enviar menu de seguradoras:', error);
            
            await whatsappService.sendText(from,
                '🔧 *Erro técnico momentâneo*\n\n' +
                'Estamos resolvendo rapidamente!\n\n' +
                '💡 Digite "atendente" para falar com nosso suporte.'
            );
            
            return false;
        }
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
     * Transfere para atendimento humano com notificação SEPARADA
     * @param {string} from - Número do usuário
     * @param {string} reason - Motivo da transferência
     * @returns {Promise<boolean>} Sucesso da transferência
     */
    async transferToHuman(from, reason = 'Solicitação de atendimento') {
        // Obtém dados do usuário se disponíveis
        const session = stateManager.getUserSession(from);
        const clientName = session.data?.cotacao?.nome || session.data?.nome || 'Não informado';
        const clientEmail = session.data?.cotacao?.email || session.data?.email || '';
        const clientContact = clientEmail || from.replace('@c.us', '');

        // CORREÇÃO CRÍTICA: Envia notificação APENAS para o corretor
        await whatsappService.notifyBrokerTransfer(clientName, clientContact, reason);

        // CORREÇÃO CRÍTICA: Envia mensagem APENAS para o cliente
        await whatsappService.sendText(from,
            '👨‍💼 *Transferindo para Atendente Especializado*\n\n' +
            '⏳ Aguarde um momento, você será atendido por um de nossos corretores em breve.\n\n' +
            '📞 *Contatos diretos da DJS Corretora:*\n' +
            '• WhatsApp: (19) 99591-0737\n' +
            '• Telefone: (19) 3403-3333\n' +
            '• E-mail: contato@djscorretora.com.br\n\n' +
            '💡 *Para retornar ao atendimento automático, digite "menu" a qualquer momento.*'
        );

        // Desativa o bot temporariamente e atualiza sessão
        stateManager.disableBot(60); // 60 minutos
        stateManager.updateUserSession(from, { 
            currentFlow: 'atendimento',
            currentStep: 'transferido',
            data: { transferred_at: Date.now(), reason: reason }
        });

        return true;
    }

    /**
     * Manipula opção inválida com tratamento melhorado
     * @param {string} from - Número do usuário
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async handleInvalidOption(from) {
        await whatsappService.sendText(from,
            '❓ *Opção não reconhecida*\n\n' +
            'Escolha uma das opções abaixo:\n\n' +
            '🔹 Tentar novamente\n' +
            '🔹 Voltar ao menu anterior\n' +
            '🔹 Encerrar atendimento\n\n' +
            '💡 *Comandos úteis:*\n' +
            '• "menu" - Voltar ao início\n' +
            '• "atendente" - Falar com corretor\n' +
            '• "seguradoras" - Ver contatos'
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

    /**
     * Manipula fluxo de finalização padronizado
     * @param {string} from - Número do usuário
     * @param {string} input - Entrada do usuário
     * @param {Object} session - Sessão do usuário
     * @returns {Promise<boolean>} Sucesso do processamento
     */
    async handleFinalization(from, input, session) {
        const normalized = utils.normalizeText(input);

        // Voltar ao menu principal
        if (input.includes('menu') || 
            input.includes('option_1') || 
            normalized.includes('voltar') ||
            normalized.includes('menu principal') ||
            utils.extractOptionNumber(input) === 1) {
            
            stateManager.updateUserSession(from, { currentFlow: 'main_menu' });
            return await this.sendMainMenu(from);
        }

        // Encerrar conversa
        if (input.includes('encerrar') || 
            input.includes('option_2') || 
            normalized.includes('encerrar') ||
            normalized.includes('tchau') ||
            utils.extractOptionNumber(input) === 2) {
            
            await whatsappService.sendText(from, 
                '👋 *Conversa Encerrada*\n\n' +
                'Obrigado por entrar em contato com a DJS Corretora! 😊\n\n' +
                'Estamos sempre à disposição para te ajudar.\n\n' +
                '💡 Digite "menu" a qualquer momento para reiniciar o atendimento.'
            );
            
            // Limpa a sessão do usuário
            stateManager.updateUserSession(from, { 
                currentFlow: 'welcome',
                currentStep: 'inicio',
                data: {}
            });
            
            return true;
        }

        // Input inválido, reexibe menu de finalização
        await whatsappService.sendText(from, 
            '❓ *Opção não reconhecida.*\n\n' +
            'Por favor, escolha uma das opções abaixo:'
        );
        
        const finalizationMenu = menuService.finalizationMenu();
        return await whatsappService.sendListMessage(from, finalizationMenu);
    }
}

// Singleton instance
const mainFlow = new MainFlow();

module.exports = mainFlow;
