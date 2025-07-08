#!/usr/bin/env node

/**
 * Script de linha de comando para gerenciar sessões WhatsApp
 * Uso: node session-cli.js [comando] [argumentos]
 */

require('dotenv').config();
const sessionManager = require('./src/utils/sessionManager');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return colors[color] + text + colors.reset;
}

function showHelp() {
    console.log('\n' + colorize('🤖 DJS WhatsApp Session Manager', 'cyan'));
    console.log(colorize('================================', 'cyan'));
    console.log('\nComandos disponíveis:');
    console.log('  ' + colorize('status', 'green') + '           - Verifica status da sessão atual');
    console.log('  ' + colorize('list', 'green') + '             - Lista todas as sessões');
    console.log('  ' + colorize('info [nome]', 'green') + '      - Mostra informações detalhadas da sessão');
    console.log('  ' + colorize('clear [nome]', 'green') + '     - Remove uma sessão específica');
    console.log('  ' + colorize('backup [nome]', 'green') + '    - Cria backup de uma sessão');
    console.log('  ' + colorize('help', 'green') + '             - Mostra esta ajuda');
    console.log('\nSe [nome] não for especificado, usa: ' + colorize(process.env.SESSION_NAME || 'djs-bot', 'yellow'));
    console.log('');
}

function showStatus() {
    const sessionName = process.env.SESSION_NAME || 'djs-bot';
    console.log('\n' + colorize('📊 Status da Sessão', 'blue'));
    console.log(colorize('==================', 'blue'));
    
    const hasSession = sessionManager.hasSession(sessionName);
    const sessionInfo = sessionManager.getSessionInfo(sessionName);
    
    console.log('Sessão atual: ' + colorize(sessionName, 'yellow'));
    console.log('Status: ' + (hasSession ? colorize('✅ Ativa', 'green') : colorize('❌ Inativa', 'red')));
    
    if (sessionInfo) {
        console.log('Criada em: ' + colorize(sessionInfo.created.toLocaleString(), 'cyan'));
        console.log('Modificada: ' + colorize(sessionInfo.modified.toLocaleString(), 'cyan'));
        console.log('Arquivos: ' + colorize(sessionInfo.files, 'cyan'));
        console.log('Tamanho: ' + colorize(sessionInfo.sizeFormatted, 'cyan'));
    }
    console.log('');
}

function listSessions() {
    console.log('\n' + colorize('📂 Sessões Disponíveis', 'blue'));
    console.log(colorize('====================', 'blue'));
    
    const sessions = sessionManager.listSessions();
    
    if (sessions.length === 0) {
        console.log(colorize('Nenhuma sessão encontrada.', 'yellow'));
        console.log('');
        return;
    }
    
    sessions.forEach(session => {
        const status = session.valid ? colorize('✅', 'green') : colorize('❌', 'red');
        const current = session.name === (process.env.SESSION_NAME || 'djs-bot') ? colorize(' (atual)', 'yellow') : '';
        
        console.log(`${status} ${colorize(session.name, 'cyan')}${current}`);
        console.log(`   Criada: ${session.created.toLocaleString()}`);
        console.log(`   Modificada: ${session.modified.toLocaleString()}`);
        console.log('');
    });
}

function showSessionInfo(sessionName) {
    const name = sessionName || process.env.SESSION_NAME || 'djs-bot';
    
    console.log('\n' + colorize(`📋 Informações da Sessão: ${name}`, 'blue'));
    console.log(colorize('=======================================', 'blue'));
    
    const sessionInfo = sessionManager.getSessionInfo(name);
    
    if (!sessionInfo) {
        console.log(colorize('❌ Sessão não encontrada.', 'red'));
        console.log('');
        return;
    }
    
    console.log('Nome: ' + colorize(sessionInfo.name, 'cyan'));
    console.log('Caminho: ' + colorize(sessionInfo.path, 'cyan'));
    console.log('Status: ' + (sessionInfo.valid ? colorize('✅ Válida', 'green') : colorize('❌ Inválida', 'red')));
    console.log('Criada em: ' + colorize(sessionInfo.created.toLocaleString(), 'cyan'));
    console.log('Modificada: ' + colorize(sessionInfo.modified.toLocaleString(), 'cyan'));
    console.log('Arquivos: ' + colorize(sessionInfo.files, 'cyan'));
    console.log('Tamanho: ' + colorize(sessionInfo.sizeFormatted, 'cyan'));
    console.log('');
}

function clearSession(sessionName) {
    const name = sessionName || process.env.SESSION_NAME || 'djs-bot';
    
    console.log('\n' + colorize(`🗑️  Removendo sessão: ${name}`, 'yellow'));
    console.log(colorize('==============================', 'yellow'));
    
    const success = sessionManager.clearSession(name);
    
    if (success) {
        console.log(colorize('✅ Sessão removida com sucesso!', 'green'));
        console.log(colorize('💡 O próximo início do bot irá gerar um novo QR Code.', 'cyan'));
    } else {
        console.log(colorize('❌ Erro ao remover sessão ou sessão não encontrada.', 'red'));
    }
    console.log('');
}

function backupSession(sessionName) {
    const name = sessionName || process.env.SESSION_NAME || 'djs-bot';
    
    console.log('\n' + colorize(`💾 Criando backup da sessão: ${name}`, 'yellow'));
    console.log(colorize('================================', 'yellow'));
    
    const backupPath = sessionManager.backupSession(name);
    
    if (backupPath) {
        console.log(colorize('✅ Backup criado com sucesso!', 'green'));
        console.log('Localização: ' + colorize(backupPath, 'cyan'));
    } else {
        console.log(colorize('❌ Erro ao criar backup ou sessão não encontrada.', 'red'));
    }
    console.log('');
}

// Processa argumentos da linha de comando
const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

switch (command) {
    case 'status':
        showStatus();
        break;
        
    case 'list':
        listSessions();
        break;
        
    case 'info':
        showSessionInfo(param);
        break;
        
    case 'clear':
        clearSession(param);
        break;
        
    case 'backup':
        backupSession(param);
        break;
        
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
        
    default:
        if (command) {
            console.log(colorize(`❌ Comando desconhecido: ${command}`, 'red'));
        }
        showHelp();
        break;
}
