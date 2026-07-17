# Baixar fotos de anuncios (ZAP Imoveis)

Script que le uma lista de links de anuncios do ZAP Imoveis (arquivo CSV) e baixa
as primeiras fotos de cada anuncio (em `.webp`), organizadas em uma pasta por anuncio.

Nao usa scraping do carrossel/DOM: as fotos sao lidas diretamente do bloco de dados
estruturados (`application/ld+json`) que a propria pagina do ZAP carrega, o que e mais
rapido e mais estavel do que clicar na galeria.

## Instalacao

```bash
cd scripts/baixar-fotos-zap
npm install
```

## Opcao 1: interface web (colar links e clicar em um botao)

```bash
npm run server
```

Abra `http://localhost:3000` no navegador, cole a coluna de links (por exemplo,
copiada direto do Google Sheets, um link por linha) no campo de texto, ajuste
quantas fotos quer por anuncio (padrao 5) e clique em **Baixar fotos**.

- As fotos sao salvas em `scripts/baixar-fotos-zap/output/<id-do-anuncio>/foto-01.webp`, etc.
- Cada anuncio tem a sua propria subpasta (o nome da pasta e o ID do anuncio,
  tirado do link `.../id-1234567890/`), entao as fotos de anuncios diferentes
  nunca se misturam.
- O progresso aparece na tela em tempo real. Limite de 50 links por execucao.
- O servidor so aceita conexoes da propria maquina (`localhost`), nao fica
  exposto na rede.

## Opcao 2: linha de comando com CSV

1. Crie um arquivo CSV com os links (veja `entrada-exemplo.csv`):

```csv
url,nome
https://www.zapimoveis.com.br/imovel/.../id-2885702373/,AP0655_MERI
https://www.zapimoveis.com.br/imovel/.../id-1234567890/,
```

   - Coluna `url` (obrigatoria): o link do anuncio.
   - Coluna `nome` (opcional): nome da pasta onde as fotos vao ser salvas. Se
     ficar em branco, o script usa o ID do anuncio (o numero depois de `id-` no link).

2. Rode o script:

```bash
node baixar-fotos.js entrada.csv
```

Isso cria a pasta `output/<nome-ou-id>/foto-01.webp`, `foto-02.webp`, etc. para cada
anuncio da lista (5 fotos por padrao).

### Opcoes

Argumentos posicionais:

```bash
node baixar-fotos.js <caminho-do-csv> <pasta-de-saida>
```

Variaveis de ambiente:

| Variavel   | Padrao   | Descricao                                                              |
|------------|----------|-------------------------------------------------------------------------|
| `MAX_FOTOS`| `5`      | Quantidade de fotos a baixar por anuncio                                |
| `DELAY_MS` | `3000`   | Pausa (ms) entre um anuncio e o proximo, para nao sobrecarregar o site  |
| `HEADLESS` | `true`   | Use `HEADLESS=false` para abrir o Chrome visivel (ajuda a driblar bloqueios) |

Exemplo baixando 10 fotos por anuncio, com o navegador visivel:

```bash
MAX_FOTOS=10 HEADLESS=false node baixar-fotos.js entrada.csv
```
(No PowerShell: `$env:MAX_FOTOS=10; $env:HEADLESS="false"; node baixar-fotos.js entrada.csv`)

## Observacoes

- O ZAP Imoveis usa protecao Cloudflare. O script usa `puppeteer-extra` com o
  plugin stealth para reduzir a chance de bloqueio, mas se muitos links falharem
  seguidos, tente aumentar o `DELAY_MS` ou rodar com `HEADLESS=false`.
- As fotos sao baixadas sem os parametros de redimensionamento da URL original,
  para tentar pegar a versao de maior qualidade disponivel.
- Pensado para listas pequenas (ate ~50 links por execucao). Nao foi feito para
  scraping em massa.
- A pasta `output/` e o `entrada.csv` ficam fora do git (veja `.gitignore`) porque
  contem fotos e listas que sao apenas para uso local.
- Use apenas para fins internos/pessoais, respeitando os termos de uso do site.
