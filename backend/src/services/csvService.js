/**
 * Serviço de CSV para salvar dados de leads
 * Responsável por gerenciar o arquivo leads.csv
 */

const fs = require('fs');
const path = require('path');

class CSVService {
    constructor() {
        this.csvFilePath = path.join(__dirname, '..', '..', 'leads.csv');
        this.ensureCSVExists();
    }

    /**
     * Garante que o arquivo CSV existe com cabeçalho
     */
    ensureCSVExists() {
        try {
            if (!fs.existsSync(this.csvFilePath)) {
                const header = 'Data;Nome;Email;Telefone;CPF;Tipo_Seguro;Veiculo;CEP;Observacoes;WhatsApp\n';
                fs.writeFileSync(this.csvFilePath, header, 'utf8');
                console.log('📄 Arquivo leads.csv criado com sucesso');
            }
        } catch (error) {
            console.error('❌ Erro ao criar arquivo leads.csv:', error);
        }
    }

    /**
     * Salva dados do lead no arquivo CSV
     * @param {Object} dadosLead - Dados do lead
     * @returns {boolean} Sucesso da operação
     */
    salvarLead(dadosLead) {
        try {
            // Prepara os dados
            const agora = new Date();
            const dataFormatada = agora.toLocaleDateString('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // Sanitiza os dados para CSV (remove ; e quebras de linha)
            const dadosLimpos = {
                data: dataFormatada,
                nome: this.sanitizeCSVField(dadosLead.nome || ''),
                email: this.sanitizeCSVField(dadosLead.email || ''),
                telefone: this.sanitizeCSVField(dadosLead.telefone || ''),
                cpf: this.sanitizeCSVField(dadosLead.cpf || ''),
                tipoSeguro: this.sanitizeCSVField(dadosLead.tipoSeguro || ''),
                veiculo: this.sanitizeCSVField(dadosLead.veiculo || ''),
                cep: this.sanitizeCSVField(dadosLead.cep || ''),
                observacoes: this.sanitizeCSVField(dadosLead.observacoes || ''),
                whatsapp: this.sanitizeCSVField(dadosLead.whatsapp || '')
            };

            // Cria a linha CSV
            const linhaCsv = `${dadosLimpos.data};${dadosLimpos.nome};${dadosLimpos.email};${dadosLimpos.telefone};${dadosLimpos.cpf};${dadosLimpos.tipoSeguro};${dadosLimpos.veiculo};${dadosLimpos.cep};${dadosLimpos.observacoes};${dadosLimpos.whatsapp}\n`;

            // Adiciona ao arquivo
            fs.appendFileSync(this.csvFilePath, linhaCsv, 'utf8');
            
            console.log(`✅ Lead ${dadosLimpos.nome} salvo em leads.csv`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao salvar lead no CSV:', error);
            return false;
        }
    }

    /**
     * Sanitiza campo para CSV (remove caracteres problemáticos)
     * @param {string} campo - Campo a ser sanitizado
     * @returns {string} Campo sanitizado
     */
    sanitizeCSVField(campo) {
        if (typeof campo !== 'string') {
            campo = String(campo);
        }
        
        // Remove quebras de linha e ponto e vírgula
        return campo
            .replace(/[\r\n]/g, ' ')
            .replace(/;/g, ',')
            .trim();
    }

    /**
     * Lê todos os leads do arquivo CSV
     * @returns {Array} Array com dados dos leads
     */
    lerLeads() {
        try {
            if (!fs.existsSync(this.csvFilePath)) {
                return [];
            }

            const conteudo = fs.readFileSync(this.csvFilePath, 'utf8');
            const linhas = conteudo.split('\n').filter(linha => linha.trim());
            
            // Remove o cabeçalho
            const dadosLinhas = linhas.slice(1);
            
            return dadosLinhas.map(linha => {
                const campos = linha.split(';');
                return {
                    data: campos[0] || '',
                    nome: campos[1] || '',
                    email: campos[2] || '',
                    telefone: campos[3] || '',
                    cpf: campos[4] || '',
                    tipoSeguro: campos[5] || '',
                    veiculo: campos[6] || '',
                    cep: campos[7] || '',
                    observacoes: campos[8] || '',
                    whatsapp: campos[9] || ''
                };
            });

        } catch (error) {
            console.error('❌ Erro ao ler leads do CSV:', error);
            return [];
        }
    }

    /**
     * Obtém estatísticas dos leads
     * @returns {Object} Estatísticas
     */
    obterEstatisticas() {
        try {
            const leads = this.lerLeads();
            const hoje = new Date().toLocaleDateString('pt-BR');
            
            const leadsHoje = leads.filter(lead => {
                const dataLead = lead.data.split(' ')[0]; // Pega apenas a data, sem hora
                return dataLead === hoje;
            });

            const tiposSeguro = {};
            leads.forEach(lead => {
                const tipo = lead.tipoSeguro || 'Não informado';
                tiposSeguro[tipo] = (tiposSeguro[tipo] || 0) + 1;
            });

            return {
                totalLeads: leads.length,
                leadsHoje: leadsHoje.length,
                tiposSeguro: tiposSeguro,
                ultimaAtualizacao: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return {
                totalLeads: 0,
                leadsHoje: 0,
                tiposSeguro: {},
                ultimaAtualizacao: new Date().toISOString()
            };
        }
    }

    /**
     * Cria backup do arquivo CSV
     * @returns {string|null} Caminho do backup ou null se falhar
     */
    criarBackup() {
        try {
            if (!fs.existsSync(this.csvFilePath)) {
                return null;
            }

            const agora = new Date();
            const timestamp = agora.toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(
                path.dirname(this.csvFilePath), 
                `leads_backup_${timestamp}.csv`
            );

            fs.copyFileSync(this.csvFilePath, backupPath);
            console.log(`💾 Backup criado: ${backupPath}`);
            
            return backupPath;

        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            return null;
        }
    }

    /**
     * Verifica integridade do arquivo CSV
     * @returns {Object} Resultado da verificação
     */
    verificarIntegridade() {
        try {
            if (!fs.existsSync(this.csvFilePath)) {
                return {
                    valido: false,
                    erro: 'Arquivo não existe'
                };
            }

            const conteudo = fs.readFileSync(this.csvFilePath, 'utf8');
            const linhas = conteudo.split('\n').filter(linha => linha.trim());
            
            if (linhas.length === 0) {
                return {
                    valido: false,
                    erro: 'Arquivo vazio'
                };
            }

            // Verifica se tem cabeçalho
            const cabecalho = linhas[0];
            const camposEsperados = ['Data', 'Nome', 'Email', 'Telefone', 'CPF', 'Tipo_Seguro', 'Veiculo', 'CEP', 'Observacoes', 'WhatsApp'];
            const camposEncontrados = cabecalho.split(';');

            if (camposEncontrados.length !== camposEsperados.length) {
                return {
                    valido: false,
                    erro: `Número de campos incorreto. Esperado: ${camposEsperados.length}, Encontrado: ${camposEncontrados.length}`
                };
            }

            return {
                valido: true,
                totalLinhas: linhas.length - 1, // Menos o cabeçalho
                tamanhoArquivo: fs.statSync(this.csvFilePath).size
            };

        } catch (error) {
            return {
                valido: false,
                erro: error.message
            };
        }
    }

    /**
     * Obtém o caminho do arquivo CSV
     * @returns {string} Caminho do arquivo
     */
    getCaminhoArquivo() {
        return this.csvFilePath;
    }
}

module.exports = new CSVService();
