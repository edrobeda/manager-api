// Cria no tenant 45 os produtos das séries novas (Últimos Lançamentos / Outras Soluções):
// sobe imagem e vídeo via /api/totem-uploads e cria o produto via POST /api/produtos-totem.
// Os vídeos usados são os já convertidos para MP4 1080p (VIDEOS_DIR), não os originais em 4K.
//
// Uso: PROD_TOKEN='...' node scripts/importar-produtos-novos.js            (grava em produção)
//      PROD_TOKEN='...' DRY_RUN=1 node scripts/importar-produtos-novos.js  (só mostra o que faria)
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = '/root/projetos/personal/eventify/TOTEMS_IMAGENS_e_VIDEOS';
const API_BASE = 'https://manager.eventifylab.com';
const TENANT_ID = 45;

const PRODUTOS_JSON = process.env.PRODUTOS_JSON;
const VIDEOS_DIR = process.env.VIDEOS_DIR;

const TOKEN = process.env.PROD_TOKEN;
if (!TOKEN) {
    console.error('Defina PROD_TOKEN com um Bearer token válido de produção');
    process.exit(1);
}

const MIME_POR_EXTENSAO = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
};

async function upload(filePath) {
    const mime = MIME_POR_EXTENSAO[path.extname(filePath).toLowerCase()];
    if (!mime) throw new Error(`extensão sem mimetype mapeado: ${filePath}`);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(filePath)], { type: mime }), path.basename(filePath));

    const res = await fetch(`${API_BASE}/api/totem-uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'falha no upload');
    return body.url;
}

async function criarProduto(dados) {
    const res = await fetch(`${API_BASE}/api/produtos-totem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'falha ao criar produto');
    return body.produto;
}

async function main() {
    const produtos = JSON.parse(fs.readFileSync(PRODUTOS_JSON, 'utf8'));

    // Não recriar o que já existe: a API gera slug com sufixo -2 em colisão, o que
    // duplicaria o produto silenciosamente num segundo rodar do script.
    const res = await fetch(`${API_BASE}/api/produtos-totem?lang=pt`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const { produtos: existentes } = await res.json();
    const nomesExistentes = new Set(
        existentes.filter((p) => p.tenant_id === TENANT_ID).map((p) => p.nome.trim().toLowerCase()),
    );

    for (const produto of produtos) {
        if (nomesExistentes.has(produto.nome.trim().toLowerCase())) {
            console.log(`PULA  ${produto.nome} — já existe no tenant ${TENANT_ID}`);
            continue;
        }

        const dirProduto = path.join(ASSETS_DIR, produto.pasta);
        const imagemPath = produto.imagem ? path.join(dirProduto, produto.imagem) : null;
        // vídeo convertido: <VIDEOS_DIR>/<nome da pasta do produto>.mp4
        const videoPath = produto.video ? path.join(VIDEOS_DIR, `${path.basename(produto.pasta)}.mp4`) : null;

        if (videoPath && !fs.existsSync(videoPath)) throw new Error(`vídeo convertido não encontrado: ${videoPath}`);

        if (process.env.DRY_RUN) {
            console.log(`CRIARIA ${produto.nome} | ${produto.linha} | ${produto.serie}`);
            console.log(`        imagem: ${imagemPath ?? '—'}`);
            console.log(`        vídeo:  ${videoPath ?? '—'}`);
            console.log(`        ficha:  ${produto.url_ficha}`);
            continue;
        }

        try {
            const imagem_produto_url = imagemPath ? await upload(imagemPath) : null;
            const video_local_url = videoPath ? await upload(videoPath) : null;

            const criado = await criarProduto({
                tenant_id: TENANT_ID,
                nome: produto.nome,
                linha: produto.linha,
                serie: produto.serie,
                descricao_curta: produto.descricao_curta,
                descricao: produto.descricao,
                url_ficha: produto.url_ficha,
                imagem_produto_url,
                video_local_url,
                ordem: 0,
                destaque: false,
            });

            console.log(`OK    ${produto.nome} -> id=${criado.id} slug=${criado.slug} | imagem=${!!imagem_produto_url} vídeo=${!!video_local_url}`);
        } catch (err) {
            console.log(`ERRO  ${produto.nome}: ${err.message}`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
