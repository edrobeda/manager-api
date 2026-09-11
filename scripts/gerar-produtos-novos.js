// Lê as pastas das duas séries novas de TOTEMS_IMAGENS_e_VIDEOS, extrai o texto dos .docx
// e gera um JSON revisável com os campos de produtos_totem (sem tocar no banco).
// Uso: node scripts/gerar-produtos-novos.js > /tmp/produtos-novos.json
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ASSETS_DIR = '/root/projetos/personal/eventify/TOTEMS_IMAGENS_e_VIDEOS';

const SERIES = {
    '_ULTIMOS LANCAMENTOS': 'Últimos Lançamentos',
    '_OUTRAS SOLUCOES': 'Outras Soluções',
};

// Ficha no site da Vetnil e linha (categoria) — conferidas uma a uma; o slug do site
// não é derivável do nome (tem sufixos -r, -2 e variações), por isso vem mapeado à mão.
const CATALOGO = {
    'Condroton® Plus': { ficha: 'condroton-r-plus', linha: 'Equinos - Medicamentos' },
    'Doraequi Plus®': { ficha: 'doraequi-plus-r', linha: 'Equinos - Medicamentos' },
    'EquiUp MO': { ficha: 'equi-up-m-o-r', linha: 'Equinos - Suplementos' },
    'Firocoxib Vetnil® Gel': { ficha: 'firocoxib-vetnil-r-gel-2', linha: 'Equinos - Medicamentos' },
    'Firocoxib Vetnil® Injetável': { ficha: 'firocoxib-vetnil-r-injetavel-2', linha: 'Equinos - Medicamentos' },
    'Mioguard® JCR': { ficha: 'mioguard-r-jcr-2', linha: 'Equinos - Suplementos' },
    'Aminomix® Potros JCR': { ficha: 'aminomix-potros-r-jcr-nutrientes-para-o-crescimento', linha: 'Equinos - Suplementos' },
    'Gelo Flex®': { ficha: 'gelo-flex-r', linha: 'Equinos - Uso Tópico' },
    'Glicopan® Energy JCR': { ficha: 'glicopan-energy-jcr', linha: 'Equinos - Suplementos' },
    'Meloxinew® 3% Injetável': { ficha: 'meloxinew-r-3-injetavel', linha: 'Equinos - Medicamentos' },
    'Meloxinew® Gel': { ficha: 'meloxinew-r-gel', linha: 'Equinos - Medicamentos' },
    'Tonnus® Vaq JCR': { ficha: 'tonnus-r-vaq-jcr', linha: 'Equinos - Suplementos' },
    'Vetaglós® Pomada': { ficha: 'vetaglos-pomada-r', linha: 'Equinos - Medicamentos' },
};

// O nome da pasta do Meloxinew 3% vem com o '%' corrompido no filesystem (byte inválido);
// normaliza para casar com o CATALOGO.
function nomePastaLimpo(nome) {
    return nome.replace(/�/g, '%').replace(/Meloxinew® 3.? Injetável/, 'Meloxinew® 3% Injetável');
}

function textoDoDocx(arquivo) {
    const xml = execFileSync('unzip', ['-p', arquivo, 'word/document.xml'], { maxBuffer: 50 * 1024 * 1024 }).toString();
    return xml
        .split('</w:p>')
        .map((p) => p.replace(/<[^>]*>/g, ''))
        .map((p) => p.replace(/ /g, ' ').trim())
        .filter(Boolean);
}

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapar = (t) => t.replace(/[&<>]/g, (c) => ENTIDADES[c]);

// Títulos de seção nos .docx vêm em caixa alta e curtos (INDICAÇÃO, APRESENTAÇÃO, BENEFÍCIOS...)
function ehTitulo(linha) {
    const semPontuacao = linha.replace(/[:\s]+$/, '');
    return semPontuacao.length <= 30 && semPontuacao === semPontuacao.toUpperCase() && /[A-ZÁÂÃÉÊÍÓÔÕÚÇ]/.test(semPontuacao);
}

// Mesmo formato das descrições já gravadas (vindas do site): <p> com span de 18pt e <strong> nos títulos
function montarHtml(paragrafos) {
    return paragrafos.map((linha) => {
        const texto = escapar(linha);
        return ehTitulo(linha)
            ? `<p><strong><span style="font-size: 18pt;">${texto.replace(/[:\s]+$/, '')}</span></strong></p>`
            : `<p><span style="font-size: 18pt;">${texto}</span></p>`;
    }).join('\n');
}

function midias(dirProduto) {
    const arquivos = fs.readdirSync(dirProduto)
        .filter((f) => !f.includes('Zone.Identifier') && f !== 'Thumbs.db');
    return {
        imagem: arquivos.find((f) => /\.(png|jpe?g)$/i.test(f) && !/tabela/i.test(f)) ?? null,
        video: arquivos.find((f) => /\.(mp4|mov)$/i.test(f)) ?? null,
    };
}

const produtos = [];

for (const [pastaSerie, serie] of Object.entries(SERIES)) {
    const dirSerie = path.join(ASSETS_DIR, pastaSerie);
    for (const pasta of fs.readdirSync(dirSerie, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const dirProduto = path.join(dirSerie, pasta.name);
        const docx = fs.readdirSync(dirProduto).find((f) => /\.docx$/i.test(f) && !f.startsWith('~'));
        const linhas = textoDoDocx(path.join(dirProduto, docx));

        const chave = nomePastaLimpo(pasta.name);
        const catalogo = CATALOGO[chave];
        if (!catalogo) throw new Error(`pasta sem entrada no CATALOGO: ${pasta.name}`);

        const [nome, descricaoCurta, ...corpo] = linhas;
        const { imagem, video } = midias(dirProduto);

        produtos.push({
            pasta: path.join(pastaSerie, pasta.name),
            nome: nome.trim(),
            linha: catalogo.linha,
            serie,
            descricao_curta: descricaoCurta.trim(),
            descricao: montarHtml(corpo),
            url_ficha: `https://vetnil.com.br/produto/${catalogo.ficha}/`,
            imagem,
            video,
        });
    }
}

process.stdout.write(JSON.stringify(produtos, null, 2));
