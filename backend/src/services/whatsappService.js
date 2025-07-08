/**
 * Serviço de WhatsApp
 * Responsável por todas as interações com a API do WhatsApp
 */

const Utils = require('../core/utils');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.messageQueue = [];
        this.processingQueue = false;
    }

    /**
     * Define o cliente WhatsApp
     * @param {Object} client - Cliente wppconnect
     */
    setClient(client) {
        this.client = client;
        this.isReady = true;
        this.processMessageQueue();
    }

    /**
     * Verifica se o serviço está pronto
     * @returns {boolean}
     */
    isServiceReady() {
        return this.isReady && this.client;
    }

    /**
     * Adiciona mensagem à fila se serviço não estiver pronto
     * @param {Function} messageFunction - Função que envia a mensagem
     */
    queueMessage(messageFunction) {
        if (this.isServiceReady()) {
            return messageFunction();
        } else {
            this.messageQueue.push(messageFunction);
        }
    }

    /**
     * Processa fila de mensagens
     */
    async processMessageQueue() {
        if (this.processingQueue) return;
        
        this.processingQueue = true;
        
        while (this.messageQueue.length > 0) {
            const messageFunc = this.messageQueue.shift();
            try {
                await messageFunc();
                await Utils.delay(1000); // Delay entre mensagens
            } catch (error) {
                console.error('Erro ao processar mensagem da fila:', error);
            }
        }
        
        this.processingQueue = false;
    }

    /**
     * Envia mensagem de texto com delay e indicador de digitação
     * @param {string} to - Número de destino
     * @param {string} text - Texto a ser enviado
     * @param {boolean} withTyping - Se deve mostrar indicador de digitação
     * @param {number} delay - Delay adicional em ms
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendText(to, text, withTyping = true, delay = 1500) {
        try {
            if (!this.isServiceReady()) {
                this.queueMessage(() => this.sendText(to, text, withTyping, delay));
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            
            // Envia indicador de digitação se solicitado
            if (withTyping) {
                await this.sendTyping(formattedTo, delay);
                await Utils.delay(delay);
            }
            
            await this.client.sendText(formattedTo, text);
            
            console.log(`Texto enviado para ${to}: ${Utils.truncateText(text)}`);
            
            // Delay após envio para simular pausa natural
            await Utils.delay(800);
            
            return true;
        } catch (error) {
            console.error('Erro ao enviar texto:', error);
            return false;
        }
    }

    /**
     * Envia menu de lista interativo com delay e digitação
     * @param {string} to - Número de destino
     * @param {Object} menuConfig - Configuração do menu
     * @param {boolean} withTyping - Se deve mostrar indicador de digitação
     * @param {number} delay - Delay antes do envio
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendListMessage(to, menuConfig, withTyping = true, delay = 1200) {
        try {
            if (!this.isServiceReady()) {
                this.queueMessage(() => this.sendListMessage(to, menuConfig, withTyping, delay));
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            
            // Envia indicador de digitação se solicitado
            if (withTyping) {
                await this.sendTyping(formattedTo, delay);
                await Utils.delay(delay);
            }
            
            // Valida configuração do menu
            if (!this.validateMenuConfig(menuConfig)) {
                console.error('Configuração de menu inválida');
                return await this.sendText(to, 'Erro ao exibir opções. Por favor, tente novamente digitando "menu".', false);
            }

            await this.client.sendListMessage(formattedTo, menuConfig);
            
            console.log(`Menu enviado para ${to}: ${menuConfig.title}`);
            
            // Delay após envio
            await Utils.delay(600);
            
            return true;
        } catch (error) {
            console.error('Erro ao enviar menu:', error);
            
            // Fallback: envia como texto simples
            try {
                const fallbackText = this.convertMenuToText(menuConfig);
                return await this.sendText(to, fallbackText, false);
            } catch (fallbackError) {
                console.error('Erro no fallback:', fallbackError);
                return false;
            }
        }
    }

    /**
     * Envia imagem
     * @param {string} to - Número de destino
     * @param {string} imagePath - Caminho da imagem
     * @param {string} caption - Legenda da imagem
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendImage(to, imagePath, caption = '') {
        try {
            if (!this.isServiceReady()) {
                this.queueMessage(() => this.sendImage(to, imagePath, caption));
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            await this.client.sendImage(formattedTo, imagePath, 'image', caption);
            
            console.log(`Imagem enviada para ${to}`);
            return true;
        } catch (error) {
            console.error('Erro ao enviar imagem:', error);
            return false;
        }
    }

    /**
     * Envia documento
     * @param {string} to - Número de destino
     * @param {string} documentPath - Caminho do documento
     * @param {string} filename - Nome do arquivo
     * @param {string} caption - Legenda do documento
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendDocument(to, documentPath, filename, caption = '') {
        try {
            if (!this.isServiceReady()) {
                this.queueMessage(() => this.sendDocument(to, documentPath, filename, caption));
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            await this.client.sendFile(formattedTo, documentPath, filename, caption);
            
            console.log(`Documento enviado para ${to}: ${filename}`);
            return true;
        } catch (error) {
            console.error('Erro ao enviar documento:', error);
            return false;
        }
    }

    /**
     * Envia localização
     * @param {string} to - Número de destino
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {string} name - Nome do local
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendLocation(to, latitude, longitude, name = '') {
        try {
            if (!this.isServiceReady()) {
                this.queueMessage(() => this.sendLocation(to, latitude, longitude, name));
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            await this.client.sendLocation(formattedTo, latitude, longitude, name);
            
            console.log(`Localização enviada para ${to}`);
            return true;
        } catch (error) {
            console.error('Erro ao enviar localização:', error);
            return false;
        }
    }

    /**
     * Marca mensagem como lida
     * @param {string} messageId - ID da mensagem
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async markAsRead(messageId) {
        try {
            if (!this.isServiceReady()) {
                return false;
            }

            await this.client.sendSeen(messageId);
            return true;
        } catch (error) {
            console.error('Erro ao marcar como lida:', error);
            return false;
        }
    }

    /**
     * Envia indicador de digitação
     * @param {string} to - Número de destino
     * @param {number} duration - Duração em ms
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async sendTyping(to, duration = 2000) {
        try {
            if (!this.isServiceReady()) {
                return false;
            }

            const formattedTo = Utils.formatPhone(to);
            await this.client.startTyping(formattedTo);
            
            setTimeout(async () => {
                try {
                    await this.client.stopTyping(formattedTo);
                } catch (error) {
                    console.error('Erro ao parar indicador de digitação:', error);
                }
            }, duration);
            
            return true;
        } catch (error) {
            console.error('Erro ao enviar indicador de digitação:', error);
            return false;
        }
    }

    /**
     * Valida configuração do menu
     * @param {Object} menuConfig - Configuração a ser validada
     * @returns {boolean} Válido ou não
     */
    validateMenuConfig(menuConfig) {
        if (!menuConfig || typeof menuConfig !== 'object') return false;
        if (!menuConfig.title || !menuConfig.sections) return false;
        if (!Array.isArray(menuConfig.sections)) return false;
        
        return menuConfig.sections.every(section => 
            section.rows && Array.isArray(section.rows) && section.rows.length > 0
        );
    }

    /**
     * Converte menu para texto simples (fallback)
     * @param {Object} menuConfig - Configuração do menu
     * @returns {string} Menu em formato texto
     */
    convertMenuToText(menuConfig) {
        let text = `*${menuConfig.title}*\n\n`;
        
        if (menuConfig.description) {
            text += `${menuConfig.description}\n\n`;
        }

        menuConfig.sections.forEach((section, sectionIndex) => {
            if (section.title && menuConfig.sections.length > 1) {
                text += `*${section.title}:*\n`;
            }

            section.rows.forEach((row, rowIndex) => {
                const optionNumber = rowIndex + 1;
                text += `${optionNumber}. ${row.title}`;
                
                if (row.description) {
                    text += ` - ${row.description}`;
                }
                
                text += '\n';
            });

            if (sectionIndex < menuConfig.sections.length - 1) {
                text += '\n';
            }
        });

        text += '\n💡 *Digite o número da opção desejada.*';
        
        return text;
    }

    /**
     * Processa resposta de lista do usuário
     * @param {Object} message - Mensagem recebida
     * @returns {string|null} ID da opção selecionada ou null
     */
    processListResponse(message) {
        try {
            // Verifica se é uma resposta de lista interativa
            if (message.type === 'list_response' && message.list_response) {
                return message.list_response.id || message.list_response.rowId;
            }

            // Verifica se é uma resposta de botão
            if (message.type === 'button_response' && message.button_response) {
                return message.button_response.id;
            }

            // Fallback para texto simples
            if (message.body) {
                const optionNumber = Utils.extractOptionNumber(message.body);
                if (optionNumber) {
                    return `option_${optionNumber}`;
                }
            }

            return null;
        } catch (error) {
            console.error('Erro ao processar resposta de lista:', error);
            return null;
        }
    }

    /**
     * Extrai informações da mensagem
     * @param {Object} message - Mensagem do WhatsApp
     * @returns {Object} Informações extraídas
     */
    extractMessageInfo(message) {
        return {
            id: message.id,
            from: message.from,
            to: message.to,
            body: message.body || '',
            type: message.type || 'text',
            timestamp: message.timestamp || Date.now(),
            isGroup: message.isGroupMsg || false,
            author: message.author || message.from,
            quotedMsg: message.quotedMsg || null,
            listResponse: this.processListResponse(message)
        };
    }

    /**
     * Obtém informações do contato
     * @param {string} contactId - ID do contato
     * @returns {Promise<Object|null>} Informações do contato
     */
    async getContactInfo(contactId) {
        try {
            if (!this.isServiceReady()) {
                return null;
            }

            const contact = await this.client.getContact(contactId);
            return {
                id: contact.id,
                name: contact.name || contact.pushname || 'Usuário',
                number: contact.id.replace('@c.us', ''),
                isGroup: contact.isGroup || false
            };
        } catch (error) {
            console.error('Erro ao obter informações do contato:', error);
            return null;
        }
    }

    /**
     * Envia notificação de transferência APENAS para o corretor
     * @param {string} clientName - Nome do cliente
     * @param {string} clientContact - Contato do cliente (telefone/email)
     * @param {string} reason - Motivo da transferência
     * @param {string} brokerNumber - Número do corretor (opcional)
     */
    async notifyBrokerTransfer(clientName, clientContact, reason, brokerNumber = null) {
        try {
            // Número do corretor - pega do .env ou usa padrão
            const defaultBrokerNumber = process.env.BROKER_WHATSAPP || '5519995910737';
            const brokerTo = brokerNumber || defaultBrokerNumber;
            
            const notificationMessage = 
                `🔔 *Nova Transferência de Cliente*\n\n` +
                `👤 *Cliente:* ${clientName || 'Não informado'}\n` +
                `📞 *Contato:* ${clientContact || 'Não disponível'}\n` +
                `📋 *Motivo:* ${reason}\n` +
                `⏰ *Horário:* ${new Date().toLocaleString('pt-BR')}\n\n` +
                `💡 *O cliente está aguardando atendimento no WhatsApp.*`;
            
            // CRÍTICO: Envia APENAS para o corretor, nunca para o cliente
            const brokerFormatted = Utils.formatPhone(brokerTo);
            await this.client.sendText(brokerFormatted, notificationMessage);
            
            console.log(`✅ Notificação de transferência enviada APENAS para o corretor: ${brokerTo}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de transferência:', error);
            return false;
        }
    }

    /**
     * Destroi o serviço
     */
    destroy() {
        this.messageQueue = [];
        this.isReady = false;
        this.client = null;
        console.log('WhatsAppService destruído');
    }
}

// Singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;
