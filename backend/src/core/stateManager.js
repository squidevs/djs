/**
 * Gerenciador de Estado do Bot
 * Controla estado global e sessões de usuários com persistência
 */

const fs = require('fs');
const path = require('path');

class StateManager {
    constructor() {
        this.statePath = path.join(__dirname, '../data/state.json');
        this.state = this.loadState();
        this.saveInterval = null;
        
        // Auto-save a cada 30 segundos se houver mudanças
        this.startAutoSave();
    }

    /**
     * Carrega o estado do arquivo
     * @returns {object} Estado carregado ou padrão
     */
    loadState() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = fs.readFileSync(this.statePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Erro ao carregar estado:', error);
        }

        // Estado padrão
        return {
            chatbot_is_on: true,
            bot_start_time: Date.now(),
            sessions: {},
            stats: {
                total_messages: 0,
                total_users: 0,
                last_reset: Date.now()
            }
        };
    }

    /**
     * Salva o estado no arquivo
     */
    saveState() {
        try {
            // Garante que o diretório existe
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('Erro ao salvar estado:', error);
        }
    }

    /**
     * Inicia o auto-save periódico
     */
    startAutoSave() {
        this.saveInterval = setInterval(() => {
            this.saveState();
        }, 30000); // 30 segundos
    }

    /**
     * Verifica se o bot está ativo
     * @returns {boolean}
     */
    isBotActive() {
        return this.state.chatbot_is_on === true;
    }

    /**
     * Ativa o bot
     */
    enableBot() {
        this.state.chatbot_is_on = true;
        console.log('Bot ativado');
    }

    /**
     * Desativa o bot por um período específico
     * @param {number} minutes - Minutos para desativar
     */
    disableBot(minutes = 60) {
        this.state.chatbot_is_on = false;
        console.log(`Bot desativado por ${minutes} minutos`);
        
        // Reativa automaticamente após o tempo especificado
        setTimeout(() => {
            this.state.chatbot_is_on = true;
            this.saveState();
            console.log('Bot reativado automaticamente');
        }, minutes * 60 * 1000);
    }

    /**
     * Obtém a sessão de um usuário
     * @param {string} phone - Número do telefone
     * @returns {object} Dados da sessão
     */
    getUserSession(phone) {
        if (!this.state.sessions[phone]) {
            this.state.sessions[phone] = {
                phone,
                currentFlow: 'welcome',
                currentStep: 'inicio',
                data: {},
                history: [],
                createdAt: Date.now(),
                lastActivity: Date.now()
            };
            this.state.stats.total_users++;
        }

        // Atualiza última atividade
        this.state.sessions[phone].lastActivity = Date.now();
        return this.state.sessions[phone];
    }

    /**
     * Atualiza a sessão de um usuário
     * @param {string} phone - Número do telefone
     * @param {object} updates - Atualizações a serem aplicadas
     */
    updateUserSession(phone, updates) {
        const session = this.getUserSession(phone);
        
        // Adiciona à história se mudou de fluxo ou passo
        if (updates.currentFlow && updates.currentFlow !== session.currentFlow) {
            session.history.push({
                from: session.currentFlow,
                to: updates.currentFlow,
                timestamp: Date.now()
            });
        }

        // Aplica as atualizações
        Object.assign(session, updates);
        session.lastActivity = Date.now();

        this.state.sessions[phone] = session;
    }

    /**
     * Remove sessão de usuário
     * @param {string} phone - Número do telefone
     */
    removeUserSession(phone) {
        delete this.state.sessions[phone];
    }

    /**
     * Limpa sessões inativas
     * @param {number} maxInactiveHours - Horas máximas de inatividade
     */
    cleanInactiveSessions(maxInactiveHours = 24) {
        const cutoffTime = Date.now() - (maxInactiveHours * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const [phone, session] of Object.entries(this.state.sessions)) {
            if (session.lastActivity < cutoffTime) {
                delete this.state.sessions[phone];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`Sessões limpas: ${cleanedCount} sessões inativas removidas`);
        }
    }

    /**
     * Incrementa contador de mensagens
     */
    incrementMessageCount() {
        this.state.stats.total_messages++;
    }

    /**
     * Obtém estatísticas do bot
     * @returns {object} Estatísticas
     */
    getStats() {
        const activeSessions = Object.keys(this.state.sessions).length;
        const uptime = Date.now() - this.state.bot_start_time;

        return {
            ...this.state.stats,
            active_sessions: activeSessions,
            bot_uptime: uptime,
            bot_active: this.state.chatbot_is_on
        };
    }

    /**
     * Reset das estatísticas
     */
    resetStats() {
        this.state.stats = {
            total_messages: 0,
            total_users: 0,
            last_reset: Date.now()
        };
    }

    /**
     * Obtém todas as sessões ativas
     * @returns {object} Sessões ativas
     */
    getActiveSessions() {
        return this.state.sessions;
    }

    /**
     * Backup do estado
     * @returns {string} Path do backup criado
     */
    createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(path.dirname(this.statePath), `state_backup_${timestamp}.json`);
        
        try {
            fs.writeFileSync(backupPath, JSON.stringify(this.state, null, 2));
            console.log(`Backup criado: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('Erro ao criar backup:', error);
            return null;
        }
    }

    /**
     * Destroi o gerenciador e salva estado final
     */
    destroy() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        this.saveState();
        console.log('StateManager destruído e estado salvo');
    }
}

// Singleton instance
const stateManager = new StateManager();

// Graceful shutdown
process.on('SIGINT', () => {
    stateManager.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    stateManager.destroy();
    process.exit(0);
});

module.exports = stateManager;
