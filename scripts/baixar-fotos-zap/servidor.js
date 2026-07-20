#!/usr/bin/env node
"use strict";

/**
 * Servidor local com uma pagina para colar links (ex: uma coluna copiada do
 * Google Sheets) e, com um clique, baixar as fotos dos anuncios ou extrair
 * imobiliaria/link/valor de cada anuncio em JSON.
 *
 * Uso:
 *   npm run server
 *   (depois abra http://localhost:3000 no navegador)
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const express = require("express");
const { processarLista, extrairDadosLista, buscarListagem } = require("./lib/baixador");

const PORTA = Number(process.env.PORTA || 3000);
const OUT_DIR = path.join(__dirname, "output");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let emAndamento = false;
let controleAtual = null;

function normalizarLinks(links) {
  const lista = Array.isArray(links) ? links : String(links || "").split(/\r?\n/);
  return lista
    .map((l) => String(l || "").trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url }));
}

function validarLinks(links, res) {
  if (links.length === 0) {
    res.status(400).json({ erro: "Nenhum link valido foi encontrado." });
    return false;
  }
  if (links.length > 50) {
    res.status(400).json({ erro: "Maximo de 50 links por execucao." });
    return false;
  }
  return true;
}

app.post("/api/baixar", async (req, res) => {
  if (emAndamento) {
    res.status(409).json({ erro: "Ja existe uma operacao em andamento. Aguarde terminar." });
    return;
  }

  const links = normalizarLinks(req.body.links);
  const maxFotos = Number(req.body.maxFotos) || 5;

  if (!validarLinks(links, res)) return;

  emAndamento = true;
  controleAtual = { cancelado: false, browser: null };
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.flushHeaders();

  const log = (msg) => res.write(msg + "\n");

  try {
    log(`Pasta de saida: ${OUT_DIR}`);

    const resultados = await processarLista(links, {
      outDir: OUT_DIR,
      maxFotos,
      delayMs: 3000,
      headless: true,
      log,
      controle: controleAtual,
    });

    log("\nConcluido.");
    log("\n===JSON===");
    log(JSON.stringify(resultados, null, 2));
  } catch (erro) {
    log(`\nFalha geral: ${erro.message}`);
  } finally {
    emAndamento = false;
    controleAtual = null;
    res.end();
  }
});

app.post("/api/extrair-dados", async (req, res) => {
  if (emAndamento) {
    res.status(409).json({ erro: "Ja existe uma operacao em andamento. Aguarde terminar." });
    return;
  }

  const links = normalizarLinks(req.body.links);

  if (!validarLinks(links, res)) return;

  emAndamento = true;
  controleAtual = { cancelado: false, browser: null };
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.flushHeaders();

  const log = (msg) => res.write(msg + "\n");

  try {
    const resultados = await extrairDadosLista(links, {
      delayMs: 3000,
      headless: true,
      log,
      controle: controleAtual,
    });

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const caminhoJson = path.join(OUT_DIR, "dados-anuncios.json");
    fs.writeFileSync(caminhoJson, JSON.stringify(resultados, null, 2));

    log(`\nJSON salvo em: ${caminhoJson}`);
    log("\n===JSON===");
    log(JSON.stringify(resultados, null, 2));
  } catch (erro) {
    log(`\nFalha geral: ${erro.message}`);
  } finally {
    emAndamento = false;
    controleAtual = null;
    res.end();
  }
});

app.post("/api/buscar-listagem", async (req, res) => {
  if (emAndamento) {
    res.status(409).json({ erro: "Ja existe uma operacao em andamento. Aguarde terminar." });
    return;
  }

  const url = String(req.body.url || "").trim();
  const maxPaginas = Math.min(Math.max(Number(req.body.maxPaginas) || 3, 1), 10);

  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ erro: "Informe uma URL valida da pagina de busca/listagem do ZAP." });
    return;
  }

  emAndamento = true;
  controleAtual = { cancelado: false, browser: null };
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.flushHeaders();

  const log = (msg) => res.write(msg + "\n");

  try {
    const imoveis = await buscarListagem(url, {
      maxPaginas,
      headless: true,
      log,
      controle: controleAtual,
    });

    log("\n===JSON===");
    log(JSON.stringify(imoveis, null, 2));
  } catch (erro) {
    log(`\nFalha geral: ${erro.message}`);
  } finally {
    emAndamento = false;
    controleAtual = null;
    res.end();
  }
});

app.post("/api/cancelar", (req, res) => {
  if (!emAndamento || !controleAtual) {
    res.status(400).json({ erro: "Nao ha nenhuma operacao em andamento." });
    return;
  }

  controleAtual.cancelado = true;
  if (controleAtual.browser) {
    // fecha o navegador imediatamente, interrompendo qualquer requisicao em andamento
    controleAtual.browser.close().catch(() => {});
  }

  res.json({ ok: true });
});

app.post("/api/abrir-pasta", (req, res) => {
  const idAnuncio = String(req.body.idAnuncio || "").trim();

  if (!idAnuncio) {
    res.status(400).json({ erro: "idAnuncio nao informado." });
    return;
  }

  const pastaResolvida = path.resolve(OUT_DIR, idAnuncio);
  const outDirResolvido = path.resolve(OUT_DIR);

  // impede sair da pasta output/ (ex: idAnuncio = "..\\..\\Windows")
  if (!pastaResolvida.startsWith(outDirResolvido + path.sep)) {
    res.status(400).json({ erro: "Pasta invalida." });
    return;
  }

  if (!fs.existsSync(pastaResolvida)) {
    res.status(404).json({ erro: "Pasta ainda nao existe." });
    return;
  }

  execFile("explorer.exe", [pastaResolvida], () => {
    // o explorer.exe frequentemente "retorna erro" mesmo quando abre com sucesso;
    // por isso nao tratamos o codigo de saida como falha
  });

  res.json({ ok: true });
});

app.listen(PORTA, "127.0.0.1", () => {
  console.log(`Abra http://localhost:${PORTA} no navegador para usar a interface.`);
  console.log(`As fotos serao salvas em: ${OUT_DIR}`);
});
