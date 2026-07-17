#!/usr/bin/env node
"use strict";

/**
 * Baixa as fotos dos anuncios do ZAP Imoveis a partir de uma lista de links em CSV.
 *
 * Uso:
 *   node baixar-fotos.js [caminho-do-csv] [pasta-de-saida]
 *
 * Variaveis de ambiente opcionais:
 *   MAX_FOTOS=5      quantidade de fotos a baixar por anuncio (padrao: 5)
 *   DELAY_MS=3000    pausa entre um anuncio e outro, em ms (padrao: 3000)
 *   HEADLESS=false   abre o Chrome visivel (util se o Cloudflare bloquear em modo headless)
 *
 * Para uma interface web (colar links e clicar em um botao), use `npm run server`.
 */

const fs = require("fs");
const path = require("path");
const { processarLista } = require("./lib/baixador");

const CSV_PATH = process.argv[2] || path.join(__dirname, "entrada.csv");
const OUT_DIR = process.argv[3] || path.join(__dirname, "output");
const MAX_FOTOS = Number(process.env.MAX_FOTOS || 5);
const DELAY_MS = Number(process.env.DELAY_MS || 3000);
const HEADLESS = process.env.HEADLESS !== "false";

function lerCsv(caminho) {
  const texto = fs.readFileSync(caminho, "utf8");
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (linhas.length === 0) return [];

  const primeiraLinha = linhas[0].toLowerCase();
  const temCabecalho = primeiraLinha.startsWith("url");
  const dados = temCabecalho ? linhas.slice(1) : linhas;

  return dados
    .map((linha) => {
      const [url, nome] = linha.split(",").map((s) => (s || "").trim());
      return { url, nome };
    })
    .filter((item) => item.url);
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Arquivo CSV nao encontrado: ${CSV_PATH}`);
    process.exit(1);
  }

  const itens = lerCsv(CSV_PATH);
  if (itens.length === 0) {
    console.error("Nenhum link encontrado no CSV.");
    process.exit(1);
  }

  await processarLista(itens, {
    outDir: OUT_DIR,
    maxFotos: MAX_FOTOS,
    delayMs: DELAY_MS,
    headless: HEADLESS,
    log: console.log,
  });
}

main().catch((erro) => {
  console.error("Falha geral no script:", erro);
  process.exit(1);
});
