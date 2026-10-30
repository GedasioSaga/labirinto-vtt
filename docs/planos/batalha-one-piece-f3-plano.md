# Batalha One Piece, F3 (Judge, Transformação, Selos): plano de implementação

Base: main `96b90938`, 30/10/2026. Plano de leitura: nada foi editado nem executado no repo.
Fontes lidas: `docs/planos/batalha-one-piece-2026-10-30.md` (decisões 13, 16, 18 e "Fases"), `docs/planos/batalha-one-piece-f2-plano.md` (contrato e Q1 a Q8), `docs/design/batalha-persona/README.md` (tabela Movimento) e `prototipo.html` (CSS 428-441, `transformar` 1469-1490, `efeitoTransformacao` 1887-1935), `docs/design/judge/v2-mcp/README.md` e `judge-folha.json`, `docs/planos/livros-de-regras-plano.md` (colisões), `PEDIDOS.md` (fim), e o código: `lib/batalha/{combate,turnos,registro,ponte,vistaDoJogador,aberturaLembrada}.ts`, `lib/ajusteDaFicha.ts:78-210`, `lib/sistemaOnePiece.ts`, `lib/personagem.ts:39-56`, `lib/midia.ts`, `lib/camadas/ordem.ts:58-186`, `stores/batalhaStore.ts` (interface e seletores), `net/protocoloDaBatalha.ts:621` (`lerEfeito`), `pixi/tokensRenderer.ts:170-204 e 820-915`, `pixi/PixiCanvas.tsx:5964-6000` (o `pointerdown` com os gestos), `pixi/fogosDoMapa.ts` (ticker só com algo na vista), `player/PlayerView.tsx:740-760, 1558-1583, 3690-3740`, `components/batalha/{MenuDaVez,dadosDaFaixa,EfeitosDaBatalha}`, `vite.config.ts`, `desktop/src-tauri/src/net/commands.rs:252-258` (a sala serve qualquer arquivo do build pelo `asset_resolver`).

(Aspas duplas nos trechos por causa da ferramenta; no código, o estilo do repo, aspas simples.)

**Mudança pedida pelo coordenador (30/10, depois da aprovação do Judge pelo usuário):** o Judge sai primeiro, como **fatia J própria e publicável**, antes da Transformação e dos Selos (fatia T). A folha final chega no MESMO formato de `judge-folha.json` (8 direções x 20 quadros, 192x240, 64 px por casa, chão em (96, 200.3), 12 fps).

## 0. Entendimento e premissas

- **J, Judge:** avatar do mestre, montado no chocobo, que aparece sozinho ao iniciar a batalha em todas as telas, respira em laço, vira para a ficha da vez (8 direções) e ergue a carta vermelha quando o MESTRE desfaz uma linha. O mestre o arrasta; a posição fica lembrada por mapa. Some ao encerrar. Não entra na ordem, não tem ficha, não aceita clique no jogador.
- **T1, Transformação:** a tira Transformação do menu da vez (hoje apagada, `MenuDaVez.tsx:66` e `:232`) passa a funcionar: escolher a forma, ver o que muda, trocar a ação (Bônus, Simples, Completa) e Ativar. Ativar liga o cartão, gasta a ação, o HP atual ganha a diferença do máximo, toca a animação aprovada nas telas que veem o token e, se a forma tem imagem e o dono quis, troca a imagem do token e do retrato na batalha. Desfazer a forma é ação livre. Tudo no registro com Desfazer.
- **T2, Selos:** o mestre põe selos com duração na carta ("Atordoado 2"); a habilidade que diz "por N turnos" sugere o selo no golpe; o selo conta sozinho e avisa quando acaba.

Premissas do código (iguais às da F2): o host é o mestre, no mesmo processo; o jogador só pede; a regra mora na store do mestre pela `lib/batalha`; ficha muda só por `useAdventureStore.getState().ajustarPersonagem(...)` com histórico; tudo da batalha é SESSÃO; `tsc` cobre os `.test.ts`, então tipo existente só ganha campo opcional e assinatura só ganha parâmetro opcional. Testes não rodam (regra do usuário de 27/10); o portão é `tsc` + `vite build` + roteiro.

## 1. Abordagens consideradas

**Judge (como a imagem entra e como a direção chega ao jogador)**
- **Escolhida:** a folha `.webp` vira arquivo do build do Vite (`client/src/assets/judge/judge-folha.webp`, importada com `?url`, nome com hash, nunca embutida porque passa de 4 KB). A sala já serve qualquer arquivo do build pelo `asset_resolver` do Tauri (`commands.rs:252`): zero Rust. O jogador recebe SÓ a posição (`judge: { x, y }`) no `batalha.estado` e o gesto como efeito na fila que já existe (`batalha.efeitos`, `seq`). A **direção é calculada em cada tela**, pela ficha da vez que AQUELA tela conhece: o jogador que não vê a ficha da vez não recebe a vez, e o Judge não vira; nada vaza.
- Rejeitada: mandar a direção pronta do host. Diria ao jogador para que lado está um inimigo escondido.
- Rejeitada: PNG (6,3 MB) ou a pasta `public/` (sem hash, cache velho depois de atualizar).
- Rejeitada: o pacote de animações assinado (`/animacoes`). Serve para baixar sem reinstalar; o Judge é fixo do app, e 1 MB no instalador é pouco.
- Rejeitada: 3D ao vivo (three.js). A escolha do usuário foi a folha do Blender.

**Transformação (o ganho de HP)**
- **Escolhida:** função pura nova `ativarForma` em `lib/batalha/transformacao.ts`, por cima de `aplicarAjuste` (liga com `parte: "cartao"` e soma a diferença com `parte: "recurso"`). `ajusteDaFicha.ts` NÃO muda: a ficha fora da batalha segue igual, e o arquivo é quente no plano dos livros.
- Rejeitada: mudar `ligarCartao` para sempre ganhar a diferença. Mudaria o botão da ficha fora da batalha sem pedido e colide com a M2 dos livros.

**Imagem da forma (troca do token e do retrato)**
- **Escolhida:** sobreposição de SESSÃO: `TurnosDaCena.formas[personagemId] = { cartaoId, imagem }` (desfeita junto com a linha), que vale só enquanto o cartão está ligado. O token no disco não muda; os dois desenhistas de ficha (editor e jogador) ganham um mapa opcional `fotoDaForma` (tokenId para src pronto) que vence a foto do token.
- Rejeitada: trocar `Token.image`/`imageData` no mapa. Sujaria o `map.json`, e a imagem da forma é `midia:<id>`, não data URL.
- A escolha "trocar a imagem" fica lembrada por personagem NO APARELHO de quem ativa (localStorage, molde de `aberturaLembrada.ts`): nenhum campo novo na ficha nem no fio.

**Selos**
- **Escolhida:** lista `TurnosDaCena.selos` (por TOKEN, para a carta extra mostrar o mesmo selo), contada no `passarVez` quando sai uma carta daquele token, no máximo 1 vez por rodada. O aviso vai no texto da linha da vez e num efeito na fila.
- Rejeitada: contar no virar da rodada. Selo de 1 turno posto depois que o alvo já jogou acabaria sem ele perder nada.

## 2. Modelo de dados

### 2.1 Disco
- `lib/sistemaOnePiece.ts`, aba `transformacoes`: campo novo `{ id: "acao", rotulo: "Ação", forma: "linha" }` depois de Descrição. Vazio = Completa. Lido pela `lerAcao` da F2. Nenhum tipo novo em `sistemaDeRpg.ts`.
- `localStorage` do aparelho (não é a ficha nem o mapa):
  - `lb-batalha:judge:<aventuraId ou ->:<sceneKey>` = `{ x, y }` (posição do Judge por mapa; `sceneKey` = `activeSceneId ?? map.id`, `App.tsx:1401`).
  - `lb-batalha:forma-imagem:<personagemId>` = `true | false` (última escolha de trocar a imagem; nada guardado = true).
- Nada mais no disco. Nada da batalha no `map.json`.

### 2.2 Sessão: tipos novos
`lib/batalha/judge.ts` (novo, fatia J):
```ts
export interface JudgeNaCena { x: number; y: number }      // px do mundo, mesma convenção de Token.x/y (centro da casa)
export type DirecaoDoJudge = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 // linha da folha: sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste
export const FOLHA_DO_JUDGE = {
  quadro: { largura: 192, altura: 240 }, pxPorCasa: 64, chao: { x: 96, y: 200.3 },
  colunas: 20, linhas: 8, fps: 12,
  respiracao: { inicio: 0, quadros: 12 }, erguer: { inicio: 12, quadros: 8 },
} as const                                                  // conferido contra judge-folha.json ao trocar a folha
export const SEGURA_A_CARTA_MS = 1000
export const PASSO_DA_VIRADA_MS = 70
export const CARTA_REDUZIDA_MS = 1500
export function direcaoPara(judge: JudgeNaCena, alvo: { x: number; y: number }): DirecaoDoJudge | null
export function passosDaVirada(de: DirecaoDoJudge, para: DirecaoDoJudge): DirecaoDoJudge[]
export type GestoDoJudge = { inicio: number } | null       // performance.now() do começo
export function colunaDoJudge(agora: number, gesto: GestoDoJudge, reduzido: boolean): number   // 0..19
export function judgeInicial(lembrado: JudgeNaCena | null, primeiraFicha: { x: number; y: number } | null, centroDoMapa: { x: number; y: number }, tamanhoDaCasa: number, limites: { largura: number; altura: number }): JudgeNaCena
export function lerJudgeLembrado(armazem: Pick<Storage, "getItem"> | null, aventuraId: string | null, sceneKey: string): JudgeNaCena | null
export function gravarJudgeLembrado(armazem: Pick<Storage, "setItem"> | null, aventuraId: string | null, sceneKey: string, judge: JudgeNaCena): void
```

`lib/batalha/combate.ts` (fatia J ganha a primeira linha do efeito; fatia T o resto):
```ts
// EfeitoDaBatalha ganha:
| { seq: number; tipo: "judge"; gesto: "carta" }                       // J: o mestre desfez uma linha
| { seq: number; tipo: "transformacao"; tokenId: string; forma: string; imagem: string | null; numeros?: readonly NumeroDaForma[] }  // T1
| { seq: number; tipo: "forma"; tokenId: string; forma: string; ligou: false }                      // T1: desfez a forma (texto curto)
| { seq: number; tipo: "selo"; tokenId: string; nome: string; acabou: true }                        // T2: aviso

export interface NumeroDaForma { rotulo: string; de: number; para: number; nota?: string }  // "FOR 160 → 220", "HP máx 1.200 → 1.800", "HP 900 → 1.500"
export interface FormaNaBatalha { cartaoId: string; imagem: string | null }  // imagem = CartaoDaFicha.imagem se o dono quis trocar
export interface SeloDaBatalha {
  id: string                 // "selo_" + uuid
  tokenId: string
  nome: string               // até NOME_DO_SELO_MAX
  turnos: number | null      // os que faltam; null = até o mestre tirar
  total: number | null
  contadoNaRodada?: number   // a rodada em que já descontou (1 vez por rodada)
  origem?: string            // nome da técnica que o pôs
}
export interface SeloPedido { nome: string; turnos: number | null }

// PedidoDeAcao ganha:
| { tipo: "transformar"; cartaoId: string; acao: "simples" | "completa" | "bonus"; trocarImagem: boolean }
| { tipo: "destransformar"; cartaoId: string }
// "atacar" e "habilidade" ganham `selo?: SeloPedido` (o sugerido, marcado na mira); GolpeDaBatalha ganha `selo?: SeloPedido`

export const NOME_DO_SELO_MAX = 24
export const TURNOS_DO_SELO_MAX = 99
export const SELOS_POR_TOKEN_MAX = 8
export const SELOS_MAX = 120
export const NUMEROS_DA_FORMA_MAX = 16
```

### 2.3 O que muda nos tipos da F1/F2 (só campos opcionais)
- `ponte.ts`, `BatalhaEmTurnos`: `judge?: JudgeNaCena` (J). Fora de `turnos`: mover o Judge não vai ao registro nem se desfaz.
- `turnos.ts`, `TurnosDaCena`: `formas?: Readonly<Record<string, FormaNaBatalha>>` (por personagemId) e `selos?: readonly SeloDaBatalha[]` (T).
- `turnos.ts`, `passarVez` e `darVez`: descontam os selos do token da carta que SAI (só se `contadoNaRodada !== rodada`); os que chegam a 0 saem e voltam em `VezPassada.acabaram` (para o texto da linha e o efeito).
- `registro.ts`: `TipoDaLinha` ganha `"selo"`; `Reversao` ganha `{ tipo: "forma"; personagemId: string; antes: FormaNaBatalha | null }` e `{ tipo: "selo"; seloId: string; antes: SeloDaBatalha | null }` (cobre pôr, editar e tirar); a `"vez"` ganha `antes.selos?`. `TIPOS_QUE_O_JOGADOR_DESFAZ` ganha `"transformacao"`. `reverterTurnos` trata as duas reversões novas.
- `vistaDoJogador.ts`:
  - `EstadoParaJogador.judge?: JudgeNaCena` (J; sempre que a batalha está ligada).
  - `CartaParaJogador.forma?: string` (nome da forma ligada, para todos que veem a carta) e `selos?: { nome: string; turnos: number | null }[]` (T; regra na Q5).
  - `EstadoParaJogador.aparencias?: Record<string, string>` (tokenId para `midia:<id>`; só tokens de carta no recorte dele, só forma com imagem escolhida e cartão ainda ligado).
  - `efeitosParaJogador(efeitos, depoisDoSeq, tokensNoRecorte, numerosVisiveis?: ReadonlySet<string>)`: "judge" passa sempre (não tem token); "transformacao", "forma" e "selo" só com o token no recorte; `numeros` saem SÓ se o token está em `numerosVisiveis` (dele ou de aliado de equipe: a mesma regra da vida). Ausente = sem números.
- `ponte.ts`, `PonteDaBatalha`: nada novo. Transformar e desfazer a forma passam pelo `agir` da F2; selo à mão é só do mestre (chamada direta na store).

### 2.4 Store (`stores/batalhaStore.ts`)
- J: `InicioDaBatalha` ganha `judge?: JudgeNaCena` (ou fica sem e o App põe logo depois); `moverJudge(sceneKey, x, y): boolean` (sobe `turnosRev`, não escreve linha); `desfazer` feito por `{ tipo: "mestre" }` com sucesso solta o efeito `{ tipo: "judge", gesto: "carta" }`; seletor `judgeDaCena(state, sceneKey)`; `desligar` leva o Judge junto.
- T1: `agir` trata `transformar` (confere: carta da vez com personagem; cartão em `cartoesQueLigam`; não ligado; a ação cabe) e `destransformar` (cartão ligado; não gasta). Ficha pela aventura, como o custo da F2 (sem linha "ficha" duplicada). Linha `"transformacao"` com texto sem números ("Bruno ativa Punho Negro (Completa)") e reversão `composta` [`gasto` de antes, `ficha` (partes de `partesDoAjuste`), `forma` de antes]. Efeito "transformacao" com os números, ou "forma".
- T2: `porSelo(sceneKey, tokenId, selo: SeloPedido)`, `editarSelo(sceneKey, seloId, selo)`, `tirarSelo(sceneKey, seloId)`: só mestre, linha `"selo"` com reversão `selo`. No golpe: alvo resolvido com saída que pega (Q6) recebe o selo do golpe; a reversão `composta` do golpe ganha um `selo` (antes null) por alvo. `passarVez` junta ao texto da linha da vez "· Atordoado acabou em Ilo" e solta um efeito "selo" por selo acabado. `normalizarCena`: selo de token que saiu da cena sai.

## 3. Lógica pura (com os exemplos que viram aceite)

### 3.1 `lib/batalha/judge.ts` (J)
Direção: ângulo na tela (y para baixo), `indice = round((90 - graus(atan2(dy, dx))) / 45) mod 8`. Mesma posição: `null` (fica como está).

| Judge | Alvo | Direção |
|---|---|---|
| (0, 0) | (100, 0) | 2 leste |
| (0, 0) | (0, 100) | 0 sul |
| (0, 0) | (0, -100) | 4 norte |
| (0, 0) | (-70, -70) | 5 noroeste |
| (0, 0) | (70, -70) | 3 nordeste |
| (0, 0) | (-100, 10) | 6 oeste |
| (0, 0) | (0, 0) | null |

Virada pelo lado mais curto, um passo por `PASSO_DA_VIRADA_MS`; empate (oposto) gira pelo índice crescente: `passosDaVirada(0, 4) = [1, 2, 3, 4]`; `(2, 6) = [3, 4, 5, 6]`; `(7, 1) = [0, 1]`; `(3, 3) = []`.

Coluna do quadro (12 fps, 1 quadro = 83,3 ms):
- Sem gesto: `floor(agora / 83,3) mod 12` (respiração, laço de 1 s).
- Gesto (desde `inicio`): 0 a 667 ms sobe (colunas 12 a 19); até 1.667 ms segura na 19; até 2.333 ms desce (19 a 12, a folha ao contrário); depois volta à respiração. Gesto novo no meio: recomeça do zero (sem fila).
- Movimento reduzido: sempre coluna 0 (parado); gesto = coluna 19 por `CARTA_REDUZIDA_MS` (1.500 ms) e volta à 0; virada sem passos.

Recorte na folha: `x = coluna × 192`, `y = direcao × 240`. Sprite com âncora (96/192, 200.3/240) = (0,5; 0,8346) e escala `tamanhoDaCasa / 64`: os pés no centro da casa, 1 casa no chão e cerca de 2,5 de altura.

`judgeInicial`: o lembrado, preso dentro dos limites do mapa; senão 2 casas ao norte da primeira ficha da ordem (preso nos limites); senão o centro do mapa.

### 3.2 `lib/batalha/transformacao.ts` (T1)
```ts
export interface FormaNoMenu {
  cartao: CartaoDaFicha
  ligada: boolean
  acaoDaFicha: "simples" | "completa" | "bonus"   // campo Ação; vazio ou ilegível = "completa"
  imagem: string | null
  numeros: NumeroDaForma[]                        // a prévia do que muda (modificadores, máximos, atual)
  tecnicas: string[]                              // nomes dos subcartões (entram nas Habilidades quando ligada: já é a F2)
  motivo: string | null                           // apagada e por quê
}
export function formasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, acoes: AcoesDaVez | null): FormaNoMenu[]
export function motivoDaForma(forma: FormaNoMenu, acao: AcaoDaTecnica, acoes: AcoesDaVez | null): string | null
export function ativarForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): { personagem: Personagem; numeros: NumeroDaForma[] } | null
export function desfazerForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): Personagem | null
export function aparenciaDaForma(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null  // null se o cartão não está mais ligado
```
`ativarForma`: guarda `maximoComposto(...).total` de cada recurso com atual e máximo que a forma mexe (Q1), liga com `{ parte: "cartao", valor: 1 }` e, para cada recurso com diferença `d = máxDepois - máxAntes` maior que 0, soma `d` ao atual com `{ parte: "recurso" }` (o `aplicarAjuste` limita no máximo). `d` menor que 0: o corte do `ligarCartao` já resolve. Tudo pelo `aplicarAjustes`, para o histórico da ficha ganhar as linhas.

Exemplos (Bruno: FOR 160; HP 900/1.200; SP 50/300; Punho Negro com FOR +60, HP +600, SP +100):

| Ação | Antes | Depois |
|---|---|---|
| Ativar Punho Negro | HP 900/1.200, SP 50/300, FOR 160 | HP 1.500/1.800, SP 150/400, FOR 220; números: FOR 160 → 220, HP máx 1.200 → 1.800, HP 900 → 1.500, SP máx 300 → 400, SP 50 → 150 |
| Desfazer a forma (ação livre) | HP 1.500/1.800 | HP 1.200/1.200 (cortado) |
| Desfazer a forma | HP 1.000/1.800 | HP 1.000/1.200 (não corta) |
| Desfazer a LINHA da ativação, logo depois | HP 1.500/1.800 | HP 900/1.200, a ação volta, a imagem volta |
| Desfazer a LINHA da ativação depois de levar 700 | HP 800/1.800 | HP 200/1.200 (por delta: como se nunca tivesse transformado; risco R4) |
| Forma com HP -200 | HP 1.000/1.200 | HP 1.000/1.000 (sem ganho, corte) |
| Ação vazia na ficha | | "completa"; o seletor deixa trocar para Simples ou Bônus |
| Bônus escolhido sem Bônus dado | | apagada: "Ação bônus: só quando o mestre dá" |
| Completa depois de gastar a Simples | | apagada: "Completa precisa da Simples e do Movimento" |

`acoes.ts`: o motivo "Transformação: ligue pela ficha" (`:162`, habilidade cuja Ação diz TRANSFORMAÇÃO) vira "É transformação: use a tira Transformação".

### 3.3 `lib/batalha/selos.ts` (T2)
```ts
export const SELOS_PRONTOS = ["Atordoado", "Cego", "Sangrando", "Queimando", "Envenenado", "Paralisado", "Lento", "Preso", "Confuso"] as const
export function lerDuracao(texto: string, nomeDaTecnica: string): SeloPedido | null
export function contarSelos(selos: readonly SeloDaBatalha[], tokenIdQueSai: string, rodada: number): { selos: SeloDaBatalha[]; acabaram: SeloDaBatalha[] }
export function selosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[]
export function pegaOSelo(saida: SaidaDaReacao): boolean   // conforme a Q6
export function textoDoSelo(selo: Pick<SeloDaBatalha, "nome" | "turnos">): string  // "Atordoado 2", "Cego"
```
`lerDuracao` (sem acento, minúsculas; lê Efeito e depois Descrição): número + "turno(s)" ou "rodada(s)" depois de "por" ou "durante". Nome: a primeira palavra-chave achada (atordoa, stun = Atordoado; cega, cego = Cego; sangra = Sangrando; queima = Queimando; envenena, veneno = Envenenado; paralisa = Paralisado; lento, lentidão = Lento; prende, imobiliza = Preso; confunde = Confuso); nenhuma = o nome da técnica (cortado em 24).

| Texto | Saída |
|---|---|
| "Atordoa o alvo por 1 turno" | Atordoado, 1 |
| "Cega o inimigo por 2 turnos" | Cego, 2 |
| "20 de queimadura por turno durante 3 turnos" | Queimando, 3 |
| "Rede de fumaça durante 2 rodadas" (técnica "Névoa") | Névoa, 2 |
| "-15 (Por turno)" | null (sem número) |
| "-" ou "" | null |

Contagem: Ilo com "Atordoado 1"; a carta do Ilo passa a vez na rodada 2: chega a 0, sai, `acabaram = [Atordoado]`, linha "Vez de Bruno · Atordoado acabou em Ilo". Ilo com carta extra na mesma rodada: a segunda carta não desconta. Selo posto pela Lia no Ilo que já jogou nesta rodada, 1 turno: vale durante a próxima vez do Ilo e acaba no fim dela. Selo sem turnos: nunca desconta.

## 4. Protocolo (`net/protocoloDaBatalha.ts`; `protocol.ts` não muda)

Jogador para host: nenhuma mensagem nova. `batalha.agir` aceita os `tipo` novos (enum fechado): `transformar` (`cartaoId` até `ID_DA_BATALHA_MAX`, `acao` entre as 3, `trocarImagem` booleano) e `destransformar`; `atacar` e `habilidade` aceitam `selo?` (`nome` de 1 a 24 sem quebra de linha, `turnos` inteiro de 1 a 99 ou null). O host confere o de sempre (cena dele, a vez é a carta dele nesta rodada, personagem em `meusPersonagens`); a store confere a regra.

Host para jogador:

| Onde | Campo | Quem recebe |
|---|---|---|
| `batalha.estado` | `judge?: { x, y }` (finitos, de -1.000.000 a 1.000.000) | todos na cena em batalha (J) |
| `batalha.estado` | `cartas[i].forma?`, `cartas[i].selos?` (até 8; nome até 24; turnos 0 a 99 ou null) | quem vê a carta (T) |
| `batalha.estado` | `aparencias?` (tokenId para a referência `midia:` da imagem; até 200; só `ehRefDeMidia` ou a embutida) | só tokens no recorte dele (T) |
| `batalha.efeitos` | `{ tipo: "judge", gesto: "carta" }` | todos (J) |
| `batalha.efeitos` | `transformacao` (`numeros` só se o token é dele ou de aliado), `forma`, `selo` | quem tem o token no recorte (T) |

Nada de NPC vaza: os números da forma de NPC nunca saem a jogador; a imagem da forma do NPC sai porque é o que a mesa já veria no token; a direção do Judge nem sai (cada tela calcula). A rota `/media/` da sala já serve qualquer mídia por hash (`net/media.rs`): nenhuma mudança no Rust.

## 5. Telas e animações

Referência: o protótipo aprovado; skills do Emil (`emil-design-eng` primeiro; `animate` e `review-animations` depois). Só `transform`, `opacity`, `clip-path` e um `filter: brightness` curto; nada de `blur` animado; movimento reduzido por `movimentoReduzido()` (`components/grimorio/comum.ts:47`) no DOM e `prefersReducedMotion()`/`canAnimate()` no Pixi.

### 5.1 Judge (J), no Pixi do editor e do jogador
- Módulo único `pixi/judgeDoMapa.ts` (novo), usado pelos dois lados, no molde de `pixi/fogosDoMapa.ts`: um `Container` com 1 `Sprite`; carrega a folha uma vez (`Assets.load(urlDaFolha)`), corta as 160 texturas uma vez (`new Texture({ source, frame })`); `definir({ judge, tamanhoDaCasa, alvo, reduzido })` (alvo = posição da ficha da vez ou null); `gesto()`; `acertou(pontoDoMundo)` (retângulo do corpo: 1 casa de largura, do chão até 2,3 casas acima); inscreve no `app.ticker` só com batalha ligada e o Judge na vista, e só troca a textura quando a coluna muda (12 vezes por segundo, não 60).
- Camada: faixa nova `judge` (FIXA) logo depois de `tokensContainer` em `FAIXAS_EDITOR` e depois de `tokens` em `FAIXAS_JOGADOR` (`lib/camadas/ordem.ts`): acima das fichas (Q7), abaixo dos guias e das alças do editor. No jogador, `eventMode = "none"`: clique passa para a ficha de trás.
- Arrasto (só mestre, só com batalha ligada): `pixi/judgeGesture.ts` (novo) no molde de `noiseGesture`/`laserGesture`: `pointerDown(botao, pontoDoMundo)` devolve true se acertou o Judge com o botão esquerdo; chamado em `PixiCanvas.tsx` logo depois do laser (`:5995`) e antes do pan e da seleção. No arrasto só a tela do mestre anda; ao soltar, encaixa no centro da casa e chama a prop nova `onJudgeSolto(x, y)`, que faz `moverJudge` + `gravarJudgeLembrado`. Esc no meio do arrasto: volta.
- Direção: o editor usa a ficha da vez (`vezTokenIdDaCena`) no mapa do mestre; o jogador usa o `vezTokenId` que já recebe (`PlayerView.tsx:265`) no mapa dele. Vez sem ficha visível: mantém a última direção (Q8). A ficha da vez que anda faz o Judge seguir virando.
- Gesto: a tela toca o efeito "judge" que chega na fila (mestre lê `efeitosDaCena`; jogador `state.batalhaEfeitos`), sem reprise ao entrar.
- Encerrar: o módulo esconde o sprite e sai do ticker; a textura fica no cache do Pixi (cerca de 29,5 MB de vídeo para 3840x1920; R2).

### 5.2 Transformação (T1)
- `MenuDaVez.tsx`: a tira Transformação acende quando a ficha tem forma. Abre `ListaDeFormas.tsx` (novo, no padrão das tiras da `ListaDeTecnicas`): uma tira por forma, com a seta para o detalhe (descrição, os números da prévia, as técnicas da forma). Forma desligada: seletor de ação com 3 botões (o da ficha marcado), caixa "Trocar a imagem do token e do retrato" (só se a forma tem imagem; marcada pela última escolha, `lib/batalha/escolhaDaImagem.ts`, novo) e Ativar (apagado com o motivo). Forma ligada: "Desfazer a forma · ação livre".
- Mestre: o mesmo bloco no `PainelDaVezDoNpc.tsx` (vez do NPC) e "Desfazer a forma" no `MenuDaCarta.tsx`.
- `EfeitosDaBatalha.tsx`: efeito novo `transformacao`, fiel ao `efeitoTransformacao` do protótipo: palco roxo (`.transformacao__fundo`, 160 ms), raios girando 1.500 ms, dois anéis de 0,35 a 2,8 em 620 ms (atraso 120 e 230 ms), retrato em 340 ms, clarão de 300 ms aos 300 ms, rótulo "Bruno · Transformação" aos 380 ms, nome da forma batendo de 1,6 a 1 aos 420 ms, linhas dos números aos 760 ms + 60 ms cada, contagem de 420 ms, segura 700 ms, sai em 220 ms (cerca de 2,2 s). Retrato = a imagem da forma do efeito, senão `imagemDe(tokenId)`. Sem `numeros` (jogador olhando NPC): só o nome. Pula com clique, Enter, Espaço ou Esc. Reduzido: aparece em 160 ms, números já no fim, 1.100 ms, some em 180 ms. Efeito `forma` (desfez): texto curto sobre o token ("PUNHO NEGRO DESFEITO", 220/650/200 ms).
- `CartaDaOrdem.tsx`: contorno roxo (`--bt-forma`) e o nome da forma (`.carta__forma` do protótipo); brilho de 600 ms (`brightness` 1,8 a 1) quando a forma liga.
- Imagem: `dadosDaFaixa.ts` usa `aparencia ?? ficha.imageData ?? retrato` na carta, no perfil, no corte do golpe e na cabeça do menu. No mapa, a prop `fotoDaForma` (5.4).

### 5.3 Selos (T2)
- `CartaDaOrdem.tsx`: fileira de selos sob as barras ("ATORDOADO 2"; sem número quando é até tirar); no mestre, clicar no selo abre editar e tirar.
- `MenuDaCarta.tsx` (mestre): "Pôr selo..." abre `SeloDialog.tsx` (novo): os prontos em botões, nome livre, turnos (1 a 99) ou "até tirar".
- `MiraDoGolpe.tsx`: com `lerDuracao` dando algo, a linha "Selo: Atordoado · 1 turno" marcada, com nome e turnos editáveis e o desmarcar (sugerido, nunca obrigatório).
- `EfeitosDaBatalha.tsx`: efeito `selo` = texto sobre o token ("ATORDOADO ACABOU"), no molde do texto curto.

### 5.4 Onde monta
- Mestre, `App.tsx`: props `judge`, `onJudgeSolto` e `fotoDaForma` ao `PixiCanvas`; efeito que põe o Judge inicial quando a batalha liga sem ele (`judgeInicial` com o lembrado); o gesto pelo `efeitosDaCena`.
- Jogador, `player/main.tsx`: `judge` (de `estado.judge`), o gesto (efeito da fila) e `fotoDaForma` (de `estado.aparencias`, resolvidas por `resolverComBase(URL_DA_MIDIA_NA_SALA)`) ao `PlayerView`.
- Desenhistas de ficha: `pixi/tokensRenderer.ts` (`draw` ganha o parâmetro opcional `fotoDaForma?: ReadonlyMap<string, string>` no fim) e `PlayerView.tsx` (pintura da ficha, `:744`): src pronto que não é data URL carrega por `Assets.load` (o id da mídia tem extensão), sem `convertFileSrc`.

## 6. Divisão do trabalho (na main, sem worktree, 1 dono por arquivo quente)

Antes de cada fatia: `git status` limpo nos caminhos dela. O conserto do encaixe da aba Batalha (designer-opus, em voo) mexe em `components/batalha/` e `components/livro/`: a fatia J não toca esses caminhos e pode correr junto; a fatia T espera o commit dele. A M2 dos livros não corre junto com a T (as duas tocam `lib/batalha/turnos.ts`, `stores/batalhaStore.ts` e `App.tsx`).

### Fatia J: Judge (publicável sozinha)
| Ordem | Escritor | Agent | Dono exclusivo de |
|---|---|---|---|
| J1 (cerca de 1 h) | J-A, regra e fio | `programador-frontend` | `lib/batalha/judge.ts` (novo, PRIMEIRO, commit logo), `lib/batalha/combate.ts` (efeito judge), `lib/batalha/ponte.ts`, `lib/batalha/vistaDoJogador.ts`, `net/protocoloDaBatalha.ts` (`judge` no estado, efeito judge no `lerEfeito`), `stores/batalhaStore.ts` (`judge`, `moverJudge`, gesto no `desfazer`, `judgeDaCena`) |
| J2 (começa com o `judge.ts` commitado) | J-B, mapa e montagem | `programador-frontend` | `client/src/assets/judge/judge-folha.webp` (cópia da folha FINAL de `docs/design/judge/v2-mcp/`, depois do commit do agente do Blender), `pixi/judgeDoMapa.ts` e `pixi/judgeGesture.ts` (novos), `pixi/PixiCanvas.tsx`, `player/PlayerView.tsx`, `lib/camadas/ordem.ts`, `App.tsx`, `player/main.tsx` |

Costuras J: S-J1 `judgeDaCena`/`moverJudge` (J-A) usados no `App.tsx` (J-B); S-J2 `estado.judge` e o efeito judge chegam ao `main.tsx` pelo `playerConnection` sem mudança (ele guarda o estado e a fila já parseados; J-B confere); S-J3 `FOLHA_DO_JUDGE` e `colunaDoJudge`/`direcaoPara`/`passosDaVirada` (J-A) usados por `judgeDoMapa.ts` (J-B). O `batalhaNoHost.ts` não muda (o estado sai de `vistaParaJogador`; o `turnosRev` sobe no `moverJudge`). Portão J (seção 7) por 1 agente; commit; perguntar ao usuário se publica (`scripts/publicar-versao.cjs`).

### Fatia T: Transformação e Selos
**Fase 0 (T-A sozinho): o contrato.** `lib/batalha/combate.ts` (tipos e constantes de 2.2), `turnos.ts` (campos), `registro.ts` (tipo `"selo"`, reversões, `"vez"` com selos, `TIPOS_QUE_O_JOGADOR_DESFAZ`), `transformacao.ts` e `selos.ts` (novos, assinaturas com corpo provisório honesto: `formasNoMenu` devolve as formas com motivo "ainda não", `lerDuracao` devolve null), `vistaDoJogador.ts` (campos e o recorte COMPLETO, puro, com `numerosVisiveis`), `net/protocoloDaBatalha.ts` (parsers dos pedidos, campos e efeitos novos), `stores/batalhaStore.ts` (`porSelo`, `editarSelo`, `tirarSelo` com corpo `false`), `lib/sistemaOnePiece.ts` (o campo Ação). Portão: `rtk proxy npx tsc --noEmit` limpo. Commit "contrato da F3".

**Fase 1 (os três juntos):**
| Escritor | Agent | Dono exclusivo de |
|---|---|---|
| T-A, regra e estado | `programador-frontend` | `lib/batalha/{transformacao,selos,leituraDaFicha,acoes,golpe,turnos,registro,combate}.ts`, `stores/batalhaStore.ts`, `lib/sistemaOnePiece.ts` |
| T-B, host, fio e fichas no mapa | `programador-frontend` | `net/batalhaNoHost.ts` (`numerosVisiveis` no `sync`: tokens das fichas dele e dos aliados), `net/protocoloDaBatalha.ts`, `player/playerConnection.ts`, `pixi/tokensRenderer.ts`, `pixi/tokenPhotoSprite.ts`, `pixi/PixiCanvas.tsx`, `player/PlayerView.tsx` |
| T-C, telas | `designer-opus` | `components/batalha/*` (novos `ListaDeFormas.tsx`, `SeloDialog.tsx`; os da F2), `components/batalha/{batalha,combate}.css`, `lib/batalha/escolhaDaImagem.ts` (novo), `App.tsx`, `player/main.tsx`, `player/player.css` |

Arquivos quentes, 1 dono: `batalhaStore.ts` e `turnos.ts` = T-A; `PixiCanvas.tsx`, `PlayerView.tsx`, `tokensRenderer.ts`, `batalhaNoHost.ts`, `playerConnection.ts` = T-B; `App.tsx`, `main.tsx` = T-C. Ninguém toca `lib/ajusteDaFicha.ts`, `lib/personagem.ts`, `net/hostSession.ts`, `net/protocol.ts`, `types/map.ts`, `fogFilter.ts`, `PEDIDOS.md`, `Minigames/`, nem as provas sujas do usuário.

Costuras T: S-T1 `formasNoMenu`, `motivoDaForma`, `lerDuracao`, `selosDoToken`, `textoDoSelo`, `aparenciaDaForma` (T-A) usados por `dadosDoMenu.ts`/`dadosDaFaixa.ts` (T-C); S-T2 o mestre chama `agir(..., { tipo: "transformar", ... })`, `porSelo`, `editarSelo`, `tirarSelo` direto; o jogador por `connection.agirNaBatalha(vez, pedido)` (existe); S-T3 `fotoDaForma` (T-B nos dois canvas) recebido do `App.tsx`/`main.tsx` (T-C); S-T4 `efeitosDaCena` e a fila do jogador já existem. Convivência da F2: costura que ainda não existe, T-C deixa por último e avisa; nunca cria no arquivo do outro; commit só dos próprios caminhos; portão global por 1 agente no fim.

Em voo por vez: 2 (J) ou 3 (T), dentro do teto de 5; nenhum `.rs` muda.

## 7. Critério de pronto (sem suíte)

Portão de máquina, igual nas duas fatias:
1. Em `client`: `rtk proxy npx tsc --noEmit` = 0 erros (inclui os `.test.ts`).
2. Em `client`: `npx vite build` sem erro; em `client/dist/assets/` há UM `judge-folha-<hash>.webp` (J) com o tamanho da folha final (perto de 1 MB), e a folha não aparece embutida em nenhum `.js` do `dist`.
3. `git status` só com os caminhos da seção 6 (mais o sujo do usuário: `Minigames/`, `docs/design/telhado/provas/pagina-de-teste.html`, `docs/verification/task4-e2e-evidencia.png`, e os arquivos do Judge que o agente do Blender ainda não commitou).
4. Nenhum `.rs` mudou.
5. As tabelas da seção 3 conferidas à mão pelo escritor da regra num rascunho FORA do repo (como na F2; não é arquivo de teste), saída colada no relatório.

Roteiro J (mestre no app + 2 jogadores no navegador; Lia e Bruno; NPC Ilo):
1. Iniciar batalha: o Judge aparece 2 casas ao norte da primeira ficha, respirando, nas 3 telas, por cima das fichas, com os pés no centro da casa.
2. Vez da Lia, a leste: ele vira para leste passando pelas direções do meio. Vez do Ilo, ao norte: vira para norte. Na tela de quem não vê o Ilo, fica como estava.
3. A Lia anda na vez dela: o Judge acompanha virando.
4. O mestre arrasta o Judge: só a tela dele anda no arrasto; ao soltar, encaixa na casa e as outras telas o mostram lá. O arrasto não seleciona nem move ficha. Esc no meio: volta.
5. No jogador, clicar no Judge não faz nada; a ficha de trás continua clicável.
6. O mestre desfaz uma linha no registro: nas 3 telas ele ergue a carta vermelha (sobe, segura 1 s, desce, volta a respirar). A Lia desfaz a dela: nada.
7. Encerrar: ele some nas 3 telas. Iniciar de novo: volta onde o mestre deixou. Em outro mapa: posição própria.
8. Zoom: escala com a grade.
9. Movimento reduzido: parado no quadro 1; vira de uma vez; a carta aparece erguida e parada por 1,5 s.
10. DevTools do jogador, WS: `batalha.estado` tem `judge: { x, y }` e mais nada do Judge; `batalha.efeitos` tem `{ tipo: "judge", gesto: "carta" }`. Network: a folha baixa uma vez, quando a batalha começa.
11. Fluidez: mapa grande, batalha ligada, Performance do Chrome no jogador e no mestre por 20 s: nenhuma tarefa longa de 200 ms ou mais; p95 do quadro não piora mais de 2 ms contra o mesmo mapa com a batalha desligada.

Roteiro T (Bruno: FOR 160, HP 900/1.200, SP 50/300; Punho Negro: FOR +60, HP +600, SP +100, Ação vazia, com imagem e a técnica "Punho de Ferro Negro"; Lia com "Rajada de Penas" cujo Efeito diz "Atordoa o alvo por 1 turno"; Vera, NPC, com a forma "Névoa Viva", HP +300):
1. Na ficha One Piece, a Transformação tem o campo Ação.
2. Vez do Bruno: a tira Transformação acende; Punho Negro com a prévia (FOR 160 → 220, HP máx 1.200 → 1.800, HP 900 → 1.500, SP...), Completa marcada, "Trocar a imagem" marcada.
3. Ativar: nas 3 telas, a animação roxa (cerca de 2,2 s, pula com clique); a Lia (aliada) vê os números. Depois: HP 1.500/1.800, SP 150/400, a Simples e o Mov gastos, a carta com contorno roxo e "PUNHO NEGRO", o token e o retrato com a imagem da forma nas 3 telas, "Punho de Ferro Negro" nas Habilidades. Registro: "Bruno ativa Punho Negro (Completa)", sem HP no texto.
4. Trocar para Bônus sem Bônus dado: Ativar apagado com o motivo.
5. "Desfazer a forma · ação livre": HP 1.200/1.200, a imagem volta, nenhuma ação gasta, texto curto sobre o token.
6. Ativar de novo e o Bruno desfaz a LINHA na vez dele: HP 900/1.200, a Completa volta, a imagem volta, linha riscada.
7. Ativar desmarcando "Trocar a imagem": nada de imagem; na próxima vez a caixa já vem desmarcada.
8. Vez da Vera, o mestre ativa Névoa Viva no painel: os jogadores veem a animação SÓ com o nome, sem números; nenhum HP de NPC no WS.
9. O mestre põe "Cego 2" no Ilo pelo menu da carta: as cartas do Ilo mostram "CEGO 2" em todas as telas que as veem; o Ilo joga: "CEGO 1"; joga na rodada seguinte: some, a linha da vez diz "Cego acabou em Ilo" e o texto aparece sobre ele.
10. Lia usa Rajada no Ilo: a mira traz "Selo: Atordoado · 1 turno" marcado; o Ilo defende (metade) e ganha o selo; noutro golpe ele esquiva e não ganha. Desfazer a linha do golpe tira o selo.
11. Desfazer a vez que acabou com um selo: o selo volta com 1.
12. Movimento reduzido: a transformação aparece e some, números já no fim, sem anéis.
13. Encerrar: selos e imagens somem; a forma segue (ou não) conforme a Q3.

Conferência de vazamento (WS do jogador): nenhum `numeros` em efeito de token que não é dele nem de aliado; `aparencias` só de tokens que a tela tem; `cartas[i].selos` só em cartas que ele vê; nada de HP, SP ou atributo de NPC.

## 8. Riscos e o que não confirmei

- R1 `ordem.test.ts` e o golden de camadas (`task-camadas-golden.spec.ts`) contam as faixas: com a faixa `judge` ficam vermelhos em runtime (os testes não rodam). Dizer na entrega. Saída se o usuário não quiser: o Judge como último filho do container das fichas (frágil: o desenhista reordena os filhos).
- R2 Textura de 3840x1920 = cerca de 29,5 MB de vídeo e precisa de `MAX_TEXTURE_SIZE` de 4096 ou mais (quase todo PC). Load que falha: o Judge some sem erro na tela (aviso no console). Folha final maior que 4096 num lado: partir em 2 texturas por linhas.
- R3 A respiração pede quadro 12 vezes por segundo com a batalha ligada. Medir no item 11 do roteiro J; se piorar, pausar a respiração com o Judge fora da vista e com a aba escondida.
- R4 Desfazer a LINHA da transformação depois de dano volta por delta (decisão 5 da F1): 800/1.800 vira 200/1.200. É "como se nunca tivesse transformado", mas pode assustar. O "Desfazer a forma" (ação livre) não tem isso.
- R5 Ligar ou desligar a forma pela FICHA no meio da batalha segue o caminho manual (Q2): sem ganho, sem animação, linha "ficha". A imagem some sozinha porque `aparenciaDaForma` exige o cartão ligado.
- R6 Duas formas com imagem ligadas: vale a última ativada; desfazer ela não volta a imagem da outra (YAGNI).
- R7 O Judge por cima de uma ficha tampa o clique nela no mestre (o corpo dele vence). O mestre o arrasta para o lado.
- R8 Sistema importado (cópia do One Piece na biblioteca) não ganha o campo Ação: lê vazio = Completa, e o seletor deixa trocar. Mesmo caso da aba Armas (F2).
- R9 Custo de SP da transformação não é cobrado (a aba não tem campo Custo); o dono ajusta à mão.
- R10 Colisão: a M2 dos livros e a fatia T não correm juntas; o conserto da aba Batalha precisa estar commitado antes da T-C.

Não confirmei:
- Se o `playerConnection` guarda campos novos do `batalha.estado` sem mudança (ele guarda o objeto parseado; o parser é da fase 0).
- Se `ImagemOuIniciais` e o corte do golpe já resolvem `midia:` no jogador.
- Se o `app.ticker` do editor renderiza sempre ou sob demanda (muda o custo do R3).
- Se a janela "Visão de jogador" (`visao-jogador.html`) monta o `PlayerView` com o estado da batalha; se sim, o Judge aparece lá de graça.
- Qual função o editor usa para encaixar no centro da casa (o J-B usa a mesma do arrasto de ficha).
- Diagrama (regra 2g): este agente não chama a skill. Fluxo para o orquestrador desenhar: mestre arrasta no `PixiCanvas` (`judgeGesture`), `moverJudge` na `batalhaStore`, `turnosRev`, `batalhaNoHost.sync`, `vistaParaJogador` (`judge`), `batalha.estado`, `playerConnection`, `main.tsx`, `PlayerView` + `judgeDoMapa` (direção calculada ali pela vez que a tela vê); desfazer do mestre, efeito "judge" na fila, `batalha.efeitos`, gesto nas duas telas.

## 9. Decisões que faltam ao usuário (só as que mudam o que ele vê)

Antes da fatia J:
- **Q7 Judge e as fichas.** Recomendo o Judge por cima das fichas e visível mesmo na névoa (é o juiz, não um personagem). Alternativa: por baixo das fichas, ou sumindo na névoa como ficha.
- **Q8 Vez fora da vista do jogador.** Recomendo que o Judge daquele jogador fique como estava (não denuncia onde está o escondido). Alternativa: virar mesmo assim (a direção sai do mestre).

Antes da fatia T:
- **Q1 Ganho da diferença.** Recomendo HP E SP (todo recurso com atual e máximo que a forma muda). Alternativa: só o HP, como diz a decisão 16 ao pé da letra.
- **Q2 Ligar pela ficha no meio da batalha.** Recomendo que a ficha siga o caminho manual de hoje (liga sem ganho e sem animação); ganho, animação e imagem são do menu. Alternativa: a ficha faz o mesmo que o menu com a batalha ligada.
- **Q3 Forma ao encerrar a batalha.** Recomendo que continue ligada (a ficha manda; só a imagem volta), com uma linha no Encerrar "Bruno segue em Punho Negro". Alternativa: o Encerrar desliga sozinho as formas ativadas na batalha.
- **Q4 Como o selo conta.** Recomendo "N turnos" = N vezes do alvo, descontando no fim da vez dele (1 vez por rodada). Alternativa: rodadas inteiras, descontando quando a rodada vira.
- **Q5 Quem vê o selo de NPC.** Recomendo todos que veem a carta ("ATORDOADO 2"), porque o efeito está na cena. Alternativa: só o mestre.
- **Q6 Selo sugerido da habilidade.** Recomendo que pegue quando o golpe acerta (Receber, Defender, Crítico, Não reagir, sem reação) e não em Esquivar nem Contra-atacar; o mestre tira ou põe à mão. Alternativa: sempre pega, e o mestre tira.

Já decidido pelo pedido ou pelo protótipo (dizer na entrega): Judge sai antes, como versão própria (30/10); só o desfazer do MESTRE ergue a carta; a escolha de trocar a imagem fica lembrada no aparelho de quem ativa; a imagem da forma vale só na batalha; as técnicas da forma já entram nas Habilidades desde a F2 (`leituraDaFicha.ts:148-161`).

## Próximo passo

O orquestrador leva Q7 e Q8 ao usuário antes da fatia J, e Q1 a Q6 antes da fase 0 da T (`AskUserQuestion`, até 4 por vez, com as recomendações). Fatia J: `programador-frontend` (J-A) com 2.2 (judge), 3.1, 4 (linhas J) e 6 (fatia J); depois do commit do `judge.ts` e da folha final do agente do Blender, `programador-frontend` (J-B) com 5.1, 5.4 (parte J) e as costuras S-J; portão J e roteiro J por um agente só; perguntar se publica. Fatia T: `programador-frontend` (T-A) faz a fase 0 e commita "contrato da F3"; depois T-A, T-B (`programador-frontend`) e T-C (`designer-opus`, skills do Emil) em paralelo na main, com a tabela da seção 6 e as costuras S-T no prompt de cada um; portão final por um agente só.

## Respostas do usuário (30/10/2026)
- Q7: Judge por cima das fichas e sempre visível, mesmo na névoa.
- Q8: vez de alguém fora da vista do jogador: o Judge daquele jogador fica como estava.
- Crista: "Abre a crista no meio" (folha v4.1 sendo refeita nos mesmos caminhos; a fatia J usa o arquivo que estiver em docs/design/judge/v2-mcp/ na hora da montagem).
- Arena de testes (pedido novo, depois da fatia J): marcador "Arena de testes" no mundo do livro; fichas de cada lado ou uma só contra o Judge-boneco; o mesmo sistema de batalha numa arena pequena; o mestre controla todos os lados; nada mexe nas fichas de verdade. Boneco: começa com vida infinita e placar (dano por golpe, total, média por rodada; reage com d20 ou fica parado), com opção de ajustar HP, Escudo e modificador de reação.
- Q1: o ganho da diferença vale para HP E SP (todo recurso com atual e máximo que a forma aumenta).
- Q2: ligar a forma pela ficha no meio da batalha continua manual (sem ganho, sem animação).
- Q3: ao encerrar a batalha a forma continua ligada; só a imagem volta; linha "Bruno segue em Punho Negro".
- Q4: o selo conta pela vez do alvo (N turnos = N vezes do alvo, desconta no fim da vez dele).
- Q5: o selo de NPC aparece para todos que veem a carta.
- Q6: o selo sugerido pela habilidade só pega se o golpe acerta (não em Esquivar nem Contra-atacar).
