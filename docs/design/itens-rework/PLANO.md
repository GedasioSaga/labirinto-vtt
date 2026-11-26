# Plano de construção: sistema de itens refeito

- Data: 26/11/2026. Base aprovada: `docs/design/itens-rework/prototipo.html` (bca88f9f) e as 18 decisões da aba "Como era x como fica" ("Confirmo, pode começar a trabalhar", PEDIDOS.md, 26/11 00:20).
- Porquê: `docs/levantamento-mecanicas-duplicadas.md` (achados 0, 1, 3, 4, 5, 8, 9, 10, 11, 23, 24) e as entradas de 25-26/11 no fim do PEDIDOS.md.
- Este arquivo é só plano. Nenhum código foi mudado para escrevê-lo. Os `arquivo:linha` foram lidos em 26/11 no `main` (58cf5641); conferir de novo antes de cada etapa, porque outros agentes estão mexendo na árvore.
- Regras do dono que valem para todas as etapas: nada de teste durante a construção (só na E7); trabalho direto na `main`, sem worktree; escritores só em caminhos disjuntos, e cada um commita só os próprios caminhos; não publicar sem ordem do dono; 1 jornada só por gestos antes de lançar.
- Premissa: o conserto das cópias de NPC (variação com vida própria: `lib/livros/combate.ts:495` `novaVariacao`, `lib/ligarFicha.ts`) chega pronto antes da E1. Daqui em diante, "cópia" = o `Personagem` de variação (`combate.modeloId`, `lib/livros/combate.ts:66`), um por token.
- Caminhos sem prefixo são relativos a `client/src/`.

## 1. Modelo de dados

### 1.1 Princípio

Três donos, cada um de uma coisa só:

| O quê | Dono único | Onde mora |
|---|---|---|
| O que o item **é** (regra, foto, preço de referência, efeitos) | Item do Acervo | `lib/acervoDeItens.ts`, índice do Acervo (do app, fora da aventura) |
| Quem **tem** o item, quantos, se está equipado, o pente | Vaga da mochila | `Personagem.mochila` (jogador: a ficha; NPC: a cópia). `Token.mochila` só para token sem ficha |
| As condições de alguém | Condição na ficha | `Personagem.condicoes` (jogador: a ficha; NPC: a cópia). `Token.conditions` só para token sem ficha |

O que é estado só da batalha (espera do arremesso, boomerang fora da mão, recarga adiada para a próxima vez, Escudo atual) mora no estado da batalha (`BatalhaDaCena`, `stores/batalhaFabrica.ts:54`), nunca na vaga.

### 1.2 O item único do Acervo (substitui `ItemDoCatalogo`, `lib/acervoDeItens.ts:88`)

Forma recomendada: um tipo só, com o campo `tipo` e blocos opcionais. Trocar o tipo no editor **esconde** os blocos que não servem, mas não os apaga (voltando ao tipo antigo, estão lá). Assim a conversão nunca perde campo.

Campos comuns (todo tipo):

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `item_<uuid>` | igual ao de hoje |
| `nome`, `descricao`, `imagem`, `pasta` | como hoje | imagem: PNG, JPG, WEBP ou GIF até 2 MB (decisão 15) |
| `tipo` | um de: corpo, fogo, hibrida, municao, arremesso, consumivel, equipamento, outros | **novo**, obrigatório depois da conversão |
| `preco` | número ou `null` | referência; a banca pode ter preço próprio |
| `empilhavel` | boolean | padrão pelo tipo: Munição, Arremesso e Consumível empilham sozinhos |
| `luz?` | `LuzDoItem` (`types/map.ts:865`) | qualquer tipo; "Outros" é o caso comum (Tocha) |
| `requisitos?`, `marcas?` | como hoje | |
| `confira?` | lista de `{ texto, antes?, depois?, origem? }` | **novo**: os avisos "Confira" da conversão, com os números lado a lado. O mestre apaga ao conferir |
| `categoriaAntiga?` | texto | **novo**: a categoria de antes ("Fruta", "Tesouro"), guardada para não perder |

Blocos por tipo:

| Bloco | Tipos | Campos |
|---|---|---|
| `ataque` | corpo, fogo, hibrida (o tiro), arremesso | `dano` (número), `soma` (id de atributo ou vazio), `acao`, `alvos`, `alcance` = `FormaDoAlcance` (`lib/batalha/alcance/forma.ts:31`). "Alvo até X" = `alvo`; "Anel de X a Y" = `alvo` com `de`; linha, cruz, volta iguais; "Ponto que explode" = `ponto` com explosão |
| `golpe` | hibrida | `dano`, `soma`, `acao`, `alcance` (a parte que bate) |
| `pente` | fogo, hibrida | `capacidade` (número), `aceita` (ids de Munição; substitui `municoes`, `lib/acervoDeItens.ts:106`), `recarga: { acao, rodadas 0/1/2 }` |
| `arremesso` | arremesso | `recarga: { acao, rodadas }` (= tempo até o próximo estar na mão, decisão 7), `volta` (boomerang) |
| `bala` | municao | `{ modo: soma / troca / atributo, valor, atributo?, divisor? }` (substitui `tiro` e `TiroDaMunicao`, `lib/acervoDeItens.ts:111,142`) |
| `uso` | consumivel | `acao`, `alcance`, `onde: { batalha, fora }` |
| `equipamento` | equipamento | `parte` (Corpo, Cabeça, Mãos, Pés, Acessório), `bonus: { campo: CA / Escudo / Vantagem / Desvantagem / atributo, n, em? }[]` (sem "Defesa" inventada) |
| `aoAcertar?` | corpo, fogo, hibrida, municao, arremesso | `MecanicaGuardada` (`lib/personagem.ts`): as mesmas peças das técnicas, lidas por `lerMecanica` (`lib/batalha/mecanica/modelo.ts`): Condição com duração, Dano extra, Empurrar |
| `aoUsar?` | consumivel | `EfeitoDoItem` (`types/map.ts:850`), restrito a Curar, Tirar condição e Condição |

Peças: Condição usa a peça `selo` que já existe (com o id da condição do catálogo); Curar usa `cura` (`modelo.ts:284`); Tirar condição usa `tirarSelos` com `nomes` (`modelo.ts:286`); Dano extra usa a soma de dano da mecânica. **Empurrar não roda hoje** (`modelo.ts:541`, `EFEITOS_QUE_AINDA_NAO_RODAM.mover`): a peça existe no editor desde a E2 e o movimento entra na E6c.

Dano extra igual ao de cima (decisão 14): o leitor marca a peça como "dobra" e o aplicador a ignora; o editor a pinta de vermelho.

### 1.3 A vaga da mochila (muda `CarriedItem`, `types/map.ts:882`, e `DadosDoItem`, `types/map.ts:789`)

A vaga continua **plana** (sem objeto aninhado), para não mudar os caminhos de operação do Lobby (`['mochila', vagaId, campo]`, `lib/nuvem/caminho.ts:267-271`).

| Campo | Novo? | Quem escreve | Nota |
|---|---|---|---|
| `id` (da vaga), `itemId`, `quantidade` | não | como hoje | `itemId` passa a existir sempre depois da conversão (vaga sem item no Acervo vira item novo com "Confira") |
| `equipado?: true` | **sim** | dono e mestre | só arma, arremesso e equipamento; limite = "Armas por batalha" da ficha (uma pilha de granadas conta 1, decisão 5) |
| `pente?: { balaId, n }` | **sim** | dono e mestre, só pelo Recarregar | só De fogo e Híbrida; um tipo de bala por vez (decisão 2). As balas do pente **não** contam na vaga da munição |
| `acesa?: true` | não | como hoje | |
| Cópia de exibição: `nome`, `imagem`, `descricao`, `tipo`, `preco`, `empilhavel`, `luz`, `efeitoResumo` | só `tipo` é novo; `categoria` sai | **só derivada do Acervo** | cache para quem não vê o Acervo (jogador na LAN, site do Lobby). Atualiza sozinha ao salvar no Acervo (mecanismo de hoje: `lib/mochila/efeitoNasCopias.ts`, `stores/itensNaFonte.ts`) |
| `regra?` | **sim** | **só o app do mestre** | instantâneo das regras do item (blocos da 1.2, sem a imagem) para o Worker do Lobby, que roda a batalha do treino sem o Acervo (`lobby/nuvem/src/luta.ts` e `duelo.ts` importam `stores/batalhaFabrica`). Ver A1 |
| `notaDaVaga?` | **sim** | mestre | guarda o nome ou a descrição que o mestre editou só naquela vaga (decisão Nº 11 de 25/11). Ver A4 |

Saem da vaga: `categoria` (vira `tipo`), `municoes` (vira `regra.pente.aceita`), `efeito` (as peças ficam só no Acervo; o host lê pelo `itemId`) e `requisitos` (idem). O leitor continua aceitando os campos antigos: é por ele que a conversão os enxerga.

Leitores que mudam juntos (são o "juiz" do disco, do fio e do Worker): `readCarriedItem` (`lib/items.ts:62`), `dadosDoItemLidos` (`lib/leituraDoItem.ts:93`), `CAMPO_DO_ITEM` e `CAMPOS_DO_ITEM_DO_MESTRE` (`lib/nuvem/caminho.ts:121,149`), `lerItemNovo` (`caminho.ts:893`). O Worker recusa item que o leitor não devolve igual (`jsonIgual`): campo novo sem leitor novo = recusa no Lobby.

### 1.4 Posse única

- `Personagem.mochila` e `moedas` (`lib/personagem.ts:265,267`) são a mochila. O espelho no boneco (`lib/mochila/espelho.ts`; `Token.mochila` e `moedas`, `types/map.ts:1822,1826`) fica só para token **sem** ficha.
- Quem lê o boneco hoje passa a ler a ficha: a venda (`net/hostSession.ts`, perto da linha 10134), o Acender (`App.tsx`, perto da 1241), o Dar a, o pagar e o uso no host.
- Ficha de NPC posta várias vezes: cada token tem a sua cópia (variação), com mochila própria; a cópia nova nasce com a mochila do modelo; dar à ficha modelo só muda as cópias novas (decisão 1).

### 1.5 Condições na ficha

Campo novo em `Personagem` (`lib/personagem.ts:215`):

```
condicoes?: { id, condId, turnos: número ou null, n?, origem?, contadoNaCarta? }[]
```

- `condId` aponta para o catálogo de condições: as de fábrica (hoje `TokenCondition`, `types/map.ts:1566`, mais Sangrando, Queimando e Cura reduzida) e as criadas (`CondicaoPropria`, `types/map.ts:1589`, guardadas por `stores/condicoesPropriasStore.ts`).
- Cada condição do catálogo ganha `regra` (vida, cura ou narra) e `n` (decisão 10). `turnos: null` = até alguém tirar.
- Saem do token com ficha: `Token.conditions` (`types/map.ts:1753`), `Token.condicoesProprias` (`:1761`) e `Token.prazosDasCondicoes` (`:1769`). Ficam só para token sem ficha (A3).
- Na batalha, o `SeloDaBatalha` (`lib/batalha/combate.ts:871`, preso ao `tokenId`) deixa de guardar condição: o selo de natureza "condição" passa a ser a condição da ficha do token; o selo de técnica (bônus como "FOR +20") continua selo da batalha.

### 1.6 O que sai (na E7, depois que tudo já lê o formato novo)

| Sai | Onde está hoje |
|---|---|
| Regra da arma separada no livro: entradas `arma` e `item` com `acervoId` | `lib/livros/catalogo.ts:42-45` (`DADOS_DO_TIPO`), `:52` (`ItemDoCatalogo`), `:70` (`balas`), `:79` (`acervoId`), `:110` (`BalaDoCatalogo`); `lib/livros/regraDaArma.ts:40` (`RegraDaArma`) e o arquivo todo; `lib/livros/coisaERegra.ts`; `stores/armasNaFonte.ts` |
| "Tipos de bala" no cartão da arma | subcartões da aba Armas (`lib/sistemaOnePiece.ts`); `BalaDaArma` e `balaDoCartao` (`lib/batalha/leituraDaFicha.ts:255,307-322`); `CartaoDaFicha.municaoPeloNome` (`lib/personagem.ts:160`); `lib/mochila/balasNaMochila.ts`; a ligação pelo nome em `lib/mochila/municao.ts` |
| Cartões das abas Armas e Itens | `Personagem.abas` armas/itens (`lib/personagem.ts:250`); `ArmaDaFicha` e `armasDe` (`leituraDaFicha.ts:275,456`); "Passar para a mochila" (`components/FichaAbas.tsx`, perto de 99-170); `components/batalha/EscolhaDeArmas.tsx` |
| Condições no token com ficha | `types/map.ts:1753,1761,1769`; `lib/ponteDasCondicoes.ts` (a ponte de mão única deixa de existir: há uma fonte só) |
| Palpite pelo nome no "Usar" | `components/RpgDialogs.tsx` (perto de 341-351); `lib/curaPeloItem.ts` (perto de 48-56) |
| Categoria livre do item | `ItemDoCatalogo.categoria`; `CATEGORIAS_PADRAO` (`lib/acervoDeItens.ts:66`); `ehCategoriaDeMunicao` |

O leitor antigo de cada campo fica até a E7 (é ele que alimenta a conversão). Na E7 ele passa a existir **só dentro do conversor**; o resto do app para de importá-lo.

Fora do escopo, de propósito: o inventário próprio do Dragon Ball (`FichaDBT.inventario`, `lib/dbt/modelo.ts:697`; achado Nº 5). Ver A2.

## 2. Conversão dos dados salvos

### 2.1 Regras

1. **Na leitura**: cada leitor de disco (Acervo, catálogo, ficha, mapa, loja) devolve o formato novo. O arquivo só muda quando o app grava de novo, como hoje.
2. **Idempotente pelo estado, não por bandeira**: converter o que já foi convertido não muda nada. Exemplos: vaga com o mesmo `itemId` já na mochila = não cria outra; munição que já tem vaga na mochila = não soma a quantidade do cartão. Isso protege também do app antigo, que apaga os campos que não conhece ao regravar (o leitor de hoje só guarda os campos da lista, `lib/items.ts:62`).
3. **Ids determinísticos** para o que nasce na conversão: `item_conv_<hash da origem>` (origem = `cartao:<personagemId>/<cartaoId>`, `catalogo:<entradaId>` ou `bala:<nome normalizado>`). Converter de novo dá o mesmo id, nunca um segundo item.
4. **Nada se perde**: o que não vira campo vai para a Descrição, com um "Confira" que aponta a origem. Os campos antigos continuam no arquivo até a E7.
5. **Cópia de segurança, uma vez**: antes da primeira gravação convertida, copiar o índice do Acervo para `index.antes-itens-v2.json`, o catálogo de cada sistema para `<catalogo>.antes-itens-v2.json` e a pasta da aventura para `<aventura>.antes-itens-v2` (se o app já faz cópia ao gravar, reusar).
6. **Ordem na abertura**: Acervo e catálogos primeiro (dão os itens); depois fichas e mapas da aventura (dão as vagas e as condições); por último as lojas. O Acervo é do app e a ficha é da aventura: a parte da ficha que cria item no Acervo devolve uma lista de "itens a criar", e a store do Acervo grava. A função de conversão é pura; o efeito fica na store.

### 2.2 Tabela antigo -> novo

| Hoje | Depois | Confira? |
|---|---|---|
| Item do Acervo e entrada `arma` ou `item` do catálogo com o mesmo `acervoId` | Um item só. Foto, preço, pilha e pasta vêm do Acervo; dano, ação, alvos, alcance, mecânica, requisitos e marcas vêm da entrada. A entrada sai do catálogo | Só se os números divergirem (linha abaixo) |
| Campos de cima e "O que ela faz" com números diferentes | Fica o de cima; o outro vai lado a lado no `confira` | Sim |
| "O que ela faz" com o mesmo dano de cima | Fica fora (o dano não dobra) | Não |
| Entrada `arma` ou `item` do catálogo **sem** `acervoId` | Item novo no Acervo, id `item_conv_<hash(catalogo:id)>` | Sim |
| Categoria "Arma" | Tipo pela categoria da regra (`CategoriaDaArma`, `leituraDaFicha.ts:240`): branca e natural -> Corpo a corpo; deFogo -> De fogo; hibrida -> Híbrida; arremesso -> Arremesso. Sem categoria: com balas -> De fogo; sem balas -> Corpo a corpo | Sim, quando sem categoria |
| Granada e bombas (categoria Arma, alcance de explosão) | Arremesso, recarga Ação Livre na hora. Quantidade da mochila igual | Não |
| Categoria "Munição", "Bala" ou "Balas" | Munição. `tiro` vira `bala`: dano "+15" -> soma 15; "40" -> troca por 40; "+Percepção / 2" -> pelo atributo | Sim, quando o dano não casa com nenhum dos três |
| "Consumível" | Consumível; `efeito` vira `aoUsar`; `onde` sempre / soNaBatalha / soFora vira batalha e fora | Não |
| "Armadura" | Equipamento, parte Corpo; "Defesa N" escrito vira bônus sugerido CA +N | Sim |
| Outras categorias ("Fruta", "Chave", "Tesouro", peça de puzzle) | Outros, com `categoriaAntiga` guardada; a peça de puzzle mantém o seu marcador | Não |
| "Tipos de bala" no cartão da arma (ex.: Prata 12) | Item de Munição (o do `itemId` do subcartão, ou o de mesmo nome, ou novo `item_conv_<hash(bala:nome)>`). As 12 vão para a mochila **só se não houver vaga dessa munição ligada** (`lib/mochila/municao.ts` liga por `itemId` ou nome; a vaga ligada já é a verdade, porque o cartão nunca descontou). O pente começa vazio | Sim, quando a quantidade não é número |
| Bala com a quantidade no texto ("12 balas de prata") | O número vai para a mochila; o texto fica na Descrição | Sim |
| "Ferido por prata" ou cura pela metade escrita no texto | Peça Condição: Cura reduzida 50% até o fim da batalha | Não |
| Cartões da aba Armas | Com `itemId`, ou nome que casa no Acervo: vaga na mochila (se ainda não houver). Sem item: item novo `item_conv_<hash>`. Cartões iguais em fichas diferentes (mesmo nome e mesma regra) viram **um** item; regra diferente = item à parte "Nome (de Fulano)" | Sim, no item novo |
| Arma "em uso" | Equipadas as primeiras N pela ordem dos cartões, N = "Armas por batalha" (`ESCOLHA_DAS_ARMAS`, `leituraDaFicha.ts:26`); o resto fica guardado | Sim, se passou do limite |
| Cartões da aba Itens | Mesma regra dos de Armas (ex.: Luneta Velha da Nay) | Sim, no item novo |
| Vaga sem `itemId` (pino "!" só com nome, mochila antiga) | Casa pelo nome com o Acervo; sem casar, item novo do tipo Outros | Sim, no item novo |
| Vaga com nome ou descrição diferentes do Acervo (editada à mão) | `notaDaVaga` com o texto da vaga; nome e foto passam a ser os do Acervo | Sim |
| `Token.conditions`, `condicoesProprias` e `prazosDasCondicoes` em token com ficha | `Personagem.condicoes` da ficha (jogador) ou da cópia (NPC). O prazo vira `turnos`; a vida por turno vira `n`; a criada entra no catálogo de condições | Não. Vários tokens da mesma ficha de jogador com condições diferentes: une as listas e marca Confira |
| Condição "por N turnos" | Passa a contar no fim da vez de quem está com ela | Não |
| `Token.mochila` e `moedas` com ficha que ainda não tem mochila (aventura não migrada) | Vão para a ficha (a migração de hoje, `App.tsx` perto de 3313 e `lib/mochila/espelho.ts`, vira um passo da conversão) | Não |
| `LojaItem.acervo` (cópia, `types/map.ts:1330`) | `itemId` mais o `preco` próprio da banca (o campo de texto de hoje: só dígitos; vazio = segue o Acervo) | Preço que não vira número: como já decidido em 25/11 (Nº 2) |
| Item em pino "!", objeto e baú (`PinItem`, `Prop.item`) | Mesmo leitor da vaga: ganha `itemId` e `tipo` pela mesma regra | Sim, no item novo |
| Peça da estante (`lib/tokenLibrary.ts:115`) com mochila | Mesmo leitor da vaga; continua modelo (achado 32, de propósito) | Não |
| Item do Grimório (`lib/preparo/tipos.ts:487`) | O importador (`lib/preparo/importar/inventario.ts`) passa a criar o item com `tipo`; os já importados passam pela regra das categorias | Não |
| Texto livre que não vira peça | Fica na Descrição | Sim |

### 2.3 Lobby e compatibilidade

- **O Worker usa o código do app** (`lobby/nuvem/src/*.ts` importa `client/src/lib/...`): "o Worker aceitar o formato novo" = publicar o Worker com os leitores novos. `scripts/publicar-versao.cjs` já publica na ordem certa: Worker -> Pages (site) -> release do app, com o Worker aceitando o formato anterior (N-1).
- **O que o Worker precisa aceitar** (E1 e E5):
  - Nos campos da vaga: `equipado`, `pente`, `tipo`, `notaDaVaga`. `regra` só pelo caminho do mestre (como `efeitoResumo` e `requisitos` hoje, `caminho.ts:149`); recusar `regra` e as peças vindas do jogador.
  - Operação nova e atômica `recarregar { armaVagaId, balaVagaId, n }`: tira da vaga da bala e põe no pente de uma vez, conferindo que o pente mais n não passa da capacidade, que é a mesma bala ou o pente está vazio, e que n não passa da quantidade. Duas operações soltas deixariam bala sumir ou duplicar se a segunda falhasse.
  - `equipar` e `guardar`, com o limite "Armas por batalha" conferido no servidor.
  - `Personagem.condicoes` só pelo mestre (o jogador lê e não escreve; decisão 18).
  - Ficha publicada no formato antigo (app do mestre ainda não atualizado): continua aceita, e a conversão a lê.
- **Teto do item** (`TETOS_DO_CAMINHO.itemBytes` = 4 KiB, `caminho.ts:37`): medir na E1 uma vaga com a `regra` de uma Híbrida cheia. Se passar, a `regra` vai pelo caminho de publicação do mestre (sem o teto da operação do jogador), não pela operação de vaga.
- **App antigo abrindo dado novo**: lê sem quebrar (campos opcionais), mas ao regravar apaga `equipado`, `pente`, `tipo` e `condicoes`. A conversão idempotente refaz o tipo e a posse; equipado e pente se perdem. Mitigação: (a) publicar a E1 só depois de o dono atualizar todos os PCs dele; (b) a E1 sobe `VERSAO_DO_INDICE` do Acervo (`lib/acervoDeItens.ts:54`) para 6 e passa a abrir **só para leitura** o índice de versão maior que a conhecida, para isso não se repetir nas próximas mudanças.
- **Jogador na LAN**: o navegador é servido pelo app do mestre, na mesma versão; não há N-1 aqui.

## 3. Etapas

Cada etapa termina com o app funcionando e publicável (publicar só com ordem do dono). Verificação comum, chamada abaixo de **PORTÃO-TSC** (a partir de `C:/dev/labirinto`):

```
cd client && rtk proxy npx tsc --noEmit
rtk proxy npx tsc --noEmit -p lobby/site/tsconfig.json
rtk proxy npx tsc --noEmit -p lobby/nuvem/tsconfig.json
```

Etapa que toca `lib/nuvem` ou a batalha (o Worker roda a batalha do treino) soma `npx wrangler deploy --dry-run` em `lobby/nuvem` (só confere o pacote, não envia nada). Antes de cada build: disco C: com pelo menos 8 GB livres (hoje 12 GB).

Os gestos usam uma **cópia** da aventura real do dono (Vincent G. com Rosa Fúnebre e Bala de Prata 12, Granada, Boomerang, Kit Médico, zumbis), nunca a original, até a E7.

### E1. Modelo e conversão na leitura (sem tela nova)

- **Entra**: os tipos novos (1.2, 1.3, 1.5); os leitores novos; o conversor puro em `lib/itens/conversao/` (Acervo, catálogo, ficha, mapa, loja), com a lista de "Confira" e de "itens a criar"; a ligação nos leitores do disco e nas stores; a cópia de segurança `.antes-itens-v2`; a guarda de versão do Acervo; o Worker aceitando os campos novos (sem operação nova ainda). As telas de hoje continuam lendo os campos antigos, que ficam no arquivo. Os cartões das abas Armas e Itens ficam **só para ler**, com a frase "Agora mora na mochila" (evita duas fontes divergindo até a E4).
- **Arquivos principais**: `types/map.ts`, `lib/acervoDeItens.ts`, `lib/leituraDoItem.ts`, `lib/items.ts`, `lib/personagem.ts`, `lib/livros/catalogo.ts`, `lib/loja.ts`, `stores/acervoDeItensStore.ts`, `stores/catalogoStore.ts`, `stores/adventureStore.ts` (a abertura), `lib/mochila/espelho.ts`, `lib/nuvem/caminho.ts`, novo `lib/itens/`.
- **Dono**: `programador`, sozinho (tudo acoplado: tipos e leitores que o app e o Worker dividem).
- **Paralelo**: nenhum.
- **Pronto**: E1 até o PORTÃO-TSC e o dry-run do Worker passarem **e** este gesto: abrir a cópia da aventura; o Acervo mostra o mesmo número de itens de antes mais os "Confira" novos; a Granada aparece com tipo Arremesso no `index.json` regravado; a mochila do Vincent tem Bala de Prata 12 (não 24); fechar e abrir de novo não muda o arquivo (copiar a pasta depois da 1ª e da 2ª gravação; `git diff --no-index` entre as duas sai vazio); uma batalha com o Vincent atira como antes.
- **Recomendado (ferramenta, não teste; precisa do ok do dono, A9)**: `node scripts/relatorio-conversao-itens.cjs <pasta-da-aventura>`, só leitura, que imprime por ficha a soma das quantidades por `itemId` antes e depois, os itens criados e os Confira. Prova "nada se perdeu" sem abrir ficha por ficha.

### E2. Acervo e editor do item

- **Entra**: a tela Acervo do protótipo (lista por tipo, "Nas mochilas" com o total, painel "Confira"); o editor do item com os campos pelo tipo, "Ao acertar" e "Ao usar" com as peças das técnicas e a frase "O que acontece", o Dano extra igual em vermelho, imagem até 2 MB; a Biblioteca deixa de listar coisa e regra separadas (a Granada duplicada some). O "Testar" fica desligado com a dica "chega com a batalha" (entra na E6c).
- **Arquivos principais**: `components/livros/PaginaItens.tsx`, `components/livros/biblioteca/*`, `components/ItemDoCatalogoDialog.tsx`, `components/EfeitoDaArmaCampos.tsx`, `lib/livros/gruposDaBiblioteca.ts`, `stores/acervoDeItensStore.ts` (salvar).
- **Dono**: `programador-frontend` (com as skills do Emil).
- **Paralelo**: pode rodar junto com a **E4a** (condições, só `lib/`): caminhos disjuntos.
- **Pronto**: E2 até o PORTÃO-TSC passar **e** o gesto: criar "Lâmina-Revólver" do tipo Híbrida e ver golpe e tiro separados, pente e recarga; trocar para Corpo a corpo e voltar para Híbrida, e os campos do tiro voltam iguais; abrir a Bala de Prata e ver "Ao acertar: Cura reduzida 50% até o fim da batalha" e nenhum bloco "O que ele faz"; a Granada aparece uma vez só na Biblioteca; salvar uma foto nova no Acervo e ela aparecer na vaga da mochila do Vincent sem reabrir a aventura.

### E3. Dar a, loja e mochila (lado do mestre)

- **Entra**: "Dar a..." com quantidade e várias fichas de uma vez, mostrando quanto cada um tem e com quanto fica (do Acervo para fichas e cópias; de uma mochila para um aliado); posse só na ficha (quem lia o boneco passa a ler a ficha; espelho só para token sem ficha); Equipar e Guardar com o limite "Armas por batalha"; Recarregar fora da batalha (na hora, sem gastar nada; tira da vaga da bala e põe no pente); trocar de bala devolve as do pente; dar, vender ou largar arma esvazia o pente na mochila de quem tinha (A8); loja: comprar com Desfazer (o preço que aparece é o cobrado), vender à banca pela metade do preço dela, arma equipada precisa ser guardada antes (decisão 16).
- **Arquivos principais**: `lib/mochila/*` (`darNaFicha.ts`, `editarVaga.ts`, `espelho.ts`, `usarItemFora.ts`), `lib/loja.ts`, `lib/vendaDaLoja.ts`, `components/PinLojaControls.tsx`, `components/MochilaDoMestre.tsx`, `components/RpgDialogs.tsx`, `components/livros/biblioteca/LadoDaEscolhida.tsx` (o Dar a da Biblioteca chama a função nova), `net/hostSession.ts`, `net/protocol.ts`.
- **Dono**: `programador`, sozinho (host, protocolo e mochila são o mesmo estado).
- **Paralelo**: nenhum escritor junto. `RpgDialogs.tsx` e `net/protocol.ts` estão sujos hoje por outros agentes: esperar a árvore limpa nesses dois.
- **Pronto**: E3 até o PORTÃO-TSC passar **e** o gesto: dar 40 Bala de Prata ao Vincent e ao Hector de uma vez (dois cliques, não 80), e o Desfazer volta os dois; equipar uma terceira arma no Vincent com "Armas por batalha" 2 é recusado com a frase do limite; Recarregar a Rosa Fúnebre fora da batalha: pente 0 -> 6 e mochila 52 -> 46; comprar 2 Kit Médico tira os berries que a banca mostra; vender a Rosa equipada pede para guardar antes.

### E4. Ficha do mestre e Condições

Duas partes, que podem rodar em momentos diferentes.

- **E4a (lib)**: catálogo de condições com `regra` (vida, cura, narra) e `n`; condições em `Personagem.condicoes`; funções puras de pôr, tirar, contar no fim da vez e aplicar ou pular no começo da vez; o mapa e o recorte do jogador (`lib/fogFilter.ts`) leem as pastilhas da ficha; fora da batalha, o prazo conta pela ficha. Arquivos: `lib/tokenConditions.ts`, `lib/prazoDaCondicao.ts`, `stores/condicoesPropriasStore.ts`, `stores/condicoesNasCenas.ts`, novo `lib/condicoes/`. Dono: `programador`.
- **E4b (tela)**: a Ficha do mestre com um cabeçalho e a aba "Mochila e equipamento" no lugar de Armas e Itens ("Armas por batalha" ali); as habilidades mostram os itens que gastam, com a contagem; a tela Condições (catálogo, "Quem está com", "Pôr condição em alguém"); o menu do token mostra e muda as condições da ficha. Arquivos: `components/FichaAbas.tsx`, `components/InventarioDaFicha.tsx`, `components/TokenContextMenu.tsx` e os painéis de condição do token, `pixi/PixiCanvas.tsx` só onde desenha a pastilha (arquivo sujo hoje: esperar). Dono: `programador-frontend`.
- **Paralelo**: a E4a começa junto com a E2. A E4b só depois da E3 (lê a mochila nova) e da E4a.
- **Pronto**: E4 até o PORTÃO-TSC passar **e** o gesto: pôr "Envenenado 2 turnos, 3 de vida" no Zumbi 1 pelo menu do token: aparece no Zumbi 1 e **não** no Zumbi 2; abrir a ficha do Vincent e ver Rosa Fúnebre e Granada equipadas, sem aba Armas nem Itens; criar a condição "Encharcado" e ela aparecer na lista de pôr condição; a mesma condição aparece igual no mapa do mestre e na tela do jogador da LAN.

### E5. Inventário do jogador e Lobby

- **E5a (telas)**: o Inventário do jogador na LAN, com a mesma mochila e as ações pelo tipo (Equipar, Recarregar, Jogar, Usar, Acender, Dar com quantidade, Largar; "diga ao mestre" só em item sem regra), o cartão inteiro do item só para ler, grade de 16 vagas (empilhável ocupa 1), e o retrato, o medidor e os atalhos mantidos; o site do Lobby (`lobby-site/telas/PainelMochila.tsx`) com as ações que o Lobby permite (A6). Arquivos: `player/main.tsx` e o inventário do jogador, `lobby-site/telas/*`. Dono: `programador-frontend`.
- **E5b (servidor)**: as mensagens novas da LAN e a validação no host (equipar, recarregar, dar com quantidade, usar); as operações novas do Worker (`recarregar` atômica, `equipar` e `guardar` com limite); a recusa de `regra` e de `condicoes` vindas do jogador. Arquivos: `net/protocol.ts`, `net/hostSession.ts`, `net/edicaoDoPersonagem.ts`, `net/protocoloDoPersonagem.ts`, `lib/nuvem/caminho.ts` e, se precisar, `lobby/nuvem/src/*`. Dono: `programador`.
- **Paralelo**: E5a e E5b juntas (caminhos disjuntos). Antes, escrever o formato das mensagens no topo de `net/protocol.ts` (é o contrato entre as duas).
- **Publicação**: esta etapa **exige** a ordem Worker -> Pages -> app (o script já faz). O site novo não pode ir antes do Worker novo.
- **Pronto**: E5 até o PORTÃO-TSC e o dry-run do Worker passarem **e** o gesto: no navegador do jogador (LAN), o Vincent recarrega a Rosa e o mestre vê a mochila mudar na hora; o Vincent dá 5 balas à Kaya e as duas mochilas batem; o jogador não acha botão para tirar item da mochila de outro nem para mexer em condição; no site do Lobby (dev local), equipar e recarregar funcionam e a mesma ficha aberta no app mostra o mesmo.

### E6. Batalha

A maior e a mais acoplada. Um escritor só (`programador`), em três partes em sequência, cada uma publicável.

- **E6a. Armas, pente e recarga**: o Atacar lê só as armas equipadas da mochila de agora (`armasDe` deixa de ler cartões); o tiro gasta do pente; pente zerado recarrega sozinho da mochila até onde der; se a ação da recarga já foi gasta, recarrega no começo da próxima vez e gasta a ação daquela vez (decisão 3); Tipo e Tempo de recarga; trocar de bala conta como recarga; equipar e guardar sem gastar ação (decisão 6); o Escudo da roupa enche no começo da batalha e o bônus de CA aparece na ficha e na batalha (decisão 8); no fim da batalha, as balas no pente ficam (decisão 11). Arquivos: `lib/batalha/leituraDaFicha.ts`, `lib/batalha/municoesDoAcervo.ts`, `stores/batalha/golpe.ts`, `stores/batalha/vez.ts`, `stores/batalha/nucleo.ts`, `stores/batalhaFabrica.ts`, `components/batalha/*` (sai `EscolhaDeArmas.tsx`), `components/livros/ControleDaBatalha.tsx`, `batalhaJanela/espelhoOP.ts`.
- **E6b. Arremesso, consumível e dar na batalha**: o arremesso tira 1 da mochila com Desfazer, sem nenhum na mochila não joga, e tem tempo até o próximo estar na mão; o boomerang não gasta e volta no começo da próxima vez de quem jogou (decisão 7); o consumível vai pelo "Usar" com o efeito do item, e sem efeito não gasta e mostra "o mestre narra" (decisão 12); a técnica sem regra gasta o item que pede e o mestre narra (decisão 13); o Kit Médico da Medicina passa a descontar da mochila (achado 1); dar item a aliado não gasta ação, e munição recebida recarrega a arma de quem recebeu quando o pente estava vazio. Arquivos: `lib/batalha/itemNaBatalha.ts`, `stores/batalha/gastosDosRequisitos.ts`, `lib/batalha/mecanicasAMao.ts`, `stores/batalha/golpe.ts`.
- **E6c. Efeitos e condições na batalha**: "Ao acertar" pelo aplicador das técnicas (Condição na ficha ou na cópia do alvo, Dano extra sem dobrar, Empurrar movendo o token de verdade, A5); as três regras de condição (vida no começo da vez com Aplicar ou Pular; cura cortada em %; narra), com a duração contando no fim da vez de quem está com ela; o fim da batalha tira as que têm duração e deixa as "até alguém tirar" (decisão 11); o selo de condição passa a ler e gravar a ficha (1.5); o "Testar" do editor atira num boneco pela mesma função. Arquivos: `lib/batalha/condicoes.ts`, `lib/batalha/mecanica/*`, `stores/batalha/golpe.ts`, `stores/batalha/vez.ts`, `components/batalha/blocos/PecasDoSelo.tsx`, o editor do item (só ligar o Testar).
- **Paralelo**: nenhum escritor junto (tudo passa por `stores/batalha/golpe.ts`). A batalha do Dragon Ball (`components/dbt/batalha/*`) não muda (A2).
- **Pronto E6a**: até o PORTÃO-TSC e o dry-run do Worker passarem **e** o gesto: batalha do Vincent contra 3 zumbis; o Atacar mostra só Rosa Fúnebre e Granada; 6 tiros esvaziam o pente e o 7º recarrega sozinho (mochila 46 -> 40); o Desfazer do último tiro devolve 1 ao pente; a Clava dada e desfeita não fica no Atacar.
- **Pronto E6b**: até o PORTÃO-TSC passar **e** o gesto: jogar a Granada (mochila 2 -> 1; o Desfazer volta 2); o Boomerang some da mão e volta no começo da próxima vez do Vincent; a Kaya dá 10 Bala de Prata ao Vincent com o pente vazio e o pente enche; a Ração de Viagem sem efeito mostra "o mestre narra" e não desconta; a Medicina do Hector tira 1 Kit Médico da mochila.
- **Pronto E6c**: até o PORTÃO-TSC e o dry-run do Worker passarem **e** o gesto: um tiro de Bala de Prata no Zumbi 2 põe "Cura reduzida 50%" só nele, e uma Poção nele cura a metade; a Bala de Borracha empurra o Zumbi 1 uma casa (e não atravessa parede); Sangrando pede Aplicar ou Pular no começo da vez do alvo; no fim da batalha a Cura reduzida sai e uma condição "até alguém tirar" fica na ficha; o "Testar" no editor da Bala de Prata mostra o mesmo resultado; uma luta de treino no Lobby (dev local) com o Vincent atira com a Rosa.

### E7. Limpeza, testes e auditoria

- **E7a. Limpeza** (`programador`): tirar o que a seção 1.6 lista; o leitor antigo fica só dentro de `lib/itens/conversao/`; apagar o espelho do boneco para token com ficha; tirar o "só para ler" das abas antigas (as abas saem do molde do One Piece, `lib/sistemaOnePiece.ts`, mas a leitura do arquivo antigo fica no conversor). Pronto: até o PORTÃO-TSC passar e `rg -n "regraDaArma|balasNaMochila|EscolhaDeArmas|municaoPeloNome|ponteDasCondicoes" client/src --type ts` só achar o conversor.
- **E7b. Testes** (`testador`, só agora): ajustar os testes velhos que a mudança quebra (a lista já conhecida no PEDIDOS: loja, venda, ponteDasCondicoes, curaPeloItem, mecanicasFatiaF, municao, mochila, regraDaArma, coisaERegra, gruposDaBiblioteca, armaDaMochila, InventarioDaFicha) e escrever os novos: conversão idempotente (converter duas vezes = converter uma), conservação (por ficha, a soma por `itemId` antes = vagas + pentes depois), o Worker recusando `regra` do jogador, a `recarregar` atômica e as três regras de condição. No máximo 2 testes por situação. Pronto: até `cd client && npx vitest run --project rapido` e depois `npx vitest run --project lento` passarem (uma suíte pesada por vez na máquina).
- **E7c. Auditoria** (`verificador-realidade`, só leitura, junto com a E7b): item por item contra o **texto literal** das entradas de 25-26/11 do PEDIDOS.md e as 18 decisões, não contra este plano; mais 1 jornada só por gestos (sem `setState`), vista falhando antes de consertar. Pronto: tabela "pedido -> onde está -> evidência" sem nenhum item em aberto.

### Resumo da ordem e do paralelismo

| Ordem | Etapa | Dono | Junto com |
|---|---|---|---|
| 1 | E1 | programador | nada |
| 2 | E2 | programador-frontend | E4a |
| 2 | E4a | programador | E2 |
| 3 | E3 | programador | nada |
| 4 | E4b | programador-frontend | nada |
| 5 | E5a + E5b | programador-frontend + programador | as duas |
| 6 | E6a -> E6b -> E6c | programador | nada |
| 7 | E7a -> (E7b + E7c) | programador -> testador + verificador-realidade | E7b e E7c juntas |

No máximo 2 escritores ao mesmo tempo, nunca dois no mesmo arquivo.

## 4. Riscos e decisões abertas

### 4.1 Riscos

| Risco | Como aparece | Como pegar cedo |
|---|---|---|
| R1. Bala contada duas vezes na conversão | Vincent com Prata 24 em vez de 12 (cartão "Tipos de bala" + vaga ligada) | Regra da 2.2: a vaga ligada vence e o cartão não soma. O gesto da E1 confere 12 |
| R2. App antigo apaga campo novo | Outro PC do mestre, sem atualizar, regrava e some o "equipado" e o pente | Atualizar todos os PCs antes de publicar a E1; guarda de versão do Acervo (2.3) |
| R3. Worker fora de ordem | Site novo manda `equipado` e o Worker velho recusa "fora do formato" | Publicar sempre pelo `publicar-versao.cjs` (Worker primeiro); dry-run do Worker em toda etapa que toca `lib/nuvem` ou a batalha |
| R4. A batalha do treino do Lobby muda junto | O Worker importa `stores/batalhaFabrica`: tirar o `armasDe` dos cartões tira as armas do treino se a `regra` não estiver na vaga | A1 resolvido na E1; gesto de treino no Pronto da E6a e da E6c |
| R5. Condição saindo do selo para a ficha | `stores/batalha/golpe.ts` (1446 linhas) e `vez.ts` tratam selo por `tokenId` em dezenas de pontos; erro = condição que não conta ou conta duas vezes | E6c sozinha e por último; as funções puras da E4a já em uso fora da batalha antes |
| R6. Ficha modelo de NPC ainda ligada a vários tokens (aventura antiga) | Condição posta num zumbi aparece em todos | Depende do conserto das variações (premissa); a conversão das condições do token só roda depois da migração das cópias |
| R7. Árvore suja por outros agentes | `net/protocol.ts`, `RpgDialogs.tsx`, `PixiCanvas.tsx`, `mapStore.ts`, `ligarFicha.ts`, `App.tsx` modificados agora | Cada etapa começa com `git status` desses caminhos limpo; commit só dos próprios caminhos |
| R8. Teto de 4 KiB da vaga no Worker | Vaga de arma com `regra` recusada no Lobby | Medir na E1 (2.3) |
| R9. Empurrar no mapa | Token empurrado atravessa parede, sai do piso ou cai em cima de outro | E6c usa as mesmas regras de passo (`lib/movementRules.ts`) e Desfazer; gesto com parede |
| R10. Disco | Build falha com o C: quase cheio (12 GB hoje) | Conferir 8 GB livres antes de cada build |
| R11. Acervo do app x regra por sistema | O mesmo item com dano diferente em dois livros | A2; Confira com os dois números |

### 4.2 Decisões que o protótipo não respondeu (com a recomendação)

- **A1. Como a regra do item chega ao Worker do Lobby, que não tem o Acervo.** Recomendado: instantâneo `regra` na vaga, escrito só pelo app do mestre ao salvar no Acervo e ao publicar; o Worker recusa `regra` vinda do jogador. Rejeitado: um Acervo recortado por campanha no Worker (tabela nova e junção na luta, mais trabalho para o mesmo resultado).
- **A2. Dragon Ball e outros sistemas.** Recomendado: fora deste rework. O inventário próprio do Dragon Ball (`FichaDBT.inventario`) fica como está e o achado Nº 5 segue pendente. O item do Acervo tem uma regra só; se catálogos de sistemas diferentes derem números diferentes para o mesmo item, vale o do One Piece e o outro vai para o Confira.
- **A3. Token sem ficha.** Recomendado: continua com mochila e condições no próprio token (é o único lugar que existe). O "Ligar ficha" leva as duas coisas para a ficha.
- **A4. Vaga editada à mão pelo mestre** (nome ou descrição diferentes do Acervo, decisão Nº 11 de 25/11). O protótipo não tem editor de vaga ("mudou aqui, muda em todo lugar"). Recomendado: o editor de vaga sai; o texto diferente vira `notaDaVaga`, mostrada embaixo do item, com Confira. Nada se perde.
- **A5. Empurrar.** O protótipo empurra sozinho; o app hoje não move (só lembra). Recomendado: mover de verdade na E6c, pela regra de passo, com Desfazer; sem casa livre, o registro diz "não tinha para onde ser empurrado".
- **A6. O que o jogador faz no site do Lobby.** Recomendado: o que já fazia (pôr item, mudar quantidade e moedas; plano lobby-jogadores §4.7) mais Equipar, Guardar e Recarregar fora da batalha. Usar consumível e Dar a outra ficha só na mesa (precisam do host).
- **A7. Sem arma equipada.** Recomendado: o ataque Desarmado de hoje (`ALCANCE_DESARMADO`, `lib/batalha/alcanceDoCartao.ts:37`) continua no Atacar.
- **A8. Pente da arma que sai da mochila (dar, vender, largar).** Recomendado: as balas do pente voltam antes para a mochila de quem tinha; a arma vai vazia.
- **A9. Relatório de conversão da E1.** É ferramenta só de leitura, não teste. Recomendado: fazer (é a única prova de "nada se perdeu" sem abrir ficha por ficha). Precisa do ok do dono por causa da regra "nenhum teste sem pedido".
- **A10. Condições na luta de treino do Lobby.** Recomendado: o treino começa sem as condições da ficha e não grava nenhuma de volta (treino não deixa marca).
- **A11. A mesma ficha de jogador em dois tokens com condições diferentes** (dado antigo). Recomendado: une as duas listas e marca Confira.
