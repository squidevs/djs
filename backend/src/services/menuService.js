/**
 * Serviço de Geração de Menus
 * Responsável por criar menus interativos e listas para WhatsApp
 */

const seguradoras = require('../data/seguradoras.json');

class MenuService {
    /**
     * Gera menu de lista básico
     * @param {Array} options - Opções do menu
     * @param {string} title - Título do menu
     * @param {string} description - Descrição do menu
     * @param {string} buttonText - Texto do botão
     * @returns {Object} Configuração do menu
     */
    static generateMenu(options, title = 'Menu', description = 'Escolha uma opção:', buttonText = 'Selecionar') {
        return {
            title: title,
            description: description,
            buttonText: buttonText,
            sections: [{
                title: 'Opções Disponíveis',
                rows: options.map((opt, index) => ({
                    id: `option_${index + 1}`,
                    rowId: opt.rowId || `option_${index + 1}_${opt.key || opt.id || index}`,
                    title: opt.text || opt.title,
                    description: opt.description || ''
                }))
            }]
        };
    }

    /**
     * Menu de boas-vindas
     * @returns {Object} Menu de boas-vindas
     */
    static welcomeMenu() {
        const options = [
            {
                key: 'cliente',
                text: '👤 Já sou cliente DJS',
                description: 'Acesse serviços para clientes'
            },
            {
                key: 'cotacao',
                text: '💰 Quero cotar um seguro',
                description: 'Solicite uma nova cotação'
            }
        ];

        return this.generateMenu(
            options,
            '🏢 DJS Corretora de Seguros',
            'Olá! 👋 Seja bem-vindo à DJS Corretora de Seguros.\n\nSomos especialistas em seguros e estamos aqui para te ajudar!\n\nComo posso te orientar hoje?',
            '📋 Ver Opções'
        );
    }

    /**
     * Menu principal para clientes
     * @returns {Object} Menu principal
     */
    static mainMenu() {
        const options = [
            {
                key: 'nova_cotacao',
                text: '📝 Quero uma Nova Cotação',
                description: 'Solicitar cotação de seguro'
            },
            {
                key: 'renovacao',
                text: '🔄 Informações sobre Renovação',
                description: 'Consultar renovação de apólice'
            },
            {
                key: 'sinistro',
                text: '🚗 Comunicar Sinistro',
                description: 'Abrir chamado de sinistro'
            },
            {
                key: 'segunda_via',
                text: '📄 2ª Via de Documento/Boleto',
                description: 'Solicitar segunda via'
            },
            {
                key: 'seguradoras',
                text: '🏢 Contatos das Seguradoras',
                description: 'Lista de seguradoras parceiras'
            },
            {
                key: 'atendimento',
                text: '👨‍💼 Falar com Atendente',
                description: 'Transferir para corretor'
            }
        ];

        return this.generateMenu(
            options,
            '📋 Menu Principal',
            'Como posso te orientar?',
            '✅ Selecionar'
        );
    }

    /**
     * Menu de tipos de cotação
     * @returns {Object} Menu de cotação
     */
    static cotacaoMenu() {
        const options = [
            {
                key: 'auto',
                text: '🚗 Seguro Auto',
                description: 'Cotação para veículos'
            },
            {
                key: 'residencial',
                text: '🏠 Seguro Residencial',
                description: 'Proteção para sua casa'
            },
            {
                key: 'vida',
                text: '❤️ Seguro de Vida',
                description: 'Proteção pessoal e familiar'
            },
            {
                key: 'empresarial',
                text: '🏢 Seguro Empresarial',
                description: 'Proteção para empresas'
            },
            {
                key: 'outros',
                text: '📋 Outros Seguros',
                description: 'Demais modalidades'
            },
            {
                key: 'voltar',
                text: '⬅️ Voltar ao Menu',
                description: 'Retornar ao menu anterior'
            }
        ];

        return this.generateMenu(
            options,
            '💰 Tipos de Cotação',
            'Qual tipo de seguro você gostaria de cotar?',
            '📋 Escolher'
        );
    }

    /**
     * Menu de seguradoras parceiras
     * @returns {Object} Menu de seguradoras
     */
    static seguradorasMenu() {
        const options = seguradoras.map(seg => ({
            key: seg.id,
            text: `🏢 ${seg.nome}`,
            description: `WhatsApp: ${seg.whatsapp}`
        }));

        // Adiciona opção de voltar
        options.push({
            key: 'voltar',
            text: '⬅️ Voltar ao Menu',
            description: 'Retornar ao menu anterior'
        });

        return this.generateMenu(
            options,
            '🏢 Seguradoras Parceiras',
            'Selecione uma seguradora para ver os contatos:',
            '📞 Ver Contatos'
        );
    }

    /**
     * Menu de informações de renovação - Simplificado
     * @returns {Object} Menu de renovação
     */
    static renovacaoMenu() {
        const options = [
            {
                key: 'contato',
                text: '👨‍💼 Falar com Atendente',
                description: 'Atendimento especializado'
            },
            {
                key: 'voltar',
                text: '⬅️ Voltar ao Menu Principal',
                description: 'Retornar ao menu anterior'
            }
        ];

        return this.generateMenu(
            options,
            '🔄 Renovação de Apólice',
            'Como posso te ajudar com sua renovação?',
            '📋 Selecionar'
        );
    }

    /**
     * Menu de comunicação de sinistro - Reestruturado para mostrar seguradoras
     * @returns {Object} Menu de sinistro
     */
    static sinistroMenu() {
        const seguradoras = require('../data/seguradoras.json');
        
        const options = seguradoras.map((seg, index) => ({
            key: seg.id,
            text: `${index + 1}. ${seg.nome}`,
            description: `Assistência: ${seg.assistencia}`
        }));

        options.push({
            key: 'voltar',
            text: '⬅️ Voltar ao Menu Principal',
            description: 'Retornar ao menu anterior'
        });

        return this.generateMenu(
            options,
            '🚨 Selecione sua Seguradora',
            'Escolha sua seguradora para ver os contatos de sinistro:',
            '📋 Selecionar'
        );
    }

    /**
     * Menu de segunda via de documentos
     * @returns {Object} Menu de segunda via
     */
    static segundaViaMenu() {
        const options = [
            {
                key: 'apolice',
                text: '📜 Apólice de Seguro',
                description: 'Segunda via da apólice'
            },
            {
                key: 'boleto',
                text: '💳 Boleto de Pagamento',
                description: 'Segunda via do boleto'
            },
            {
                key: 'certificado',
                text: '🏆 Certificado de Seguro',
                description: 'Documento comprobatório'
            },
            {
                key: 'carta_cobertura',
                text: '📋 Carta de Cobertura',
                description: 'Detalhes da cobertura'
            },
            {
                key: 'voltar',
                text: '⬅️ Voltar ao Menu',
                description: 'Retornar ao menu anterior'
            }
        ];

        return this.generateMenu(
            options,
            '📄 Segunda Via de Documentos',
            'Qual documento você precisa?',
            '📋 Solicitar'
        );
    }

    /**
     * Gera texto com informações de seguradora PROFISSIONAL (SEM markdown)
     * @param {string} seguradoraId - ID da seguradora
     * @returns {string} Texto formatado com informações
     */
    static getSeguradoraInfo(seguradoraId) {
        const seguradoras = require('../data/seguradoras.json');
        const seguradora = seguradoras.find(s => s.id === seguradoraId);
        
        if (!seguradora) {
            return 'Seguradora não encontrada.';
        }

        // CORREÇÃO: Formato limpo sem markdown (WhatsApp torna links clicáveis automaticamente)
        return `🏢 *${seguradora.nome}*\n\n` +
               `📞 Atendimento 24h (Sinistros):\n` +
               `   ${seguradora.assistencia}\n\n` +
               `📱 WhatsApp:\n` +
               `   ${seguradora.whatsapp}\n\n` +
               `🆘 SAC (Atendimento Geral):\n` +
               `   ${seguradora.sac}\n\n` +
               `🌐 Portal Online:\n` +
               `   ${seguradora.site}\n\n` +
               `💡 *Os números e links são clicáveis no WhatsApp*`;
    }

    /**
     * Lista todas as seguradoras em formato texto
     * @returns {string} Lista formatada
     */
    static getAllSeguradorasText() {
        let text = '🏢 *Nossas Seguradoras Parceiras:*\n\n';
        
        seguradoras.forEach((seg, index) => {
            text += `${index + 1}. *${seg.nome}*\n`;
            text += `   📞 ${seg.whatsapp}\n`;
            text += `   🆘 ${seg.assistencia}\n\n`;
        });

        text += '💡 *Dica:* Digite o nome da seguradora ou use o menu para ver informações específicas.';
        
        return text;
    }

    /**
     * Gera menu baseado em texto do usuário
     * @param {string} userText - Texto do usuário
     * @returns {Object|null} Menu correspondente ou null
     */
    static getMenuByUserText(userText) {
        const normalized = userText.toLowerCase().trim();

        // Mapeamento de palavras-chave para menus
        const menuMap = {
            'cotacao': () => this.cotacaoMenu(),
            'cotar': () => this.cotacaoMenu(),
            'renovacao': () => this.renovacaoMenu(),
            'sinistro': () => this.sinistroMenu(),
            'acidente': () => this.sinistroMenu(),
            'seguradoras': () => this.seguradorasMenu(),
            'contatos': () => this.seguradorasMenu(),
            'segunda via': () => this.segundaViaMenu(),
            'documentos': () => this.segundaViaMenu()
        };

        for (const [keyword, menuFunc] of Object.entries(menuMap)) {
            if (normalized.includes(keyword)) {
                return menuFunc();
            }
        }

        return null;
    }

    /**
     * Menu padrão de finalização de fluxos
     * @returns {Object} Menu de finalização
     */
    static finalizationMenu() {
        const options = [
            {
                key: 'menu',
                text: '🔙 Voltar ao Menu Principal',
                description: 'Retornar ao menu principal'
            },
            {
                key: 'encerrar',
                text: '👋 Encerrar Conversa',
                description: 'Finalizar atendimento'
            }
        ];

        return this.generateMenu(
            options,
            '🎯 O que deseja fazer agora?',
            'Escolha uma das opções abaixo:',
            '📋 Escolher'
        );
    }

    /**
     * Cria mensagem de boas-vindas simplificada para clientes existentes
     * @returns {string} Mensagem simplificada
     */
    static getExistingClientMessage() {
        return '👋 Olá! Bem-vindo de volta à DJS Corretora de Seguros.\n\n' +
               'Como posso te ajudar hoje?';
    }
}

module.exports = MenuService;
