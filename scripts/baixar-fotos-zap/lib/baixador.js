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
      return { idAnuncio, url, pasta: pastaAnuncio, baixadas: 0 };
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

    return { idAnuncio, url, pasta: pastaAnuncio, baixadas };
  } catch (erro) {
    log(`  ERRO ao processar anuncio: ${erro.message}`);
    return { idAnuncio, url, pasta: pastaAnuncio, baixadas: 0, erro: erro.message };
  } finally {
    await page.close().catch(() => {});
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
 * @param {{cancelado?: boolean, browser?: object}} [opcoes.controle] - objeto compartilhado
 *   para permitir cancelamento: setar `controle.cancelado = true` interrompe apos o anuncio
 *   atual; chamar `controle.browser.close()` interrompe imediatamente
 */
async function processarLista(itens, opcoes) {
  const {
    outDir,
    maxFotos = 5,
    delayMs = 3000,
    headless = true,
    log = () => {},
    controle = {},
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
  controle.browser = browser;

  const resultados = [];

  try {
    for (let i = 0; i < itens.length; i++) {
      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      const resultado = await processarAnuncio(browser, itens[i], i, itens.length, {
        outDir,
        maxFotos,
        log,
      });
      resultados.push(resultado);

      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      if (i < itens.length - 1) {
        await pausar(delayMs);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log("\n=== Resumo ===");
  for (const r of resultados) {
    const status = r.erro ? `ERRO: ${r.erro}` : `${r.baixadas} foto(s)`;
    log(`${r.idAnuncio}: ${status}`);
  }

  return resultados;
}

function identificarTipoPelaUrl(url) {
  const match = url.match(/\/imovel\/(aluguel|venda)-/i);
  return match ? match[1].toLowerCase() : null;
}

async function extrairAnuncianteEPreco(page) {
  return page.evaluate(() => {
    let nome = null;
    const linkOficial = document.querySelector(
      'a[data-testid="official-store-redirect-link"]'
    );
    if (linkOficial) {
      nome = linkOficial.textContent.trim();
    }

    if (!nome) {
      const header = document.querySelector(
        '[data-testid="advertiser-info-header"]'
      );
      if (header) {
        nome = header.textContent.split(/Creci/i)[0].trim();
      }
    }

    let preco = null;
    let linkCanonico = null;
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    for (const script of scripts) {
      try {
        const dados = JSON.parse(script.textContent);
        if (dados.offers && typeof dados.offers.price === "number") {
          preco = dados.offers.price;
          linkCanonico = dados.offers.url || null;
        }
      } catch (e) {
        // ignora blocos de JSON que nao sao o que procuramos
      }
    }

    let tipoPelaPagina = null;
    const corpo = document.body.innerText;
    if (/\bAluguel\b\s*R\$/.test(corpo)) tipoPelaPagina = "aluguel";
    else if (/\bVenda\b\s*R\$/.test(corpo)) tipoPelaPagina = "venda";

    return { nome, preco, linkCanonico, tipoPelaPagina };
  });
}

function formatarValor(tipo, valor) {
  if (valor == null) return null;
  const valorFormatado = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
  });
  return tipo === "aluguel" ? `R$ ${valorFormatado}/mês` : `R$ ${valorFormatado}`;
}

async function extrairDadosDoAnuncio(browser, item, indice, total, opcoes) {
  const { log } = opcoes;
  const { url } = item;

  log(`\n[${indice + 1}/${total}] ${url}`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});

    const { nome, preco, linkCanonico, tipoPelaPagina } =
      await extrairAnuncianteEPreco(page);

    const tipo = identificarTipoPelaUrl(url) || tipoPelaPagina;

    if (!nome || preco == null) {
      log("  Nao foi possivel encontrar imobiliaria/preco (pagina pode ter mudado ou o acesso foi bloqueado).");
    } else {
      log(`  OK  ${nome} - ${formatarValor(tipo, preco)}`);
    }

    return {
      imobiliaria: nome,
      link: linkCanonico || url.split("?")[0],
      tipo,
      valor: preco,
      valorFormatado: tipo ? formatarValor(tipo, preco) : null,
    };
  } catch (erro) {
    log(`  ERRO ao processar anuncio: ${erro.message}`);
    return {
      imobiliaria: null,
      link: url.split("?")[0],
      tipo: null,
      valor: null,
      valorFormatado: null,
      erro: erro.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Extrai nome da imobiliaria, link e valor (aluguel/venda) de uma lista de anuncios.
 *
 * @param {{url: string}[]} itens
 * @param {object} opcoes
 * @param {number} [opcoes.delayMs] - pausa entre anuncios, em ms (padrao 3000)
 * @param {boolean} [opcoes.headless] - se roda o Chrome sem interface (padrao true)
 * @param {(msg: string) => void} [opcoes.log] - callback para mensagens de progresso
 * @param {{cancelado?: boolean, browser?: object}} [opcoes.controle] - objeto compartilhado
 *   para permitir cancelamento (veja `processarLista`)
 */
async function extrairDadosLista(itens, opcoes) {
  const { delayMs = 3000, headless = true, log = () => {}, controle = {} } = opcoes;

  if (!itens || itens.length === 0) {
    throw new Error("Nenhum link foi informado.");
  }

  log(`Encontrados ${itens.length} link(s). Extraindo imobiliaria, link e valor de cada.`);

  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  controle.browser = browser;

  const resultados = [];

  try {
    for (let i = 0; i < itens.length; i++) {
      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      const resultado = await extrairDadosDoAnuncio(browser, itens[i], i, itens.length, {
        log,
      });
      resultados.push(resultado);

      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      if (i < itens.length - 1) {
        await pausar(delayMs);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  log("\n=== Resumo ===");
  for (const r of resultados) {
    const status = r.erro
      ? `ERRO: ${r.erro}`
      : `${r.imobiliaria || "?"} - ${r.valorFormatado || "?"}`;
    log(`${r.link}: ${status}`);
  }

  return resultados;
}

function identificarTipoDaUrlBusca(url) {
  if (/\/aluguel\//i.test(url)) return "aluguel";
  if (/\/venda\//i.test(url)) return "venda";
  return null;
}

function adicionarParametroPagina(url, pagina) {
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}pagina=${pagina}`;
}

function parseValorTexto(texto) {
  if (!texto) return null;
  const somenteNumeros = texto.replace(/[^\d]/g, "");
  return somenteNumeros ? Number(somenteNumeros) : null;
}

async function extrairCardsDaPagina(page) {
  return page.evaluate(() => {
    function textoLimpo(el) {
      if (!el) return null;
      const clone = el.cloneNode(true);
      clone.querySelectorAll(".sr-only, svg").forEach((n) => n.remove());
      const texto = clone.textContent.replace(/\s+/g, " ").trim();
      return texto || null;
    }

    const cards = Array.from(document.querySelectorAll('a[href*="/imovel/"]'));

    return cards.map((card) => {
      const h2 = card.querySelector('[data-cy="rp-cardProperty-location-txt"]');
      let endereco = null;
      if (h2) {
        const clone = h2.cloneNode(true);
        const spanInterno = clone.querySelector("span");
        if (spanInterno) spanInterno.remove();
        endereco = clone.textContent.replace(/\s+/g, " ").trim() || null;
      }

      const rua = textoLimpo(card.querySelector('[data-cy="rp-cardProperty-street-txt"]'));
      const area = textoLimpo(card.querySelector('[data-cy="rp-cardProperty-propertyArea-txt"]'));
      const quartos = textoLimpo(card.querySelector('[data-cy="rp-cardProperty-bedroomQuantity-txt"]'));
      const banheiros = textoLimpo(card.querySelector('[data-cy="rp-cardProperty-bathroomQuantity-txt"]'));
      const vagas = textoLimpo(card.querySelector('[data-cy="rp-cardProperty-parkingSpacesQuantity-txt"]'));

      const precoEl = card.querySelector('[data-cy="rp-cardProperty-price-txt"] p');
      const valorTexto = precoEl ? precoEl.textContent.replace(/\s+/g, " ").trim() : null;

      const imagens = Array.from(
        card.querySelectorAll('[data-cy="rp-cardProperty-image-img"] img')
      ).map((img) => img.src);

      return {
        link: card.href.split("?")[0],
        endereco,
        rua,
        area,
        quartos,
        banheiros,
        vagas,
        valorTexto,
        imagem: imagens[0] || null,
        imagens: imagens.slice(0, 5),
      };
    });
  });
}

async function haProximaPagina(page) {
  return page.evaluate(() => {
    const a = document.querySelector('.olx-core-pagination a[aria-label="próxima página"]');
    return !!a && a.getAttribute("aria-disabled") !== "true";
  });
}

async function extrairItensDoDrawer(page) {
  return page.evaluate(() => {
    // localiza o painel "Anuncios deste imovel" que abre ao clicar num card agrupado
    const titulo = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,span")).find((el) =>
      /^An[uú]ncios deste im[oó]vel$/i.test(el.textContent.trim())
    );
    if (!titulo) return [];

    let container = titulo;
    let achou = false;
    for (let i = 0; i < 10 && container; i++) {
      // se o candidato engloba a listagem principal da pagina, subimos demais:
      // os links achados seriam os cards normais, nao os anuncios do drawer
      if (container.querySelector(".listings-wrapper, .olx-core-pagination")) break;
      if (container.querySelectorAll('a[href*="/imovel/"]').length > 0) {
        achou = true;
        break;
      }
      container = container.parentElement;
    }
    if (!achou) return [];

    return Array.from(container.querySelectorAll('a[href*="/imovel/"]')).map((item) => {
      const nomeEl = item.querySelector("p");
      const precoEl = item.querySelector('[data-cy="rp-cardProperty-price-txt"] p');
      const img = item.querySelector("img");
      return {
        link: item.href.split("?")[0],
        anunciante: nomeEl ? nomeEl.textContent.replace(/\s+/g, " ").trim() : null,
        valorTexto: precoEl ? precoEl.textContent.replace(/\s+/g, " ").trim() : null,
        imagem: img ? img.src : null,
      };
    });
  });
}

async function expandirCardsAgrupados(page, log) {
  // cards "Ver os X anuncios deste imovel" nao tem href proprio: e preciso
  // clicar em cada um para abrir o painel lateral e capturar os links de dentro
  const qtdBotoes = await page.evaluate(
    () => document.querySelectorAll('[data-cy="listing-card-deduplicated-button"]').length
  );

  if (qtdBotoes === 0) return [];

  log(`  ${qtdBotoes} card(s) agrupado(s) ("Ver os X anuncios deste imovel") - expandindo...`);

  const itens = [];

  for (let i = 0; i < qtdBotoes; i++) {
    // dados do proprio card agrupado (endereco/specs valem para todos os anuncios de dentro)
    const dadosCard = await page.evaluate((indice) => {
      const botao = document.querySelectorAll('[data-cy="listing-card-deduplicated-button"]')[indice];
      if (!botao) return null;
      const card = botao.closest("li") || botao.closest("a");
      if (!card) return {};

      function texto(sel) {
        const el = card.querySelector(sel);
        if (!el) return null;
        const clone = el.cloneNode(true);
        clone.querySelectorAll(".sr-only, svg").forEach((n) => n.remove());
        return clone.textContent.replace(/\s+/g, " ").trim() || null;
      }

      let endereco = null;
      const h2 = card.querySelector('[data-cy="rp-cardProperty-location-txt"]');
      if (h2) {
        const clone = h2.cloneNode(true);
        const spanInterno = clone.querySelector("span");
        if (spanInterno) spanInterno.remove();
        endereco = clone.textContent.replace(/\s+/g, " ").trim() || null;
      }

      return {
        endereco,
        rua: texto('[data-cy="rp-cardProperty-street-txt"]'),
        area: texto('[data-cy="rp-cardProperty-propertyArea-txt"]'),
        quartos: texto('[data-cy="rp-cardProperty-bedroomQuantity-txt"]'),
        banheiros: texto('[data-cy="rp-cardProperty-bathroomQuantity-txt"]'),
        vagas: texto('[data-cy="rp-cardProperty-parkingSpacesQuantity-txt"]'),
      };
    }, i);

    if (dadosCard === null) break;

    try {
      await page.evaluate((indice) => {
        document.querySelectorAll('[data-cy="listing-card-deduplicated-button"]')[indice].click();
      }, i);

      await page
        .waitForFunction(
          () => {
            const titulo = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,span")).find((el) =>
              /^An[uú]ncios deste im[oó]vel$/i.test(el.textContent.trim())
            );
            if (!titulo) return false;
            let container = titulo;
            for (let j = 0; j < 10 && container; j++) {
              if (container.querySelector(".listings-wrapper, .olx-core-pagination")) return false;
              if (container.querySelectorAll('a[href*="/imovel/"]').length > 0) return true;
              container = container.parentElement;
            }
            return false;
          },
          { timeout: 10000 }
        )
        .catch(() => {});

      const doDrawer = await extrairItensDoDrawer(page);
      log(`    card agrupado ${i + 1}: ${doDrawer.length} anuncio(s) encontrado(s) dentro.`);

      for (const item of doDrawer) {
        itens.push({ ...dadosCard, ...item, agrupado: true });
      }
    } catch (erro) {
      log(`    ERRO ao expandir card agrupado ${i + 1}: ${erro.message}`);
    }

    // fecha o painel para poder clicar no proximo card
    await page.evaluate(() => {
      const fechar = Array.from(document.querySelectorAll("button")).find((b) =>
        /fechar modal|fechar|close/i.test(b.getAttribute("aria-label") || "")
      );
      if (fechar) fechar.click();
    });
    await pausar(600);
  }

  return itens;
}

/**
 * Busca imoveis em uma pagina de listagem/busca do ZAP Imoveis (ex: uma busca
 * filtrada por rua/bairro), percorrendo automaticamente as paginas seguintes.
 *
 * @param {string} urlBusca - URL da pagina de resultados (busca filtrada)
 * @param {object} opcoes
 * @param {number} [opcoes.maxPaginas] - quantas paginas percorrer no maximo (padrao 3)
 * @param {boolean} [opcoes.headless] - se roda o Chrome sem interface (padrao true)
 * @param {(msg: string) => void} [opcoes.log] - callback para mensagens de progresso
 * @param {{cancelado?: boolean, browser?: object}} [opcoes.controle] - objeto compartilhado
 *   para permitir cancelamento (veja `processarLista`)
 */
async function buscarListagem(urlBusca, opcoes) {
  const { maxPaginas = 3, headless = true, log = () => {}, controle = {} } = opcoes;

  if (!urlBusca) {
    throw new Error("Nenhuma URL de busca foi informada.");
  }

  const tipo = identificarTipoDaUrlBusca(urlBusca);

  log(`Buscando imoveis em: ${urlBusca}`);
  if (tipo) log(`Tipo detectado: ${tipo}`);

  const browser = await puppeteer.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  controle.browser = browser;

  const imoveis = [];
  const linksVistos = new Set();

  try {
    for (let pagina = 1; pagina <= maxPaginas; pagina++) {
      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      const urlPagina = pagina === 1 ? urlBusca : adicionarParametroPagina(urlBusca, pagina);
      log(`\n[pagina ${pagina}/${maxPaginas}] ${urlPagina}`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 900 });

      let cardsDaPagina = [];
      let temProximaPagina = false;

      try {
        await page.goto(urlPagina, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForSelector('a[href*="/imovel/"]', { timeout: 15000 }).catch(() => {});

        cardsDaPagina = await extrairCardsDaPagina(page);
        temProximaPagina = await haProximaPagina(page);

        // cards "Ver os X anuncios deste imovel" escondem varios anuncios num
        // painel lateral - expandimos cada um para nao perder esses imoveis
        const agrupados = await expandirCardsAgrupados(page, log);
        cardsDaPagina = cardsDaPagina.concat(agrupados);
      } catch (erro) {
        log(`  ERRO ao carregar pagina: ${erro.message}`);
      } finally {
        await page.close().catch(() => {});
      }

      let novos = 0;
      for (const card of cardsDaPagina) {
        if (!card.link || linksVistos.has(card.link)) continue;
        linksVistos.add(card.link);

        // o slug do link pode nao bater com o preco exibido (imovel anunciado
        // para venda E aluguel): o texto do proprio preco e o sinal mais confiavel
        let tipoCard;
        if (card.valorTexto && /\/m[eê]s/i.test(card.valorTexto)) tipoCard = "aluguel";
        else tipoCard = identificarTipoPelaUrl(card.link) || tipo;

        imoveis.push({
          ...card,
          tipo: tipoCard,
          valor: parseValorTexto(card.valorTexto),
          valorFormatado: card.valorTexto || null,
        });
        novos++;
      }

      log(`  ${novos} imovel(is) novo(s) encontrado(s) (total: ${imoveis.length}).`);

      if (controle.cancelado) {
        log("\nCancelado pelo usuario.");
        break;
      }

      if (novos === 0 || !temProximaPagina) break;

      if (pagina < maxPaginas) {
        await pausar(2000);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // ordena do menor para o maior valor (imoveis sem valor vao para o final)
  imoveis.sort((a, b) => {
    if (a.valor == null && b.valor == null) return 0;
    if (a.valor == null) return 1;
    if (b.valor == null) return -1;
    return a.valor - b.valor;
  });

  log("\n=== Resumo ===");
  log(`${imoveis.length} imovel(is) encontrado(s) no total (ordenados do menor para o maior valor).`);

  return imoveis;
}

module.exports = {
  extrairIdAnuncio,
  sanitizarNomePasta,
  processarLista,
  extrairDadosLista,
  buscarListagem,
};
