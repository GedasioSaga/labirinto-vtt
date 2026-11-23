# Alcance: as casas que acendem na batalha (22/11/2026)

Plano do arquiteto-solucoes para o protótipo aprovado (`tmp/proto-alcance/fonte.html`) e as decisões finais do dono.
Nada de código aqui. Implementa o `programador` (lib, host e rede) e o `programador-frontend` (telas e Pixi).
Nenhum Rust previsto.

## Em uma página

- **Uma função pura acende as casas** (`lib/batalha/alcance/`): a mesma conta no host, no mestre, no jogador, no
  Testar do editor e no treino do Lobby. A mira pré-marca quem está nas casas acesas e o host confere com a mesma
  função. Assim nenhum lugar diz uma coisa e outro diz outra.
- **Parede corta pela regra da visão que já existe**: `visionSegments` + `hasLineOfSight` (`lib/visibility.ts`), a
  "porta única" de toda conta de olhar. Janela e porta aberta deixam passar; porta fechada e secreta cortam.
- **Cor:** azul quando dá dano (mesmo com efeito junto), verde claro quando não dá (ajuda, atrapalha, cura).
- **As casas só mostram.** Alvo fora delas abre "Fora do alcance, usar mesmo assim?". Confirmado, o pedido vai com
  `foraDoAlcance: true` e o host aceita. Hoje o host recusa; passa a recusar só sem a confirmação.
- **Todos veem:** mensagem nova e leve `batalha.mira` (como o laser), fora do `batalha.estado`. O host resolve a forma
  pelo cartão dele e repassa só a forma, a cor e a direção, nunca o nome da técnica, e só a quem enxerga a ficha.
- **Formas:** as de hoje (alvo até N, linha, em volta, quadrado à frente, área num ponto ou numa ficha) e 3 novas:
  cruz, leque (1, 3, 5 por fileira) e anel (de N a M). As novas também decidem quem é atingido.
- **Condições mudam o alcance:** +N, -N ou "no máximo X", cada uma com escopo (tudo, só armas, só habilidades, só
  itens). Ordem: somas, depois o teto, nunca abaixo de 1. Aviso "Alcance 6 → 4 (Ofuscado)".
- **Os antigos sem alcance:** o Claude propõe um alcance por entrada lendo o texto, o app guarda backup, mostra a lista
  e só grava no Confirmar (o mesmo jeito do "Juntar as armas").
- **Grade quadrada só.** Na hexagonal aparece só o número ("Alcance 4"), sem casas.

## 1. O que existe hoje (conferido no código)

| Peça | Onde | Observação |
|---|---|---|
| Forma do alvo da mecânica | `lib/batalha/mecanica/modelo.ts:94` (`FormaDoAlvo`) | `um`, `varios`, `linha`, `quadrado` (si/frente/ponto), `raio` (si/alvo/ponto) |
| Alcance da mecânica | `modelo.ts:115` (`alvo.alcance`), validação `:589-593` | Só no alvo escolhido e no centro da área longe; já é peça da versão 2 |
| Geometria da área | `lib/batalha/area.ts` (`casaNaAreaDaFicha`, `fichaNaArea`, `fichaPertoDoCentro`) | Mede da borda da ficha inteira; sem parede |
| Recusa do host | `lib/batalha/golpe.ts:782` (`motivoForaDoAlcance`), `:793-818` (`motivoDaAreaLonge`); item pelo mesmo caminho (`:502-505`) | Recusa alvo longe e alvo fora da área em volta do centro |
| Mira | `components/batalha/MiraDoGolpe.tsx` (estado local, direção por 4 chips), `EscolhaDoPonto.tsx` (grade HTML) | Alvo só por clique na ficha; a direção não vai ao host (`combate.ts:428`) |
| Pré-marcação e filtro | `components/batalha/dadosDoMenu.ts:1091`, `:1113`, `:1143` | Duas regras de área: a da tabela à mão (sem direção, vale qualquer lado) e a da montada (com direção) |
| Buraco | `dadosDoMenu.ts:900-903` | `golpe.alcance` só no cartão montado; o host confere qualquer cartão |
| Desenho no mapa | `pixi/alcanceDaBatalha.ts` (só o andar), mestre `PixiCanvas.tsx:2313-2335`, jogador `PlayerView.tsx:4584` | Cada tela calcula com as paredes que tem; sem mensagem de rede |
| Visão | `lib/visibility.ts:178` (`hasLineOfSight`), `:255` (`wallLetsSightThrough`), `:269` (`visionSegments`) | Usada pela névoa, luz, guarda NPC e a "Visão" da batalha |
| Editores | `components/batalha/MecanicaDaTecnica.tsx`, `blocos/BlocoDoAlvo.tsx:89-124`, `EfeitoDoItemCampos.tsx`, `EfeitoDaArmaCampos.tsx` | Alcance só em um/vários/raio com centro |
| Modelos com alcance | itens 23/25, técnicas 1/22, armas 0/20 (`mecanica/modelosDaArma.ts`) | |
| Fonte da arma | entrada de arma do catálogo do livro (`ARMAS-FONTE-UNICA.md`) | O cartão é cópia escrita pela fonte |
| Lobby | `lobby/nuvem/src/duelo.ts` importa o motor de `client/src/lib` | O Worker roda o mesmo motor: sai junto com o app |

## 2. Abordagens consideradas

| Ponto | Escolha | Rejeitada (e por quê) |
|---|---|---|
| Onde mora a conta | Uma função pura em `lib/batalha/alcance/` | Conta só na tela: o host veria outra coisa |
| Parede | `visionSegments` + `hasLineOfSight` | Paredes do andar (`paredesParaAndarDoJogador`): barranco, móvel e janela cortariam o tiro |
| Todos veem | Mensagem nova `batalha.mira` | Dentro do `batalha.estado`: reenvia o recorte inteiro a cada virada do mouse e entraria no salvar e no Desfazer |
| O que viaja | A forma já resolvida pelo host | As casas prontas: contariam paredes que o jogador não vê. O id da técnica: o jogador não tem o cartão do NPC |
| Fora do alcance | Host exige `foraDoAlcance: true` | Host sem conferir nada: um defeito da mira passaria calado |
| Anel | Campo `alcanceMinimo` no alvo escolhido | Forma nova separada: duplicaria toda a regra do "alvo até" |
| Cartão só de texto | Campo `alcance` no cartão | Montar mecânica para ~230 cartões de texto (a mecânica é tudo ou nada: mudaria o comportamento deles) |

## 3. Modelo de dados

### 3.1 A forma do alcance (uma só, usada por todos)

`FormaDoAlcance` em `lib/batalha/alcance/forma.ts`, o que a função das casas recebe:

| tipo | números | escolhe | muda com condição |
|---|---|---|---|
| `alvo` (um ou vários) | `ate`, `de?` (anel) | uma casa por alvo | `ate` (no anel só o máximo; abaixo do mínimo fica mínimo a mínimo) |
| `linha` | `ate` | a forma inteira | `ate` |
| `volta` (raio em quem usa; quadrado ímpar em quem usa = raio) | `ate` | a forma inteira | `ate` |
| `frente` (quadrado à frente) | `lado` | a forma inteira | não muda |
| `cruz` (nova) | `ate` | a forma inteira | `ate` |
| `leque` (novo) | `ate` | a forma inteira | `ate` |
| `ponto` / `ficha` (área longe) | `ate` (até o centro), `raio` ou `lado` da explosão | a casa ou a ficha do centro | só o `ate`; a explosão fica |
| `si` (só em quem usa) | nenhum | a própria casa | não muda |

A casa de quem usa acende quando a regra de hoje deixa ele ser alvo (`quem: 'si'`, ajuda que inclui quem usa, área
"todos" num ponto colado). Nenhum campo novo para isso.

### 3.2 De onde sai a forma: `alcanceDoCartao` (o único leitor)

Ordem fixa; o editor só grava num lugar por cartão:
1. **Mecânica montada válida** (`alvo.forma` + `alvo.alcance` + `alvo.alcanceMinimo`). A área que sai de quem usa já
   tem o tamanho como alcance (raio `casas`, linha `casas`, quadrado `lado`): nada novo para gravar.
2. **Tabela à mão** (`lib/batalha/mecanicasAMao.ts`, `area` e `alcance`): manda; o editor mostra "vem da regra à mão".
3. **Campo `alcance` do cartão** (novo, opcional) para o cartão só de texto e a arma não montada.
4. Nada: sem casas, a mira diz "Sem alcance definido" e o host não confere distância (como hoje).

Atacar desarmado = alvo até 1 (fixo no motor).

### 3.3 Mudanças no disco

| Onde | O quê | Compatibilidade |
|---|---|---|
| `mecanica/modelo.ts` | `FormaDoAlvo` ganha `cruz { casas }` e `leque { casas }`; `AlvoDaMecanica` ganha `alcanceMinimo?`; o selo ganha `alcance?` com `mexe` (soma ou teto), `n` e `vale` (tudo, armas, habilidades, itens) | **Versão 3** (`VERSAO_DA_MECANICA = 3`), gravada só quando a mecânica usa uma dessas peças (`precisaDaVersao3`, no molde de `precisaDaVersao2`). O app de antes lê 3 como "atualize o app" e o cartão fica à mão sem perder nada. Toda outra mecânica continua 1 ou 2 |
| Validação `modelo.ts:589-593` | Continua recusando `alcance` na área que sai de quem usa: ali o tamanho É o alcance | Nada muda no que já existe |
| `CartaoDaFicha` (`lib/personagem.ts:47`) e entrada do catálogo (`lib/livros/catalogo.ts`) | `alcance?: FormaDoAlcance` (objeto com `tipo`) | Campo opcional; leitor tolerante (torto = ignorado = "sem alcance"). Conferir se o leitor da ficha e o do Worker preservam chave nova ao salvar; se cortam, site e Worker saem junto (SISTEMA.md §12) |
| Arma | O `alcance` mora na entrada do catálogo e é copiado ao cartão pelo mesmo caminho da `mecanica` (`stores/armasNaFonte.ts`) | Uma fonte, cópia travada |
| `SeloParaJogador` (`lib/batalha/vistaDoJogador.ts:160`) | `alcance?` do selo | Aditivo; o jogador precisa para o aviso da própria mira |
| `condicoes.ts` (tabela por nome) | Coluna `alcance?`, vazia agora | A revisão das condições (Cego, Ofuscado...) é o lote SEGUINTE, separado |

### 3.4 Pedido de ação (`lib/batalha/combate.ts`, `PedidoDeAcao`)

`atacar`, `habilidade` e `item` ganham `direcao?: Direcao` (o lado que o mouse escolheu; o host passa a usar a mesma
direção que a mira) e `foraDoAlcance?: true`. Leitor em `net/protocoloDaBatalha.ts:500` (`lerPedidoDeAcao`).
O jogador recebe o pacote do próprio host (mesma versão); o treino do Lobby sai junto com o Worker.

## 4. A função das casas (`lib/batalha/alcance/`)

Arquivos, todos puros (sem store, sem rede, sem Pixi):

- `forma.ts`: tipos, `descreverAlcance` (as frases do protótipo: "Leque de 3 casas à frente", "De 3 a 6 casas,
  nunca colado") e `DIRECIONAIS` (linha, frente, leque).
- `condicoes.ts`: `alcanceComCondicoes(forma, grupo, selosAtivos)`: filtra pelo escopo, soma, aplica o menor teto,
  piso 1, devolve `{ forma, aviso, muda }` com o texto exato do protótipo (`fonte.html:517-534`), inclusive
  "sem mudança" e "o anel não fica menor que 3".
- `casas.ts`: `casasDoAlcance({ forma, quemUsa: PegadaNaGrade, direcao, segmentos, colunas, linhas })` e
  `casasDaExplosao(centro, forma, segmentos, ...)`. Regras de `dentroDaForma` do protótipo (`fonte.html:417-435`),
  medidas da borda da ficha inteira como `casaNaAreaDaFicha` (ficha grande: a linha tem a largura da ficha; o leque
  abre a partir dela, +2 por fileira). Parede: a casa acende se `hasLineOfSight` vale do centro de QUALQUER casa da
  ficha de quem usa até o centro da casa (o centro de uma ficha 2x2 cai na quina da grade, onde a ponta da parede
  cortaria tudo). Na explosão, a linha sai do centro escolhido.
- `quemEntra.ts`: `fichasNaForma(casas, candidatos, quem)`: a ficha entra se qualquer casa dela está acesa. Substitui
  `alvosNaAreaPelaGrade`, `alvosEmVoltaDoCentro` e `alvosNaAreaDaMira` (dadosDoMenu.ts) e a conferência do host.
- `cor.ts`: `corDoAlcance(acao)`: `azul` se a leitura de sempre (`leituraDaTecnica` / `mecanicaDoCartao`) tem dano, ou
  é Atacar; senão `verde`. É o único classificador "dá dano ou ajuda" do app.
- `segmentos.ts`: `segmentosDoAlcance(map, piso)` = `visionSegments` do mapa que a tela tem (o mestre: tudo; o
  jogador: o recorte). Guarda o último pela referência de `map.walls`, `props` e `carimbos`, como `criarCalculoDoAlcance`.
- `cores.ts`: as cores e medidas do protótipo, lidas pelo Pixi e pelo Testar.

Custo: caixa de até 41x41 casas (`CASAS_MAX = 20`) vezes os segmentos que cruzam a caixa (filtrados uma vez por
recálculo). Recalcula só quando muda a forma, a direção, a ficha ou as paredes. Meta: menos de 8 ms no maior mapa do
dono; nenhuma tarefa longa de 200 ms ou mais.

## 5. Host: de recusar para pedir confirmação

- `motivoDaAreaLonge` e `motivoForaDoAlcance` (`golpe.ts:782-818`) passam a medir pela função das casas (distância E
  parede). Alvo, centro ou ficha marcada fora das casas acesas: com `foraDoAlcance` passa; sem ele, recusa com
  "Fora do alcance: confirme para usar mesmo assim" (a mira abre a confirmação também nessa volta).
- Para a ficha de um jogador, o host mede com as paredes que ESSE jogador vê (o mesmo filtro `escondido` que a recusa
  do passo já usa, `obstaculosDeObjeto.ts:433`): a recusa não pode contar que existe parede secreta. Para o NPC, todas.
- O mesmo vale para `atacar` com arma (a arma agora tem alcance) e para `item` (passa por `podeAgir`).
- Quem é atingido nas áreas: a mira pré-marca com `fichasNaForma`; o host confere que cada marcado está nas casas (ou
  veio com `foraDoAlcance`). Desmarcar continua livre.
- O registro ganha "(fora do alcance)" na linha do golpe, para o mestre ver depois.
- `dadosDoMenu.ts:900-903`: `golpe.alcance` sai de `alcanceDoCartao` para QUALQUER cartão (fecha o buraco).
- A conferir pelo portão de ouro (SISTEMA.md §1): a leitura dos 241 cartões não muda; muda quem entra na área quando
  há parede no meio (antes atravessava). É o pedido do dono, mas vai no relatório da fase.

## 6. "Todos veem": a mira viaja

**Mensagem nova, aditiva** (`net/protocoloDaBatalha.ts`, no molde do laser, `net/protocol.ts:3650`):

- Jogador → host: `batalha.mira` com `tokenId`, a ação (`atacar` com `armaId?`, `habilidade` com `cartaoId`, `item`
  com `vagaId`), `direcao?`, `ponto?`, `centroId?`; ou `off: true`.
- Host → mesa: `batalha.miraNaMesa` com `tokenId`, a forma (já com as condições), a cor, `direcao?`, `ponto?` e
  `aviso?`; ou `tokenId` + `off: true`. Sem nome, sem id de cartão, sem número de dano.
- O host confere: é a vez dessa ficha? a ficha é de quem mandou? a ação existe na ficha? E resolve a forma pelo cartão
  DELE (o jogador não manda forma).
- **Privacidade:** o host manda a cada jogador só se a ficha de quem mira está no recorte dele (a mesma regra que
  decide se o token vai no recorte: camada, zona oculta, névoa, invisível). Cada tela calcula as casas com as paredes
  que tem, então nenhuma parede escondida vaza pelo desenho. NPC escondido mirando: o jogador não recebe nada.
- O mestre mirando com o NPC: a store local manda direto pelo host.
- Envia só ao abrir, ao virar (4 lados), ao escolher ponto ou centro e ao fechar. O passar do mouse (destaque forte e
  explosão em prévia) fica só na tela de quem mira. Teto de 10 mensagens por segundo por conta.
- Limpa sozinho quando a vez passa, o golpe sai, a ficha sai da cena ou a conexão cai.
- Jogador antigo ignora tipo desconhecido. O treino do Lobby mostra as casas só para quem mira (mandar ao adversário
  fica fora deste lote).

## 7. Tela: Pixi e a mira

### 7.1 Camada `pixi/alcanceDoGolpe.ts` (nova, ao lado de `alcanceDaBatalha.ts`)

Mesmo lugar no mestre e no jogador: `gradeDaBatalha.camada`, acima do alcance de andar e por baixo das fichas.
Enquanto há golpe na mira, o alcance de andar some (como no protótipo).

| Parte | Como no protótipo (`fonte.html:403-406`, `737-798`, `969-989`) |
|---|---|
| Casa acesa | Preenchimento `base` com recuo de max(1,5; casa x 0,04), contorno escuro 2 px, borda de dentro clara 1,25 px |
| Azul | base `#1664ec` 0,6; forte `#3088ff` 0,84; borda `#cdeeff`; contorno `#06122e` 0,6; brilho rgb(168,222,255) |
| Verde claro | base `#68de68` 0,58; forte `#96f28c` 0,86; borda `#ecffe2`; contorno `#0a280e` 0,62; brilho rgb(214,255,204) |
| Brilho que respira | Uma textura de degradê redondo por cor (feita uma vez), um sprite por casa num container; alfa 0,4 a 0,9 em 1,8 s, vai e volta, pelo ticker só enquanto há mira. Movimento reduzido: alfa fixo 0,65 |
| Mouse em cima (só local) | Casa forte com borda branca 2 px; em alvo e anel só a casa (ou a explosão); nas formas inteiras, todas |
| Mouse fora das casas | Contorno tracejado 6/5, 2 px, rgba(236,234,228,0,85) |
| Alvo escolhido | Cantos em latão `#f3ba66` 3 px sobre escuro 6 px, braço 0,3 casa |
| Direção | Seta triangular a meia casa do centro, na cor da borda, contorno escuro 3 px (só linha, frente, leque) |

Traços em px de TELA (o zoom refaz) e a chave de "nada mudou" como em `alcanceDaBatalha.ts:51`.

### 7.2 A mira (`MiraDoGolpe.tsx`) e a store

- **Store nova** `stores/batalha/miraNoMapa.ts`: a ação, a forma efetiva, a direção, o ponto, o alvo escolhido e o
  aviso. Dona: a mira de quem age. `MiraDoGolpe`, o Pixi e o envio da rede leem dela; ninguém guarda cópia. Outra
  store, só leitura, guarda a `miraNaMesa` que chegou.
- **Direção pelo mouse**: o lado em que o ponteiro está em relação ao centro da ficha (zona morta de 0,3 casa), e as
  setas do teclado. Os 4 chips de hoje ficam para quem não usa mouse.
- **Clique na casa**: em alvo e anel, a ficha naquela casa vira alvo; em área num ponto, a casa vira o centro (a grade
  HTML de `EscolhaDoPonto.tsx` fica só para a hexagonal e para sem mapa). Clique na ficha continua valendo.
- **Frase de cima** igual ao protótipo (`fonte.html:1034-1055`) e o aviso das condições.
- **Confirmação**: ao mandar com alvo, centro ou marcado fora das casas acesas, a caixa "Fora do alcance, usar mesmo
  assim?" com [Usar mesmo assim] e [Voltar]. A mesma caixa abre se o host devolver a recusa de fora do alcance.
- **Hexagonal**: sem casas; a frase diz "Alcance 4" e o host confere só a distância, como hoje.

## 8. Editores

- **`BlocoDoAlvo.tsx`**: a escolha "Forma do alcance" com os 7 desenhos do protótipo (alvo até, linha reta, em volta,
  quadrado à frente, cruz, leque, anel só longe) mais área num ponto e numa ficha. O número aparece em toda forma (na
  área que sai de quem usa, o tamanho é o alcance). A cor mostrada vem de `corDoAlcance`.
- **Cartão só de texto** (aba da ficha) e **entrada de arma do catálogo**: o mesmo seletor de forma, gravando o campo
  `alcance`. A arma montada grava na mecânica.
- **Selo**: "Muda o alcance" com Soma ou Máximo, o número e o escopo (tudo, só armas, só habilidades, só itens).
- **Testar**: grade pequena 13x13 com a ficha no meio, a forma acesa, a direção pelas setas, "Pôr uma parede" e uma
  condição para provar (`fonte.html:1418-1457`). Canvas 2D com as MESMAS cores (`lib/batalha/alcance/cores.ts`) e a
  MESMA função das casas.
- **Modelos** (`mecanica/modelosDaArma.ts` A01-A20 e os de técnica e item sem alcance) ganham alcance de fábrica.

## 9. Os antigos sem alcance: proposta, backup e Confirmar

1. O Claude (`especialista-dados`, só leitura) lê uma CÓPIA do `rpg.json` e dos catálogos e escreve, fora do repo
   (pasta de dados do app), `alcances-propostos.json`: por entrada, o id, o nome, a forma proposta, o trecho do texto
   que a justifica e "certeza alta ou baixa". Nenhum dado da campanha vai para o repo.
2. Botão "Dar alcance aos antigos" (página Itens do livro, ao lado do "Juntar as armas"): ensaio com a lista agrupada
   por ficha, cada linha editável e com "não mexer". Antes da primeira gravação, backup com data (como o índice
   guardado em `lib/acervoDeItens.ts:425`, nunca por cima).
3. **Confirmar** grava cada entrada no lugar certo pela ordem de 3.2 (mecânica montada, campo do cartão, entrada da
   arma, que reescreve as cópias). Cancelar não grava nada. Rodar de novo mostra só o que ainda falta.

## 10. Fases

Escritores em paralelo só em arquivos disjuntos, no máximo 3, direto na main (regra do projeto); cada um commita só os
próprios caminhos. Teste automático novo só se o dono pedir (regra de 27/10): a conferência de cada fase é por script
de rascunho em `tmp/` e pelo app.

| Fase | Quem | Arquivos | Pronto quando |
|---|---|---|---|
| **A. Função das casas** (junto com B) | `programador` | `lib/batalha/alcance/*` (novos) | Script em `tmp/` roda as funções do protótipo e as da lib em 500 casos sorteados (formas, direções, condições, sem parede e com parede na grade) sem diferença; sem parede: leque 3 = 9 casas, cruz 3 = 12, anel 3-6 = 144, em volta 1 = 8, quadrado 3 à frente = 9; `rtk proxy npx tsc --noEmit` limpo |
| **B. Modelo e leitores** (junto com A) | `programador` | `mecanica/modelo.ts`, `lib/personagem.ts`, `lib/livros/catalogo.ts`, `stores/armasNaFonte.ts`, `vistaDoJogador.ts`, `condicoes.ts` | Mecânica com cruz, leque, anel ou selo de alcance grava 3; sem elas grava o mesmo de antes; portão de ouro dos 241 cartões igual; ficha com `alcance` no cartão abre, salva e reabre igual |
| **C. Host e quem entra** | `programador` | `golpe.ts`, `combate.ts`, `protocoloDaBatalha.ts` (pedido), `dadosDoMenu.ts`, `area.ts`, `registro.ts`, `lib/treino/*` | Na Arena: alvo a 6 com alcance 5 sem confirmação = recusa; com `foraDoAlcance` = passa e o registro diz "(fora do alcance)"; alvo atrás de parede idem; em cada forma a mira pré-marca as mesmas fichas que o host aceita; portão de ouro igual |
| **D. Rede "todos veem"** (junto com E e F) | `programador` | `net/protocoloDaBatalha.ts` (mira), `net/batalhaNoHost.ts`, store `miraNaMesa` | Na visão de teste com 2 jogadores: B vê as casas da mira de A; NPC escondido mirando não chega a ninguém; a mensagem não tem nome nem id de cartão (conferido no fio); some ao passar a vez |
| **E. Pixi e mira** (junto com D e F) | `programador-frontend` (revisão do `designer-opus`) | `pixi/alcanceDoGolpe.ts`, `stores/batalha/miraNoMapa.ts`, `MiraDoGolpe.tsx`, `PixiCanvas.tsx`, `PlayerView.tsx`, `EscolhaDoPonto.tsx` | Folha de contato de 12 quadros (abrir, virar, mouse dentro e fora, alvo, confirmação) igual ao protótipo; p95 do quadro sem piora e nenhuma tarefa de 200 ms ou mais com a mira aberta no maior mapa; movimento reduzido sem respirar |
| **F. Editores e Testar** (junto com D e E) | `programador-frontend` | `blocos/BlocoDoAlvo.tsx`, `MecanicaDaTecnica.tsx`, `EfeitoDoItemCampos.tsx`, `EfeitoDaArmaCampos.tsx`, editor do cartão de texto, `EntradaDoCatalogoDialog.tsx`, editor do selo, modelos | Cada uma das 9 formas pode ser escolhida, salva e reaberta; o Testar acende as mesmas casas que a batalha para a mesma ficha (print lado a lado, 1 por forma nova); selo "-2 só armas" muda o Testar da arma e não o da técnica |
| **G. Os antigos** | `especialista-dados` (proposta), `programador-frontend` (tela) | ferramenta do ensaio, store da gravação | O ensaio lista todas as entradas sem alcance; o backup existe antes da 1ª gravação; Confirmar grava; reabrir mostra o proposto; rodar de novo lista só o que faltou |
| **H. Publicar e jogar** | `automacao-devops`, `verificador-realidade` | `scripts/publicar-versao.cjs`, site e Worker juntos | Item por item contra o texto do PEDIDOS; o dono joga uma rodada com mestre e 2 jogadores e responde: deu para ver? a cor bateu? a confirmação incomodou? |

Ordem: A e B juntas, depois C, depois D, E e F juntas, depois G, depois H. Nenhum Rust.

## 11. Riscos e como ver cedo

| Risco | Como aparece | O que fazer |
|---|---|---|
| Duas regras de área continuam vivas (tabela à mão sem direção e montada com direção) | A mira marca um, o host aceita outro | A fase C troca as três funções por `fichasNaForma`; a conferência mira x host é por forma |
| Ponta de parede na quina da grade corta casas a mais | Leque "picotado" encostado na parede | Regra "qualquer casa da ficha" e o caso da parede no script da fase A; se ainda picotar, a folga de `hasLineOfSight` (`MIN_HIT_DISTANCE`) decide |
| A tela do jogador e o host discordam (parede que só o host vê) | Jogador vê aceso e o host recusa | O host mede com as paredes que o jogador vê; sobra a corrida de porta abrindo, que cai na confirmação |
| A mira vaza ficha escondida | Casas acesas no escuro revelam o NPC | O filtro do recorte na fase D e o caso do NPC escondido no aceite |
| Leitor velho (site, Worker, app de antes) corta o campo `alcance` do cartão ao salvar | O alcance some depois de editar a ficha no site | Conferir o leitor na fase B; publicar app, site e Worker juntos (fase H) |
| Mecânica versão 3 no app de antes | "Atualize o app" no cartão | Esperado; só as mecânicas com peça nova gravam 3 |
| Recalcular a cada movimento do mouse | Quadro travando no mapa grande | Recalcula só ao virar de lado ou mudar ficha, forma ou paredes; o passar do mouse só redesenha o foco |
| Proposta automática errada nos antigos | Técnica com alcance absurdo | "Certeza baixa" destacada, edição por linha, backup e Confirmar |
| Condição muda quem é atingido na área em volta | Ofuscado encolhe o giro e alguém sai | É a regra pedida; o aviso "Alcance 2 → 1 (Ofuscado)" aparece na mira de quem usa |
