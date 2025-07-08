/**
 * Utilitário para gerenciar sessões WhatsApp
 * Permite limpar, backup e restaurar sessões
 */

const fs = require('fs');
const path = require('path');

class SessionManager {
    constructor() {
        this.tokensDir = path.join(__dirname, '..', '..', 'tokens');
        this.backupDir = path.join(__dirname, '..', '..', 'session-backups');
    }

    /**
     * Verifica se existe uma sessão salva
     * @param {string} sessionName Nome da sessão
     * @returns {boolean}
     */
    hasSession(sessionName = 'djs-bot') {
        try {
            const sessionPath = path.join(this.tokensDir, sessionName);
            
            if (!fs.existsSync(sessionPath)) {
                return false;
            }
            
            const files = fs.readdirSync(sessionPath);
            
            // Verifica arquivos essenciais do Chrome/Puppeteer
            const essentialFiles = [
                'Default/Preferences',
                'Default/Local Storage',
                'Local State'
            ];
            
            const hasEssentials = essentialFiles.some(file => {
                const filePath = path.join(sessionPath, file);
                return fs.existsSync(filePath);
            });
            
            return hasEssentials || files.length > 5; // Se tem muitos arquivos, provavelmente é válida
            
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
            return false;
        }
    }

    /**
     * Remove uma sessão específica
     * @param {string} sessionName Nome da sessão
     * @returns {boolean}
     */
    clearSession(sessionName = 'djs-bot') {
        try {
            const sessionPath = path.join(this.tokensDir, sessionName);
            
            if (fs.existsSync(sessionPath)) {
                // Remove recursivamente
                this.removeDirectory(sessionPath);
                console.log(`✅ Sessão ${sessionName} removida com sucesso`);
                return true;
            } else {
                console.log(`⚠️ Sessão ${sessionName} não encontrada`);
                return false;
            }
            
        } catch (error) {
            console.error('Erro ao limpar sessão:', error);
            return false;
        }
    }

    /**
     * Cria backup de uma sessão
     * @param {string} sessionName Nome da sessão
     * @returns {string|null} Caminho do backup criado
     */
    backupSession(sessionName = 'djs-bot') {
        try {
            const sessionPath = path.join(this.tokensDir, sessionName);
            
            if (!fs.existsSync(sessionPath)) {
                console.log(`⚠️ Sessão ${sessionName} não encontrada para backup`);
                return null;
            }
            
            // Cria diretório de backup se não existir
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            
            // Nome do backup com timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${sessionName}_backup_${timestamp}`;
            const backupPath = path.join(this.backupDir, backupName);
            
            // Copia arquivos
            this.copyDirectory(sessionPath, backupPath);
            
            console.log(`✅ Backup da sessão criado: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            console.error('Erro ao criar backup da sessão:', error);
            return null;
        }
    }

    /**
     * Lista todas as sessões disponíveis
     * @returns {Array}
     */
    listSessions() {
        try {
            if (!fs.existsSync(this.tokensDir)) {
                return [];
            }
            
            const sessions = fs.readdirSync(this.tokensDir)
                .filter(item => {
                    const itemPath = path.join(this.tokensDir, item);
                    return fs.statSync(itemPath).isDirectory();
                })
                .map(sessionName => {
                    const sessionPath = path.join(this.tokensDir, sessionName);
                    const stats = fs.statSync(sessionPath);
                    const hasValidSession = this.hasSession(sessionName);
                    
                    return {
                        name: sessionName,
                        path: sessionPath,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        valid: hasValidSession
                    };
                });
            
            return sessions;
            
        } catch (error) {
            console.error('Erro ao listar sessões:', error);
            return [];
        }
    }

    /**
     * Remove diretório recursivamente
     * @param {string} dirPath
     */
    removeDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach((file) => {
                const curPath = path.join(dirPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.removeDirectory(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    /**
     * Copia diretório recursivamente
     * @param {string} src
     * @param {string} dest
     */
    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        fs.readdirSync(src).forEach((file) => {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            
            if (fs.lstatSync(srcPath).isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    /**
     * Obtém informações detalhadas de uma sessão
     * @param {string} sessionName Nome da sessão
     * @returns {Object|null}
     */
    getSessionInfo(sessionName = 'djs-bot') {
        try {
            const sessionPath = path.join(this.tokensDir, sessionName);
            
            if (!fs.existsSync(sessionPath)) {
                return null;
            }
            
            const stats = fs.statSync(sessionPath);
            const files = this.getDirectorySize(sessionPath);
            const hasValidSession = this.hasSession(sessionName);
            
            return {
                name: sessionName,
                path: sessionPath,
                created: stats.birthtime,
                modified: stats.mtime,
                valid: hasValidSession,
                files: files.count,
                size: files.size,
                sizeFormatted: this.formatBytes(files.size)
            };
            
        } catch (error) {
            console.error('Erro ao obter informações da sessão:', error);
            return null;
        }
    }

    /**
     * Calcula tamanho do diretório
     * @param {string} dirPath
     * @returns {Object}
     */
    getDirectorySize(dirPath) {
        let totalSize = 0;
        let totalFiles = 0;
        
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isDirectory()) {
                const subDir = this.getDirectorySize(filePath);
                totalSize += subDir.size;
                totalFiles += subDir.count;
            } else {
                totalSize += stats.size;
                totalFiles += 1;
            }
        });
        
        return { size: totalSize, count: totalFiles };
    }

    /**
     * Formata bytes em formato legível
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new SessionManager();
