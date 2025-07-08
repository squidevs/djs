/**
 * Funções Utilitárias
 * Contém funções auxiliares para processamento de texto e validações
 */

class Utils {
    /**
     * Normaliza texto para comparação
     * @param {string} text - Texto a ser normalizado
     * @returns {string} Texto normalizado
     */
    static normalizeText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^\w\s]/g, ' ') // Remove pontuação
            .replace(/\s+/g, ' '); // Normaliza espaços
    }

    /**
     * Verifica se é uma saudação
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isGreeting(text) {
        const normalized = this.normalizeText(text);
        const greetings = [
            'oi', 'ola', 'olá', 'hello', 'hi',
            'bom dia', 'boa tarde', 'boa noite',
            'bomdia', 'boatarde', 'boanoite',
            'oi bom dia', 'ola bom dia',
            'eae', 'e ai', 'salve'
        ];
        
        return greetings.some(greeting => 
            normalized.includes(greeting) || normalized === greeting
        );
    }

    /**
     * Verifica se é uma despedida
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isFarewell(text) {
        const normalized = this.normalizeText(text);
        const farewells = [
            'tchau', 'ate mais', 'ate logo', 'ate breve',
            'obrigado', 'obrigada', 'valeu', 'ok obrigado',
            'tudo bem obrigado', 'ja consegui', 'ja resolvi',
            'fui', 'vlw', 'valeu mesmo'
        ];
        
        return farewells.some(farewell => 
            normalized.includes(farewell)
        );
    }

    /**
     * Verifica se usuário está pedindo atendente humano
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isRequestingHuman(text) {
        const normalized = this.normalizeText(text);
        const humanRequests = [
            'atendente', 'atendimento', 'humano', 'pessoa',
            'falar com alguem', 'falar com pessoa',
            'quero falar com atendente', 'preciso de ajuda',
            'corretor', 'vendedor', 'consultor',
            'nao consigo', 'nao entendi', 'ajuda',
            'suporte', 'help'
        ];
        
        return humanRequests.some(request => 
            normalized.includes(request)
        );
    }

    /**
     * Verifica se é comando de menu
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isMenuCommand(text) {
        const normalized = this.normalizeText(text);
        const menuCommands = [
            'menu', 'inicio', 'começar', 'comecar',
            'voltar', 'start', 'reiniciar'
        ];
        
        return menuCommands.some(command => 
            normalized === command || normalized.includes(command)
        );
    }

    /**
     * Extrai número da opção do texto
     * @param {string} text - Texto com possível número
     * @returns {number|null} Número extraído ou null
     */
    static extractOptionNumber(text) {
        const normalized = this.normalizeText(text);
        
        // Busca por números no início do texto
        const match = normalized.match(/^(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }

        // Busca por números escritos por extenso
        const numberWords = {
            'um': 1, 'uma': 1, 'primeiro': 1, 'primeira': 1,
            'dois': 2, 'duas': 2, 'segundo': 2, 'segunda': 2,
            'tres': 3, 'terceiro': 3, 'terceira': 3,
            'quatro': 4, 'quarto': 4, 'quarta': 4,
            'cinco': 5, 'quinto': 5, 'quinta': 5,
            'seis': 6, 'sexto': 6, 'sexta': 6,
            'sete': 7, 'setimo': 7, 'setima': 7,
            'oito': 8, 'oitavo': 8, 'oitava': 8,
            'nove': 9, 'nono': 9, 'nona': 9,
            'dez': 10, 'decimo': 10, 'decima': 10
        };

        for (const [word, number] of Object.entries(numberWords)) {
            if (normalized.includes(word)) {
                return number;
            }
        }

        return null;
    }

    /**
     * Verifica se texto contém palavras-chave
     * @param {string} text - Texto a ser verificado
     * @param {string[]} keywords - Palavras-chave a buscar
     * @returns {boolean}
     */
    static containsKeywords(text, keywords) {
        const normalized = this.normalizeText(text);
        return keywords.some(keyword => 
            normalized.includes(this.normalizeText(keyword))
        );
    }

    /**
     * Formata número de telefone
     * @param {string} phone - Número a ser formatado
     * @returns {string} Número formatado
     */
    static formatPhone(phone) {
        if (!phone) return '';
        
        // Remove tudo que não é número
        const numbers = phone.replace(/\D/g, '');
        
        // Adiciona código do país se necessário
        if (numbers.length === 11 && numbers.startsWith('11')) {
            return `55${numbers}@c.us`;
        } else if (numbers.length === 10) {
            return `5511${numbers}@c.us`;
        } else if (numbers.startsWith('55')) {
            return `${numbers}@c.us`;
        }
        
        return phone;
    }

    /**
     * Valida formato de email
     * @param {string} email - Email a ser validado
     * @returns {boolean}
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Valida CPF (aceita com ou sem máscara)
     * @param {string} cpf - CPF a ser validado
     * @returns {boolean}
     */
    static isValidCPF(cpf) {
        if (!cpf) return false;
        
        // Remove TODOS os caracteres não numéricos (pontos, hífens, espaços)
        const numbers = cpf.replace(/[^\d]/g, '');
        if (numbers.length !== 11) return false;
        
        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1{10}$/.test(numbers)) return false;
        
        // Validação do CPF
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(numbers.charAt(i)) * (10 - i);
        }
        let digit1 = 11 - (sum % 11);
        if (digit1 > 9) digit1 = 0;
        
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(numbers.charAt(i)) * (11 - i);
        }
        let digit2 = 11 - (sum % 11);
        if (digit2 > 9) digit2 = 0;
        
        return digit1 === parseInt(numbers.charAt(9)) && 
               digit2 === parseInt(numbers.charAt(10));
    }

    /**
     * Formata data para exibição
     * @param {Date|string|number} date - Data a ser formatada
     * @returns {string} Data formatada
     */
    static formatDate(date) {
        try {
            const d = new Date(date);
            return d.toLocaleDateString('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Data inválida';
        }
    }

    /**
     * Gera ID único
     * @returns {string} ID único
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Debounce function para evitar execuções múltiplas
     * @param {Function} func - Função a ser debounced
     * @param {number} wait - Tempo de espera em ms
     * @returns {Function} Função debounced
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Trunca texto para tamanho máximo
     * @param {string} text - Texto a ser truncado
     * @param {number} maxLength - Tamanho máximo
     * @returns {string} Texto truncado
     */
    static truncateText(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Sanitiza texto para evitar problemas de encoding
     * @param {string} text - Texto a ser sanitizado
     * @returns {string} Texto sanitizado
     */
    static sanitizeText(text) {
        if (!text) return '';
        
        return text
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis de faces
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Remove emojis diversos
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Remove emojis de transporte
            .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Remove símbolos diversos
            .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Remove Dingbats
            .trim();
    }

    /**
     * Delay assíncrono
     * @param {number} ms - Milissegundos para aguardar
     * @returns {Promise}
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Verifica se usuário está solicitando voltar
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isRequestingBack(text) {
        const normalized = this.normalizeText(text);
        const backRequests = [
            'voltar', 'volta', 'anterior', 'antes', 
            'menu anterior', 'opcao anterior', 'back'
        ];
        
        return backRequests.some(request => 
            normalized.includes(request) || normalized === request
        );
    }

    /**
     * Verifica se é input inválido que precisa de tratamento especial
     * @param {string} text - Texto a ser verificado
     * @returns {boolean}
     */
    static isInvalidInput(text) {
        const normalized = this.normalizeText(text);
        
        // Inputs muito curtos ou confusos
        if (normalized.length < 1) return true;
        if (/^[0-9]{10,}$/.test(normalized)) return true; // Apenas números longos
        if (/^[^a-zA-Z0-9\s]+$/.test(normalized)) return true; // Apenas símbolos
        
        return false;
    }

    /**
     * Aplica máscara no CPF
     * @param {string} cpf - CPF para aplicar máscara
     * @returns {string} CPF formatado
     */
    static maskCPF(cpf) {
        if (!cpf) return '';
        
        // Remove tudo que não é número
        const numbers = cpf.replace(/[^\d]/g, '');
        
        // Aplica a máscara XXX.XXX.XXX-XX
        if (numbers.length === 11) {
            return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        
        return cpf; // Retorna como estava se não for um CPF válido
    }
}

module.exports = Utils;
