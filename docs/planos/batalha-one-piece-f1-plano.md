# Batalha One Piece, F1 (Ordem e vez): plano de implementação

Base: main `a8795eb9`, 30/10/2026. Fontes: `docs/planos/batalha-one-piece-2026-10-30.md` (decisões 1, 2, 3a, 4, 5, 7), `docs/design/batalha-persona/README.md` e `prototipo.html` (faixa `.ordem`/`.carta` em 137-169 e 870-1015; painel do mestre em 1600-1632), `docs/planos/modo-batalha-2026-10-24.md` (host autoridade, recorte por jogador). Plano de leitura: nada foi editado nem executado no repo.

## 0. Entendimento e premissas

O mestre liga a batalha numa cena (já existe: `stores/batalhaStore.ts`, `components/livro/ControleDaBatalha.tsx`). A F1 põe por cima: a ordem dos turnos com vez, rodada e cartas extras; equipes gravadas em disco; a faixa da ordem no topo das duas telas; o pulso no token da vez; o perfil ao clicar na carta (recorte por equipe); o registro com Desfazer; e as regras do campo (biblioteca global + cópia por batalha).

Premissas (do código lido):
- Tudo o que é da batalha mora na SESSÃO do mestre (`batalhaStore`), nunca no `map.json` (decisão 1 do plano de 24/10). Só as equipes e a biblioteca de regras vão a disco.
- O host (`net/hostSession.ts`) roda no mesmo processo do mestre: ação do mestre é chamada direta na store; só o jogador manda mensagem.
- Personagens vêm do DONO ativo: a aventura OU a pasta (`stores/adventureStore.ts:901-960`, `personagensAtivos`, `donoDosPersonagens`). Equipes referenciam personagens, então seguem o mesmo dono (ver Q5).
- `tsc` cobre os testes (`client/tsconfig.json` inclui `src`): toda assinatura existente muda só com parâmetro NOVO opcional, senão os `.test.ts` quebram o portão sem ninguém rodar teste.

## 1. Abordagens consideradas

- **Escolhida: estado na `batalhaStore` + regras puras em `lib/batalha/` + mensagem própria `batalha.estado` por jogador, deduplicada por conexão** (molde de `personagensEnviados`, `hostSession.ts:3328` e `7523-7562`). A troca de vez não mexe no snapshot do mapa.
- Rejeitada: pôr a ordem no `snapshot` (como `batalha?: true`). Campo fora do `patch` força snapshot INTEIRO (`hostSession.ts:4706-4707`) a cada "Passar a vez", com a foto de todas as fichas.
- Rejeitada: estado num submódulo do host (molde `tiroNoHost`). O mestre teria de falar com o host por ponte a cada arrasto; a store já é a dona da batalha e a UI do mestre lê dela.
- Rejeitada: Desfazer restaurando o personagem inteiro de antes. Apagaria o que mudou depois (outro golpe, a ficha editada pelo jogador). Desfazer da ficha é por DELTA, com linha nova no histórico.

## 2. Modelo de dados

(Nos trechos de código abaixo as aspas são duplas só por causa da ferramenta que escreveu este arquivo; no código, sigam o estilo do repo, aspas simples.)

### 2.1 Arquivos novos em `client/src/lib/batalha/` (puros, sem store nem rede)

`turnos.ts`
```ts
export type Desempate = "d20" | "manual"
export type DuracaoDaExtra = "rodada" | "sempre"
export interface CartaDaOrdem {
  id: string                  // "carta_<rand>"; a carta extra tem id próprio e o mesmo tokenId
  tokenId: string
  personagemId: string | null // lido de Token.characterId na inclusão e no Ordenar
  extra?: { duracao: DuracaoDaExtra; criadaNaRodada: number }
}
export interface AcoesExtras { simples: number; bonus: number; mov: number; duracao: DuracaoDaExtra } // F2 preenche; F1 sempre vazio
export interface GastoDaVez { simples: boolean; movimento: number; bonus: number }              // F2; zera no Passar
export interface TurnosDaCena {
  cartas: readonly CartaDaOrdem[]   // a ordem
  vez: string | null                 // cartaId; null antes de começar
  rodada: number                     // 1..
  desempate: Desempate
  d20: Readonly<Record<string, number>>         // cartaId -> d20 do desempate (só o mestre vê)
  empates: Readonly<Record<string, number>>     // cartaId -> grupo de empate (modo manual; a marca fica até arrastar)
  extras: Readonly<Record<string, AcoesExtras>> // F2: ações extras dadas pelo mestre
  gastos: Readonly<Record<string, GastoDaVez>>  // F2
}
export type AutorDaAcao = { tipo: "mestre" } | { tipo: "jogador"; playerId: string; nome: string }
```
Funções (puras; relógio e d20 entram por parâmetro):
- `combatentesIniciais(tokens, personagens, sistema)`: fichas da cena com personagem ligado e não escondidas, ordenadas pela Agilidade.
- `agilidadeDe(personagem, sistema)`: `valorDoRank(personagem, "agilidade")` (`lib/ajusteDaFicha.ts`); sistema sem `agilidade` usa o atributo de nome "Agilidade"; sem nenhum = 0.
- `ordenarPelaAgilidade(turnos, agilidades, rolarD20)`: maior primeiro; empate em "d20" rola para cada um do grupo (re-rola empate de d20) e grava `d20`; em "manual" grava `empates`. Carta extra fica logo depois da original.
- `passarVez(turnos, caidas)`: próxima carta; ao dar a volta, `rodada + 1`, remove extras "rodada", zera `gastos`; devolve também as cartas removidas (para o Desfazer). Pula carta caída só se a Q3 confirmar.
- `moverCarta`, `incluirCombatente`, `tirarCombatente`, `adicionarCartaExtra(tokenId, indice, duracao)`, `removerCarta`, `darVez(cartaId)`.
- `normalizar(turnos, tokenIdsDaCena)`: carta de ficha apagada sai; vez numa carta que sumiu anda para a próxima.
- `turnoNoM(turnos)`: `{ n, m }` para "Turno N/M".

`registro.ts`
```ts
export type TipoDaLinha =
  | "vez" | "ordem" | "cartaExtra" | "combatente" | "equipe" | "ficha" | "regras" | "desempate"
  // F2, já no tipo para a UI não mudar: "acao" | "golpe" | "reacao" | "dano" | "habilidade" | "acoesExtras" | "transformacao"
export interface ParteDaFicha { parte: "recurso" | "maximo" | "cartao"; chave: string; de: number; para: number }
export type Reversao =
  | { tipo: "vez"; antes: { vez: string | null; rodada: number; removidas: { carta: CartaDaOrdem; indice: number }[]; gastos: TurnosDaCena["gastos"] } }
  | { tipo: "ordem"; antes: readonly string[] }                     // ids na ordem de antes (mover, Ordenar, desempate)
  | { tipo: "cartaNova"; cartaId: string }                          // desfazer = remover
  | { tipo: "cartaRemovida"; carta: CartaDaOrdem; indice: number }  // desfazer = reinserir
  | { tipo: "equipe"; personagemId: string; antes: string | null; depois: string | null }
  | { tipo: "ficha"; personagemId: string; partes: readonly ParteDaFicha[] }
  | { tipo: "regras"; antes: RegrasDaBatalha | null }
  | { tipo: "composta"; partes: readonly Reversao[] }               // F2: um golpe = ficha de N alvos + gasto
export interface LinhaDoRegistro {
  id: string; seq: number; quando: number; rodada: number
  autor: AutorDaAcao
  tipo: TipoDaLinha
  texto: string                    // montado com nomes; o do mestre pode ter número de NPC
  envolve: { tokenIds: readonly string[]; personagemIds: readonly string[] } // para o recorte
  reversao: Reversao
  desfeita?: { por: string; quando: number }
}
export interface LinhaParaJogador { id: string; rodada: number; autor: string; texto: string; desfeita?: { por: string }; podeDesfazer: boolean }
```
Funções:
- `linhaDeAjuste(antes, depois, autor, sistema)`: compara `recursos` (atual) e `maximos`; nada mudou = `null`. Funde com a linha anterior do MESMO autor e personagem dentro de `JANELA_DO_REGISTRO_MS` (`lib/ajusteDaFicha.ts:253`), como o histórico da ficha; senão dez cliques no + viram dez linhas.
- `ajustesParaDesfazer(partes, atual): Ajuste[]`: recurso e máximo = `valorAgora - (para - de)`; cartão = `de`. Passa por `aplicarAjustes` (limita entre 0 e o máximo). Se o limite cortou, a linha riscada diz "desfeito em parte".
- `reverterTurnos(turnos, reversao)`: vez, ordem (reaplica a permutação só às cartas que ainda existem; carta nova vai ao fim), carta nova ou removida.
- `podeDesfazer(linha, quem, vezDoJogador)`: mestre = qualquer linha não desfeita; jogador = `autor.playerId` dele, é a vez dele (a carta da vez tem token dele) e tipo "ficha" na F1 (a F2 soma "acao", "golpe"...). Linha desfeita não se desfaz de novo.
- `registroParaJogador(linhas, ctx)`: só linhas com todos os `tokenIds` no recorte dele e `personagemIds` dele ou de aliado; linha "ficha" de NPC nunca sai. As 50 mais novas.

`equipes.ts`
```ts
export interface Equipe { id: string; nome: string; cor: string; membros: readonly string[] } // membros = personagemId (jogador ou NPC)
export const EQUIPES_MAX = 12
export const NOME_DA_EQUIPE_MAX = 40
```
- `equipesDoArquivo(value): Equipe[] | undefined` (campo a campo; cor `#rrggbb`; personagem em duas equipes fica na primeira).
- `equipeDe(personagemId, equipes)`.
- `aliadosDe(meusPersonagens, equipes, personagens): Set<string>`: SEM equipe cadastrada = todos os personagens tipo "jogador" formam a equipe implícita (como hoje: colega vê colega); COM equipes = membros tipo "jogador" das equipes dele, menos os dele. NPC nunca entra (decisão 1). Jogador sem equipe quando há equipes = sem aliados.

`regrasDoCampo.ts`
```ts
export interface RegraDoCampo { id: string; nome: string; blocosPorRank: number; texto: string }                 // biblioteca global
export interface RegrasDaBatalha { origemId: string | null; nome: string; blocosPorRank: number; texto: string } // cópia por batalha
export const BLOCOS_POR_RANK_PADRAO = 1   // inteiro 1..10
export const TEXTO_DA_REGRA_MAX = 4000
export const NOME_DA_REGRA_MAX = 60
export const REGRAS_MAX = 100
```
`lerRegraDoCampo`, `bibliotecaDeRegrasDoTexto`, `serializarBibliotecaDeRegras` (versão 1).

`regrasDoCampoNoDisco.ts` (I/O, Tauri fs): `<appData>/batalha/regras-do-campo.json` por `writeTextFileSafely`; ilegível = cópia `regras-do-campo.invalido-AAAAMMDD-HHMMSS.json` e biblioteca vazia que não grava por cima (molde `lib/sons/bibliotecaNoDisco.ts`). O escopo do fs já cobre `$APPDATA/**/*` (`desktop/src-tauri/capabilities/default.json:26`): nada de Rust.

`vistaDoJogador.ts` (o recorte; quem chama é o host)
```ts
export type LadoNaCarta = "eu" | "aliado" | "outro"
export interface CartaParaJogador {
  id: string; tokenId: string; nome: string; lado: LadoNaCarta
  equipe?: { nome: string; cor: string }
  personagemId?: string   // só eu e aliado (abre o perfil)
  extra?: DuracaoDaExtra
  caiu?: true             // só eu e aliado
}
export interface EstadoParaJogador {
  rodada: number; turno: { n: number; m: number }
  vez: string | null; proxima: string | null; minhaVez: boolean
  vezForaDaVista: boolean // a vez é de carta que ele não vê
  cartas: CartaParaJogador[]
  registro: LinhaParaJogador[]
  regras: RegrasDaBatalha | null
}
export function vistaParaJogador(cena: BatalhaDaCena, ctx: ContextoDoJogador): EstadoParaJogador
// ContextoDoJogador: playerId, meusTokens, tokensNoRecorte (id -> nome), meusPersonagens, aliados, equipes, personagens, sistema
```
Regra: carta de token fora do recorte dele NÃO sai (Q1); `turno` e `proxima` contam só as que saem. Nunca sai Agilidade, d20 nem marca de empate ao jogador. HP/SP da carta o jogador lê do personagem que já tem (o dele em `personagens`, o do aliado em `batalha.aliados`): o estado não leva número.

`ponte.ts` (contrato entre a store e o host)
```ts
export interface PonteDaBatalha {
  cena(sceneKey: string): BatalhaDaCena | null
  passarVez(sceneKey: string, autor: AutorDaAcao, esperado: { cartaId: string; rodada: number }): boolean // idempotente
  desfazer(sceneKey: string, linhaId: string, autor: AutorDaAcao): boolean
  registrarAjuste(personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDaAcao): void // acha as cenas em batalha com o personagem na ordem
}
```

### 2.2 Store `stores/batalhaStore.ts` (só sessão)
`BatalhaDaCena` ganha `turnos: TurnosDaCena`, `registro: readonly LinhaDoRegistro[]` (teto 300), `regras: RegrasDaBatalha | null` e `turnosRev: number`. O `rev` de hoje (caminhos) NÃO sobe com os turnos: ele entra na chave `session` do `viewIfChanged` (`hostSession.ts:4629-4630`) e faria snapshot inteiro a cada vez.

Ações novas: `ligar(sceneKey, abertura?, inicio?: { combatentes; regras; desempate })` (3º parâmetro opcional, compatível com `ControleDaBatalha.test.tsx`), `passarVez`, `darVez`, `moverCarta`, `ordenarPelaAgilidade`, `trocarDesempate`, `incluirCombatente`, `tirarCombatente`, `adicionarCartaExtra`, `removerCarta`, `definirRegras`, `trocarEquipe(personagemId, equipeId | null)` (escreve via `adventureStore` e registra), `registrarAjuste`, `desfazer(sceneKey, linhaId, autor)`.

`desfazer` é o ÚNICO caminho que reverte (também quando o pedido vem do jogador pelo host): turnos na própria store; ficha por `useAdventureStore.getState().ajustarPersonagem(id, atual => aplicarAjustes(atual, sistema, ajustesParaDesfazer(...), quem, agora))`, com `quem` = "Mestre (desfez)" ou "<nome> (desfez)" (quem diferente do autor impede o `registrar` de fundir e apagar a linha, `ajusteDaFicha.ts:270-275`); equipe pela `adventureStore`. O histórico da ficha só ganha linha, nunca perde. A mudança na aventura chega ao jogador pelo `syncPersonagens` de sempre. A linha do registro fica riscada com `desfeita`.

Exports para a costura: `ponteDaBatalha: PonteDaBatalha`, `deveAvisarJogadores(state, previous): boolean` (chaves, `zerados` ou `turnosRev` mudaram), `vezTokenIdDaCena(state, sceneKey): string | null`.

`stores/regrasDoCampoStore.ts` (novo): biblioteca global em memória, grava 400 ms depois da última mudança, fora do Ctrl+Z e do "não salvo" (molde `bibliotecaDeSonsStore.ts`, sem migração).

### 2.3 Disco
- `lib/adventure.ts`: `Adventure.equipes?: Equipe[]`, lida por `equipesDoArquivo` (aditivo; `ADVENTURE_VERSION` não muda; sem equipes grava sem a chave, como `cabines`). `serializeAdventure` é `JSON.stringify` (`lib/adventure.ts:298`).
- `lib/pastasDeMapas.ts`: `RpgDaPasta.equipes?: Equipe[]` em `rpgDoArquivo` e `serializarRpg` (as equipes seguem o dono dos personagens, Q5).
- `stores/adventureStore.ts`: `equipesAtivas(state)` (molde `personagensAtivos`), `salvarEquipes`, `trocarEquipe`, por um `donoDasEquipes` igual a `donoDosPersonagens` (marca `structureDirty` ou `pastaSuja`); `hostWorldOf` (`:886`) passa `rpg.equipes`.
- `<appData>/batalha/regras-do-campo.json`: biblioteca global.
- Fica SÓ na sessão: ordem, vez, rodada, cartas extras, d20, empates, registro, regras da batalha (a cópia), gastos e extras.

## 3. Protocolo

Arquivo novo `net/protocoloDaBatalha.ts` (não importa `protocol.ts`; `protocol.ts` só ganha as uniões e o `case` do parser, molde `protocoloDaMedida.ts`).

Jogador -> host
| Mensagem | Campos | Validação no host |
|---|---|---|
| `batalha.passar` | `reqId`, `cartaId`, `rodada` | entrou e joga; a cena DELE está em batalha (`emBatalha`, `hostSession.ts:3659`); a carta da vez é a `cartaId` nesta `rodada` (senão `ok: false` sem efeito: clique duplo e reenvio não passam duas vezes); o token da carta está em `ownership[playerId]` |
| `batalha.desfazer` | `reqId`, `linhaId` | mesma cena; a linha existe, não está desfeita, `autor.playerId` é ele, tipo permitido ao jogador e é a vez dele (`podeDesfazer`) |

Teto: 10 pedidos por 5 s por jogador (molde `cabePedidoDePersonagem`, `:7565`); o resto morre calado. Parser: `reqId` no teto `REQ_ID_MAX_LENGTH`, ids string até 80, `rodada` inteiro 1..100000. Recusa única `ok: false`, sem motivo (motivo ensinaria ids).

Host -> jogador
| Mensagem | Campos | Quando |
|---|---|---|
| `batalha.estado` | `estado: EstadoParaJogador` ou `null` | no broadcast, só se o JSON mudou para a conexão; `null` uma vez ao sair da batalha ou da cena |
| `batalha.aliados` | `personagens: Personagem[]` (sem `dono`, por `semDono`, `:7511`) | só em batalha e na cena dele; reenvia quando a lista muda por referência (molde `mesmasReferencias`, `:7508`) |
| `batalha.resultado` | `reqId`, `ok` | resposta aos dois pedidos |

Todo o resto (ordem, carta extra, desempate, equipe, regras, combatentes, Desfazer do mestre) é ação LOCAL do mestre na store e não passa pela rede.

### 3.1 No host
`net/batalhaNoHost.ts` (novo): `criarBatalhaNoHost(...)`, puro e síncrono como `tiroNoHost` (`hostSession.ts:3520`). Guarda `estadoEnviado: Map<clientId, string>` e `aliadosEnviados: Map<clientId, readonly Personagem[]>`; expõe `sync(world)`, `entrou(clientId)`, `caiu(clientId)`, `passar(...)`, `desfazer(...)`.

Pontos em `hostSession.ts`:
- `HostSessionOptions.ponteDaBatalha?: PonteDaBatalha` (junto de `getBatalha`, `:1719`).
- Broadcast: `outbound.push(...batalhaNoHost.sync(world))` logo depois de `syncPersonagens` (`:11015`).
- Entrada e volta: limpar e mandar junto de `personagensEnviados.delete` (`:5420`); queda e kick junto de `dancaNoHost.caiu` (`:10545`, `:10572`).
- `switch` das mensagens do jogador (perto de `:9505`): `batalha.passar` e `batalha.desfazer`.
- `handlePersonagemAjustar` (`:7702`): depois de calcular, `options.ponteDaBatalha?.registrarAjuste(id, alvo.atual, personagem, { tipo: "jogador", playerId, nome })`. O Desfazer não passa por aqui (não vira linha nova).
- Contexto do recorte por conexão: `tokensNoRecorte` da tela que a conexão TEM (`sentViews.get(clientId).view`, conferir o tipo `PlayerViewContent`), `meusTokens` = `ownership[playerId]`, `meusPersonagens` de `fichasDoPersonagem` (`:7480`), `aliados = aliadosDe(...)` com `world.rpg.equipes`.

### 3.2 Recorte por equipe
- Perfil: `batalha.aliados` leva SÓ os personagens de `aliadosDe` (nunca NPC, nunca outra equipe) e só a quem está numa cena em batalha. O próprio já vem em `personagens` (`:7539`).
- Barra de vida no mapa: `lib/vidaDaFicha.ts` ganha `barrasParaJogador(tokens, personagens, sistema, aliados?)`; com `aliados`, `deJogador` vira "personagem dele ou aliado"; sem o parâmetro, igual a hoje. `barrasDoMapa` (`hostSession.ts:4368`) passa os aliados do jogador, e a chave `session` do `viewIfChanged` (`:4630`) ganha a lista de aliados, para a troca de equipe refazer o recorte. `fogFilter.ts` NÃO muda.
- Aventura sem equipes: nada muda para quem não usa equipes.

### 3.3 Desfazer (antes e depois)
| Linha | Guarda | Desfazer faz |
|---|---|---|
| Passar a vez | vez, rodada, extras "rodada" removidas com o índice, gastos | volta a vez e a rodada, reinsere as extras; as linhas de depois ficam como estão |
| Ordem (mover, Ordenar, desempate) | ids na ordem de antes | reaplica a permutação às cartas que existem; carta nova vai ao fim |
| Carta extra, combatente | id da carta, ou carta + índice | remove ou reinsere |
| Equipe | personagem, antes, depois | `trocarEquipe(antes)` |
| Ficha (HP, SP, Escudo pela ficha) | partes `{parte, chave, de, para}` | delta inverso sobre o valor de AGORA via `aplicarAjustes`, `quem` "... (desfez)"; o histórico da ficha só cresce |
| Regras | regras de antes | `definirRegras(antes)` |

Sempre: a linha fica, riscada, com "desfeito por X". Desfazer não se desfaz.

## 4. Telas

Pasta nova `client/src/components/batalha/` (designer-opus), presentacional por props; quem monta lê a store ou a conexão.
- `FaixaDaOrdem.tsx` + `CartaDaOrdem.tsx` + `batalha.css`: "Ordem dos turnos (N)", cartas com retrato (imagem do token), nome, posição, cor da equipe (`--lado`), fitas VEZ e A SEGUIR; à direita "Rodada R", "Turno N/M", "Sua vez" ou o nome, "Você joga em N turnos" (jogador) ou "Depois: X" (mestre). Mestre arrasta (Pointer Events), Alt + setas com a carta em foco, Esc cancela; troca de lugar com FLIP em `cubic-bezier(0.77, 0, 0.175, 1)`; só `transform` e `opacity`; movimento reduzido sem FLIP. Carta: HP/SP com números para o mestre e para eu/aliado (decisão 1), "Vida oculta" para outro; marcas "d20 N" e "empate" só no mestre; "EXTRA · só nesta rodada" ou "EXTRA".
- `PerfilDaCarta.tsx`: `Dialogo` do grimório com `FichaDePersonagem` (`components/FichaDePersonagem.tsx:51`) em `editando={false}` e sem `onAjustar` = só lê. Jogador: carta de aliado abre isto com o personagem de `batalha.aliados`; a própria abre a `PlayerFicha` de sempre; "outro" não abre nada. Mestre: o clique abre a ficha cheia de sempre (`useRpgStore.getState().abrirFicha(personagemId)`, `stores/rpgStore.ts:44`), que ajusta e entra no registro.
- `RegistroDaBatalha.tsx`: mais nova em cima, "R2 · Mestre · Lia: HP 450 -> 380", Desfazer por linha (aceso por `podeDesfazer`), linha riscada com "desfeito por Mestre".
- `PainelDaBatalha.tsx` (mestre): Vez (quem, Passar a vez, dar a vez a uma carta), Ordem (Ordenar pela Agilidade; Desempate 1d20 ou Eu decido; + Carta extra: combatente, posição, "só nesta rodada" ou "todas"; Incluir ou Tirar combatente), botões Registro, Regras e Equipes. Monta DENTRO do `ControleDaBatalha` quando ligada (o slot `batalha` do livro já existe, `App.tsx:4249` e `LivroDaMesa.tsx:294`): `LivroDaMesa.tsx` não muda.
- `RegrasDoCampoDialog.tsx` (leitura, mestre e jogador); `EscolhaDaRegra.tsx` (no Iniciar: regra da biblioteca ou Nenhuma, blocos por rank de Agilidade padrão 1, texto, "Guardar na biblioteca"); `BibliotecaDeRegrasDialog.tsx` (criar, renomear, apagar).
- `EquipesDialog.tsx`: equipes (nome, cor), membros em chips, "Sem equipe"; mover = `trocarEquipe` (entra no registro com a batalha ligada). Trocar de lado também pelo menu da carta (mestre).

Onde montam:
- Mestre, `App.tsx`: faixa sobre o canvas, no topo de `lb-editor__canvas` (absoluta, abaixo dos avisos, sem cobrir a barra de cima), só com a batalha da cena aberta ligada; `vezTokenId` para o `PixiCanvas`; `ponteDaBatalha` nas DUAS criações da ponte (`App.tsx:900` e `:960`); a condição do `subscribe` (`:1007-1019`) vira `deveAvisarJogadores(state, previous)`.
- Mestre, `components/livro/ControleDaBatalha.tsx`: o diálogo de Iniciar ganha `EscolhaDaRegra` e o desempate e chama `ligar(sceneKey, abertura, inicio)` com `combatentesIniciais(...)`; ligada, mostra o `PainelDaBatalha`.
- Jogador, `player/main.tsx`: faixa no topo da `Session` quando há `state.batalhaEstado` (respeitar o que `hudSemColisao` protege), "Passar a vez" na faixa quando `minhaVez`, botões Regras e Registro, `PerfilDaCarta`; passa `vezTokenId` (token da carta da vez, se ele vê) ao `PlayerView`.
- Pulso, recuperado do histórico:
  - mestre: commit `c8208ff3`, arquivo `client/src/pixi/tokensRenderer.ts` (o `applyTurnPulse`, `TURN_RING_*`, `syncTurnRing`, `semPulsoDaVez`) e as constantes em `pixi/constants.ts`; `pixi/PixiCanvas.tsx` recebe a prop `vezTokenId` e redesenha quando ela muda (em `c8208ff3` lia a `initiativeStore`).
  - jogador: o pai de `ccec84a5`, arquivo `client/src/player/PlayerView.tsx` (prop `turnTokenId` e o anel; renomear para `vezTokenId`).
  - Recuperado = anel fixo na ficha da vez + 1 pulso na troca (Q4).

## 5. Divisão: 3 escritores, caminhos disjuntos, na main, sem worktree

### Fase 0 (sozinho, A, antes dos outros): o contrato
A escreve só tipos e as funções de LEITURA que B usa: `lib/batalha/turnos.ts` (tipos + `turnoNoM`), `registro.ts` (tipos + `podeDesfazer` + `registroParaJogador`), `equipes.ts` (inteiro, é pequeno), `regrasDoCampo.ts` (tipos, limites, parser), `vistaDoJogador.ts` (inteiro), `ponte.ts`, `net/protocoloDaBatalha.ts` (tipos + parsers) e UMA linha em `net/hostSession.ts`: `equipes?: readonly Equipe[]` em `RpgDoMundo` (`:283`). Portão: checagem de tipos da seção 6 limpa. Commit "contrato da F1". Daí em diante `hostSession.ts` é só do B.

### Fase 1 (os três juntos)
| Escritor | Agent | Dono exclusivo de |
|---|---|---|
| **A, lógica e estado** | `programador-frontend` | `lib/batalha/turnos.ts`, `registro.ts`, `regrasDoCampo.ts`, `regrasDoCampoNoDisco.ts` (novo), `stores/batalhaStore.ts`, `stores/regrasDoCampoStore.ts` (novo), `lib/adventure.ts`, `lib/pastasDeMapas.ts`, `stores/adventureStore.ts`, `components/RpgDialogs.tsx` (o `onAjustar` do mestre, `:117`, chama `registrarAjuste` com autor mestre); DEPOIS, o pulso: `pixi/tokensRenderer.ts`, `pixi/constants.ts`, `pixi/PixiCanvas.tsx`, `player/PlayerView.tsx` |
| **B, host e rede** | `programador-frontend` | `net/hostSession.ts`, `net/batalhaNoHost.ts` (novo), `net/hostBridge.ts` (dep `ponteDaBatalha` repassada perto de `:3721`), `net/protocol.ts` (uniões `PlayerMessage` e `HostMessage`, `case` no `parsePlayerMessage`), `net/protocoloDaBatalha.ts` (depois da fase 0), `player/playerConnection.ts` (`state.batalhaEstado`, `state.aliados`, os `case` das 3 mensagens, `passarVezNaBatalha(cartaId, rodada)`, `desfazerNaBatalha(linhaId)`, limpar ao sair da cena e ao cair), `lib/vidaDaFicha.ts` |
| **C, telas** | `designer-opus` (skills do Emil, `emil-design-eng` primeiro; o protótipo aprovado é a referência, não refazer o visual) | `components/batalha/*` (novo), `App.tsx`, `components/livro/ControleDaBatalha.tsx`, `player/main.tsx`, `player/player.css` |

Arquivos quentes, 1 dono cada: `hostSession.ts`, `hostBridge.ts`, `protocol.ts`, `playerConnection.ts` = B; `App.tsx` e `player/main.tsx` = C; `PlayerView.tsx` e `PixiCanvas.tsx` = A (só no fim). Ninguém toca `PEDIDOS.md` (sujo pelo usuário), `fogFilter.ts`, `LivroDaMesa.tsx` nem `types/map.ts`.

Ordem dentro da fase 1:
1. A: reducer e store (`ligar` com `inicio`, `passarVez` ... `desfazer`, `ponteDaBatalha`, `deveAvisarJogadores`, `vezTokenIdDaCena`); depois a persistência das equipes e a biblioteca de regras; depois `RpgDialogs`; por último o pulso.
2. B: parsers e uniões; `playerConnection`; `batalhaNoHost` + pontos no `hostSession`; `vidaDaFicha` e a chave `session`; `hostBridge`.
3. C: componentes com dados de exemplo nas props (sem store); depois as montagens, consumindo o que A e B exportam.

### Pontos de costura (nomes fixos desde a fase 0)
- S1 `App.tsx` (C) passa `ponteDaBatalha` (A, `stores/batalhaStore.ts`) às duas pontes; o campo em `hostBridge` e `HostSessionOptions` se chama `ponteDaBatalha` (B).
- S2 `App.tsx` (C) troca a condição do `subscribe` por `deveAvisarJogadores` (A), que chama `notifyBatalhaChanged` (já existe, `hostBridge.ts:3848`).
- S3 `player/main.tsx` (C) lê `state.batalhaEstado` e `state.aliados` e chama `passarVezNaBatalha` e `desfazerNaBatalha` (B); passa `vezTokenId` ao `PlayerView` (prop de A).
- S4 `App.tsx` (C) passa ao `PixiCanvas` a prop `vezTokenId`, lida da store com o seletor `vezTokenIdDaCena(state, chaveDaCenaAberta)` (A).
- S5 `ControleDaBatalha.tsx` (C) chama `ligar(sceneKey, abertura, inicio)` e `combatentesIniciais` (A).
- S6 `hostSession.ts` (B) chama `ponte.registrarAjuste` em `handlePersonagemAjustar`.
- Prop que ainda não existe na hora de montar: C deixa a linha da costura para o fim e avisa; nunca cria a prop no arquivo do outro.

Durante a fase 1 a checagem de tipos global acusa o meio do trabalho dos outros: cada escritor filtra os erros dos PRÓPRIOS caminhos. Commit só dos próprios caminhos, uma vez por escritor, quando os seus caminhos zerarem. O portão final é global (seção 6), feito por um agente só depois dos três.

## 6. Critério de pronto (sem suíte; o usuário proibiu teste sem pedido)

Portão de máquina:
1. Na pasta `client`: `rtk proxy npx tsc --noEmit` = 0 erros (inclui os `.test.ts`: as assinaturas antigas continuam valendo).
2. Na pasta `client`: `npx vite build` termina sem erro.
3. `git status` só com os caminhos da seção 5 (mais o que o usuário já tinha sujo: `PEDIDOS.md`, `Minigames/`, provas e planos novos).
4. Nenhum `.rs` mudou.

O que o usuário vê (mestre no app + 2 jogadores no navegador; Lia e Bruno na equipe "Grupo", Duda na "Rivais", NPCs Vera e Ilo):
1. Iniciar batalha pede a regra do campo (lista da biblioteca ou Nenhuma), os blocos por rank (1) e o desempate (1d20 ou Eu decido). Confirmar: a faixa aparece no topo do mestre e dos jogadores da cena, ordenada pela Agilidade.
2. Empate com 1d20: o mestre vê "d20 N" nas cartas empatadas; o jogador não vê o número. Com "Eu decido": a marca de empate fica até o mestre arrastar.
3. A carta da vez sobe com VEZ, a próxima tem A SEGUIR, "Rodada 1 · Turno 1/M". O token da vez ganha o anel e pulsa na troca, no mestre e no jogador.
4. O mestre arrasta uma carta (e Alt + setas): a ordem muda nas duas telas.
5. "Ordenar pela Agilidade" refaz a ordem; a linha entra no registro, e o Desfazer devolve a ordem anterior.
6. Carta extra "só nesta rodada" aparece e some na rodada seguinte; "todas" fica.
7. Lia, na vez dela, clica "Passar a vez": a vez anda; clique duplo não pula duas. Bruno, fora da vez, não vê o botão.
8. Lia clica na carta do Bruno: abre o perfil dele, só leitura. Na da Duda (outra equipe) ou da Vera (NPC): nada abre, e a carta diz "Vida oculta".
9. O mestre põe a Duda no "Grupo" no meio da luta: a Lia passa a ver HP/SP e o perfil da Duda, e a barra da Duda no mapa. Desfazer volta.
10. Na vez dela, a Lia tira 50 de HP pela ficha: "Lia: HP 450 -> 400" aparece no registro dela e do mestre; Desfazer volta a 450; o histórico da ficha ganha "Lia (desfez)" e mantém a linha antiga. Fora da vez, o Desfazer dela fica apagado.
11. O mestre desfaz um "Passar a vez": a vez volta, e a linha fica riscada "desfeito por Mestre".
12. Botão Regras: os três leem o mesmo texto. A regra guardada na biblioteca aparece numa batalha de OUTRA aventura.
13. As equipes sobrevivem a Salvar, fechar e abrir a aventura (ou a pasta).
14. Encerrar batalha: a faixa some em todas as telas, e nada da batalha fica no `map.json`.

Conferência de vazamento (DevTools do jogador, aba WS): o `batalha.aliados` da Duda (outra equipe) não traz Lia nem Bruno; nenhum NPC em `batalha.aliados`; nenhuma linha de ficha de NPC em `batalha.estado.registro`; carta de token fora da vista não vem.
Fluidez (opcional, Performance do Chrome no mestre com ~20 fichas): Passar a vez sem tarefa longa de 200 ms ou mais.

## 7. Riscos e o que não confirmei

Decisões para o usuário (cada uma com a minha recomendação):
- **Q1 Combatente fora da vista do jogador.** Recomendo NÃO mandar a carta (sem vazamento; "Turno N/M" conta só as que ele vê; vez escondida = "Vez de alguém fora da sua vista"). Alternativa: carta coberta "?" (mostra que existe alguém).
- **Q2 Membro de equipe por personagem** (recomendado: estável entre sessões e aparelhos), e não por jogador da sala. Jogador sem equipe quando há equipes = sem aliados; aventura sem equipes = todos os jogadores aliados, como hoje.
- **Q3 Carta caída (HP 0).** Recomendo pular no "Passar a vez", como no protótipo; o jogador vê "caiu" só onde já vê a vida (pular a vez de um NPC pode denunciar a queda: aceitar).
- **Q4 Pulso.** O recuperado é anel fixo + 1 pulso na troca. "Pulsar sempre" deixa o relógio do Pixi do mestre rodando o tempo todo (o renderer hoje para quando nada anima); medir antes de trocar.
- **Q5 Onde as equipes moram.** O pedido diz "na aventura", mas os personagens podem morar na PASTA (`rpg.json`, "Usar o da pasta", `adventureStore.ts:904-908`). Recomendo que as equipes sigam o dono dos personagens (aventura ou pasta).

Riscos técnicos:
- R1 Três escritores na main ao mesmo tempo: a checagem de tipos fica suja no meio; commit só dos próprios caminhos. Os testes não rodam, então comportamento novo pode deixar teste existente vermelho em runtime (`hostSession.batalha.test.ts`, `ControleDaBatalha.test.tsx`, testes de `vidaDaFicha`): dizer isso ao usuário na entrega.
- R2 `notifyBatalhaChanged` chama `broadcastNow` (recorte de todos). Por vez deve ser barato, porque `viewIfChanged` devolve cedo quando o mapa não mudou, mas não medi.
- R3 Só o ajuste rápido entra no registro. HP mudado pelo "Editar/Salvar" da ficha (`salvarPersonagem`) durante a batalha não entra na F1.
- R4 O `personagemId` da carta é lido na inclusão; religar o token a outro personagem no meio da luta só atualiza no "Ordenar" ou ao tirar e incluir de novo.
- R5 Desfazer de ficha é por delta: se o valor bateu no limite (0 ou máximo) depois, volta em parte, e o texto diz.
- R6 A tela da mesa (TV) fica sem faixa na F1.
- R7 As ações do mestre são locais na store; não há caminho para um mestre em segunda tela remota (não existe hoje).
- R8 Equipe trocada no meio da luta marca a aventura como não salva (`structureDirty`) ou a pasta suja; se o mestre fechar sem salvar, a troca some (igual à ficha hoje).

Não confirmei:
- Se `sentViews.get(clientId).view` traz `map.tokens` como penso (é `PlayerViewContent`; ler o tipo antes de usar).
- O código exato do anel do jogador no pai de `ccec84a5` (vi só o diff das props) e se `TURN_RING_*` saíram de `pixi/constants.ts` em `c8208ff3` (o diff do import diz que deixaram de ser importadas).
- Se a mídia do retrato (`midia:<id>`) de um ALIADO é servida ao jogador sem lista por jogador.
- Qual campo do `Token` marca "escondida dos jogadores" para `combatentesIniciais`.
- O espaço livre no topo do `App.tsx` e da `Session` do jogador sem colidir com a barra, os avisos e o que `hudSemColisao` protege.
- Diagrama: a regra 2g pede `diagram-design`, que este agente não consegue chamar; o fluxo vai em texto abaixo para o orquestrador desenhar.

Fluxo (texto): mestre (UI) -> `batalhaStore` (reducer de `lib/batalha`) -> `deveAvisarJogadores` -> `notifyBatalhaChanged` -> broadcast do host -> `batalhaNoHost.sync` -> `vistaParaJogador` + `aliadosDe` por conexão -> `batalha.estado` e `batalha.aliados` -> `playerConnection` -> faixa, perfil e registro em `player/main.tsx`. Jogador -> `batalha.passar` ou `batalha.desfazer` -> `hostSession` valida -> `ponteDaBatalha` -> store -> mesmo caminho de volta. Ajuste de ficha: `handlePersonagemAjustar` (jogador) ou `RpgDialogs` (mestre) -> `registrarAjuste` -> linha no registro.

## Q1 a Q5 decididas (orquestrador, 30/10/2026; o usuário mandou seguir sem perguntar de novo)
- Q1: carta fora da vista do jogador NÃO vai a ele ("Vez de alguém fora da sua vista").
- Q2: equipe por personagem.
- Q3: carta com HP 0 é pulada no Passar a vez; o mestre ainda pode dar a vez a ela.
- Q4: o usuário pediu "o token vai pulsar". Fica o anel fixo + pulso na troca da vez + um pulso curto (cerca de 600 ms) a cada 3 s enquanto for a vez. O relógio do Pixi só anda durante o pulso, nunca o tempo todo.
- Q5: equipes seguem o dono dos personagens (aventura ou pasta).

## Próximo passo
O orquestrador leva Q1 a Q5 ao usuário (um `AskUserQuestion`, com as recomendações). Com as respostas: `programador-frontend` (A) faz a fase 0 com este arquivo como input; depois A, B (`programador-frontend`) e C (`designer-opus`) em paralelo, na main, com a tabela da seção 5 no prompt de cada um; o portão final da seção 6 por um agente só.
