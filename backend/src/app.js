/**
 * Aplicação Principal do Chatbot DJS
 * Ponto de entrada da aplicação com configuração do servidor e WhatsApp
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

// Importa módulos do sistema
const stateManager = require('./core/stateManager');
const cacheSystem = require('./core/cacheSystem');
const whatsappService = require('./services/whatsappService');
const mainFlow = require('./flows/mainFlow');
const sessionManager = require('./utils/sessionManager');

class DJSChatbot {
    constructor() {
        this.app = express();
        this.client = null;
        this.server = null;
        this.isConnected = false;
        
        this.setupExpress();
        this.setupRoutes();
        this.setupGracefulShutdown();
    }

    /**
     * Configura o servidor Express
     */
    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Middleware de log
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Configura as rotas da API
     */
    setupRoutes() {
        // Rota de status
        this.app.get('/status', (req, res) => {
            res.json({
                status: 'online',
                whatsapp_connected: this.isConnected,
                bot_active: stateManager.isBotActive(),
                uptime: process.uptime(),
                stats: stateManager.getStats(),
                cache_stats: cacheSystem.getStats()
            });
        });

        // Rota para controlar bot
        this.app.post('/bot/toggle', (req, res) => {
            const { active } = req.body;
            
            if (active === true) {
                stateManager.enableBot();
                res.json({ message: 'Bot ativado', active: true });
            } else if (active === false) {
                const minutes = req.body.minutes || 60;
                stateManager.disableBot(minutes);
                res.json({ message: `Bot desativado por ${minutes} minutos`, active: false });
            } else {
                res.status(400).json({ error: 'Parâmetro "active" deve ser true ou false' });
            }
        });

        // Rota para obter sessões ativas
        this.app.get('/sessions', (req, res) => {
            const sessions = stateManager.getActiveSessions();
            res.json({
                total: Object.keys(sessions).length,
                sessions: sessions
            });
        });

        // Rota para limpar cache
        this.app.post('/cache/clear', (req, res) => {
            cacheSystem.clear();
            res.json({ message: 'Cache limpo com sucesso' });
        });

        // Rota para backup do estado
        this.app.post('/backup', (req, res) => {
            const backupPath = stateManager.createBackup();
            if (backupPath) {
                res.json({ message: 'Backup criado', path: backupPath });
            } else {
                res.status(500).json({ error: 'Erro ao criar backup' });
            }
        });

        // Rota para enviar mensagem manual
        this.app.post('/send', async (req, res) => {
            try {
                const { to, message, type = 'text' } = req.body;
                
                if (!to || !message) {
                    return res.status(400).json({ error: 'Parâmetros "to" e "message" são obrigatórios' });
                }

                if (!this.isConnected) {
                    return res.status(503).json({ error: 'WhatsApp não conectado' });
                }

                let success = false;
                switch (type) {
                    case 'text':
                        success = await whatsappService.sendText(to, message);
                        break;
                    case 'menu':
                        success = await whatsappService.sendListMessage(to, message);
                        break;
                    default:
                        return res.status(400).json({ error: 'Tipo de mensagem inválido' });
                }

                if (success) {
                    res.json({ message: 'Mensagem enviada com sucesso' });
                } else {
                    res.status(500).json({ error: 'Erro ao enviar mensagem' });
                }
            } catch (error) {
                console.error('Erro na rota /send:', error);
                res.status(500).json({ error: 'Erro interno do servidor' });
            }
        });

        // Rota para resetar sessão de usuário
        this.app.delete('/sessions/:phone', (req, res) => {
            const { phone } = req.params;
            stateManager.removeUserSession(phone);
            res.json({ message: `Sessão do usuário ${phone} removida` });
        });

        // Rota para obter informações de usuário
        this.app.get('/users/:phone', (req, res) => {
            const { phone } = req.params;
            const session = stateManager.getUserSession(phone);
            res.json(session);
        });

        // Rota de health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: require('../package.json').version
            });
        });

        // Rota para servir QR Codes
        this.app.get('/qrcode/:filename', (req, res) => {
            try {
                const path = require('path');
                const fs = require('fs');
                
                const filename = req.params.filename;
                const filepath = path.join(__dirname, '..', 'qrcodes', filename);
                
                if (fs.existsSync(filepath)) {
                    res.sendFile(filepath);
                } else {
                    res.status(404).json({ error: 'QR Code não encontrado' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Erro ao buscar QR Code' });
            }
        });

        // Rota para listar QR Codes
        this.app.get('/qrcodes', (req, res) => {
            try {
                const path = require('path');
                const fs = require('fs');
                
                const qrDir = path.join(__dirname, '..', 'qrcodes');
                
                if (!fs.existsSync(qrDir)) {
                    return res.json({ qrcodes: [] });
                }
                
                const files = fs.readdirSync(qrDir)
                    .filter(file => file.endsWith('.png'))
                    .map(file => ({
                        filename: file,
                        url: `/qrcode/${file}`,
                        created: fs.statSync(path.join(qrDir, file)).birthtime
                    }))
                    .sort((a, b) => b.created - a.created);
                
                res.json({ qrcodes: files });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao listar QR Codes' });
            }
        });

        // Rota para forçar reconexão do WhatsApp
        this.app.post('/whatsapp/reconnect', async (req, res) => {
            try {
                console.log('🔄 Tentativa de reconexão do WhatsApp solicitada via API...');
                
                // Fecha conexão atual se existir
                if (this.client) {
                    try {
                        await this.client.close();
                        console.log('🔌 Conexão anterior fechada');
                    } catch (error) {
                        console.error('Erro ao fechar conexão anterior:', error);
                    }
                }
                
                // Reseta o status
                this.isConnected = false;
                this.client = null;
                
                // Inicia nova conexão
                setTimeout(async () => {
                    try {
                        await this.startWhatsApp();
                        console.log('✅ Reconexão iniciada com sucesso');
                    } catch (error) {
                        console.error('❌ Erro na reconexão:', error);
                    }
                }, 2000);
                
                res.json({ 
                    message: 'Processo de reconexão iniciado',
                    status: 'reconnecting'
                });
                
            } catch (error) {
                console.error('Erro na rota de reconexão:', error);
                res.status(500).json({ error: 'Erro ao tentar reconectar' });
            }
        });

        // Rota para verificar status da sessão
        this.app.get('/whatsapp/session', (req, res) => {
            try {
                const sessionName = process.env.SESSION_NAME || 'djs-bot';
                const hasSession = sessionManager.hasSession(sessionName);
                const sessionInfo = sessionManager.getSessionInfo(sessionName);
                
                res.json({
                    session_name: sessionName,
                    has_existing_session: hasSession,
                    is_connected: this.isConnected,
                    client_exists: !!this.client,
                    session_info: sessionInfo
                });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao verificar sessão' });
            }
        });

        // Rota para gerenciar sessões
        this.app.get('/whatsapp/sessions', (req, res) => {
            try {
                const sessions = sessionManager.listSessions();
                res.json({ sessions });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao listar sessões' });
            }
        });

        // Rota para limpar sessão atual
        this.app.delete('/whatsapp/session', async (req, res) => {
            try {
                const sessionName = process.env.SESSION_NAME || 'djs-bot';
                
                // Fecha conexão atual se existir
                if (this.client) {
                    try {
                        await this.client.close();
                        console.log('🔌 Conexão WhatsApp fechada');
                    } catch (error) {
                        console.error('Erro ao fechar conexão:', error);
                    }
                }
                
                // Reset status
                this.isConnected = false;
                this.client = null;
                
                // Remove sessão
                const success = sessionManager.clearSession(sessionName);
                
                if (success) {
                    res.json({ 
                        message: `Sessão ${sessionName} removida com sucesso`,
                        session_cleared: true 
                    });
                } else {
                    res.status(404).json({ error: 'Sessão não encontrada' });
                }
                
            } catch (error) {
                console.error('Erro ao limpar sessão:', error);
                res.status(500).json({ error: 'Erro ao limpar sessão' });
            }
        });

        // Rota para backup da sessão
        this.app.post('/whatsapp/session/backup', (req, res) => {
            try {
                const sessionName = process.env.SESSION_NAME || 'djs-bot';
                const backupPath = sessionManager.backupSession(sessionName);
                
                if (backupPath) {
                    res.json({ 
                        message: 'Backup criado com sucesso',
                        backup_path: backupPath 
                    });
                } else {
                    res.status(404).json({ error: 'Sessão não encontrada para backup' });
                }
                
            } catch (error) {
                res.status(500).json({ error: 'Erro ao criar backup' });
            }
        });

        // Rotas para Google Sheets
        this.app.get('/sheets/status', (req, res) => {
            try {
                const googleSheetsService = require('./services/googleSheetsService');
                res.json({
                    configured: googleSheetsService.isReady(),
                    spreadsheet_id: process.env.GOOGLE_SHEETS_ID || null
                });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao verificar status do Google Sheets' });
            }
        });

        this.app.get('/sheets/stats', async (req, res) => {
            try {
                const googleSheetsService = require('./services/googleSheetsService');
                
                if (!googleSheetsService.isReady()) {
                    return res.status(503).json({ error: 'Google Sheets não configurado' });
                }
                
                const stats = await googleSheetsService.obterEstatisticas();
                res.json(stats);
                
            } catch (error) {
                res.status(500).json({ error: 'Erro ao obter estatísticas' });
            }
        });

        this.app.post('/sheets/test', async (req, res) => {
            try {
                const googleSheetsService = require('./services/googleSheetsService');
                
                if (!googleSheetsService.isReady()) {
                    return res.status(503).json({ error: 'Google Sheets não configurado' });
                }
                
                const testData = {
                    nome: 'Teste Bot',
                    email: 'teste@example.com',
                    telefone: '11999999999',
                    cpf: '12345678901',
                    tipoSeguro: 'Teste',
                    veiculo: 'Teste Veículo',
                    cep: '01000-000',
                    observacoes: 'Teste de integração',
                    whatsapp: '5511999999999'
                };
                
                const success = await googleSheetsService.salvarCotacao(testData);
                
                if (success) {
                    res.json({ message: 'Dados de teste salvos com sucesso' });
                } else {
                    res.status(500).json({ error: 'Erro ao salvar dados de teste' });
                }
                
            } catch (error) {
                res.status(500).json({ error: 'Erro ao testar Google Sheets' });
            }
        });

        // Rotas para CSV (leads)
        this.app.get('/csv/leads', (req, res) => {
            try {
                const csvService = require('./services/csvService');
                const leads = csvService.lerLeads();
                res.json({ 
                    leads,
                    total: leads.length,
                    arquivo: csvService.getCaminhoArquivo()
                });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao ler leads do CSV' });
            }
        });

        this.app.get('/csv/stats', (req, res) => {
            try {
                const csvService = require('./services/csvService');
                const stats = csvService.obterEstatisticas();
                const integridade = csvService.verificarIntegridade();
                
                res.json({
                    estatisticas: stats,
                    integridade: integridade,
                    arquivo: csvService.getCaminhoArquivo()
                });
            } catch (error) {
                res.status(500).json({ error: 'Erro ao obter estatísticas do CSV' });
            }
        });

        this.app.post('/csv/backup', (req, res) => {
            try {
                const csvService = require('./services/csvService');
                const backupPath = csvService.criarBackup();
                
                if (backupPath) {
                    res.json({ 
                        message: 'Backup do CSV criado com sucesso',
                        backup_path: backupPath 
                    });
                } else {
                    res.status(404).json({ error: 'Arquivo CSV não encontrado para backup' });
                }
                
            } catch (error) {
                res.status(500).json({ error: 'Erro ao criar backup do CSV' });
            }
        });

        this.app.get('/csv/download', (req, res) => {
            try {
                const csvService = require('./services/csvService');
                const caminhoArquivo = csvService.getCaminhoArquivo();
                
                if (require('fs').existsSync(caminhoArquivo)) {
                    res.download(caminhoArquivo, 'leads.csv', (err) => {
                        if (err) {
                            console.error('Erro no download:', err);
                            res.status(500).json({ error: 'Erro ao fazer download do arquivo' });
                        }
                    });
                } else {
                    res.status(404).json({ error: 'Arquivo CSV não encontrado' });
                }
                
            } catch (error) {
                res.status(500).json({ error: 'Erro ao preparar download' });
            }
        });

        // Rota 404
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Rota não encontrada' });
        });

        // Middleware de tratamento de erros
        this.app.use((error, req, res, next) => {
            console.error('Erro no servidor:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        });
    }

    /**
     * Inicia o cliente WhatsApp
     */
    async startWhatsApp() {
        try {
            console.log('🚀 Iniciando cliente WhatsApp...');

            // Verifica se existe sessão salva
            const hasSession = this.hasExistingSession();
            if (hasSession) {
                console.log('🔄 Tentando reconectar com sessão existente...');
            }

            const client = await wppconnect.create({
                session: process.env.SESSION_NAME || 'djs-bot',
                catchQR: (base64Qr, asciiQR, attempt) => {
                    console.log('📱 QR Code gerado! Escaneie com o WhatsApp:');
                    console.log(asciiQR);
                    
                    // Salva QR Code como PNG
                    this.saveQRCodeAsImage(base64Qr, attempt);
                },
                statusFind: (statusSession, session) => {
                    console.log(`📊 Status da sessão ${session}: ${statusSession}`);
                    
                    // Mapeia diferentes status para conexão
                    switch (statusSession) {
                        case 'authenticated':
                        case 'isLogged':
                        case 'qrReadSuccess':
                        case 'chatsAvailable':
                            console.log('✅ Sessão autenticada! Conectando automaticamente...');
                            this.isConnected = true;
                            break;
                        case 'inChat':
                        case 'browserClose':
                        case 'serverClose':
                        case 'noLogged':
                            console.log('⚠️ Sessão não autenticada. QR Code necessário.');
                            this.isConnected = false;
                            break;
                        case 'autocloseCalled':
                        case 'desconnectedMobile':
                            console.log('🔴 Sessão desconectada.');
                            this.isConnected = false;
                            break;
                        default:
                            console.log(`🟡 Status da sessão: ${statusSession}`);
                            break;
                    }
                },
                headless: process.env.HEADLESS !== 'false',
                disableWelcome: process.env.DISABLE_WELCOME === 'true',
                updatesLog: false,
                autoClose: 0,
                createPathFileToken: true,
                waitForLogin: true,
                deviceName: 'DJS Bot',
                poweredBy: 'DJS Corretora',
                browserWS: '',
                browserArgs: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ],
                puppeteerOptions: {
                    userDataDir: './tokens/' + (process.env.SESSION_NAME || 'djs-bot'),
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox', 
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                },
                logQR: false,
                tokenStore: 'file',
                folderNameToken: './tokens',
                mkdirFolderToken: '',
            });

            this.client = client;
            whatsappService.setClient(client);

            console.log('✅ WhatsApp conectado com sucesso!');

            // Configura eventos
            this.setupWhatsAppEvents(client);

            // Verifica se já está autenticado
            try {
                const isAuthenticated = await client.isAuthenticated();
                if (isAuthenticated) {
                    console.log('🔓 Sessão já autenticada! WhatsApp pronto para uso.');
                    this.isConnected = true;
                } else {
                    console.log('🔒 Aguardando autenticação via QR Code...');
                    this.isConnected = false;
                }
            } catch (error) {
                console.log('⏳ Verificando status de autenticação...');
                this.isConnected = false;
            }

            return client;
        } catch (error) {
            console.error('❌ Erro ao conectar WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Configura eventos do WhatsApp
     * @param {Object} client - Cliente WhatsApp
     */
    setupWhatsAppEvents(client) {
        // Evento de mensagem recebida
        client.onMessage(async (message) => {
            try {
                // Ignora mensagens de grupos por enquanto
                if (message.isGroupMsg) {
                    return;
                }

                // Ignora mensagens próprias
                if (message.fromMe) {
                    return;
                }

                // Ignora mensagens de status
                if (message.from === 'status@broadcast') {
                    return;
                }

                // Processa a mensagem através do fluxo principal
                await mainFlow.processMessage(message);

            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
            }
        });

        // Evento de mudança de estado - Mais detalhado
        client.onStateChange((state) => {
            console.log(`📱 Estado do WhatsApp alterado: ${state}`);
            
            switch (state) {
                case 'CONNECTED':
                case 'AUTHENTICATED':
                case 'LOGGED':
                    this.isConnected = true;
                    console.log('🟢 WhatsApp conectado e pronto para receber mensagens!');
                    break;
                    
                case 'DISCONNECTED':
                case 'UNPAIRED':
                case 'UNPAIRED_IDLE':
                    this.isConnected = false;
                    console.log('🔴 WhatsApp desconectado');
                    
                    // Tenta reconectar após desconexão (mas não imediatamente)
                    setTimeout(() => {
                        if (!this.isConnected) {
                            console.log('🔄 Tentando reconectar automaticamente...');
                            this.attemptReconnect();
                        }
                    }, 10000); // Aguarda 10 segundos antes de tentar reconectar
                    break;
                    
                case 'PAIRING':
                case 'SCAN_QR_CODE':
                    console.log('🟡 Aguardando escaneamento do QR Code...');
                    this.isConnected = false;
                    break;
                    
                case 'OPENING':
                case 'INITIALIZING':
                    console.log('🟡 Inicializando WhatsApp...');
                    break;
                    
                default:
                    console.log(`🟡 Status intermediário: ${state}`);
                    break;
            }
        });

        // Evento quando cliente está pronto
        if (client.onReady) {
            client.onReady(() => {
                console.log('🎉 Cliente WhatsApp pronto e autenticado!');
                this.isConnected = true;
            });
        }

        // Evento de chamadas recebidas
        if (client.onIncomingCall) {
            client.onIncomingCall(async (call) => {
                console.log('📞 Chamada recebida:', call);
                // Rejeita chamadas automaticamente
                try {
                    await client.rejectCall(call.id);
                    console.log('📞 Chamada rejeitada automaticamente');
                } catch (error) {
                    console.error('Erro ao rejeitar chamada:', error);
                }
            });
        }

        // Eventos adicionais para melhor debugging
        if (client.onLoadingScreen) {
            client.onLoadingScreen((percent, message) => {
                console.log(`⏳ Carregando: ${percent}% - ${message}`);
            });
        }

        if (client.onAck) {
            client.onAck((ackData) => {
                // Log apenas para mensagens importantes (evita spam)
                if (ackData.ack === 1) {
                    console.log(`✅ Mensagem entregue: ${ackData.id}`);
                }
            });
        }
    }

    /**
     * Tenta reconectar automaticamente
     */
    async attemptReconnect() {
        try {
            console.log('🔄 Iniciando tentativa de reconexão automática...');
            
            // Verifica se ainda tem sessão válida
            if (!this.hasExistingSession()) {
                console.log('❌ Sessão não encontrada. Reconexão automática cancelada.');
                return;
            }
            
            // Fecha conexão atual se existir
            if (this.client) {
                try {
                    await this.client.close();
                } catch (error) {
                    console.log('⚠️ Erro ao fechar conexão anterior:', error.message);
                }
            }
            
            // Aguarda um pouco antes de tentar reconectar
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Inicia nova conexão
            await this.startWhatsApp();
            
        } catch (error) {
            console.error('❌ Erro na tentativa de reconexão automática:', error);
            
            // Programa nova tentativa em 30 segundos
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log('🔄 Reagendando nova tentativa de reconexão...');
                    this.attemptReconnect();
                }
            }, 30000);
        }
    }

    /**
     * Inicia o servidor
     */
    async startServer() {
        const port = process.env.PORT || 3000;
        
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`🌐 Servidor rodando na porta ${port}`);
                    console.log(`📊 Status: http://localhost:${port}/status`);
                    resolve(this.server);
                }
            });
        });
    }

    /**
     * Configura graceful shutdown
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 Recebido sinal ${signal}. Encerrando aplicação...`);

            try {
                // Para o servidor HTTP
                if (this.server) {
                    await new Promise((resolve) => {
                        this.server.close(resolve);
                    });
                    console.log('✅ Servidor HTTP encerrado');
                }

                // Fecha conexão WhatsApp
                if (this.client) {
                    await this.client.close();
                    console.log('✅ WhatsApp desconectado');
                }

                // Destroi serviços
                stateManager.destroy();
                cacheSystem.destroy();
                whatsappService.destroy();

                console.log('✅ Aplicação encerrada com sucesso');
                process.exit(0);
            } catch (error) {
                console.error('❌ Erro durante encerramento:', error);
                process.exit(1);
            }
        };

        // Eventos de encerramento
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

        // Tratamento de erros não capturados
        process.on('uncaughtException', (error) => {
            console.error('❌ Erro não capturado:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Promise rejeitada não tratada:', reason);
            gracefulShutdown('unhandledRejection');
        });
    }

    /**
     * Salva QR Code como imagem JPG
     * @param {string} base64Qr - QR Code em base64
     * @param {number} attempt - Número da tentativa
     */
    saveQRCodeAsImage(base64Qr, attempt = 1) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Remove o prefixo data:image/png;base64, se existir
            const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
            
            // Cria diretório para QR codes se não existir
            const qrDir = path.join(__dirname, '..', 'qrcodes');
            if (!fs.existsSync(qrDir)) {
                fs.mkdirSync(qrDir, { recursive: true });
            }
            
            // Nome do arquivo com timestamp e tentativa
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `qrcode_${timestamp}_attempt_${attempt}.png`;
            const filepath = path.join(qrDir, filename);
            
            // Salva o arquivo
            fs.writeFileSync(filepath, base64Data, 'base64');
            
            console.log(`💾 QR Code salvo: ${filepath}`);
            console.log(`🌐 Acesse: http://localhost:${process.env.PORT || 3001}/qrcode/${filename}`);
            
        } catch (error) {
            console.error('❌ Erro ao salvar QR Code:', error);
        }
    }

    /**
     * Verifica se existe uma sessão salva
     * @returns {boolean} True se existe sessão
     */
    hasExistingSession() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const sessionName = process.env.SESSION_NAME || 'djs-bot';
            const sessionPath = path.join(__dirname, '..', 'tokens', sessionName);
            
            console.log(`🔍 Verificando sessão em: ${sessionPath}`);
            
            // Verifica se a pasta da sessão existe
            if (!fs.existsSync(sessionPath)) {
                console.log('📂 Pasta da sessão não encontrada.');
                return false;
            }
            
            const files = fs.readdirSync(sessionPath);
            console.log(`📂 Arquivos na sessão: ${files.length} itens`);
            
            // Verifica arquivos específicos da sessão
            const sessionFiles = [
                'Default/Preferences',
                'Default/Local Storage',
                'Default/Session Storage',
                'Default/Local State',
                'Local State'
            ];
            
            const hasRequiredFiles = sessionFiles.some(file => {
                const filePath = path.join(sessionPath, file);
                return fs.existsSync(filePath);
            });
            
            // Verifica também por arquivos de token
            const hasTokenFiles = files.some(file => 
                file.includes('Default') || 
                file.includes('session') ||
                file.includes('.json') ||
                file === 'Local State'
            );
            
            if (hasRequiredFiles || hasTokenFiles) {
                console.log('✅ Sessão válida encontrada! Tentando reconectar automaticamente...');
                console.log('📱 Se a reconexão falhar, um novo QR Code será gerado.');
                return true;
            } else {
                console.log('⚠️ Pasta da sessão existe, mas não contém arquivos válidos.');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Erro ao verificar sessão existente:', error);
            return false;
        }
    }

    /**
     * Inicia a aplicação completa
     */
    async start() {
        try {
            console.log('🏢 Iniciando DJS Chatbot...\n');

            // Limpa sessões inativas
            stateManager.cleanInactiveSessions(24);

            // Inicia servidor HTTP
            await this.startServer();

            // Inicia WhatsApp
            await this.startWhatsApp();

            console.log('\n🎉 DJS Chatbot iniciado com sucesso!');
            console.log('📱 WhatsApp pronto para receber mensagens');
            console.log('💡 Use Ctrl+C para encerrar\n');

        } catch (error) {
            console.error('❌ Erro ao iniciar aplicação:', error);
            process.exit(1);
        }
    }
}

// Inicia a aplicação se executado diretamente
if (require.main === module) {
    const chatbot = new DJSChatbot();
    chatbot.start();
}

module.exports = DJSChatbot;
