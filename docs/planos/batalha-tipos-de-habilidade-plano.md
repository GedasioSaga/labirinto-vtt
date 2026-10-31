# Batalha One Piece: Tipo da habilidade, Passiva, Buff/Debuff, Evolução, Escolha e Reação automática

Origem: pedidos de 31/10/2026 (rodada 2 de `scratchpad/saude/respostas.md`, fim de `PEDIDOS.md`).
Literais: (1) "É bom ter categoria desse tipo, porque passiva são efeitos que se ativam automaticamente no início do combate ou depois de um certo requisito, também é bom colocar uma parte de buff e debuff, tem certas habilidades que evoluem e tal e também tem habilidades que você pode escolher ou um ou outro". (2) Passo de Valsa: "Uma habilidade que você pode usar no lugar da reação, ele reage automaticamente."
Vale o princípio de 30/10: **parte automático, parte manual; toda automação tem o manual ao lado; o mestre corrige e desfaz tudo**.

## 0. Entendimento
A ficha One Piece guarda habilidade como texto livre. A batalha já lê ação, custo, tempo, dano, Overload, Perfurante e selo de duração. Falta dizer **como** a habilidade entra em jogo (usada no menu, ligada sozinha, no lugar da reação, muda números por um tempo, evolui, tem variantes) e a batalha agir conforme isso.

## 1. Premissas (medidas na ficha real em 31/10: 62 cartões de habilidade e técnicas de forma)
- Ação hoje: "Passiva" (3) + "Passiva (ativa-se automaticamente...)" (1); "Reação" puro (1, Passo de Valsa); duplas "Reação/Ação Completa", "Simples/Reação", "Reação/Ação Simples", "Reação/Completa", "OVERLOAD/REAÇÃO" (5).
- `lerAcao("Reação")` devolve `acao: null, tambemReacao: true`: o menu pergunta a ação e a Saúde diz "Tipo de ação desconhecido". Passo de Valsa está quebrado hoje.
- Evolução: 1 caso (CAÇA AS BRUXAS!, extras "Evolution" + "Condições do Evolution"); a versão evoluída já existe como cartão próprio "SUPER CAÇA AS BRUXAS!" (Ação OVERLOAD).
- Escolha: Medicina (Harvey) tem extra "Efeito 2"; Aplauso do Deus do Trovão (May) tem extras "Ação" e "Reação" (modo ataque x modo reação); Melodia (Siegfried) diz "optar por dois efeitos" só no texto.
- Requisito: 1 extra "Requisito" (Orquídea: Florescer). Gatilho por vida: Fortaleza (May), "Ao ficar abaixo de 50% de HP", com efeitos "a cada turno".
- Reações reais e o que o texto diz: Passo de Valsa "esquivar" + "marca de tinta contra o adversário"; Recuperação de forças "Anula o dano e 20% vira vida"; Aplauso (extra Reação) "Rebate ... Dano da Técnica Rebatida + Força"; Giro da Lança (extra Reação) "rola 1d20 de reação + Modificador"; Atração Relâmpago e Armadura Humana: o texto não diz o resultado.
- Jogador e host rodam o mesmo build (LAN, jogador servido pelo host): campos novos no fio entram opcionais, sem versão nova do protocolo.

## 2. Abordagens consideradas
**Onde mora o Tipo**
- (A, escolhida) **Campo novo "Tipo"** na aba Habilidades, com `opcoes` (o `FichaAbas` já desenha select para campo com opções, como a Categoria da arma). Vazio = inferido da Ação. Ficha antiga não muda no disco.
- (B, rejeitada) Ler só do campo Ação: Buff/Debuff não cabem lá, e "Simples/Reação" já mistura duas coisas.
- (C, rejeitada) Multi-marca (Passiva + Buff + Escolha num select): 7 opções que se combinam; difícil de entender e de validar.

Tipo é **um só** e diz como a habilidade entra em jogo: **Ativa, Passiva, Reação, Buff, Debuff**. **Evolução** e **Escolha** não são tipo: são **marcas** que aparecem sozinhas quando o cartão tem os extras certos. Assim "Passiva com escolha" (Melodia) e "Ativa que evolui" (CAÇA) funcionam sem combinar opções.

**Buff/Debuff**
- (A, escolhida) **Selo com modificador, só na sessão**: o `SeloDaBatalha` ganha `mods` ("FOR +20", "Dano +30", "Reação +3"). Vale em qualquer alvo (eu, aliado, inimigo), tem duração, já desfaz pelo registro, já aparece na carta para todos (Q5) e some quando a batalha acaba.
- (B, rejeitada) `ligarCartao` + `modificadores` do cartão (como a transformação): grava na ficha, só serve ao dono, não empilha, e se a batalha acaba sem desligar o buff fica na ficha.
- (C, rejeitada) Ajuste direto no atributo da ficha: mesmo problema de voltar, e mistura com o "+5" que o mestre põe na ficha.

**Escolha "um ou outro"**
- (A, escolhida) **Extras com nome convencionado** ("Opção ...", "Efeito N", "Variante ...") são as variantes; o Efeito do cartão é a opção 1. Sem schema novo; Medicina já funciona.
- (B, rejeitada) Subcartões dentro da habilidade: aba Habilidades com subcartões de si mesma, recursão em `tecnicasComForma` e no editor; caro para 3 casos.

**Evolução**
- (A, escolhida) Extras "Evolution" e "Condições do Evolution" (já usados) + extra novo opcional **"Evolui para"** com o nome de outra habilidade. O app não confere a condição (texto livre): mostra e dá o botão **Evoluir** (manual).
- (B, rejeitada) Conferir a condição sozinho: "Melodia ativa e caminho do dano ativo, ou ajuda de NPC com poder de fogo" não é legível.

## 3. Modelo de dados
### 3.1 Disco (ficha)
- `lib/sistemaOnePiece.ts`, aba `habilidades`: campo `{ id: "tipo", rotulo: "Tipo", forma: "linha", opcoes: ["Ativa", "Passiva", "Reação", "Buff", "Debuff"] }`, logo depois de `acao`. Aparece também no catálogo do livro (mesmo molde) sem código extra.
- Extras convencionados (por nome normalizado, sem acento e aparado): "Evolution"/"Evolução"; "Condições do Evolution"/"Condição da evolução"; "Evolui para" (novo); "Opção ...", "Efeito N", "Variante ..." (variantes); "Reação" (texto do modo reação; já existe em Giro e Aplauso); "Requisito" (já existe); "Gatilho" (novo, opcional, para passiva).

### 3.2 Leitura (`lib/batalha/leituraDaFicha.ts` + módulo puro novo `lib/batalha/tiposDaHabilidade.ts`)
- `type TipoDaHabilidade = "ativa" | "passiva" | "reacao" | "buff" | "debuff"`; `CAMPO_DO_TIPO = "tipo"`.
- `lerTipo(cartao): { tipo; inferido: boolean; tambemReacao: boolean }`. Ordem: campo Tipo preenchido vence; senão Ação começa com "passiva" = passiva; Ação só "Reação" = reacao; resto = ativa. `tambemReacao` = Tipo Reação ou `lerAcao().tambemReacao` (as duplas aparecem no menu E na caixa REAÇÃO).
- Exemplos (aceite): Passo de Valsa (Ação "Reação", Tipo vazio) = reacao, inferido. Giro da Lança ("Reação/Ação Completa") = ativa + tambemReacao. Fortaleza ("Passiva") = passiva. Melodia ("Passiva (ativa-se...)") = passiva. CAÇA AS BRUXAS! = ativa. Tipo "Buff" com Ação "Bônus" = buff que gasta a Bônus.
- Reação pura não gasta ação da vez (decisão 8): `lerAcao` de Ação só "Reação" passa a dar `acao: "livre"` com `tambemReacao`. A Saúde (`lib/livros/saude.ts`, `lerCampoDaAcao`) passa a ler "Reação" como lido, em vez de "desconhecido".

### 3.3 Sessão (`lib/batalha/combate.ts`, só campos opcionais)
- `ModDoSelo { alvo: string; delta: number }`: `alvo` = id de atributo do sistema, `"dano"` ou `"reacao"`. Tetos `MODS_POR_SELO_MAX = 4`, delta dentro de `DANO_MAX`.
- `SeloPedido` ganha `mods?`. `SeloDaBatalha` ganha `mods?`, `cartaoId?` (a habilidade que o pôs) e `natureza?: "buff" | "debuff" | "passiva" | "condicao"` (cor da pílula; ausente = condicao, como hoje).
- `CombateDoPersonagem` ganha `evoluidas?: readonly string[]` (cartaoIds base evoluídos nesta batalha) e `lembradas?: readonly string[]` (chaves "cartaoId:gatilho" já oferecidas, para não repetir o lembrete).
- `PedidoDeAcao`:
  - `habilidade` ganha `variante?: string` (nome do extra escolhido).
  - novo `{ tipo: "passiva"; cartaoId; ligar: boolean; alvoTokenId?: string; variante?: string; custo: number | null; selo?: SeloPedido; contraDe?: undefined }` (não gasta ação; vale fora da vez).
  - novo `{ tipo: "evoluir"; cartaoId; custo: number | null; contraDe?: undefined }` (ação livre).
- `PedidoDeReacao` novo `{ tipo: "tecnica"; golpeId; tokenId; cartaoId; saida: "esquiva" | "metade" | "contra" | "cheio"; custo: number | null; seloNoAtacante?: SeloPedido }`.
- `AlvoDoGolpe` ganha `tecnica?: { cartaoId: string; nome: string }` (registro: "Vincent esquivou com Passo de Valsa").
- Buff numa técnica usa o `selo` que o pedido `habilidade` já tem (agora com `mods`).

## 4. O que cada tipo faz na batalha
### (a) Tipo
| Tipo | Menu da vez | Caixa REAÇÃO | Efeito |
|---|---|---|---|
| Ativa | tira normal | só se `tambemReacao` | como hoje |
| Passiva | sai das técnicas; vai para a tira **Passivas** | não | ativar = selo "passiva" (com mods, se o texto der) |
| Reação | apagada: "Reação: use na caixa REAÇÃO" | **sim, no lugar do d20** | saída lida da ficha + custo, recarga, usos |
| Buff | tira normal; mira começa em **você**, aliados marcáveis, **sem reação** | não | selo buff com mods em cada alvo |
| Debuff | tira normal; mira em inimigo, **com reação** | não | selo debuff com mods, pega só se acerta (`pegaOSelo`) |

### (b) Passiva com gatilho (`tiposDaHabilidade.ts`, `gatilhoDaPassiva(cartao)`)
Lido do extra "Gatilho", senão do Tempo, senão do Efeito e da Ação:
- **inicio**: "início do combate", "ao iniciar", "automaticamente em combate" (sem número de rodada).
- **rodada N**: "início da 3ª rodada", "a partir do 3 turno" (Melodia = rodada 3).
- **vida abaixo de N%**: "abaixo de 50% de HP/vida" (Fortaleza = 50). Único requisito que o app confere sozinho.
- **requisito**: o resto (extra "Requisito", "ao atingir inimigos com disparos..."). O app NÃO confere: mostra o texto.
- **sempre**: Efeito/Tempo só "Passiva" ou "-" (Mecânicas gerais): nunca lembra, só lista.

O que o app faz (D3): no Iniciar (inicio), na virada para a rodada N (`passarVez` quando a rodada sobe) e depois de um dano que cruza o limiar de vida, o host olha as passivas dos combatentes e:
- custo lido (ou nenhum) e sem variante a escolher: **ativa sozinha**, com linha no registro ("Fortaleza ativou: HP abaixo de 50%") e Desfazer;
- senão: **lembrete** na tela do dono (e no painel do NPC, para o mestre): "Melodia pronta (rodada 3): Ativar / Agora não". Marca em `lembradas` para não repetir.
- Manual ao lado: a tira **Passivas (N)** no menu da vez e no perfil da carta lista todas, com estado (Ativa, Pronta, Espera + texto do requisito, Sempre) e **Ativar/Desligar** a qualquer hora. O mestre faz o mesmo por qualquer ficha.
- **Ativar** = cobra o custo (Melodia 15 SP), conta usos/recarga do Tempo se houver, e põe selo `natureza: "passiva"` no dono (ou no alvo escolhido, quando o texto diz "escolhendo um oponente"), com `mods` lidos do Efeito (ver c) e turnos de "por N turnos" (sem número = até desligar). **Desligar** = tira o selo.
- Visível: pílula dourada na carta da ordem ("Melodia"); a tira Passivas mostra quais estão ativas.
- Efeito "a cada turno" (Fortaleza: +30 HP e +10 FOR por turno): lembrete no começo da vez do dono com **Aplicar** (D5). Não aplica sozinho.

### (c) Buff/Debuff (`selos.ts` + `formula.ts`)
- `lerMods(texto, sistema)`: "+20 de Força", "-15 de Agilidade", "FOR +20", "+30 de dano", "+3 na reação" viram `ModDoSelo[]`. Atributo pelo nome ou abreviação do sistema. Duração por `lerDuracao` (já existe). Exemplos (aceite): "Ganha +20 de Força por 2 turnos" = [forca +20], 2. "O alvo perde 15 de Agilidade durante 3 rodadas" = [agilidade -15], 3. "+3 na reação" = [reacao +3], até tirar. "Causa 40 de dano" = [] (é dano, não mod).
- A mira de Buff/Debuff mostra o selo sugerido **editável**: nome, turnos e linhas "atributo / delta" (botões para pôr e tirar linha). O "Pôr selo..." do mestre (`SeloDialog`) ganha as mesmas linhas.
- Onde o mod vale enquanto o selo existe:
  1. **Fórmula**: `ContextoDaFormula` ganha `bonusDaBatalha?: Readonly<Record<string, number>>`; `formula.ts` soma ao `atributoComposto(...).total` e a conta mostra "FOR 160 +20 (Fúria)". `"dano"` soma no fim da sugestão do golpe ("+30 (Fúria)").
  2. **Reação**: `"reacao"` entra no modificador inicial da `CaixaDeReacao` (o campo segue editável).
  3. Não mexe na ordem (Agilidade) nem no Mov nesta versão.
- `bonusDaBatalha(selos, tokenId)` é uma função pura só, usada pelo menu, pela mira, pelo painel do NPC e pela caixa: o mesmo número em todas as telas.
- O dano é proposto por quem ataca (o host recebe o número), então o mod só muda a sugestão: continua editável, e o mestre corrige pelo registro (decisão 11).

### (d) Evolução
- Marca "Evolui" na tira quando há extra Evolution. O detalhe mostra o texto e as Condições.
- **Evoluir** (o dono na vez dele; o mestre sempre): pedido `evoluir`, cobra custo se digitado, grava em `evoluidas`, linha no registro, Desfazer.
- Com "Evolui para: SUPER CAÇA AS BRUXAS!": a evoluída fica **apagada** no menu ("Evolução: evolua CAÇA AS BRUXAS! primeiro") até evoluir (D4); depois, a base fica apagada ("Evoluiu: use SUPER CAÇA AS BRUXAS!") e a evoluída liberada. O editor da ficha sugere o link quando outro cartão contém o nome da base.
- Sem "Evolui para": a base ganha a marca "Evoluída" e o detalhe mostra o texto da Evolution como efeito; se o texto diz OVERLOAD, o uso evoluído conta como Overload (sem reação, 1 por batalha).
- Vale só nesta batalha. Evolução permanente = editar a ficha.

### (e) Escolha "um ou outro"
- `variantesDe(cartao)`: o Efeito do cartão = opção 1 ("Efeito principal"); cada extra "Opção ...", "Efeito N", "Variante ..." é mais uma. Marca "2 opções" na tira.
- Na mira, chips de escolha antes do Lançar; a escolhida vai no pedido (`variante`) e no registro ("Harvey usou Medicina (Cirurgia)"). Se o texto da variante tem dano legível (`lerDano`), selo ("por N turnos") ou mods, eles **pré-preenchem** a mira; o dano segue editável.
- Passiva com variantes (Melodia) pede a variante e o alvo no Ativar.
- Aplauso (May): os extras "Ação" e "Reação" não são variantes; "Reação" é o texto do modo reação (f).

### (f) Reação automática
- Na `CaixaDeReacao` (jogador) e em `ReacoesPendentes` (mestre, por NPC), acima do Rolar: botões **"Usar (técnica)"** para as técnicas do alvo com Tipo Reação ou `tambemReacao`, cada um com custo, saída lida e estado (apagado com motivo: recarga, usos, Overload usado, SP insuficiente). Golpe sem reação (Surpresa, Overload) não mostra nada, como hoje.
- `modoDaReacao(cartao)` lê o extra "Reação", senão o Efeito, senão a Descrição:
  - "rola", "1d20", "teste": **rolar com a técnica**; o botão vira "Rolar com Giro da Lança" (rola o d20 de sempre, gasta custo e recarga, põe o nome na linha).
  - "rebate", "devolve", "contra-ata": **contra** (ganha o contra-ataque da Q6).
  - "esquiv", "desvia", "anula", "evita": **esquiva** (dano 0).
  - "metade", "reduz": **metade**.
  - nada disso: **escolher**; a caixa mostra Esquiva, Metade, Contra, Receber, sem nenhuma marcada.
  - Exemplos (aceite): Passo de Valsa = esquiva; Recuperação de forças = esquiva (a cura de 20% é à mão; a linha cita o texto); Aplauso = contra (é Overload: trava os outros Overload); Giro da Lança = rolar; Atração Relâmpago e Armadura Humana = escolher.
- Usar = pedido `tecnica`: **sem d20**, aplica a saída (`resolverAlvo`), cobra custo, marca recarga, usos e Overload (o mesmo `depoisDaTecnica` do golpe, extraído para os dois usarem), não gasta ação (decisão 8) e, se pedido, põe selo no atacante ("Marcado" quando o texto fala de marca: palavra nova em `PALAVRAS_DO_SELO`). Linha: "Vincent esquivou com Passo de Valsa (35 SP)". Desfazer volta tudo.
- A saída lida vem marcada e quem reage pode trocar (D2); trocada, a linha diz "(à mão)".
- O host valida: a técnica é do personagem do alvo, é de reação, está disponível (`motivoDaTecnica` com `acoes = null`), a saída está no conjunto permitido, o custo está no teto.
- NPC: o mestre vê os mesmos botões em `ReacoesPendentes`; o NPC nunca reage sozinho. A técnica de reação disponível e paga ganha a marca "sugerida".

## 5. Protocolo (`net/protocoloDaBatalha.ts`)
- `lerPedidoDeReacao`: caso `tecnica` (saída em enum fechado, `cartaoId` com teto de id, `custo` de 0 a `CUSTO_MAX` ou null, selo por `seloPedidoValido`).
- Pedido de ação: casos `passiva` e `evoluir`; `variante` com teto `NOME_DO_GOLPE_MAX`.
- Selo no fio: `mods` opcional, lista com teto, alvo como texto curto, delta inteiro no teto; `natureza` em enum fechado.
- `vistaDoJogador.ts`: `CombateParaJogador` leva `evoluidas` e `lembradas` só das fichas dele; o lembrete de passiva vai só ao dono.

## 6. Telas (`components/batalha/*`, `components/FichaAbas.tsx`)
- `MenuDaVez` / `dadosDoMenu.ts`: tira **Passivas (N)**; marcas "Evolui", "2 opções", "Buff", "Debuff" nas tiras; motivo novo para Reação pura.
- `MiraDoGolpe`: chips de variante; bloco de mods editável para Buff/Debuff; mira de Buff começa em você, sem reação.
- `CaixaDeReacao` e `ReacoesPendentes`: botões "Usar técnica" acima do Rolar; escolha da saída quando o modo é "escolher"; campo de custo quando o custo é pergunta.
- `CartaDaOrdem` / `FaixaDaOrdem`: pílula do selo com cor por natureza (buff verde, debuff roxo, passiva dourada, condição como hoje) e os mods no título ("FOR +20, 2 turnos").
- `SeloDialog`: linhas de modificador.
- Lembrete de passiva: faixa pequena no topo da tela do dono ("Melodia pronta: Ativar / Agora não"); para o mestre, dentro do `PainelDaVezDoNpc`.
- `FichaAbas.tsx`: o select Tipo vem de graça; botões "+ Evolução" e "+ Opção" que criam os extras com o nome certo (fase 4).

## 7. Fases publicáveis (na main, sem worktree; cada uma = commit + pergunta se publica)
Cada fase: **passo 0 = contrato** (1 escritor, só tipos, assinaturas e parse do fio, `tsc` verde); depois **até 3 escritores em caminhos disjuntos**, cada um commita só os próprios caminhos:
- **L (lógica pura)**: `lib/batalha/tiposDaHabilidade.ts` (novo), `selos.ts`, `formula.ts`, `acoes.ts`, `golpe.ts`, `leituraDaFicha.ts`. Agent `programador`.
- **H (host e estado)**: `stores/batalhaStore.ts` (dono único), `net/batalhaNoHost.ts`, `net/protocoloDaBatalha.ts`, `lib/batalha/vistaDoJogador.ts`, `lib/livros/saude.ts`, `lib/sistemaOnePiece.ts`. Agent `programador`.
- **T (telas)**: `components/batalha/*`, `components/FichaAbas.tsx`, CSS da batalha. Agent `programador-frontend` (com as skills de design do par. 2l para pílulas e caixa).

**Fase 1: Tipo + Reação automática** (o pedido concreto do Passo de Valsa)
- Contrato: `TipoDaHabilidade`, assinatura de `lerTipo`, campo Tipo no sistema, `PedidoDeReacao` tecnica, `AlvoDoGolpe.tecnica`, parse.
- L: `lerTipo`, `modoDaReacao`, `reacoesDisponiveis(personagem, sistema, combate)`, extrair `depoisDaTecnica` e o custo para uso comum, motivo da Reação pura no menu, palavra "marca" para Marcado.
- H: `reagir` caso `tecnica` (sem d20, saída, custo, recarga, selo no atacante, contra Q6, registro, reversão); Saúde lê "Reação".
- T: botões na caixa e no mestre; marca Reação na tira.

**Fase 2: Buff/Debuff**
- Contrato: `ModDoSelo`; `mods`, `natureza`, `cartaoId` no selo; assinatura de `bonusDaBatalha`; `ContextoDaFormula.bonusDaBatalha`; fio do selo.
- L: `lerMods`, `bonusDaBatalha`, soma em `formula.ts`, Buff com alvo padrão em si e sem reação (`golpe.ts`).
- H: selo com mods no golpe e no "Pôr selo"; recorte do jogador com mods.
- T: bloco de mods na mira e no `SeloDialog`; cores das pílulas; modificador inicial da caixa com o bônus de reação; conta do dano com o bônus.

**Fase 3: Passivas** (usa a 2 para o efeito com número; sem mods, vira só selo)
- Contrato: pedido `passiva`, `CombateDoPersonagem.lembradas`, assinatura de `gatilhoDaPassiva`.
- L: `gatilhoDaPassiva`, `passivasDe(personagem, sistema, cena)` com estado, `passivasQueDisparam(momento, cena, mesa)`.
- H: pedido `passiva` (ligar, desligar, custo, selo); ganchos no Iniciar, na virada de rodada e depois de dano (um ponto só, depois de `danoNoAlvo` e `darDano`); lembrete no recorte do dono; efeito "a cada turno" como lembrete no começo da vez (D5).
- T: tira Passivas no menu, no perfil da carta e no painel do NPC; faixa de lembrete.

**Fase 4: Escolha + Evolução**
- Contrato: `variante` no pedido, pedido `evoluir`, `evoluidas`.
- L: `variantesDe`, `evolucaoDe` (link "Evolui para" e sugestão por nome), motivos novos no menu (evoluída bloqueada, base evoluída).
- H: pedido `evoluir` com registro e reversão; `variante` no registro do golpe e da passiva.
- T: chips de variante na mira; botão Evoluir no detalhe da tira; "+ Evolução" e "+ Opção" na ficha.

## 8. Critério de pronto (sem suíte: o usuário proibiu teste sem pedido em 27/10)
Por fase, nesta ordem, com a saída colada no handoff:
1. `rtk proxy npx tsc --noEmit` em `client/` sem erro.
2. `npx vite build` em `client/` sem erro.
3. Roteiro à mão (sessão local mestre + jogador no navegador, ou a Arena de testes), com cópia da ficha real, nunca a original:
- **F1**: Ilo ataca Vincent corpo a corpo, 100 de dano. A caixa de Vincent mostra "Usar Passo de Valsa, 35 SP, Esquiva". Clicar: sem dado, dano 0, SP -35, Passo de Valsa apagado "Recarga: 3 turnos", selo "Marcado" no Ilo, linha "Vincent esquivou com Passo de Valsa (35 SP)". Desfazer na linha: SP volta, recarga some, selo some, golpe volta a esperar reação. No menu da vez de Vincent, Passo de Valsa apagado "Reação: use na caixa REAÇÃO". Golpe com Surpresa: nenhum botão de técnica. Alvo NPC: o mestre vê o botão em Reações pendentes. Saúde da ficha de Vincent: Ação "Reação" lida.
- **F2**: Buff "+20 de Força por 2 turnos" em si mesmo: pílula verde "Fúria 2" com "FOR +20"; a mira do próximo golpe de Força mostra "+20 (Fúria)" na conta; depois de 2 vezes do dono o selo some e a conta volta. Debuff em inimigo que esquiva: o selo não pega. Selo do mestre com "Reação +3": a caixa daquela ficha abre com modificador 3.
- **F3**: Iniciar com May: Fortaleza não ativa no início (gatilho é vida). Dano que leva May a 49% do HP: Fortaleza ativa sozinha, linha no registro, pílula dourada; no começo da vez dela, lembrete "Fortaleza: +30 HP, Aplicar". Siegfried: na virada para a rodada 3, lembrete "Melodia pronta" (tem escolha); Ativar pede a opção e o oponente e cobra 15 SP. A tira Passivas lista Mecânicas gerais como "Sempre". Desfazer desliga e devolve o SP.
- **F4**: CAÇA AS BRUXAS! com "Evolui para" SUPER: SUPER apagado até Evoluir; depois CAÇA apagado e SUPER liberado; Desfazer volta. Medicina mostra "2 opções"; com Cirurgia, a linha diz "Medicina (Cirurgia)".
4. `revisor` (um por dimensão: validação do fio dos pedidos novos; reversão no registro) antes de perguntar se publica.

## 9. Riscos e como pegar cedo
- **`batalhaStore.ts` (1340 linhas) é o arquivo quente**: um dono por fase (H); L e T não tocam nele.
- **Leitura de texto erra** ("anula", "marca", mods): toda leitura vira sugestão marcada e editável, nunca aplicada escondida; o registro diz "(à mão)" quando trocam. Conferir os exemplos da seção 4 contra a ficha real antes do commit de L.
- **Passiva que ativa sozinha cobra SP sem a pessoa ver**: só ativa sozinha com custo lido e sem escolha, sempre com linha e Desfazer; D3 deixa o usuário escolher "só lembrar".
- **Buff inflando o dano em silêncio**: a conta mostra cada bônus com o nome do selo; o mesmo `bonusDaBatalha` em todas as telas.
- **Teto de selos** (8 por ficha) com passivas + buffs + condições: avisar no "Pôr selo" ao chegar no teto; conferir na F3 com o Siegfried (Melodia + marcas).
- **Nome diz "(Passiva)" mas a Ação diz "Simples/Reação"** (Recuperação de forças): o nome não conta; vale Tipo/Ação. Corrigir no lote de dados, não no código.
- **Reação que cura** ("20% vira vida") e **Rebate com dano próprio**: fora da automação; a linha cita o texto e o mestre usa Dar dano ou ajuste. Não inventar fórmula.
- **Gatilho de vida** precisa olhar o HP depois de todo dano (golpe, Dar dano): gancho num ponto só do store, senão escapa.
- **Plan mode trava escritores** (memória de 09/10): não entrar em plan mode com escritor rodando.

## 10. Decisões que faltam ao usuário (só as que mudam o que ele vê)
1. **Tipo = select com Ativa, Passiva, Reação, Buff, Debuff; Evolução e Escolha aparecem como marcas quando o cartão tem os extras.** Alternativa: as 7 no mesmo select. Recomendo o select de 5 + marcas (Melodia é Passiva E tem escolha; um select só não mostra as duas).
2. **Reação automática: o resultado (esquiva, metade, contra) vem lido da ficha, já marcado, e quem reage pode trocar** (a linha diz "à mão"). Alternativa: travado no que a ficha diz. Recomendo trocável, como o dano (decisão 11). E técnica cujo texto manda rolar (Giro da Lança) vira "Rolar com Giro da Lança" em vez de reagir sozinha: recomendo sim.
3. **Passiva de início do combate, rodada N ou vida baixa ativa sozinha** quando o custo é claro e não há escolha (com linha e Desfazer), e **só lembra** quando precisa escolher ou confirmar custo. Alternativa: sempre só lembrar. Recomendo ativar sozinha (é o "se ativam automaticamente" do pedido).
4. **A versão evoluída (SUPER CAÇA AS BRUXAS!) fica apagada no menu até alguém apertar Evoluir, e a evolução vale só nesta batalha.** Alternativa: as duas sempre liberadas (como hoje). Recomendo apagada, com o motivo escrito.
5. **Efeito "a cada turno" de passiva (Fortaleza: +30 HP e +10 Força por turno) vira lembrete no começo da vez, com o botão Aplicar.** Alternativa: aplicar sozinho. Recomendo o lembrete (cura e soma repetidas são onde a leitura mais erra).

## Próximo passo
- O usuário responde as 5 decisões (ou aceita as recomendações).
- `programador` (H) faz o contrato da **Fase 1** com este plano e as respostas; depois L (`programador`), H (`programador`) e T (`programador-frontend`) em paralelo nos caminhos da seção 7.
- Dados (lote de correção da ficha real, app fechado, com backup): Tipo "Reação" em Passo de Valsa; "Passiva" nas 4 passivas; "Evolui para" em CAÇA AS BRUXAS!; extras "Opção" na Melodia.

## Respostas soltas da correção em lote (31/10/2026)
- Campo de Contenção ("Concentração" na Ação): "Ação Completa e mantém" (gasta a Completa para ativar e fica ativa pagando 15 SP por turno; "manter" no Efeito). Aplicar na ficha real no próximo lote (app fechado, backup).
- Desenhar o alvo ("Dano da Bala + Dano da Arma + Percepção"): "Ensinar 'Dano da Bala' ao app": o leitor entende "Dano da Bala" = dano da bala escolhida na mira (0 sem bala especial); a fórmula fica. Entra na F1 desta feature (lógica L).
