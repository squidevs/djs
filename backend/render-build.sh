#!/bin/bash

# Script de build otimizado para Render.com
echo "🚀 Iniciando build para Render..."

# Instalar dependências
echo "📦 Instalando dependências..."
npm ci --only=production

# Instalar Chrome para Puppeteer
echo "🌐 Instalando Chrome para Puppeteer..."
npx puppeteer browsers install chrome

# Verificar se Chrome foi instalado
if [ -d "/opt/render/.cache/puppeteer" ]; then
    echo "✅ Chrome instalado com sucesso em /opt/render/.cache/puppeteer"
    ls -la /opt/render/.cache/puppeteer/
else
    echo "⚠️ Tentando instalar em cache alternativo..."
    PUPPETEER_CACHE_DIR=/tmp/puppeteer npx puppeteer browsers install chrome
fi

echo "🎉 Build concluído!"
