/**
 * Sistema de Cache Otimizado
 * Gerencia cache de mensagens com expiração automática para evitar duplicações
 */

class CacheSystem {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 60000; // 1 minuto em milissegundos
        
        // Limpeza periódica do cache a cada 5 minutos
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 300000);
    }

    /**
     * Adiciona uma entrada ao cache com TTL
     * @param {string} key - Chave única
     * @param {any} value - Valor a ser armazenado
     * @param {number} ttl - Tempo de vida em milissegundos
     */
    set(key, value, ttl = this.defaultTTL) {
        const expirationTime = Date.now() + ttl;
        
        this.cache.set(key, {
            value,
            expirationTime,
            createdAt: Date.now()
        });

        // Remove automaticamente após o TTL
        setTimeout(() => {
            this.delete(key);
        }, ttl);
    }

    /**
     * Obtém um valor do cache se ainda válido
     * @param {string} key - Chave a ser buscada
     * @returns {any|null} Valor ou null se expirado/inexistente
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }

        // Verifica se expirou
        if (Date.now() > entry.expirationTime) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Verifica se uma chave existe e ainda é válida
     * @param {string} key - Chave a ser verificada
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Remove uma entrada do cache
     * @param {string} key - Chave a ser removida
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Limpa entradas expiradas do cache
     */
    performCleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expirationTime) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cache cleanup: ${cleanedCount} entradas removidas`);
        }
    }

    /**
     * Gera chave única para mensagem
     * @param {string} from - Número do remetente
     * @param {string} messageId - ID da mensagem
     * @returns {string} Chave única
     */
    generateMessageKey(from, messageId) {
        return `msg_${from}_${messageId}`;
    }

    /**
     * Verifica se mensagem já foi processada
     * @param {string} from - Número do remetente
     * @param {string} messageId - ID da mensagem
     * @returns {boolean}
     */
    isMessageProcessed(from, messageId) {
        const key = this.generateMessageKey(from, messageId);
        return this.has(key);
    }

    /**
     * Marca mensagem como processada
     * @param {string} from - Número do remetente
     * @param {string} messageId - ID da mensagem
     * @param {number} ttl - Tempo de vida personalizado
     */
    markMessageProcessed(from, messageId, ttl = this.defaultTTL) {
        const key = this.generateMessageKey(from, messageId);
        this.set(key, true, ttl);
    }

    /**
     * Obtém estatísticas do cache
     * @returns {object} Estatísticas
     */
    getStats() {
        return {
            totalEntries: this.cache.size,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    /**
     * Limpa todo o cache
     */
    clear() {
        this.cache.clear();
        console.log('Cache completamente limpo');
    }

    /**
     * Destroi o sistema de cache
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// Singleton instance
const cacheSystem = new CacheSystem();

module.exports = cacheSystem;
