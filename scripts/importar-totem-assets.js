// Script único: casa as pastas de TOTEMS_IMAGENS_e_VIDEOS com os produtos do tenant 45,
// sobe a imagem 3D e o vídeo (quando existir) via /api/uploads, e atualiza produtos_totem.
const fs = require('fs');
const path = require('path');

const MANAGER_API_DIR = '/home/edrobeda/projetos/personal/eventify/manager-api';
const ASSETS_DIR = '/home/edrobeda/projetos/personal/eventify/TOTEMS_IMAGENS_e_VIDEOS';
const API_BASE = 'https://manager.eventifylab.com';
const TENANT_ID = 45;

require('dotenv').config({ path: path.join(MANAGER_API_DIR, '.env') });
const db = require(path.join(MANAGER_API_DIR, 'db'));

// Token real, fornecido pelo usuário (login de superadmin em produção) — nunca forjar token de prod
const TOKEN = process.env.PROD_TOKEN;
if (!TOKEN) {
    console.error('Defina PROD_TOKEN com um Bearer token válido de produção');
    process.exit(1);
}

function normalizar(texto) {
    return texto
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
    const buffer = fs.readFileSync(filePath);
    const mime = MIME_POR_EXTENSAO[path.extname(filePath).toLowerCase()];
    if (!mime) throw new Error(`extensão sem mimetype mapeado: ${filePath}`);
    const blob = new Blob([buffer], { type: mime });
    const form = new FormData();
    form.append('file', blob, path.basename(filePath));

    const res = await fetch(`${API_BASE}/api/totem-uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'falha no upload');
    return body.url;
}

async function main() {
    const produtos = await db('produtos_totem').where({ tenant_id: TENANT_ID });
    const slugsPorNomeNormalizado = new Map();
    produtos.forEach((p) => {
        const chave = normalizar(p.nome);
        if (!slugsPorNomeNormalizado.has(chave)) slugsPorNomeNormalizado.set(chave, p.slug);
    });

    const pastas = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory());

    const casados = [];
    const naoCasados = [];

    for (const pasta of pastas) {
        const nomePasta = normalizar(pasta.name);
        let slug = slugsPorNomeNormalizado.get(nomePasta);

        if (!slug) {
            // fallback: substring nos dois sentidos (ex: "Condroton Injetável" -> "Condroton® Injetável Pet")
            for (const [chave, s] of slugsPorNomeNormalizado) {
                if (chave.includes(nomePasta) || nomePasta.includes(chave)) {
                    slug = s;
                    break;
                }
            }
        }

        if (!slug) {
            naoCasados.push(pasta.name);
            continue;
        }

        const arquivos = fs.readdirSync(path.join(ASSETS_DIR, pasta.name))
            .filter((f) => !f.includes('Zone.Identifier') && f !== 'Thumbs.db');

        const imagem = arquivos.find((f) => /\.(png|jpe?g)$/i.test(f) && !/tabela/i.test(f));
        const video = arquivos.find((f) => /\.mp4$/i.test(f));

        casados.push({ pasta: pasta.name, slug, imagem, video });
    }

    console.log(`Pastas casadas: ${casados.length} / ${pastas.length}`);
    console.log('Não casaram:', JSON.stringify(naoCasados, null, 2));
    console.log('---');

    if (process.env.DRY_RUN) {
        console.log('DRY_RUN — nada será enviado. Casamentos encontrados:');
        casados.forEach((c) => console.log(`  ${c.pasta} -> slug=${c.slug} | imagem=${c.imagem ?? '—'} | video=${c.video ?? '—'}`));
        process.exit(0);
    }

    const filtro = process.env.SOMENTE_SLUGS ? process.env.SOMENTE_SLUGS.split(',') : null;
    for (const item of filtro ? casados.filter((c) => filtro.includes(c.slug)) : casados) {
        try {
            const updates = {};
            if (item.imagem) {
                try {
                    updates.imagem_produto_url = await upload(path.join(ASSETS_DIR, item.pasta, item.imagem));
                } catch (err) {
                    console.log(`  aviso: imagem falhou pra ${item.slug}: ${err.message}`);
                }
            }
            if (item.video) {
                try {
                    updates.video_local_url = await upload(path.join(ASSETS_DIR, item.pasta, item.video));
                } catch (err) {
                    console.log(`  aviso: vídeo falhou pra ${item.slug}: ${err.message}`);
                }
            }
            if (Object.keys(updates).length > 0) {
                await db('produtos_totem').where({ tenant_id: TENANT_ID, slug: item.slug }).update(updates);
            }
            console.log(`OK  ${item.pasta} -> slug=${item.slug} | imagem=${!!item.imagem} video=${!!item.video}`);
        } catch (err) {
            console.log(`ERRO ${item.pasta} -> slug=${item.slug}: ${err.message}`);
        }
    }

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
