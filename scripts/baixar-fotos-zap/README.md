# Ferramentas ZAP Imoveis (fotos e dados de anuncios)

Ferramentas que leem uma lista de links de anuncios do ZAP Imoveis e:

1. **Baixar fotos** — baixa as primeiras fotos de cada anuncio (em `.webp`),
   organizadas em uma pasta por anuncio.
2. **Extrair dados (JSON)** — extrai o nome da imobiliaria/anunciante, o link e
   o valor (aluguel ou venda, dependendo do anuncio) de cada link, gerando um
   JSON pronto para alimentar o projeto de relatorios de imoveis duplicados.
3. **Buscar imoveis (por URL de listagem)** — a partir de uma URL de busca ja
   filtrada no ZAP (ex: por rua ou bairro), percorre as paginas de resultado e
   mostra os imoveis encontrados (foto, endereco, specs, preco) em cards ou em
   lista, para voce selecionar visualmente quais interessam antes de mandar
   para as abas acima.

Nenhuma das tres faz download de fotos so para pre-visualizar: as fotos da
busca sao exibidas com o link direto do CDN do ZAP (`resizedimgs.zapimoveis.com.br`),
que carrega normalmente fora do dominio do ZAP — nao ha bloqueio de referer. O
download de fato so acontece na aba "Baixar fotos", quando voce decide baixar.
As fotos dos anuncios individuais tambem sao lidas do bloco de dados
estruturados (`application/ld+json`) que a propria pagina do ZAP carrega, o que
e mais rapido e mais estavel do que clicar na galeria.

## Instalacao

```bash
cd scripts/baixar-fotos-zap
npm install
```

## Interface web (colar links e clicar em um botao)

```bash
npm run server
```

Abra `http://localhost:3000` no navegador. Ha tres abas; as duas primeiras tem
uma grade de links (estilo planilha) na esquerda e o progresso na direita.

### Grade de links (estilo planilha)

Em vez de um campo de texto solto, os links vao numa grade com uma coluna,
numerada como linhas de planilha. Cole uma coluna inteira copiada do Google
Sheets (Ctrl+C na planilha, Ctrl+V em qualquer celula da grade) que ela se
espalha automaticamente pelas linhas seguintes — igual colar numa planilha de
verdade. Tambem da pra digitar/colar um link por vez, apertar Enter para pular
pra proxima linha, ou remover uma linha com o ✕.

### Aba "Baixar fotos"

Ajuste quantas fotos quer por anuncio (padrao 5) e clique em **Baixar fotos**.

- As fotos sao salvas em `scripts/baixar-fotos-zap/output/<id-do-anuncio>/foto-01.webp`, etc.
- Cada anuncio tem a sua propria subpasta (o nome da pasta e o ID do anuncio,
  tirado do link `.../id-1234567890/`), entao as fotos de anuncios diferentes
  nunca se misturam.
- Ao terminar, aparece uma tabela com o link de origem, a pasta e a quantidade
  de fotos baixadas de cada anuncio, com um botao **Abrir pasta** que abre a
  pasta direto no Explorer do Windows.

### Aba "Extrair dados (JSON)"

Clique em **Extrair dados**. Para cada anuncio, extrai:

- `imobiliaria` — nome do anunciante/imobiliaria
- `link` — link canonico do anuncio (sem parametros como `?source=...`)
- `tipo` — `"aluguel"` ou `"venda"`, detectado pelo proprio link do ZAP
- `valor` — valor numerico (em reais)
- `valorFormatado` — ja formatado, ex: `"R$ 11.800/mês"` (aluguel) ou `"R$ 850.000"` (venda)

Ao terminar, aparece uma tabela (Imobiliaria / Link / Valor) para conferir os
dados visualmente, alem do JSON completo com botoes para **copiar** ou
**baixar o .json** — pronto para usar no projeto de relatorios de imoveis
duplicados (mesmos 3 campos exibidos na tabela de "Anuncios duplicados"). O
JSON tambem fica salvo em `output/dados-anuncios.json`.

### Aba "Buscar imoveis (por URL de listagem)"

Cole a URL de uma pagina de resultados do ZAP ja filtrada (por rua, bairro,
etc — o modelo e algo como
`https://www.zapimoveis.com.br/aluguel/imoveis/rj+rio-de-janeiro/nome-da-rua/?onde=...`),
ajuste o numero maximo de paginas a percorrer (padrao 3) e clique em
**Buscar imoveis**. O robo abre cada pagina de resultado (`&pagina=2`,
`&pagina=3`, ...) ate acabarem as paginas ou atingir o limite.

Para cada imovel encontrado, extrai direto do card da listagem: link, endereco,
rua, area, quartos, banheiros, vagas, preco e ate 5 fotos (via CDN, sem
download). Os resultados sao ordenados automaticamente do **menor para o
maior valor**.

Alguns imoveis aparecem na listagem como um card especial "Ver os X anuncios
deste imovel" (varias imobiliarias anunciando o mesmo imovel duplicado) — o
robo clica em cada um desses cards, abre o painel com a lista interna e
tambem inclui esses anuncios no resultado (nesse caso ja vem com o **nome da
imobiliaria** direto, sem precisar de mais nada).

Os resultados aparecem como **cards** (com foto, com setas para ver as outras
fotos) ou em **Lista** (compacta) — alterne pelos botoes acima da grade.
Marque as caixinhas dos imoveis que interessam (ou use **Selecionar todos** /
**Limpar selecao**) e depois:

- **Buscar imobiliaria dos selecionados sem nome** — para os cards comuns (que
  nao vieram de um "Ver os X anuncios..."), o nome da imobiliaria nao aparece
  na listagem. Esse botao visita so os anuncios selecionados que ainda estao
  sem nome, busca o anunciante (e confirma tipo/valor) e atualiza a tabela/os
  cards no lugar, sem perder a selecao.
- **Gerar JSON dos selecionados** — monta na hora o JSON (imobiliaria, link,
  tipo, valor, valorFormatado) dos imoveis selecionados, com botoes para
  **copiar** ou **baixar o .json** — sem precisar passar pela aba
  "Extrair dados".
- **Enviar selecionados para "Extrair dados"** — alternativa: manda os links
  para aquela aba (visita a pagina de cada anuncio individualmente, util se
  quiser confirmar/atualizar todos os valores de uma vez).
- **Enviar selecionados para "Baixar fotos"** — manda os links para baixar as
  fotos completas de cada anuncio selecionado.

Note que o preco mostrado no card da busca reflete o que o ZAP exibe naquela
pagina de listagem — em raros casos (imovel duplo-anunciado para aluguel e
venda no mesmo endereco) o valor pode nao bater exatamente com o anuncio
individual. Para o valor 100% confirmado, use "Buscar imobiliaria..." (que
tambem atualiza o valor) ou a aba "Extrair dados".

Em todas as abas:
- O progresso aparece em tempo real, do lado direito.
- Um botao **Cancelar** aparece durante a execucao, para interromper a
  qualquer momento (o anuncio ou pagina em andamento e descartado, os ja
  concluidos ficam salvos/exibidos).
- O servidor so aceita conexoes da propria maquina (`localhost`), nao fica
  exposto na rede.

As abas "Baixar fotos" e "Extrair dados" tem limite de 50 links por execucao.
A busca por listagem tem limite de 10 paginas por execucao.

## Linha de comando com CSV (opcional, so para fotos)

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
