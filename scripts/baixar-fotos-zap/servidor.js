#!/usr/bin/env node
"use strict";

/**
 * Servidor local com uma pagina para colar links (ex: uma coluna copiada do
 * Google Sheets) e baixar as fotos dos anuncios com um clique.
 *
 * Uso:
 *   npm run server
 *   (depois abra http://localhost:3000 no navegador)
 */

const path = require("path");
const express = require("express");
const { processarLista, extrairIdAnuncio } = require("./lib/baixador");

const PORTA = Number(process.env.PORTA || 3000);
const OUT_DIR = path.join(__dirname, "output");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let emAndamento = false;

function separarLinks(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    // aceita linha colada como "url" ou "url,nome" (caso venha de uma planilha com 2 colunas)
    .map((l) => l.split(",").map((p) => p.trim()))
    .filter(([url]) => /^https?:\/\//i.test(url))
    .map(([url, nome]) => ({ url, nome }));
}

app.post("/api/baixar", async (req, res) => {
  if (emAndamento) {
    res.status(409).json({ erro: "Ja existe um download em andamento. Aguarde terminar." });
    return;
  }

  const links = separarLinks(req.body.links);
  const maxFotos = Number(req.body.maxFotos) || 5;

  if (links.length === 0) {
    res.status(400).json({ erro: "Nenhum link valido foi encontrado no texto colado." });
    return;
  }

  if (links.length > 50) {
    res.status(400).json({ erro: "Maximo de 50 links por execucao." });
    return;
  }

  emAndamento = true;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.flushHeaders();

  const log = (msg) => res.write(msg + "\n");

  try {
    log(`Pasta de saida: ${OUT_DIR}`);
    log(`Cada anuncio sera salvo em uma subpasta separada (ex: output/${extrairIdAnuncio(links[0].url)}/).`);

    await processarLista(links, {
      outDir: OUT_DIR,
      maxFotos,
      delayMs: 3000,
      headless: true,
      log,
    });

    log("\nConcluido.");
  } catch (erro) {
    log(`\nFalha geral: ${erro.message}`);
  } finally {
    emAndamento = false;
    res.end();
  }
});

app.listen(PORTA, "127.0.0.1", () => {
  console.log(`Abra http://localhost:${PORTA} no navegador para usar a interface.`);
  console.log(`As fotos serao salvas em: ${OUT_DIR}`);
});
