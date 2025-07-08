/**
 * Configuração do Puppeteer para ambientes de produção
 * Especialmente otimizado para Render.com e outros hosting providers
 */

const path = require('path');
const fs = require('fs');

/**
 * Configurações do Puppeteer para produção
 */
const puppeteerConfig = {
    // Cache personalizado para Render
    cacheDirectory: process.env.PUPPETEER_CACHE_DIR || '/opt/render/.cache/puppeteer',
    
    // Argumentos otimizados para servidores Linux
    launchArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
    ],
    
    // Configurações de rede
    timeout: 30000,
    headless: true,
    
    // Detectar executável do Chrome automaticamente
    executablePath: detectChromeExecutable()
};

/**
 * Detecta o caminho do executável do Chrome no ambiente
 */
function detectChromeExecutable() {
    const possiblePaths = [
        // Paths padrão do Puppeteer no Render
        '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux*/chrome',
        '/tmp/puppeteer/chrome/linux-*/chrome-linux*/chrome',
        
        // Paths padrão do sistema Linux
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        
        // Paths alternativos
        '/snap/bin/chromium',
        '/usr/local/bin/chrome',
        '/usr/local/bin/chromium'
    ];
    
    for (const pathPattern of possiblePaths) {
        if (pathPattern.includes('*')) {
            // Buscar por paths com wildcards
            const baseDir = pathPattern.split('*')[0];
            if (fs.existsSync(baseDir)) {
                const foundPath = findChromeInDirectory(baseDir);
                if (foundPath) {
                    console.log(`🌐 Chrome encontrado: ${foundPath}`);
                    return foundPath;
                }
            }
        } else {
            // Verificar paths diretos
            if (fs.existsSync(pathPattern)) {
                console.log(`🌐 Chrome encontrado: ${pathPattern}`);
                return pathPattern;
            }
        }
    }
    
    console.log('⚠️ Chrome não encontrado automaticamente. Usando padrão do Puppeteer.');
    return undefined; // Deixa o Puppeteer decidir
}

/**
 * Busca recursivamente por executável do Chrome em um diretório
 */
function findChromeInDirectory(baseDir) {
    try {
        const items = fs.readdirSync(baseDir);
        
        for (const item of items) {
            const fullPath = path.join(baseDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Buscar recursivamente
                const found = findChromeInDirectory(fullPath);
                if (found) return found;
            } else if (item === 'chrome' && stat.isFile()) {
                // Verificar se é executável
                try {
                    fs.accessSync(fullPath, fs.constants.X_OK);
                    return fullPath;
                } catch (e) {
                    continue;
                }
            }
        }
    } catch (e) {
        // Ignorar erros de permissão
    }
    
    return null;
}

/**
 * Configuração específica para wppconnect
 */
const wppConnectPuppeteerConfig = {
    headless: true,
    devtools: false,
    useChrome: true,
    debug: false,
    logQR: true,
    browserWS: '',
    browserArgs: puppeteerConfig.launchArgs,
    puppeteerOptions: {
        executablePath: puppeteerConfig.executablePath,
        args: puppeteerConfig.launchArgs,
        timeout: puppeteerConfig.timeout
    }
};

/**
 * Testa se o Puppeteer consegue inicializar
 */
async function testPuppeteerSetup() {
    try {
        console.log('🧪 Testando configuração do Puppeteer...');
        
        const puppeteer = require('puppeteer-extra');
        const browser = await puppeteer.launch({
            executablePath: puppeteerConfig.executablePath,
            args: puppeteerConfig.launchArgs,
            headless: true,
            timeout: 10000
        });
        
        const version = await browser.version();
        console.log(`✅ Puppeteer OK! Versão do Chrome: ${version}`);
        
        await browser.close();
        return true;
        
    } catch (error) {
        console.error('❌ Erro no teste do Puppeteer:', error.message);
        return false;
    }
}

module.exports = {
    puppeteerConfig,
    wppConnectPuppeteerConfig,
    testPuppeteerSetup,
    detectChromeExecutable
};
