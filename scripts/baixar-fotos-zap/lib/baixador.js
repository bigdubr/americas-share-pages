"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function extrairIdAnuncio(url) {
  const match = url.match(/id-(\d+)/i);
  if (match) return match[1];

  const partes = url.split("/").filter(Boolean);
  const ultima = partes[partes.length - 1] || "anuncio";
  return ultima.replace(/[^a-z0-9-]/gi, "-").slice(0, 60);
}

function sanitizarNomePasta(nome) {
  return nome.replace(/[\\/:*?"<>|]/g, "-").trim();
}

async function extrairFotosDaPagina(page) {
  return page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );

    for (const script of scripts) {
      try {
        const dados = JSON.parse(script.textContent);
        if (Array.isArray(dados.image) && dados.image.length > 0) {
          return dados.image;
        }
      } catch (e) {
        // ignora blocos de JSON que nao sao o que procuramos
      }
    }

    return [];
  });
}

function urlEmMaxQualidade(url) {
  // remove os parametros de redimensionamento (?action=fit-in&dimension=...)
  // para tentar baixar a imagem no tamanho original
  return url.split("?")[0];
}

async function baixarImagem(url, caminhoDestino) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}`);
  }
  const buffer = Buffer.from(await resposta.arrayBuffer());
  fs.writeFileSync(caminhoDestino, buffer);
}

function pausar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processarAnuncio(browser, item, indice, total, opcoes) {
  const { outDir, maxFotos, log } = opcoes;
  const { url, nome } = item;
  const idAnuncio = nome ? sanitizarNomePasta(nome) : extrairIdAnuncio(url);
  const pastaAnuncio = path.join(outDir, idAnuncio);

  log(`\n[${indice + 1}/${total}] ${idAnuncio}`);
  log(`  URL: ${url}`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});

    const fotos = await extrairFotosDaPagina(page);

    if (fotos.length === 0) {
      log("  Nenhuma foto encontrada (pagina pode ter mudado ou o acesso foi bloqueado).");
      return { idAnuncio, url, baixadas: 0 };
    }

    // cada anuncio tem a sua propria subpasta, entao as fotos nunca se misturam
    fs.mkdirSync(pastaAnuncio, { recursive: true });

    const selecionadas = fotos.slice(0, maxFotos);
    let baixadas = 0;

    for (let i = 0; i < selecionadas.length; i++) {
      const urlFoto = urlEmMaxQualidade(selecionadas[i]);
      const destino = path.join(pastaAnuncio, `foto-${String(i + 1).padStart(2, "0")}.webp`);

      try {
        await baixarImagem(urlFoto, destino);
        baixadas++;
        log(`  OK  foto-${String(i + 1).padStart(2, "0")}.webp`);
      } catch (erro) {
        log(`  ERRO foto-${i + 1}: ${erro.message}`);
      }
    }

    return { idAnuncio, url, baixadas };
  } catch (erro) {
    log(`  ERRO ao processar anuncio: ${erro.message}`);
    return { idAnuncio, url, baixadas: 0, erro: erro.message };
  } finally {
    await page.close();
  }
}

/**
 * Baixa as fotos de uma lista de anuncios.
 *
 * @param {{url: string, nome?: string}[]} itens
 * @param {object} opcoes
 * @param {string} opcoes.outDir - pasta onde as subpastas por anuncio serao criadas
 * @param {number} [opcoes.maxFotos] - quantas fotos baixar por anuncio (padrao 5)
 * @param {number} [opcoes.delayMs] - pausa entre anuncios, em ms (padrao 3000)
 * @param {boolean} [opcoes.headless] - se roda o Chrome sem interface (padrao true)
 * @param {(msg: string) => void} [opcoes.log] - callback para mensagens de progresso
 */
async function processarLista(itens, opcoes) {
  const {
    outDir,
    maxFotos = 5,
    delayMs = 3000,
    headless = true,
    log = () => {},
  } = opcoes;

  if (!itens || itens.length === 0) {
    throw new Error("Nenhum link foi informado.");
  }

  fs.mkdirSync(outDir, { recursive: true });

  log(`Encontrados ${itens.length} link(s). Baixando ate ${maxFotos} foto(s) de cada.`);

  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const resultados = [];

  try {
    for (let i = 0; i < itens.length; i++) {
      const resultado = await processarAnuncio(browser, itens[i], i, itens.length, {
        outDir,
        maxFotos,
        log,
      });
      resultados.push(resultado);

      if (i < itens.length - 1) {
        await pausar(delayMs);
      }
    }
  } finally {
    await browser.close();
  }

  log("\n=== Resumo ===");
  for (const r of resultados) {
    const status = r.erro ? `ERRO: ${r.erro}` : `${r.baixadas} foto(s)`;
    log(`${r.idAnuncio}: ${status}`);
  }

  return resultados;
}

module.exports = {
  extrairIdAnuncio,
  sanitizarNomePasta,
  processarLista,
};
