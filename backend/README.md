# 🏢 DJS Chatbot - Sistema de Atendimento WhatsApp

Chatbot inteligente para a DJS Corretora de Seguros, desenvolvido com Node.js e wppconnect, seguindo as melhores práticas de Clean Code e arquitetura modular.

## 📋 Funcionalidades

### 🤖 Bot Inteligente
- ✅ Atendimento automatizado 24/7
- ✅ Reconhecimento de intenções e sinônimos
- ✅ Menus interativos com listas do WhatsApp
- ✅ Sistema de fallback para texto simples
- ✅ Transferência inteligente para atendimento humano

### 📊 Gestão de Estado
- ✅ Sessões persistentes por usuário
- ✅ Controle global do bot (ativo/inativo)
- ✅ Cache otimizado para evitar duplicações
- ✅ Backup automático de dados

### 🎯 Fluxos de Conversação
- 📝 **Cotações**: Solicitação de cotação de seguros
- 🔄 **Renovações**: Informações sobre renovação de apólices
- 🚨 **Sinistros**: Comunicação e acompanhamento de sinistros
- 📄 **Segunda Via**: Solicitação de documentos
- 💰 **Pagamentos**: Informações sobre formas de pagamento
- 🏢 **Seguradoras**: Contatos das seguradoras parceiras
- 👨‍💼 **Atendimento**: Transferência para corretor humano

### 🛠️ API de Gerenciamento
- 📊 Monitoramento em tempo real
- 🔧 Controle remoto do bot
- 📈 Estatísticas e métricas
- 🗂️ Gestão de sessões ativas

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 16+ 
- NPM ou Yarn
- WhatsApp Business ou pessoal

### 1. Instalação das Dependências
```bash
# Instalar dependências
npm install

# Ou usando yarn
yarn install
```

### 2. Configuração do Ambiente
Copie o arquivo `.env.example` para `.env` e configure:

```env
# Configurações do Servidor
PORT=3000
NODE_ENV=development

# Configurações do WhatsApp
SESSION_NAME=djs-bot           # Nome único da sessão
HEADLESS=true                  # true = sem interface gráfica
DISABLE_WELCOME=false

# Configurações de Reconexão
AUTO_RECONNECT=true            # Reconexão automática
MAX_RECONNECT_ATTEMPTS=5       # Máximo de tentativas
RECONNECT_DELAY=10000         # Delay entre tentativas (ms)

# Configurações do Bot
BOT_NAME=DJS Bot
COMPANY_NAME=DJS Corretora de Seguros
TIMEOUT_MINUTES=60

# Configurações de Sessão Persistente
KEEP_SESSION=true             # Manter sessão entre execuções
AUTO_CLOSE_DISABLED=true      # Nunca fechar automaticamente
```

### 3. Executar a Aplicação
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

### 4. Conectar WhatsApp
1. Execute a aplicação
2. **PRIMEIRA VEZ**: Escaneie o QR Code que aparece no terminal
3. **PRÓXIMAS VEZES**: Conecta automaticamente (sem QR Code!)
4. O bot estará pronto para receber mensagens!

## 🔐 Persistência de Sessão

O sistema mantém sua sessão WhatsApp ativa entre execuções, **evitando escanear QR Code toda vez**.

### ✅ Como funciona

1. **Primeira execução**: QR Code é gerado e salvo em `./qrcodes/`
2. **Execuções seguintes**: Sistema reconecta automaticamente com sessão salva
3. **Reconexão automática**: Se desconectar, tenta reconectar sozinho
4. **Sessão persistente**: Arquivos salvos em `./tokens/[SESSION_NAME]/`

### 🛠️ Gerenciamento de Sessões

#### Via API REST
```bash
# Verificar status da sessão
GET http://localhost:3000/whatsapp/session

# Listar todas as sessões
GET http://localhost:3000/whatsapp/sessions

# Forçar reconexão
POST http://localhost:3000/whatsapp/reconnect

# Limpar sessão atual (força novo QR Code)
DELETE http://localhost:3000/whatsapp/session

# Criar backup da sessão
POST http://localhost:3000/whatsapp/session/backup
```

#### Via linha de comando
```bash
# Verificar status
node session-cli.js status

# Listar sessões
node session-cli.js list

# Informações detalhadas
node session-cli.js info [nome-sessao]

# Limpar sessão (força novo QR Code)
node session-cli.js clear [nome-sessao]

# Backup da sessão
node session-cli.js backup [nome-sessao]

# Ajuda
node session-cli.js help
```

### 🔧 Solução de Problemas de Conexão

Se não conseguir reconectar automaticamente:

1. **Verificar sessão**
   ```bash
   node session-cli.js status
   ```

2. **Limpar sessão corrompida** (gera novo QR Code)
   ```bash
   node session-cli.js clear
   ```

3. **Forçar reconexão via API**
   ```bash
   curl -X POST http://localhost:3000/whatsapp/reconnect
   ```

4. **Verificar logs** para diagnóstico detalhado

**⚠️ Importante**: 
- Nunca remova manualmente os arquivos em `./tokens/` com o bot rodando
- Se precisar de novo QR Code, use `session-cli.js clear`
- Backup da sessão é criado automaticamente em `./session-backups/`

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── core/                    # Núcleo do sistema
│   │   ├── stateManager.js      # Gerenciamento de estado
│   │   ├── cacheSystem.js       # Sistema de cache
│   │   └── utils.js             # Funções utilitárias
│   ├── flows/                   # Fluxos de conversação
│   │   └── mainFlow.js          # Fluxo principal
│   ├── services/                # Serviços
│   │   ├── whatsappService.js   # Serviço WhatsApp
│   │   └── menuService.js       # Geração de menus
│   ├── data/                    # Dados persistentes
│   │   ├── state.json           # Estado do bot
│   │   └── seguradoras.json     # Dados das seguradoras
│   └── app.js                   # Aplicação principal
├── tokens/                      # Tokens de sessão WhatsApp
├── package.json
├── .env
└── README.md
```

## 🎮 Comandos Disponíveis

### Comandos de Usuário
- `menu` - Volta ao menu principal
- `oi`, `olá`, `bom dia` - Inicia conversa
- `atendente`, `corretor` - Solicita atendimento humano
- `tchau`, `obrigado` - Despedida

### Scripts NPM
```bash
npm start          # Inicia em produção
npm run dev        # Inicia em desenvolvimento com nodemon
npm test           # Executa testes
```

## 🌐 API de Gerenciamento

### Endpoints Principais

#### Status do Sistema
```http
GET /status
```
Retorna status geral do sistema, conexão WhatsApp e estatísticas.

#### Controlar Bot
```http
POST /bot/toggle
Content-Type: application/json

{
  "active": true,      // true para ativar, false para desativar
  "minutes": 60        // minutos para desativar (apenas quando active=false)
}
```

#### Sessões Ativas
```http
GET /sessions
```
Lista todas as sessões ativas de usuários.

#### Enviar Mensagem Manual
```http
POST /send
Content-Type: application/json

{
  "to": "5511999999999",
  "message": "Olá! Como posso ajudar?",
  "type": "text"
}
```

#### Limpar Cache
```http
POST /cache/clear
```

#### Criar Backup
```http
POST /backup
```

## 🔧 Configurações Avançadas

### Personalização de Mensagens
Edite os arquivos em `src/services/menuService.js` para personalizar:
- Textos dos menus
- Opções disponíveis
- Fluxos de conversa

### Adicionar Novas Seguradoras
Edite `src/data/seguradoras.json`:
```json
{
  "id": "nova_seguradora",
  "nome": "Nova Seguradora",
  "whatsapp": "(11) 9999-9999",
  "assistencia": "0800 123 4567",
  "sac": "0800 765 4321",
  "site": "https://www.novaseguradora.com.br/",
  "categoria": "seguros_gerais"
}
```

### Configurar Novos Fluxos
1. Crie arquivo em `src/flows/`
2. Registre no `mainFlow.js`
3. Adicione roteamento apropriado

## 📊 Monitoramento e Logs

### Logs do Sistema
```bash
# Visualizar logs em tempo real
tail -f logs/app.log

# Logs do WhatsApp
tail -f logs/whatsapp.log
```

### Métricas Disponíveis
- Total de mensagens processadas
- Usuários únicos atendidos
- Sessões ativas
- Status de conexão WhatsApp
- Uso de memória e cache

## 🛡️ Segurança e Melhores Práticas

### Configurações de Segurança
- ✅ Validação de entrada de dados
- ✅ Rate limiting automático
- ✅ Sanitização de texto
- ✅ Controle de sessões

### Backup e Recuperação
- ✅ Backup automático de estado
- ✅ Recuperação de sessões
- ✅ Logs de auditoria

## 🚨 Solução de Problemas

### Problemas Comuns

#### WhatsApp não conecta
1. Verifique se não há outra instância rodando
2. Delete a pasta `tokens/` e reconecte
3. Verifique firewall e antivírus

#### Bot não responde
1. Verifique se `chatbot_is_on` está `true` em `data/state.json`
2. Reinicie a aplicação
3. Verifique logs de erro

#### Cache com problemas
1. Execute `POST /cache/clear`
2. Reinicie a aplicação
3. Verifique uso de memória

### Comandos de Manutenção
```bash
# Limpar dados de sessão
rm -rf tokens/

# Reset completo
rm -rf tokens/ src/data/state.json

# Verificar processos
ps aux | grep node
```

## 🔄 Atualizações e Versioning

### Atualizar Dependências
```bash
npm update
npm audit fix
```

### Versionamento
Seguimos Semantic Versioning (SemVer):
- `MAJOR.MINOR.PATCH`
- Major: Mudanças incompatíveis
- Minor: Novas funcionalidades compatíveis
- Patch: Correções de bugs

## 📞 Suporte e Contato

Para suporte técnico ou dúvidas:
- 📧 Email: suporte@djscorretora.com.br
- 📱 WhatsApp: (11) 9999-9999
- 🌐 Site: https://www.djscorretora.com.br

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**httos://squidev.com.br** - Desenvolvido com ❤️ para oferecer o melhor atendimento aos nossos clientes.
