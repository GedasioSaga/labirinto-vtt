# Editor de desafio (página Jogos): bugs, decisões e plano

Data: 21/11/2026, 01h. Pedido do dono (21/11): "mesmo que eu coloque Fogo na floresta o nome fica Dança com Dona Ziza [...] esse negócio de nome, quem pede ajuda, fala e nome da floresta é uma droga".

- Protótipo: `docs/design/jogos/editor-de-desafio.html` (abrir no navegador; arquivo único).
- Nenhum código do app foi alterado nesta etapa. A construção no app vem depois da aprovação do protótipo.
- As linhas citadas são do commit `ae8329a9`. Outra sessão está mexendo agora em `lib/desafios.ts`, `PaginaJogos.tsx`, `lib/mapFile.ts` e `PixiCanvas.tsx` (tamanho e arrasto do selo, sem commit): por isso cada item traz também o nome da função.

## 1. Por que o nome fica "Dança com Dona Ziza"

Três coisas somadas:

1. "Novo desafio" não pergunta o jogo: cria sempre uma Dança (`PaginaJogos.tsx:264-270`, `criar`), que nasce com o nome "Dança com Dona Ziza" (`lib/desafios.ts:181-184`, `novoDesafio`).
2. O nome é calculado uma vez, na criação. Trocar o jogo grava só o `minigame`; o nome só é refeito quando a alavanca troca de cena (`lib/desafios.ts:203` e `nomeNaCenaNova`, linhas 38-41).
3. A ficha mostra o nome como o primeiro campo de texto, sem dizer que ele ficou velho.

Conferido rodando as funções puras do app fora do repo (script em scratchpad, sem arquivo de teste): `novoDesafio('danca')` trocado para fogo sai `{"nome":"Dança com Dona Ziza","jogo":"fogo","npc":"Guarda Florêncio"}`.

Correção ao que veio no pedido: quem desafia e a fala **não** ficam os da dança ao trocar de jogo. `trocarJogoDoMinigame` (`lib/pins.ts:220-222`) põe o desafio padrão do jogo novo. O que fica velho é só o nome. O problema da fala é o oposto: tudo que o mestre escreveu some sem aviso (item B4).

## 2. Lista de bugs e comportamentos estranhos

Gravidade: Alta = o jogo fica errado ou sem saída para o mestre ou o jogador; Média = confunde ou perde trabalho; Baixa = acabamento.
Prova: "rodado" = conferido com as funções puras do app (saída na seção 6); "lido" = só leitura do código.

| # | Grav. | O que acontece | Como ver (1 linha) | Onde | Prova |
|---|---|---|---|---|---|
| B1 | Alta | O nome não segue o jogo | Novo desafio, Jogo = Fogo na Floresta: o título continua "Dança com Dona Ziza" | `lib/desafios.ts:203` (`atualizarDesafio`), `:38-41` (`nomeNaCenaNova`) | rodado |
| B2 | Alta | Todo desafio novo nasce Dança com Dona Ziza | Aba Ação, "Novo desafio": já aparece na lista como dança, antes de qualquer escolha | `PaginaJogos.tsx:264-270` (`criar`) | lido |
| B3 | Alta | Puzzle novo herda o progresso de outro puzzle | Puzzle resolvido por Lia, trocar para Dança e voltar para Puzzle: a Fonte nova já está "Resolvida por Lia" | `lib/desafios.ts:202` (`{ ...atual, ...patch }` não limpa `progressoDoPuzzle`); só a leitura do disco limpa (`lib/mapFile.ts:383`) | rodado |
| B4 | Alta | Puzzle sem lugar, sem aviso | Dança "Sem lugar", trocar para Puzzle: fica "Sem lugar" marcado, ninguém consegue jogar e nenhuma etiqueta avisa | `PaginaJogos.tsx:420-422`, `lib/desafios.ts:241-245` (`faltaNoLugar` devolve `null`) | rodado |
| B5 | Alta | A tela diz "Jogador toca no pino" num desafio sem lugar | Tiro novo: "Como começa" marca "Jogador toca no pino" e explica "quem pisa no pino vê o convite", mas sem lugar só o mestre começa | `MinigameControls.tsx:1074-1080` (e `:1000-1006`, `:1212-1218`, `:1307-1313`) contra `lib/desafios.ts:236-238` (`entradaDoDesafio`) | rodado |
| B6 | Alta | Cartão do jogador fala da ponte na cena do canhão | Alavanca, cena "Canhão do chão": o jogador lê "Uma alavanca diante da ponte levadiça erguida" | `minigames/registro.ts:157` (o recorte não leva a cena), `player/PlayerPinCard.tsx:191`, `:206` | rodado |
| B7 | Alta | Trocar de jogo com partida aberta deixa a partida sem painel | Dança ao vivo, trocar o Jogo para Pesca: o painel da dança some e a dança segue nos jogadores | `MinigameControls.tsx:793` (sem trava), painel ao vivo só no jogo dele (`:1497-1501`) | lido, não reproduzido (precisa de mesa aberta) |
| B8 | Média | Trocar de jogo apaga tudo que o mestre montou, sem aviso | Escrever a fala e importar música na Dança, clicar em Pesca e voltar para Dança: voltou o padrão | `lib/pins.ts:220-222` (`trocarJogoDoMinigame`), grade sempre à mão em `MinigameControls.tsx:787-794` | lido |
| B9 | Média | O nome não segue quem desafia | Trocar "Dona Ziza" por "Capitã Íris": o nome continua "Dança com Dona Ziza" | `lib/desafios.ts:25-31` (`nomePadraoDoDesafio` só roda na criação) | rodado |
| B10 | Média | Nome vazio é aceito | Apagar o campo Nome: título e linha da lista ficam em branco até reabrir o mapa | `PaginaJogos.tsx:438`, `lib/desafios.ts:195-206`; o conserto só existe na leitura (`lib/mapFile.ts:386`) | rodado |
| B11 | Média | A porta da dança sobra em jogo que não abre porta | Dança com porta ligada, trocar para Pesca: `portaLigada` continua gravada e volta a valer ao trocar para Alavanca ou Puzzle | `App.tsx:3044` (grava só `minigame`), `lib/desafios.ts:202` | rodado |
| B12 | Média | Cartão do jogador se chama "Minigame" em todo jogo | Encostar em qualquer selo: o título é "Minigame", nunca o jogo | `player/PlayerPinCard.tsx:549-550`, `:619`; leitor de tela diz "controle de videogame" (`:222`) | lido |
| B13 | Média | A fala só chega ao cartão no Fogo e na Bolha | Mesma fala escrita na Pesca e no Fogo: no selo, só a do Fogo aparece | `minigames/registro.ts:93`, `:106`, `:118`, `:157` contra `:131`, `:143-144`; `PlayerPinCard.tsx:799-805` | lido |
| B14 | Média | Fogo não tem "Como começa" e o código se contradiz | Selo do Fogo: o jogador sempre apaga sozinho; a ficha não mostra nem deixa mudar. O tipo grava `entrada: 'mestre'`, o registro devolve `'pino'`, o comentário diz "sempre o mestre chama" | `minigames/fogo/tipos.ts:61`, `:80`; `registro.ts:130-131`; `lib/mapFile.ts:539`; `MinigameControls.tsx:1117-1121` | lido |
| B15 | Média | Apagar desafio não pergunta | "Apagar desafio": some na hora, mesmo com partida aberta | `PaginaJogos.tsx:431-434`, `:477-479` | lido |
| B16 | Média | Bolha: trocar o cenário deixa a fala do outro | Cenário = Casa: a fala segue "uma faísca pegou no capim da clareira" (a alavanca troca, a bolha não) | `MinigameControls.tsx:1210` contra `minigames/alavanca/tipos.ts:109-118` (`alavancaNaCena`) | lido |
| B17 | Média | Prêmio e consequência de fábrica citam o NPC de fábrica | Bolha, trocar quem pede ajuda: o prêmio segue "Dona Aurélia agradece..."; Pesca: "o barqueiro conta..." | `minigames/bolha/tipos.ts:77`, `minigames/pesca/tipos.ts:64` | lido |
| B18 | Média | Trocar para Puzzle faz o desafio sumir da aba | Aba Ação, abrir um desafio, trocar para Puzzle, voltar: a lista da Ação não tem mais o desafio | `PaginaJogos.tsx:256-257` | lido |
| B19 | Baixa | Palavra "pino" onde hoje é selo | "Jogador toca no pino", "encostado no pino", "cartão do pino", "Encoste no pino" | `MinigameControls.tsx:239`, `:255`, `:1004`, `:1078`, `:1216`, `:1255`, `:1311`; `PlayerPinCard.tsx:196-214` | lido |
| B20 | Baixa | Mesma coisa com nomes diferentes | "Quem desafia" / "Quem pede ajuda"; "Fala do desafio" / "Fala"; "Dificuldade" / "Dificuldade permitida"; "Jogador escolhe" / "O jogador escolhe" / "Escolho na hora" | `MinigameControls.tsx:196`, `:226`, `:265`, `:984`, `:990`, `:1064`, `:1086`, `:1134`, `:1151`, `:1410` | lido |
| B21 | Baixa | Lista de jogos duplicada e diferente do registro | A grade diz "Alavanca"; o registro, "Alavanca da ponte" (e existe a cena do canhão) | `MinigameControls.tsx:215-223` contra `minigames/registro.ts:149` | lido |
| B22 | Baixa | Convite com fala vazia mostra "…" | Apagar a fala na Pesca ou no Tiro e chamar: aparece "…"; na Dança, um parágrafo vazio; os nomes de quem falta também variam | `minigames/pesca/tela/Telas.tsx:130`, `:134`; `minigames/tiro/tela/Telas.tsx:140`, `:144`; `minigames/danca/tela/Convite.tsx:71`, `:75` | lido |
| B23 | Baixa | Retrato fixo do jogo | Chamar o desafiante de "Capitão Barbudo": o convite segue com o retrato da Dona Ziza | `minigames/danca/tela/Convite.tsx:69`, `minigames/pesca/tela/Telas.tsx:53` | lido |
| B24 | Baixa | "Quantos giram juntos" parece regra, mas não grava | Alavanca: marcar 3, fechar e abrir a ficha: volta para 1 | `MinigameControls.tsx:1284`, `:1347-1351` | lido |
| B25 | Baixa | Marcar objeto: clique fora não diz nada | "Objeto", clicar no chão: nada acontece, nenhuma dica | `pixi/PixiCanvas.tsx:5286` (`marcarDesafioNoClique`) | lido |
| B26 | Baixa | Texto do Fogo fixo na "vila" | Floresta sem vila: o convite diz "Se salvarem a vila" e a ficha "Prêmio (salvou a vila)" | `minigames/fogo/tela/FogoOverlay.tsx:331`, `MinigameControls.tsx:1158` | lido |
| B27 | Baixa | Desafio novo não tem descrição, foto nem "só de perto"; o migrado tem e não dá para editar | Desafio que veio de pino ▷ com descrição: o texto continua no cartão do jogador e não há campo para mudar | `lib/desafios.ts:116` (`pinoDoDesafio`), `PaginaJogos.tsx:471-475` | lido |
| B28 | Baixa | Duas regras CSS com o mesmo nome | `.pp-pincard__fala-quem` existe para o pedido de ajuda e para as falas do pino "?": a segunda passa o nome de quem pede para maiúsculas e 0,8em | `player/player.css:3662` e `:8009` | lido, não vi na tela |
| B29 | Baixa | Subtítulo da ficha em minúsculas | "Desafio de fogo na floresta", "Desafio de alavanca da ponte" | `PaginaJogos.tsx:437` | lido |
| B30 | Baixa | `piso` do ponto antigo fica ao mudar para objeto ou sem lugar | Selo no 2º andar, "Sem lugar": `piso: 2` continua gravado | `pixi/PixiCanvas.tsx:5283-5287` | lido, efeito não medido |

## 3. O desenho novo, em uma frase

O mestre escolhe o jogo primeiro, e a ficha é a carta que o jogador recebe: quem chama, o que diz e onde é ficam num bloco só ("O convite"), com a prévia do jogador ao lado mudando a cada tecla.

Por que assim: os quatro campos soltos de hoje (nome, quem pede ajuda, fala, nome da floresta) são partes de uma coisa só, o convite que o jogador lê. Soltos, eles não mostram para que servem, mudam de rótulo de jogo para jogo e ficam velhos sem aviso. Juntos, com a forma do convite e a prévia ao lado, o mestre vê o resultado em vez de imaginar.

## 4. Decisões de design

Todas são **decisão do Claude, para o dono confirmar**. No protótipo todas estão funcionando.

1. **Jogo primeiro.** "Novo desafio" abre a lista dos 7 jogos. Nada entra no mapa antes da escolha. (Conserta B2.)
2. **Nome automático.** O nome segue o jogo, a cena da alavanca e quem chama ("Fogo na Floresta com Guarda Florêncio"; sem ninguém, "Pesca: Poço Afogado"). Sai do formulário e vira o título da ficha, com um lápis. Vira "nome seu" só quando o mestre escreve; apagar o texto volta ao automático. (B1, B9, B10.)
3. **Trocar de jogo guarda, não apaga.** O que era do jogo de antes fica guardado e volta igual se o mestre voltar; a ficha avisa e oferece "Desfazer a troca". A grade de jogos sai do topo da ficha e vira o botão "Trocar". Proposta: guardar só enquanto o app está aberto, não no arquivo do mapa (a música importada é pesada). (B8.)
4. **O que passa para o jogo novo.** Só o que é do desafio: o lugar no mapa, quem chama (se o mestre escolheu) e o nome (se o mestre escreveu). Fala, lugar do convite, regras, prêmio e porta são do jogo. (B3, B11, B16.)
5. **Um bloco "O convite".** "Quem desafia", "Quem pede ajuda", "Fala", "Fala do desafio", "Nome do lago", "Nome da barraca", "Nome da floresta" e "Lugar" viram: quem chama, o que diz, lugar no convite. O verbo ("pede ajuda", "desafia para uma dança") é automático. (B20.)
6. **Quem chama vem das fichas.** O mestre escolhe uma ficha da cena, uma do acervo, só um nome, ou ninguém (o convite vira narração, que é o caso da alavanca hoje). O retrato da ficha vai para o convite. (B23.)
7. **Exemplo com etiqueta.** O desafio novo vem pronto para jogar com o personagem, a fala e o lugar de exemplo do jogo, marcados "exemplo do jogo". Exemplo segue o jogo e a cena; o que o mestre escreve, não. "Começar em branco" limpa os três. (B16, B17.)
8. **Sugestões de fala.** Três falas prontas por jogo (e por cena, na bolha e na alavanca), em um clique.
9. **"Lugar no convite" opcional.** Um campo só para pesca, tiro, fogo e alavanca; a dança e a bolha não têm. Vazio, o convite sai sem ele (hoje sai "Lago sem nome").
10. **Onde fica e como começa juntos.** "Sem lugar" passa a "Fora do mapa". A ficha nunca mostra escolha impossível: fora do mapa, explica que só o mestre chama; na dança, no fogo e no puzzle, diz a regra em uma frase. O puzzle novo já entra pedindo o lugar, e sem lugar ganha a etiqueta "Falta o lugar no mapa". (B4, B5, B14, B25.)
11. **Prévia "O jogador vê".** Painel ao lado do mapa enquanto a ficha está aberta: 1) o cartão ao encostar no selo, 2) o convite. Atualiza a cada tecla. No app, a proposta é reusar as telas de convite de verdade com os dados da ficha.
12. **Cartão do jogador.** O título passa a ser o jogo ("Fogo na Floresta"), não "Minigame", e a fala de quem chama aparece no cartão de todos os jogos, não só no fogo e na bolha. **Atenção: esta muda o que vai para o jogador.** Hoje a fala da dança, da pesca e do tiro só aparece no convite. (B6, B12, B13.)
13. **Apagar pergunta no lugar.** "Apagar desafio" vira "Apagar mesmo / Manter", sem janela. (B15.)
14. **Uma palavra para cada coisa.** "Selo" no lugar de "pino"; "Dificuldade"; "O jogador escolhe" / "Você escolhe ao chamar". (B19, B20, B21.)
15. **Continua na página do livro.** A ficha cabe nos 262 px da página (medido nos 7 jogos, nada vaza). Não vira tela cheia, porque o mestre precisa do mapa para marcar o lugar.
16. **"Quantos giram juntos" sai da ficha.** É só uma calculadora da chance; proponho levá-la para junto do "Chamar para a alavanca". No protótipo já não aparece. (B24.)

Fora do protótipo, de propósito: o editor do puzzle (tela cheia que já existe), a música importada de verdade (o protótipo só mostra o nome do arquivo), o painel ao vivo de cada jogo (botão desligado, com o motivo escrito) e as abas Ação, Objetos e Puzzles.

## 5. Plano de implementação no app

Três entregas, cada uma publicável sozinha. As duas primeiras não mudam o que o jogador vê, salvo os itens marcados.

### Entrega 1: consertos, sem tela nova

| Arquivo | Mudança |
|---|---|
| `client/src/types/map.ts` (`Desafio`) | campo opcional `nomeProprio?: true` |
| `client/src/lib/desafios.ts` | `nomeAutomatico(desafio)`; `atualizarDesafio` refaz o nome quando não há `nomeProprio`, troca nome vazio pelo automático, tira `progressoDoPuzzle` e `portaLigada` na troca de jogo; `faltaNoLugar` acusa o puzzle sem lugar |
| `client/src/lib/mapFile.ts` | lê e grava `nomeProprio`; migração da seção 5.4 |
| `client/src/minigames/tipos.ts`, `registro.ts` | `MinigameVisivel.cena?` para a alavanca; nomes dos jogos só no registro |
| `client/src/player/PlayerPinCard.tsx` | título pelo jogo; textos da alavanca por cena; "selo" nos textos |
| `client/src/components/MinigameControls.tsx` | tira a lista `JOGOS` duplicada; trava a troca de jogo com partida aberta; rótulos iguais |
| `client/src/components/livro/PaginaJogos.tsx` | confirmação do apagar; "Novo desafio" abre a escolha do jogo |

Aceite: os itens B1, B3, B4, B6, B9, B10 e B11 deixam de aparecer no script da seção 6 (os mesmos 10 passos, com a saída certa).

### Entrega 2: a ficha nova

| Arquivo | Mudança |
|---|---|
| `client/src/components/livro/PaginaJogos.tsx` | `EscolhaDoJogo` (nova e troca), cabeçalho com nome automático e lápis |
| `client/src/components/livro/desafio/` (novo) | `BlocoDoConvite`, `BlocoOndeEComoComeca`, `BlocoDoQueVale`, e um `Regras<Jogo>` por jogo, saídos de `MinigameControls.tsx` |
| `client/src/components/livro/paginaJogos.css` | o bloco do convite, as sugestões, a escolha de quem chama |
| `client/src/minigames/registro.ts` | por jogo: verbo, campo do lugar do convite (`lago`, `barraca`, `floresta`, `lugar`), falas sugeridas, exemplo |
| `client/src/stores/desafiosStore.ts` | escolha do jogo aberta; o que ficou guardado de cada jogo, por desafio, só na memória |
| `client/src/components/livro/FichaDoPino.tsx`, `minigames/pesca/tela/vitrine/vitrine.tsx` | seguem usando `MinigameControls`: conferir antes de dividir o arquivo |

### Entrega 3: quem chama com ficha, e a prévia

| Arquivo | Mudança |
|---|---|
| `client/src/types/map.ts` | `Desafio.quem?: { nome: string; retrato?: string; tokenId?: string; acervoId?: string }` |
| `client/src/lib/tokenPhoto.ts` | a cópia pequena do retrato (a mesma regra de `Token.imageData`) |
| `client/src/net/protocoloDaDanca.ts` e os convites de pesca, tiro, fogo, bolha e alavanca | `retrato?` opcional no convite |
| telas de convite de cada jogo | usam o retrato quando vem; sem ele, o desenho de hoje |
| `client/src/components/livro/desafio/PreviaDoJogador.tsx` (novo) | o painel "O jogador vê", com as telas de verdade |
| `client/src/minigames/registro.ts` | a fala no recorte de todos os jogos (decisão 12, só se o dono confirmar) |

### 5.4 Migração: nada do que está salvo se perde

- **Nome.** O campo `nome` continua no arquivo, igual. Na leitura de arquivo sem `nomeProprio`:
  - nome igual ao de fábrica do jogo atual: vira automático;
  - nome igual ao de fábrica de **outro** jogo ("Dança com Dona Ziza" num desafio de Fogo; a lista tem 8 nomes): vira automático. É isto que conserta os mapas que já estão errados;
  - qualquer outro texto: é do mestre, ganha `nomeProprio` e não muda.
- **Quem chama.** Sem `quem`, vale o `minigame.npc` de hoje, como "só um nome". O `npc` continua sendo gravado, então uma versão antiga do app abre o mapa novo.
- **Fala, lago, barraca, floresta, lugar, prêmio, consequência, música.** Ficam onde estão, com os mesmos nomes. Só a tela muda.
- **`portaLigada` e `progressoDoPuzzle`.** A leitura não apaga nada. Passam a sair só quando o mestre troca de jogo, e essa troca entra no Ctrl+Z.
- **`eraPino`.** Intocado: o cartão do desafio migrado continua igual para o jogador.
- **Formato.** Todos os campos novos são opcionais; a versão do arquivo não muda.
- **Textos de fábrica.** Os desafios salvos guardam o texto por extenso; mudar os exemplos (B17) só vale para desafio novo.

## 6. Provas

Funções puras do app, rodadas fora do repo (esbuild + node, sem arquivo de teste no projeto):

```
1 novo desafio           : {"nome":"Dança com Dona Ziza","jogo":"danca","lugar":"nenhum"}
2 depois de Fogo         : {"nome":"Dança com Dona Ziza","jogo":"fogo","npc":"Guarda Florêncio"}
3 npc trocado            : {"nome":"Dança com Dona Ziza","npc":"Capitã Íris"}
4 nome apagado           : {"nome":""}
5 porta na pesca         : {"jogo":"pesca","portaLigada":"parede-7"}
6 progresso na dança     : {"encaixes":{},"erros":2,"resolvido":{"por":"Lia","quando":1},"rev":3}
7 puzzle NOVO c/ progresso: {"encaixes":{},"erros":2,"resolvido":{"por":"Lia","quando":1},"rev":3}
8 puzzle sem lugar       : {"lugar":"nenhum","falta":null}
9 tiro sem lugar         : {"entradaGravada":"pino","entradaDeVerdade":"mestre"}
10 recorte do canhão     : {"jogo":"alavanca","entrada":"mestre"}
```

Protótipo num Chromium de verdade (1366x768, Playwright com o Chromium 1243 já instalado):

- 35 conferências de comportamento, 35 passaram (jogo primeiro, nome segue jogo e quem chama, troca guarda e volta, desfazer, nome vazio volta ao automático, marcar ponto e objeto, Esc, puzzle pede lugar, setas do teclado, nada vaza dos 262 px nos 7 jogos). Nenhum erro no console.
- Troca de jogo 36 vezes (22 pela barra, 14 pelo "Trocar") mais uma fala inteira digitada: 461 quadros, p50 16,7 ms, **p95 16,8 ms**, máximo 17,1 ms, **nenhuma tarefa longa** (a régua é 200 ms).
- 5 prints, só para o layout.

Revisão do movimento (regra da casa):

| Antes | Depois | Por quê |
|---|---|---|
| `@keyframes` na entrada dos blocos ao trocar de jogo | `transition` + `@starting-style`, 180 ms, 4 px | Troca seguida recomeçava do zero; entrada só de opacidade parecia vir do nada |
| `transition` na seta do "quem chama" | removida | O botão é redesenhado ao abrir: a transição nunca tocava |
| Selo com fade ao aparecer | sem animação | O mapa é redesenhado a cada tecla: o selo piscava enquanto se digitava |

## 7. O que não foi verificado

- O app não foi aberto: os bugs marcados "lido" vêm só do código. B7 (trocar de jogo com partida aberta) e B28 (maiúsculas no nome de quem pede ajuda) precisam de mesa aberta para confirmar.
- O protótipo foi medido em Chromium sem tela (60 Hz). O dono ainda não clicou: a aprovação é dele.
- Retrato de ficha no convite (decisão 6): no protótipo é um disco com as iniciais. O caminho no app (`Token.imageData`) foi lido, não experimentado.
- Leitor de tela: rótulos, papéis e foco estão no código do protótipo; não foi ouvido com NVDA.
- Contraste dos textos apagados (`#858480` sobre o papel escuro) é o do app; não foi medido de novo.
