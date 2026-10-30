# Batalha One Piece, F2 (Ações e golpe): plano de implementação

Base: main `acbcd4e1`, 30/10/2026. Fontes lidas: `docs/planos/batalha-one-piece-2026-10-30.md` (decisões 6, 8 a 15 e 17), `docs/planos/batalha-one-piece-f1-plano.md`, o código da F1 (`lib/batalha/{turnos,registro,equipes,regrasDoCampo,vistaDoJogador,ponte}.ts`, `net/protocoloDaBatalha.ts`, `net/batalhaNoHost.ts`, `stores/batalhaStore.ts`, `components/batalha/`), `docs/design/batalha-persona/README.md` e `prototipo.html` (menu 236-291 e 1104-1161, mira 299-315 e 1233-1271, reação 327-346 e 1496-1562, sugestão do NPC 1567-1579, corte 404-413 e 1800 em diante, número 415), `lib/personagem.ts`, `lib/sistemaOnePiece.ts`, `lib/sistemaDeRpg.ts`, `lib/ajusteDaFicha.ts`, `lib/dice.ts`, `net/protocoloDoPersonagem.ts`, o livro (`lib/livroOnePiece.ts:36`, Concentração). Plano de leitura: nada foi editado nem executado no repo.

(Nos trechos de código as aspas são duplas por causa da ferramenta que escreveu este arquivo; no código, sigam o estilo do repo, aspas simples.)

## 0. Entendimento e premissas

Na vez dele, o jogador abre um menu de tiras sobre o mapa e age: ataca com uma arma levada para a batalha, usa uma habilidade (o app cobra o SP, calcula o dano quando a fórmula é fácil, gasta a ação, conta recarga e usos), concentra ou encerra a vez. O golpe vai a um ou mais alvos; cada alvo reage (1d20 + modificador rolado pelo HOST, Rerolar, Não reagir) e o dano final cai na ficha, com corte, d20, número e tremor. O mestre faz o mesmo pelos NPCs num painel com a sugestão já marcada, dá ações extras e dano livre a qualquer um. Tudo vira linha do registro com Desfazer.

Premissas (do código):
- O host é o mestre (mesmo processo). O jogador só PEDE; quem valida a regra do jogo e muda a ficha é a store do mestre (`batalhaStore`), pela `ponteDaBatalha` (molde da F1). O host confere o que é dele saber: dono da ficha, vez, recorte.
- Quem rola o d20 é sempre o host (`secureRollDie`, `lib/dice.ts:104`), como no `dice.roll`.
- Ficha muda só por `useAdventureStore.getState().ajustarPersonagem(id, atual => aplicarAjustes(...))` (o caminho do Desfazer da F1, `batalhaStore.ts:267`): o histórico da ficha cresce e a mudança chega ao jogador pelo `syncPersonagens` de sempre.
- Tudo novo da batalha mora na SESSÃO (store). Só a aba Armas e a escolha "Armas por batalha" vão ao disco, dentro da ficha.
- `tsc` cobre os `.test.ts`: tipo existente só ganha campo OPCIONAL; assinatura existente só ganha parâmetro novo opcional.

## 1. Abordagens consideradas

- **Escolhida: regra pura em `lib/batalha/` + store do mestre como única autoridade + 4 pedidos novos do jogador + `batalha.estado` estendido (campos opcionais) + mensagem `batalha.efeitos` só para animação.** O registro e o Desfazer da F1 servem sem mudar de forma (a `Reversao` só ganha 2 tipos).
- Rejeitada: validar a regra do jogo no host E na store. Duas cópias da economia de ações divergem; o host confere posse e vez, a store confere a regra, as duas pela mesma `lib`.
- Rejeitada: deduzir as animações do diff do `batalha.estado`. O estado é deduplicado por JSON e não tem ordem de eventos; golpe em 3 alvos viraria um borrão. Fila de efeitos com `seq` por cena, só o novo por conexão.
- Rejeitada: rolar o d20 no cliente e mandar o número. Fronteira de confiança é o host.
- Rejeitada: campo novo `Personagem.armasPorBatalha`. Exige leitor novo, parte nova no `personagem.editar` do jogador e tela nova; a escolha do sistema já existe nas três pontas (Q1).

## 2. Modelo de dados

### 2.1 Disco: a ficha One Piece (`lib/sistemaOnePiece.ts`)

Aba nova, depois de Transformações, no formato que o sistema já tem (nenhum tipo novo em `sistemaDeRpg.ts`; o jogador recebe pelo `rpg.sistema`, e `abaDoArquivo` já lê tudo):
```ts
{
  id: "armas", nome: "Armas", item: "Arma", vazio: "Nenhuma arma.",
  campos: [
    { id: "dano", rotulo: "Dano", forma: "linha" },
    { id: "acao", rotulo: "Ação", forma: "linha" },
    { id: "modificador", rotulo: "Modificador", forma: "linha" },
    { id: "efeito", rotulo: "Efeito", forma: "linha" },
    { id: "descricao", rotulo: "Descrição", forma: "paragrafo" },
  ],
  imagem: true,
}
```
"Armas por batalha" (Q1, recomendado): uma ESCOLHA do sistema, ao lado de Raça e Ofício:
```ts
{ id: "armasPorBatalha", rotulo: "Armas por batalha", opcoes: ["1 arma", "2 armas", "3 armas", "4 armas", "5 armas", "6 armas"] }
```
Vazio (a opção "nenhuma" do select) = sem limite. Lida pelo número do começo. Zero mudança de leitor, de protocolo (`parsePartesDoPersonagem` já aceita `escolhas`, `protocoloDoPersonagem.ts:308`) e de tela (a ficha já desenha o select e o chip "2 armas", `FichaDePersonagem.tsx:106-138`).

Nada mais vai ao disco. As armas do Siegfried em texto livre ficam como estão: o dono cria os cartões na aba nova.

### 2.2 Sessão: tipos novos (`lib/batalha/combate.ts`, novo)

```ts
/** O que a reação deu. "naoReagiu" = escolheu Não reagir; "semReacao" = Surpresa, Overload ou contra-ataque. */
export type SaidaDaReacao = "critico" | "cheio" | "metade" | "esquiva" | "contra" | "naoReagiu" | "semReacao"
export type AcaoDaTecnica = "simples" | "completa" | "bonus" | "livre"

/** Estado de combate de UM personagem nesta batalha (por personagemId: duas fichas do mesmo personagem dividem). */
export interface CombateDoPersonagem {
  recargas: Readonly<Record<string, number>>  // cartaoId -> turnos que faltam (0 sai da lista)
  usos: Readonly<Record<string, number>>      // cartaoId -> vezes usadas ("2 vezes por combate")
  overload: boolean                           // já usou um Overload nesta batalha (trava todos)
  carga: 0 | 1 | 2 | 3                         // concentração para o PRÓXIMO golpe
  concentrouEm?: string                        // "rodada:cartaId" da vez em que concentrou (1 por vez)
  armas: readonly string[] | null              // cartaoIds da aba Armas levados; null = ainda não escolheu
}

export interface PedidoDeAlvo { tokenId: string; dano: number | null }  // o que chega ANTES da reação; null = sem dano

export type PedidoDeAcao =
  | { tipo: "atacar"; armaId: string | null; alvos: readonly PedidoDeAlvo[]; surpresa: boolean; contraDe?: string }
  | { tipo: "habilidade"; cartaoId: string; armaId: string | null; alvos: readonly PedidoDeAlvo[]; surpresa: boolean
      custo: number | null        // o confirmado na tela; null = o da ficha
      acao: AcaoDaTecnica | null  // só quando a ficha não diz; null = a da ficha
      contraDe?: string }
  | { tipo: "concentrar" }

export type PedidoDeReacao =
  | { tipo: "rolar"; golpeId: string | null; tokenId: string; modificador: number } // golpeId null = reação livre
  | { tipo: "rerolar"; golpeId: string; tokenId: string; modificador: number }
  | { tipo: "escolher"; golpeId: string; tokenId: string; saida: SaidaDaReacao }   // só uma das liberadas pelo dado
  | { tipo: "naoReagir"; golpeId: string; tokenId: string }

export interface RolagemDaReacao { d20: number; modificador: number; total: number; vezes: number }

export interface AlvoDoGolpe {
  tokenId: string
  personagemId: string | null
  dano: number | null        // o que chega (já com concentração e Surpresa); null = golpe sem dano
  podeReagir: boolean
  rolagem?: RolagemDaReacao
  saida?: SaidaDaReacao
  danoFinal?: number          // presente = resolvido
}

export interface GolpeDaBatalha {
  id: string                  // "golpe_" + uuid
  linhaId: string             // a linha do registro que este golpe atualiza
  cartaId: string; rodada: number
  atacanteTokenId: string; atacantePersonagemId: string | null
  autor: AutorDaAcao
  nome: string                // da arma, da habilidade, ou "Ataque"
  surpresa: boolean; overload: boolean; contraDe?: string
  alvos: readonly AlvoDoGolpe[]
}

export type EfeitoDaBatalha =
  | { seq: number; tipo: "golpe"; golpeId: string; atacanteTokenId: string; nome: string; alvos: readonly string[]; surpresa: boolean; overload: boolean }
  | { seq: number; tipo: "reacao"; golpeId: string | null; tokenId: string; d20: number; modificador: number; total: number }
  | { seq: number; tipo: "dano"; tokenId: string; valor: number; saida: SaidaDaReacao | "direto" }

export const ALVOS_MAX = 12
export const ARMAS_NA_BATALHA_MAX = 20
export const GOLPES_PENDENTES_MAX = 20
export const EFEITOS_GUARDADOS = 50
export const EFEITOS_POR_MENSAGEM = 20
export const CARGA_MAX = 3
export const MULTIPLICADOR_DA_CARGA = [1, 1.5, 2, 3.5] as const   // livro: 1,5x, 2,0x, 3,5x
export const MULTIPLICADOR_DA_SURPRESA = 1.5
export const MULTIPLICADOR_DO_CRITICO = 1.5
export const MODIFICADOR_DA_REACAO_MAX = 99                          // = DICE_MODIFIER_LIMIT
```

### 2.3 Sessão: o que muda nos tipos da F1 (só campos opcionais)

- `turnos.ts`, `TurnosDaCena`: `combate?: Readonly<Record<string, CombateDoPersonagem>>` (por personagemId) e `golpes?: readonly GolpeDaBatalha[]` (só os que ainda têm alvo sem resolver). Moram em `TurnosDaCena` para o `reverterTurnos` desfazê-los. `AcoesExtras` ganha `rodada?: number` (em que rodada foi dada).
- `turnos.ts`, `passarVez` e `darVez`: (a) as extras "rodada" da carta que SAI somem, e todas as "rodada" somem ao virar a rodada; (b) o personagem da carta que ENTRA tem as `recargas` menos 1 (no 0 sai da lista). Por isso a `Reversao` "vez" ganha `antes.extras?` e `antes.combate?` (os mapas inteiros de antes; pequenos).
- `registro.ts`, `Reversao`, dois tipos novos:
  - `{ tipo: "combate"; personagemId: string; antes: CombateDoPersonagem | null }`
  - `{ tipo: "golpe"; golpeId: string }` (desfazer = tira o golpe de `golpes`: alvo que ainda esperava a reação não recebe mais nada)
- `registro.ts`: `TIPOS_QUE_O_JOGADOR_DESFAZ` passa a `ficha, acao, golpe, habilidade, dano, reacao` (só as dele, só na vez dele; o resto da regra da F1 não muda).
- `ponte.ts`, `BatalhaEmTurnos`: `efeitos?: readonly EfeitoDaBatalha[]` (últimos `EFEITOS_GUARDADOS`, `seq` crescente por cena). Fora de `turnos`: efeito não se desfaz.
- `vistaDoJogador.ts`, `EstadoParaJogador` ganha (todos opcionais; ausente = nada):
```ts
acoes?: AcoesParaJogador            // só com minhaVez
meus?: CombateParaJogador[]         // um por personagem DELE com carta na ordem
reacoes?: ReacaoParaJogador[]       // golpes pendentes cujo alvo é ficha DELE
golpes?: GolpeParaJogador[]         // golpes pendentes com atacante E alvos no recorte dele ("Esperando a reação de Ilo")

interface Contagem { usadas: number; total: number }
interface AcoesParaJogador { simples: Contagem; movimento: Contagem; bonus: Contagem; blocos: { andados: number; limite: number | null } }
interface CombateParaJogador { personagemId: string; recargas: Record<string, number>; usos: Record<string, number>; overload: boolean; carga: number; concentrouNestaVez: boolean; armas: string[] | null; limiteDeArmas: number | null }
interface ReacaoParaJogador { golpeId: string; tokenId: string; atacante: string; nome: string; dano: number | null; rolagem?: RolagemDaReacao }
interface GolpeParaJogador { golpeId: string; atacanteTokenId: string; nome: string; alvos: { tokenId: string; d20?: number; total?: number; saida?: SaidaDaReacao }[] }
```
  Regra do recorte (a da F1, mais): nunca HP, SP, recarga, usos, carga nem armas de quem não é DELE; `reacoes` só das fichas dele; `golpes` só com todos os tokens no recorte; o `dano` da reação é o número que chega nele (ele precisa ver "quanto").
- `ponte.ts`, `PonteDaBatalha` ganha:
```ts
agir(sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao): boolean  // vez null só com contraDe
reagir(sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeReacao): boolean
darDano(sceneKey: string, autor: AutorDaAcao, tokenId: string, valor: number): boolean
escolherArmas(sceneKey: string, autor: AutorDaAcao, personagemId: string, armas: readonly string[]): boolean
```
- `GastoDaVez` (já tem `simples`, `movimento`, `bonus`, `blocos`) não muda. `blocos` passa a ser somado pelo `somarCaminho` quando a ficha que andou é a da carta da vez (e `turnosRev` sobe, para o "Mov 2/4" chegar).

### 2.4 Store (`stores/batalhaStore.ts`, só sessão)

Ações novas (o mestre chama direto; o jogador pela ponte):
- `agir(sceneKey, autor, vez, pedido): boolean`: confere a regra (`podeAgir`), cobra o custo pela aventura, gasta a ação, marca recarga, usos e Overload, zera a carga usada, cria o `GolpeDaBatalha` (alvo sem reação resolve na hora), escreve UMA linha ("golpe", "habilidade" ou "acao") e os efeitos.
- `reagir(sceneKey, autor, pedido): boolean`: rola com `secureRollDie(20)` e guarda a rolagem, ou resolve (`escolher`, `naoReagir`): aplica o dano final pela aventura, ATUALIZA a linha do golpe (texto e `reversao.partes` ganham a ficha do alvo) e solta os efeitos "reacao" e "dano". Golpe sem alvo pendente sai de `golpes`.
- `darDano(sceneKey, autor, tokenId, valor)`: linha "dano", efeito "dano" (a animação toca sempre).
- `darAcoesExtras(sceneKey, cartaId, extras: AcoesExtras | null)`: linha "acoesExtras" (reversão "acoesExtras", já existe).
- `escolherArmas(sceneKey, autor, personagemId, armas)`: linha "acao" (reversão "combate").
- `somarCaminho` (existe): soma também em `gastos[vez].blocos` se `tokenId` é o da carta da vez.
- `normalizarCena` (existe): golpe cujo atacante sumiu sai; alvo que sumiu sai do golpe.
- `desligar` (existe): leva tudo junto.
- Export novo para a costura: `efeitosDaCena(state, sceneKey)`.

Toda escrita sobe `turnosRev` (o host refaz o recorte); efeito novo também (o `sync` do host os manda).

## 3. Lógica pura nova em `lib/batalha/` (com exemplos das fichas reais)

### 3.1 `leituraDaFicha.ts`: custo, ação, tempo, Overload, armas, técnicas
```ts
export type LeituraDoCusto =
  | { tipo: "nada" }
  | { tipo: "valor"; recurso: "sp" | "hp"; valor: number; porTurno: boolean }
  | { tipo: "pergunta"; recurso: "sp" | "hp"; sugestao: number | null; texto: string }
export function lerCusto(texto: string, personagem: Personagem): LeituraDoCusto
export function lerAcao(texto: string): { acao: AcaoDaTecnica | "passiva" | null; overload: boolean; transformacao: boolean; tambemReacao: boolean }
export type LeituraDoTempo = { tipo: "livre" } | { tipo: "recarga"; turnos: number } | { tipo: "usos"; vezes: number } | { tipo: "overload" } | { tipo: "texto"; texto: string }
export function lerTempo(texto: string): LeituraDoTempo
export function ehOverload(cartao: CartaoDaFicha): boolean   // ação, tempo ou extra de NOME "OVERLOAD"
export function tecnicasDe(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[]  // Habilidades + subcartões das transformações LIGADAS
export function armasDe(personagem: Personagem): CartaoDaFicha[]                             // aba "armas"
export function limiteDeArmas(personagem: Personagem): number | null                         // escolha "armasPorBatalha"
```
Leitura leve: minúsculas, sem acento, espaços juntados; "-" ou vazio = nada.

| Custo | Saída |
|---|---|
| "-35 de SP" | valor, sp, 35 |
| "15SP" | valor, sp, 15 |
| "35 SP" | valor, sp, 35 |
| "45" (número sozinho) | valor, sp, 45 (SP é a unidade padrão) |
| "-15 (Por turno)" | valor, sp, 15, porTurno (cobra 15 agora; a tira avisa "por turno: cobre à mão nas próximas") |
| "20 HP" | valor, hp, 20 |
| "10% do Hp..." com HP atual 450 | pergunta, hp, sugestão 45 ("10% do HP atual"), o texto da ficha ao lado |
| "-35 de SP + 10 HP", "Metade do SP" | pergunta, sp, sem sugestão |
| "-" ou "" | nada |

| Ação | Saída |
|---|---|
| "Completa" | completa |
| "Ação Simples", "Simples" | simples |
| "Bonus", "Bônus", "Ação Bônus" | bonus (apagada até o mestre dar Bônus, decisão 8) |
| "Reação/Ação Completa" | completa, tambemReacao (na vez dele é Completa; reação com habilidade fica manual) |
| "OVERLOAD" e "TRANSFORMAÇÃO" separados por barra vertical | completa, overload, transformacao |
| "Passiva..." | passiva (apagada: "Passiva: vale sempre") |
| "Livre" | livre (não gasta) |
| "", "-", outra coisa | null: a confirmação pergunta (Simples já marcada; Completa, Bônus e Livre ao lado) |

| Tempo | Saída |
|---|---|
| "1" a "5", "3 turnos" | recarga N |
| "2 Vezes por Combate" | usos 2 |
| "1 vez na batalha" | usos 1 |
| "OVERLOAD" | overload |
| "-", "" | livre |
| "Enquanto durar a forma" | texto (aparece; sem contador) |

Recarga: usou com Tempo N, o contador vai a N; a cada começo de vez do personagem desce 1; 0 = disponível. Tempo "2" usado na R1: na R2 apagada ("Recarga: 1 turno"), na R3 disponível. Tempo "1" = uma vez por turno.
Overload: uma vez por batalha por personagem; usar um apaga TODOS os Overload dele ("Overload: já usado nesta batalha"; livro, `livroOnePiece.ts:24`); golpe Overload não deixa reagir.

### 3.2 `formula.ts`: o dano da ficha
```ts
export interface ContextoDaFormula { personagem: Personagem; sistema: SistemaDeRpg; arma: CartaoDaFicha | null; vidaDoAlvo: { atual: number; maximo: number } | null }
export type LeituraDoDano =
  | { tipo: "semDano" }                                  // "-": habilidade de suporte
  | { tipo: "valor"; valor: number; conta: string }      // "(160 Força + 20) + 8 Gram = 188"
  | { tipo: "precisaArma"; conta: string }               // fala de "Dano da Arma" e não há arma escolhida
  | { tipo: "precisaAlvo" }                              // "% da vida do alvo" sem a vida do alvo conhecida
  | { tipo: "naoEntende"; texto: string }                // campo vazio, digita à mão
export function lerDano(texto: string, ctx: ContextoDaFormula): LeituraDoDano
```
Gramática pequena, descida recursiva, SEM `eval`: soma e subtração; vezes (asterisco, "x", "×") e divisão; parênteses; menos na frente; número com vírgula ou ponto ("1,5"). Variáveis, sem acento e sem caixa: o nome ou a abreviação de cada atributo do sistema (Força ou FOR..., valor = o TOTAL, `atributoComposto().total`); "dano da arma", "dano de arma", "arma" (o campo Dano da arma, lido pela mesma gramática, sem arma dentro). Enfeite depois de número ou variável: "de dano", "de dano base", "dano", "base", "pontos"; "de" + uma palavra desconhecida vira rótulo da conta ("50 queimadura"). Qualquer outra palavra, dado ("1d6") ou sobra = `naoEntende`. Atalho antes da gramática: "N% de/da vida/HP (atual/máxima) do alvo" = porcentagem da vida do alvo (a atual por padrão). Resultado arredondado para BAIXO, nunca negativo.

Exemplos (Força 160, Agilidade 95; armas Balmung "5" e Gram "8"):

| Fórmula | Arma | Saída |
|---|---|---|
| "Força + 45 de dano" | nenhuma | 205, "160 Força + 45 = 205" |
| "(Força + 20) + Dano da Arma" | Gram | 188, "(160 Força + 20) + 8 Gram = 188" |
| "(Força + 20) + Dano da Arma" | nenhuma escolhida | precisaArma |
| "3*(Força+Agilidade+Dano da Arma) + 50 de queimadura" | Balmung | 830, "3 × (160 + 95 + 5 Balmung) + 50 queimadura = 830" |
| "(Força + 40 de dano base) * 1,5" | nenhuma | 300, "(160 Força + 40) × 1,5 = 300" |
| "10% de Vida Atual do Alvo" | alvo é ele ou aliado com HP 450 | 45 |
| "10% de Vida Atual do Alvo" | alvo NPC, na tela do jogador | precisaAlvo (ele nunca vê a vida do NPC; digita) |
| "10% de Vida Atual do Alvo" | mestre, NPC atacando Lia (HP 380) | 38 |
| "200" | nenhuma | 200 |
| "-" | nenhuma | semDano |
| "Força + 1d6", "Metade da Força" | nenhuma | naoEntende |

Dano do "Atacar" com arma (Q2, recomendado): "Força + Dano da arma", com a conta; Balmung = "160 Força + 5 Balmung = 165". Editável sempre.

### 3.3 `acoes.ts`: economia da vez, motivo de bloqueio, menu
```ts
export interface AcoesDaVez { simples: Contagem; movimento: Contagem; bonus: Contagem; blocos: { andados: number; limite: number | null } }
export function acoesDaVez(gasto: GastoDaVez | undefined, extras: AcoesExtras | undefined, rankDeAgilidade: number | null, blocosPorRank: number): AcoesDaVez
export function rankDeAgilidade(personagem: Personagem, sistema: SistemaDeRpg): number | null   // rankDoValor(tabela, valorDoRank)
export function cabeAcao(acoes: AcoesDaVez, acao: AcaoDaTecnica): boolean
export function gastarAcao(gasto: GastoDaVez, acao: AcaoDaTecnica): GastoDaVez
export interface TecnicaNoMenu { cartao: CartaoDaFicha; forma?: string; custo: LeituraDoCusto; acao: AcaoDaTecnica | "passiva" | null; tempo: LeituraDoTempo; dano: LeituraDoDano; overload: boolean; motivo: string | null }
export function tecnicasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez | null, arma: CartaoDaFicha | null): TecnicaNoMenu[]
export function motivoDoConcentrar(combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez, chaveDaVez: string): string | null
```
Regras: Simples = 1 + extras.simples; Movimento = 1 + extras.mov; Bônus = extras.bonus (decisão 8). Completa gasta 1 Simples + 1 Movimento. Concentrar gasta a Simples (ou a Bônus, se só sobrou ela; livro: "abre mão de sua ação simples ou qualquer ação extra"), uma vez por vez, carga até 3; com carga 3 o golpe seguinte é Completa (livro, "Atenção 3"). Limite de blocos = rank da Agilidade × blocos por rank da regra do campo × Movimentos que sobraram (a Completa gasta o Movimento e o limite vai a 0: andar fica vermelho, nunca trava, decisão 6). Sistema sem rank: limite null ("Mov 3").

| Situação | Saída |
|---|---|
| Começo da vez, Agilidade 95 (limiares 33, 60, 90: rank 4), 1 bloco por rank | Simples 0/1 · Mov 0/1 · Bônus 0/0 · blocos 0/4 |
| Usou Rajada de Penas (Simples) | outra Simples apagada: "A ação simples deste turno já foi usada" |
| Quer uma Completa depois da Simples | apagada: "Completa precisa da Simples e do Movimento" |
| Andou 5 com limite 4 | "Mov 5/4" vermelho; nada trava |
| Mestre deu +1 Simples "só nesta vez" | Simples 1/2; some ao passar a vez |
| Corrente Ascendente (Bônus) sem Bônus dado | apagada: "Ação bônus: só quando o mestre dá" |
| SP 80, custo 120 | apagada: "SP insuficiente: custa 120, você tem 80" |
| Tempo "2" usada na rodada anterior | apagada: "Recarga: 1 turno" |
| "1 vez na batalha" já usada | apagada: "Já usada nesta batalha (1/1)" |
| Concentrou em 3 vezes seguidas | carga 3; próximo golpe ×3,5 e gasta a Completa |
| Concentrar de novo na mesma vez | apagado: "Já concentrou nesta vez" |

### 3.4 `reacao.ts`: d20 e dano final
```ts
export function saidasPossiveis(d20: number, total: number): SaidaDaReacao[]   // a melhor primeiro
export function fatorDaSaida(saida: SaidaDaReacao): number                       // critico 1,5; cheio, naoReagiu, semReacao 1; metade 0,5; esquiva e contra 0
export function danoQueChega(base: number, carga: number, surpresa: boolean): number   // floor(base × carga × Surpresa)
export function danoFinal(chega: number, saida: SaidaDaReacao): number                 // floor(chega × fator)
export function ajustesDoDano(personagem: Personagem, sistema: SistemaDeRpg, dano: number): Ajuste[]  // conforme a Q4
```
Regra (Q3, recomendada): o 1 NATURAL é crítico (×1,5) com qualquer modificador; 10, 15 e 20 contam pelo TOTAL. Com 10 ou mais o alvo escolhe entre as liberadas (protótipo, `saidasPossiveis`, 596-603): 20+ Contra-atacar, Esquivar ou Defender; 15+ Esquivar ou Defender; 10+ Defender; abaixo, "Receber o golpe".

| Dano que chega | d20 | Modificador (total) | Saída | Dano final |
|---|---|---|---|---|
| 260 | 7 | +2 (9) | cheio | 260 |
| 260 | 8 | +2 (10) | metade | 130 |
| 260 | 13 | +2 (15) | esquiva (ou metade) | 0 |
| 260 | 18 | +2 (20) | contra (ou esquiva, metade) | 0 |
| 260 | 1 | +5 (6) | critico | 390 |
| 260 | nenhum | Não reagir | naoReagiu | 260 |
| base 205, carga 2 (×2), Surpresa | nenhum | sem reação | semReacao | 615 (205 × 2 × 1,5) |
| base 260, Overload | nenhum | sem reação | semReacao | 260 |

Escudo (Q4, recomendado "Escudo primeiro"): Escudo 50, HP 450, dano 130 = Escudo 0, HP 370. Sem Escudo: só o HP, parando no 0 (`aplicarAjuste` já limita).

### 3.5 `golpe.ts`: os reducers que a store chama (fase 1, A)
```ts
export function podeAgir(ctx: ContextoDoGolpe, pedido: PedidoDeAcao): string | null   // motivo; null = pode
export function lancarGolpe(ctx: ContextoDoGolpe, pedido: PedidoDeAcao, ids: { golpe: string; linha: string }): GolpeLancado
export function rolarReacao(golpe: GolpeDaBatalha, tokenId: string, modificador: number, d20: number): GolpeDaBatalha
export function resolverAlvo(golpe: GolpeDaBatalha, tokenId: string, saida: SaidaDaReacao): GolpeDaBatalha
export function sugestaoParaNpc(npc: Personagem, cena: BatalhaEmTurnos, ctx: ContextoDaMesa): { cartaoId: string | null; armaId: string | null; alvoTokenId: string | null }
```
`GolpeLancado` = o golpe, o `GastoDaVez` novo, o `CombateDoPersonagem` novo, os ajustes de custo do atacante e os alvos já resolvidos (sem reação). A store aplica os ajustes pela aventura, monta a linha e os efeitos.

Sugestão do NPC (decisão 17; protótipo 1567-1572): a técnica DISPONÍVEL de maior dano calculável que ele paga (nenhuma calculável: a primeira disponível; sem técnica: Atacar com a primeira arma); o alvo = combatente de OUTRA equipe (NPC sem equipe: os de tipo jogador), que não caiu, com a menor proporção de vida. Ex.: Vera (SP 80) com Névoa (custo 50, dano 300) e Prisão (custo 120, dano 450) = Névoa; alvos Lia 240/450 (53%) e Bruno 900/1200 (75%) = Lia.

### 3.6 Registro: textos e Desfazer

Uma linha por golpe, ATUALIZADA a cada alvo resolvido (mesmo `id`). `envolve.tokenIds` = atacante + alvos; `envolve.personagemIds` = [] (senão a linha de NPC some do jogador pela regra da F1, `registro.ts:162-168`; o recorte por token basta). O texto nunca traz HP, SP nem custo:
- "Lia usa Rajada de Penas em Ilo: 260 · d20 7+2 = 9 · recebeu 260"
- "Vera usa Névoa em Lia (Surpresa): 615 sem reação"
- "Lia usa Rajada em Ilo e Teo: Ilo d20 15, esquivou · Teo esperando reação"
- "Lia concentrou (carga 2)" · "Mestre: +1 Simples para Bruno (só nesta vez)" · "Mestre deu 50 de dano em Ilo" · "Lia reagiu: d20 12+1 = 13" (reação livre) · "Siegfried levou Balmung e Gram"

A `reversao` do golpe é `composta`: [`gasto` de antes, `combate` de antes, `ficha` do atacante (custo), `golpe` (tira o pendente), depois uma `ficha` por alvo resolvido]. Desfazer volta tudo, alvo a alvo, por delta (F1). Golpe desfeito com alvo esperando: a caixa REAÇÃO some. O jogador desfaz a linha dele só na vez dele; o mestre, qualquer uma.

## 4. Protocolo (`net/protocoloDaBatalha.ts`; `protocol.ts` só ganha as uniões e os `case`)

Jogador para host (tudo com `reqId`; resposta `batalha.resultado` com `reqId` e `ok`, recusa sem motivo, como na F1):

| Mensagem | Campos | O host confere (`batalhaNoHost`) | A store confere |
|---|---|---|---|
| `batalha.agir` | `vez` (cartaId e rodada, ou null), `pedido: PedidoDeAcao` | cena DELE em batalha; a vez é essa carta nessa rodada e o token é dele (`ownership`); `vez` null só com `contraDe` de golpe cujo alvo DELE saiu "contra" e ainda não revidou; personagem da carta em `meusPersonagens`; alvos em `fichasNaTela`; `reqId` repetido devolve o mesmo `ok` sem agir de novo | `podeAgir`: técnica existe (aba ou forma ligada), não passiva, recarga 0, usos, Overload, ação cabe, custo cabe, arma entre as levadas, alvos com personagem, no máximo `ALVOS_MAX`, dano inteiro de 0 a 1.000.000 ou null |
| `batalha.reagir` | `pedido: PedidoDeReacao` | o token é dele; com `golpeId`, existe golpe pendente com esse alvo | rolar só sem rolagem; rerolar só com rolagem; escolher só uma de `saidasPossiveis`; modificador inteiro de -99 a 99 |
| `batalha.dano` | `tokenId`, `valor` (1 a 1.000.000) | o token é dele e tem personagem | aplica e anima |
| `batalha.armas` | `personagemId`, `armas: string[]` (até 20) | personagem dele, com carta na ordem; ele ainda não escolheu (Q8) | ids da aba Armas; no máximo o limite |

Host para jogador:

| Mensagem | Campos | Quando |
|---|---|---|
| `batalha.estado` | o de hoje + `acoes`, `meus`, `reacoes`, `golpes` (opcionais) | como hoje: só se o JSON mudou para a conexão |
| `batalha.efeitos` | `efeitos: EfeitoParaJogador[]` (até 20) | no `sync`, os de `seq` maior que o último enviado à conexão e com todos os tokens no recorte dela; ao entrar, marca o `seq` atual sem mandar os velhos (nada de reprise) |

`EfeitoParaJogador` = `EfeitoDaBatalha` só com tokens que ele vê e nomes. O número do dano vai a quem vê a ficha (Q5, recomendado); vida e SP de NPC nunca.

Teto de pedidos: `PEDIDOS_DE_BATALHA_POR_JANELA` de 10 para 20 (golpe em 4 alvos + rerolagens cabe). Parser: ids até `ID_DA_BATALHA_MAX`, enum fechado em cada `tipo`, lista acima do teto recusa a mensagem inteira (molde da F1).

O golpe pendente esperando a reação:
1. Lia lança Rajada em Ilo e Teo: a store cria o golpe com 2 alvos esperando, cobra 45 SP, gasta a Simples, solta o efeito "golpe" (corte em todas as telas que veem Lia e os alvos).
2. Ilo e Teo são NPC: o mestre vê a REAÇÃO de cada um na aba Batalha (ou "Rolar as 2 reações de NPC"). Se o alvo fosse Bruno, o `batalha.estado` dele traria `reacoes: [{ golpeId, tokenId, atacante: "Lia", nome: "Rajada de Penas", dano: 260 }]` e a caixa abriria na tela dele.
3. Rolar: `batalha.reagir` (rolar), o host rola, a `rolagem` entra no estado e o efeito "reacao" gira o d20 junto ao alvo em todas as telas. Rerolar quantas vezes quiser (Ponto Saga é manual).
4. Escolher a saída (ou Não reagir): dano final na ficha, efeito "dano" (número e tremor), linha atualizada.
5. Enquanto isso, Lia segue a vez (mais ações, andar, Encerrar). O golpe pendente fica até o alvo reagir, o mestre resolver por ele ("Rolar por", "Não reagir por") ou alguém desfazer a linha.

## 5. Telas e animações

Referência visual: o protótipo aprovado (não refazer o visual). Skills do Emil (`emil-design-eng` primeiro; `animate` e `review-animations` depois). Curvas e tempos da tabela "Movimento" do README; só `transform`, `opacity`, `clip-path` e um `filter: brightness` curto; nenhum `blur` animado; clique, Enter, Espaço ou Esc pulam; movimento reduzido (`movimentoReduzido()`, `components/grimorio/comum.ts:47`) = só aparece e some, sem tremor.

### 5.1 Aba "Batalha" no livro da mesa (pedido do usuário, 30/10)

Onde as abas moram: `components/livro/LivroDaMesa.tsx`, a lista `PAGINAS` (`:123-129`: Grupo, Chat, Cenas, Mesa, Sons), as folhas sempre montadas (`FolhaDaMesa`, `:285-308`) e `PAGINAS_SEM_SALA` (`:132`); o tipo `PaginaDaMesa` em `stores/livroDaMesaStore.ts:12`; os ícones em `components/livro/icones.tsx` (`DESENHOS`, tipo `NomeDoIcone` `:231`). Hoje o `ControleDaBatalha` é passado por `App.tsx:4251` na prop `batalha` e desenhado no alto da folha Cenas (`LivroDaMesa.tsx:293-294`); o `PainelDoMestre` da F1 monta dentro dele (`ControleDaBatalha.tsx:221`).

O que muda:
- `livroDaMesaStore.ts`: `PaginaDaMesa` ganha `"batalha"`.
- `icones.tsx`: desenho novo `batalha` (duas espadas cruzadas), no traço e no tamanho dos outros.
- `LivroDaMesa.tsx`: `{ id: "batalha", rotulo: "Batalha", icone: "batalha" }` em `PAGINAS`, logo depois de Cenas; `"batalha"` em `PAGINAS_SEM_SALA` (o mapa solto e o navegador puro também têm batalha, e o Shift+B mora dentro do `ControleDaBatalha`); folha nova `FolhaDaMesa pagina="batalha"` com a prop `batalha`; a folha Cenas deixa de desenhá-la. Prop nova opcional `esperandoNaBatalha?: number` = contador no marcador (como o de pedidos do Grupo): reações de NPC esperando + 1 se a vez é de NPC; rótulo "2 esperando o mestre".
- `components/livro/PaginaDaBatalha.tsx` (novo): a página inteira, de cima para baixo: Iniciar/Encerrar (o `ControleDaBatalha` de hoje: abertura, nome, desempate, regra do campo, Zerar caminhos, Shift+B); com a batalha ligada, o painel da vez (o `PainelDaVezDoNpc` na vez de NPC; na de jogador, "Vez de Lia" com Simples, Bônus, Mov e "Ações extras"); `ReacoesPendentes`; a ordem e o resto do `PainelDaBatalha` da F1 (Ordenar, desempate, carta extra, incluir ou tirar, equipes, regras do campo, biblioteca); o registro com Desfazer. Sem batalha: só o Iniciar e uma linha do que a batalha faz.
- `ControleDaBatalha.tsx` FICA no mesmo caminho e com a mesma prop (o `ControleDaBatalha.test.tsx` importa de lá; mudar de pasta quebraria o `tsc`). Só perde o `PainelDoMestre` de dentro: quem monta o painel passa a ser a `PaginaDaBatalha`.
- `App.tsx:4251`: passa `PaginaDaBatalha` (com as mesmas três props de hoje) em vez do `ControleDaBatalha`, e o `esperandoNaBatalha` lido da store (seletor `esperandoOMestre(state, sceneKey)`, do A).
- Shift+B continua: o ouvinte está no `ControleDaBatalha`, que segue sempre montado porque toda folha fica montada (`LivroDaMesa.tsx:134`). Ao INICIAR (pelo botão ou pelo Shift+B), o livro abre na página Batalha (`abrirPagina("batalha")`); ao encerrar, fica onde está.
- Sem trocar de página sozinho no meio da luta: chegou a vez de NPC ou reação de NPC, acende o contador no marcador Batalha (Q7).

### 5.2 Componentes novos em `components/batalha/` (presentacionais por props)
- `MenuDaVez.tsx` (jogador): tiras Atacar, Habilidades, Transformação (apagada: "Chega na próxima fase; por enquanto, ligue pela ficha"), Concentrar ("Carga 1, próximo golpe ×2"), Encerrar vez; cabeça com nome e economia ("Simples 1 · Bônus 0 · Mov 2/4", Mov vermelho quando passa). Setas, Enter, seta para a direita abre, Esc volta; recolhe num botão "Ações" para o mapa ficar livre (o jogador anda arrastando a ficha). Teclas só com foco dentro do menu.
- `ListaDeTecnicas.tsx`: tiras com nome, descrição, custo à direita ("45 SP", "? SP" quando pergunta), chips Ação · Dano (o número ou "fórmula") · Tempo ("Recarga 1", "1/2 usos", "Overload"); apagada com o motivo; seta para o detalhe (conta do dano, efeito, extras). Serve Armas (Atacar) e Habilidades. Item "Escolher armas" quando há limite e ele ainda não escolheu.
- `MiraDoGolpe.tsx`: alvos (lista dos que ele vê na ordem; setas trocam, Espaço marca vários; clique na ficha no mapa também, S4); por alvo, o dano que chega, editável, com a conta ao lado ("205 × 2 concentração"; "editado" quando mudou); custo perguntado quando a ficha não diz; ação perguntada quando a ficha não diz; Surpresa (×1,5, sem reação); a nota da reação; Lançar. A marca da mira desenhada sobre o token (S4).
- `CaixaDeReacao.tsx`: REAÇÃO, quem ataca, com o quê e quanto; modificador (lembrado por personagem na sessão); Rolar 1d20; o dado (160 ms entra, 8 números em 380 ms, pousa em 200 ms); depois só as saídas liberadas, com o dano de cada uma; Rerolar; Não reagir. No mestre, uma por NPC atingido, com "Rolar todas".
- `BotaoDeReacao.tsx` (jogador): sempre à vista na batalha; com golpe esperando mostra quantos e abre a caixa; sem golpe abre a reação livre (1d20 + modificador, vai ao registro).
- `EscolhaDeArmas.tsx`: no começo (limite definido e ainda não escolheu), marca até N; o mestre usa o mesmo diálogo para trocar (menu da carta).
- `PainelDaVezDoNpc.tsx` (mestre, na aba Batalha): retrato e perfil compacto (HP, SP, Escudo, carga), técnicas com a seta para o detalhe, técnica e alvo sugeridos já marcados, dano editável com a conta, Surpresa, Concentrar, Executar, Encerrar vez. Nada acontece sem Executar. Sem "jogam sozinhos".
- `ReacoesPendentes.tsx` (mestre, na aba Batalha): golpes esperando reação, de NPC (Rolar, Não reagir, modificador) e de jogador ("Esperando Lia", com "Rolar por ela" e "Não reagir por ela").
- `DarDanoDialog.tsx` e `AcoesExtrasDialog.tsx` (mestre, pelo menu da carta e pelo painel da vez; Simples, Bônus, Mov com mais e menos; "só nesta vez" ou "todas").
- `EfeitosDaBatalha.tsx` + trecho em `batalha.css`: camada sobre o mapa que toca a fila: faixa SUA VEZ (240/420/180 ms, quando `minhaVez` vira true), corte do golpe (150/330/150 ms; retrato = imagem do token do atacante; nome da técnica), risco no alvo, d20 junto ao alvo, número do dano (bate em 260 ms até 116%, fica 520 ms, sobe e some em 240 ms; "ESQUIVOU", "CONTRA-ATAQUE", "CRÍTICO"), tremor de 220 ms (`onTremor`, quem monta mexe no invólucro do mapa). Posição do token pela consulta da S4, lida no começo de cada efeito.
- `dadosDoMenu.ts`: adaptador (personagem, estado, sistema para props), chamando a `lib`.
Mudam: `CartaDaOrdem.tsx` (barras em duas camadas: a clara some 400 ms depois; carga na carta), o menu da carta na `FaixaDoMestre` (Dar dano, Ações extras, Armas desta batalha), `FaixaDoJogador.tsx` (na carta dele: "Me dar dano"), `PainelDoMestre.tsx` (vira peça da `PaginaDaBatalha`).

### 5.3 Onde montam
- Mestre, aba Batalha (5.1): tudo o que é painel. Mestre, `App.tsx`: só o `EfeitosDaBatalha` sobre o canvas (lendo `efeitosDaCena`), com o invólucro do tremor; a faixa da ordem continua em `App.tsx:3223`.
- Jogador, `player/main.tsx`: `MenuDaVez` com `estado.minhaVez`; `CaixaDeReacao` com `estado.reacoes`; `BotaoDeReacao` na batalha; `EscolhaDeArmas` com `meus[i].armas` null e limite; `EfeitosDaBatalha` sobre o `PlayerView`, com o invólucro do tremor. Respeitar o que `hudSemColisao` protege; menu no canto de baixo à esquerda (protótipo `.menu--principal`), caixa REAÇÃO no meio de baixo.

## 6. Divisão: fase 0 (contrato, 1 escritor) + fase 1 (3 escritores, caminhos disjuntos, na main, sem worktree)

### Fase 0 (A, sozinho, antes dos outros): o contrato
- `lib/batalha/combate.ts` (novo): os tipos e constantes da seção 2.2.
- `lib/batalha/{leituraDaFicha,formula,acoes,reacao,golpe}.ts` (novos): as assinaturas da seção 3 com corpo provisório honesto (`lerCusto` devolve pergunta; `lerDano`, naoEntende; `acoesDaVez`, tudo 0/1; `podeAgir`, "ainda não"), para B e C compilarem. A troca os corpos na fase 1.
- `lib/batalha/turnos.ts`, `registro.ts`, `ponte.ts`: os campos opcionais, as 2 reversões novas (`reverterTurnos` trata "golpe" e "combate"), `TIPOS_QUE_O_JOGADOR_DESFAZ`, a `PonteDaBatalha` nova.
- `lib/batalha/vistaDoJogador.ts`: os campos novos do `EstadoParaJogador` e o recorte COMPLETO deles (puro).
- `net/protocoloDaBatalha.ts`: as 4 mensagens novas e `batalha.efeitos`, com parsers; `lerEstadoParaJogador` lendo os campos novos (opcionais, estritos); `PEDIDOS_DE_BATALHA_POR_JANELA` 20.
- `stores/batalhaStore.ts`: as ações novas na interface `BatalhaState` com corpo que devolve `false`, os seletores `efeitosDaCena` e `esperandoOMestre`, os 4 métodos novos na `ponteDaBatalha`.
- `stores/livroDaMesaStore.ts`: `"batalha"` no tipo `PaginaDaMesa` (uma linha; assim C e o tipo andam juntos).
Portão: `rtk proxy npx tsc --noEmit` limpo em `client`. Commit "contrato da F2". Daí em diante cada arquivo tem um dono só.

### Fase 1 (os três juntos)
| Escritor | Agent | Dono exclusivo de |
|---|---|---|
| **A, regra e estado** | `programador-frontend` | `lib/batalha/{leituraDaFicha,formula,acoes,reacao,golpe,combate,turnos,registro}.ts`, `stores/batalhaStore.ts`, `lib/sistemaOnePiece.ts` (aba Armas e a escolha). Não toca `vistaDoJogador.ts` nem `ponte.ts` depois da fase 0 (se precisar, avisa) |
| **B, host, rede e mapa** | `programador-frontend` | `net/batalhaNoHost.ts`, `net/protocoloDaBatalha.ts`, `net/hostSession.ts`, `net/protocol.ts`, `player/playerConnection.ts`, `player/PlayerView.tsx`, `pixi/PixiCanvas.tsx` |
| **C, telas** | `designer-opus` | `components/batalha/*` (novos e os da F1), `components/livro/{LivroDaMesa,ControleDaBatalha,PaginaDaBatalha,icones}.tsx`, `components/livro/livro.css`, `stores/livroDaMesaStore.ts` (depois da fase 0), `App.tsx`, `player/main.tsx`, `player/player.css` |

Arquivos quentes, 1 dono cada: `hostSession.ts`, `protocol.ts`, `playerConnection.ts`, `PlayerView.tsx`, `PixiCanvas.tsx` = B; `App.tsx`, `player/main.tsx`, `LivroDaMesa.tsx` = C; `batalhaStore.ts` = A. Ninguém toca `PEDIDOS.md`, `fogFilter.ts`, `types/map.ts`, `hostBridge.ts` (a ponte é o mesmo objeto, só com mais métodos), `LivroDoMestre.tsx`, a pasta `Minigames/` nem as provas sujas do usuário.

Ordem dentro da fase 1:
1. A: `formula.ts` e `leituraDaFicha.ts` (os exemplos da seção 3 são o aceite, conferidos à mão num rascunho FORA do repo com `npx tsx`, sem arquivo de teste); `acoes.ts` e `reacao.ts`; `turnos.ts` (extras, recargas) e `registro.ts`; `golpe.ts`; a store (`agir`, `reagir`, `darDano`, `darAcoesExtras`, `escolherArmas`, `somarCaminho` com blocos, `normalizarCena`, efeitos, `esperandoOMestre`); `sistemaOnePiece.ts`; `sugestaoParaNpc`.
2. B: `protocol.ts` (uniões e `case`, junto de `batalha.passar` em `:3419`) e `playerConnection.ts` (estado e métodos da S3, junto dos `case` em `:4784` e dos métodos em `:5914`); `batalhaNoHost.ts` (`agir`, `reagir`, `dano`, `armas`, `reqId` repetido, efeitos no `sync` e no `entrou`); `hostSession.ts` (os `case` junto de `batalha.passar` em `:9621`, `handleBatalha` generalizado em `:7805`); por último `PlayerView.tsx` e `PixiCanvas.tsx` (S4).
3. C: a aba Batalha primeiro (5.1: ícone, página, `PAGINAS`, folha, mover o painel; é o que o usuário pediu e não depende de A nem de B); depois os componentes com dados de exemplo nas props; `EfeitosDaBatalha` com fila de exemplo; por último as montagens em `main.tsx` e `App.tsx`, consumindo o que A e B exportam.

### Pontos de costura (nomes fixos desde a fase 0)
- S1 `hostSession.ts` (B) chama `options.ponteDaBatalha.agir/reagir/darDano/escolherArmas` (A), sempre via `batalhaNoHost`. Valeu: `batalhaNoHost.sync` a todos antes da resposta (molde `handleBatalha`, `hostSession.ts:7810`).
- S2 Mestre: `PaginaDaBatalha`, `PainelDaVezDoNpc`, `ReacoesPendentes`, os diálogos e o menu da carta (C) chamam `useBatalhaStore.getState().agir(sceneKey, { tipo: "mestre" }, vez, pedido)`, `reagir`, `darDano`, `darAcoesExtras`, `escolherArmas` (A).
- S3 Jogador: `player/main.tsx` (C) lê `state.batalhaEstado` (campos novos) e `state.batalhaEfeitos` (fila com `seq`, até 20) e chama `connection.agirNaBatalha(vez, pedido)`, `reagirNaBatalha(pedido)`, `darDanoEmMim(tokenId, valor)`, `escolherArmasNaBatalha(personagemId, armas)` (B; cada um devolve `boolean` = saiu, e fica pendente até o `batalha.resultado`).
- S4 Mapa: `PlayerView` e `PixiCanvas` (B) ganham `onFichaNaTela?: (consulta: (tokenId: string) => { x: number; y: number; raio: number } | null) => void` (registra a consulta da posição na tela, pela câmera) e `aoEscolherFicha?: (tokenId: string) => void` (com ela, clicar numa ficha a escolhe como alvo em vez de selecionar ou arrastar). C passa as duas em `main.tsx` e `App.tsx`.
- S5 Efeitos do mestre: `efeitosDaCena(state, sceneKey)` (A) lido pelo `EfeitosDaBatalha` em `App.tsx` (C); o componente guarda o último `seq` tocado e começa no `seq` de agora (sem reprise).
- S6 Leitura da ficha: `tecnicasNoMenu`, `armasDe`, `limiteDeArmas`, `lerDano`, `acoesDaVez`, `saidasPossiveis`, `danoQueChega`, `sugestaoParaNpc` (A) usados por `dadosDoMenu.ts` (C) nos dois lados.
- S7 "Mov 2/4": `somarCaminho` (A) soma em `gastos[vez].blocos`; `vistaDoJogador` (fase 0) põe em `acoes.blocos`; o painel do mestre lê `acoesDaVez` direto da cena.
- S8 Tremor: `EfeitosDaBatalha` (C) chama `onTremor()`; quem monta (C, nos dois arquivos) aplica a classe no invólucro do mapa.
- S9 Aba Batalha: `App.tsx` (C) passa `PaginaDaBatalha` na prop `batalha` e `esperandoNaBatalha={esperandoOMestre(state, chaveDaCenaAberta)}` (A) ao `LivroDaMesa` (C).
- Convivência: prop ou função que ainda não existe na hora de montar, C deixa a linha da costura por último e avisa; nunca cria no arquivo do outro. Na fase 1 a checagem global fica suja: cada um filtra os erros dos PRÓPRIOS caminhos. Commit só dos próprios caminhos, uma vez por escritor. O portão final é global, por um agente só, depois dos três.

## 7. Critério de pronto (sem suíte de teste: o usuário proibiu teste sem pedido)

Portão de máquina:
1. Em `client`: `rtk proxy npx tsc --noEmit` = 0 erros (inclui os `.test.ts`).
2. Em `client`: `npx vite build` termina sem erro.
3. `git status` só com os caminhos da seção 6 (mais o que o usuário já tinha sujo: `Minigames/`, `docs/design/telhado/provas/pagina-de-teste.html`, `docs/verification/task4-e2e-evidencia.png`).
4. Nenhum `.rs` mudou.
5. Os exemplos das tabelas da seção 3 conferidos pelo A num rascunho fora do repo, com a saída colada no relatório dele.

Roteiro do que o usuário vê (mestre no app + Lia e Bruno no navegador, equipe "Grupo"; NPCs Vera e Ilo; Lia com Força 160, Agilidade 95, SP 200; Rajada de Penas "-45 de SP", "Força + 45 de dano", "Ação Simples", Tempo "2"; Corrente Ascendente "Bonus"; Tempestade "1 vez na batalha"; Fúria com extra OVERLOAD; Bruno com Balmung "5", Gram "8" e "Armas por batalha: 1 arma"):
1. A lombada do livro da mesa mostra Grupo, Chat, Cenas, Batalha, Mesa, Sons; o ícone de espadas no mesmo traço dos outros. A página Cenas não tem mais o Iniciar batalha. Sem sala (mapa solto), a aba Batalha continua lá.
2. Shift+B em qualquer página: abre a escolha de abertura; Iniciar liga a batalha e o livro vai à página Batalha, com o painel da vez, a ordem, equipes, regras, ações extras e o registro, tudo ali. Shift+B de novo encerra.
3. Na ficha One Piece: aba Armas (nome, dano, ação, modificador, efeito, imagem) e o select "Armas por batalha". O jogador cria e edita a dele.
4. Ao iniciar, o Bruno vê "Escolha as armas desta batalha (até 1)" e marca Gram. O mestre troca para Balmung pelo menu da carta; o registro mostra os dois.
5. Vez da Lia: a faixa SUA VEZ corta a tela e o menu entra tira por tira com "Simples 0/1 · Bônus 0/0 · Mov 0/4". O Bruno vê "Vez de Lia" e nenhum menu.
6. Lia anda 3 blocos: "Mov 3/4". Mais 2: "Mov 5/4" vermelho, e a ficha anda mesmo assim.
7. Habilidades: Rajada com "45 SP", "Dano 205", "Recarga 2"; Corrente Ascendente apagada "Ação bônus: só quando o mestre dá"; Fúria com "Overload".
8. Rajada em Ilo: a mira pousa no Ilo (setas trocam; clique no Ilo no mapa também); dano 205 com a conta; Lançar. Corte vermelho "RAJADA DE PENAS" nas três telas; o SP da Lia vai a 155; a Simples fica riscada.
9. O marcador Batalha do mestre acende "1"; na página, REAÇÃO de Ilo: modificador +1, Rolar: o d20 gira junto ao Ilo em todas as telas e cai em 9 (total 10): só "Defender · 102" e Rerolar. Rerolar: 16 (17): "Esquivar · 0" e "Defender · 102". Esquivar: "ESQUIVOU" sobre o Ilo, sem tremor. Registro: "Lia usa Rajada de Penas em Ilo: 205 · d20 16+1 = 17 · esquivou". A Lia não vê a vida do Ilo em lugar nenhum.
10. Na aba Batalha, o mestre dá +1 Simples "só nesta vez" à Lia: "Simples 1/2". Rajada segue apagada ("Recarga"), Tempestade acende.
11. Lia concentra: "Carga 1"; Concentrar apaga "Já concentrou nesta vez".
12. Lia desfaz a Rajada: SP 200 de novo, a Simples volta, a recarga some, a linha fica riscada "desfeito por Lia". Fora da vez dela, o Desfazer fica apagado.
13. Encerrar vez. Vez da Vera (NPC): o marcador Batalha acende; na página, Névoa e Lia já marcadas, a conta do dano e Executar. Com Surpresa: 615 bate em cima da Lia, a tela dela treme, a barra cai em duas camadas; nenhuma REAÇÃO abre.
14. Outro golpe da Vera na Lia sem Surpresa: na tela da Lia, REAÇÃO "Vera usa Névoa em você: 300". Ela digita +2 e tira 1 natural: "CRÍTICO" e 450. Em outro, Não reagir: 300.
15. Botão Reação sem golpe esperando: reação livre; o d20 aparece para todos e entra no registro.
16. Fúria (Overload) em Ilo e Teo: os dois levam o dano sem reação, cada um com seu número; todo Overload dela apaga "Overload: já usado nesta batalha".
17. Habilidade com custo "10% do Hp...": a confirmação pergunta o valor, com 10% do HP atual sugerido; cobra do HP.
18. Habilidade com dano "Metade da Força": o campo vem vazio; ela digita 80 e lança.
19. O mestre dá 50 de dano no Bruno pelo menu da carta: número e tremor na tela do Bruno. O Bruno se dá 20 pela carta dele: mesmo efeito, linha no registro.
20. Total 20 na reação: "Contra-atacar" abre o atalho de contra-ataque para quem reagiu (Q6).
21. Movimento reduzido do sistema ligado: nada corta nem treme, os números aparecem no lugar, tudo funciona igual.
22. Encerrar: menu, caixas, botões e efeitos somem; nada da batalha no `map.json`; a aba Armas e a escolha das armas por batalha continuam na ficha depois de Salvar e reabrir.

Conferência de vazamento (DevTools do jogador, aba WS): nenhum `batalha.estado` traz HP, SP, recarga, carga ou armas de NPC ou de outra equipe; `reacoes` só das fichas dele; texto do registro sem HP nem custo; `batalha.efeitos` só com tokens que a tela dele tem; o `batalha.reagir` não tem campo de dado.
Fluidez (opcional, Performance do Chrome no jogador): golpe com 2 alvos, do corte ao número, sem tarefa longa de 200 ms ou mais.

## 8. Riscos e o que não confirmei

Riscos:
- R1 Três escritores na main: a checagem fica suja no meio; commit só dos próprios caminhos. Testes não rodam: `hostSession.batalha.test.ts`, `ControleDaBatalha.test.tsx` (o painel saiu de dentro dele), testes do livro da mesa que contam as páginas, e os do `sistemaOnePiece`/importador (a aba e a escolha novas mudam as listas) podem ficar vermelhos em runtime. Dizer na entrega.
- R2 Reentrância: `agir` muda a ficha pela aventura dentro do pedido do jogador; o App avisa as pontes e o `syncPersonagens` pode sair antes ou depois do recorte. A F1 já tropeçou nisso (`hostSession.ts:7790-7794`): B confere a ordem e comenta.
- R3 A fórmula cobre cerca de 25 dos 44 danos reais; o resto vem vazio (decisão 12). Leitura errada é pior que vazia: na dúvida, `naoEntende`.
- R4 Teclas do menu e atalhos do mapa do jogador (setas movem a ficha?): o menu só pega tecla com foco dentro; conferir no `PlayerView` antes de ligar.
- R5 Efeito posicionado pela câmera no começo: se a câmera anda durante o efeito (cerca de 1 s), o número fica no lugar velho. Aceitável; medir antes de trocar por desenho no Pixi.
- R6 Mov do NPC: o mestre arrasta NPC no editor, e só o movimento do JOGADOR passa pelo `onBatalhaAndou` (`hostSession.ts:5976`); o painel do NPC mostra "Mov" sem número. Contar o arrasto do mestre fica para depois.
- R7 Golpe pendente fica até alguém reagir: jogador que sai da mesa trava um alvo. O mestre resolve por ele em `ReacoesPendentes`.
- R8 Dano em quem já caiu: aplica e anima; a carta segue "caiu".
- R9 Duas fichas do mesmo personagem: recarga, usos e carga são do PERSONAGEM; o gasto da vez é da CARTA.
- R10 "Por turno" e efeitos com duração não cobram nem contam sozinhos (selos são da F3).
- R11 A linha do golpe muda depois de criada; o `registrarAjuste` só funde linhas "ficha" (`registro.ts:350`), então não colide. Desfazer no meio das reações tira o golpe pendente.
- R12 Aba Batalha: seis marcadores na lombada; conferir a altura em 1366x768 e o livro recolhido. O `id`/região "Cenas" que as jornadas procuram (`LivroDaMesa.tsx:279` e `:295`) não muda.

Não confirmei:
- Se a aventura do usuário usa o One Piece EMBUTIDO (`id: "one-piece"`) ou uma cópia importada na biblioteca; numa cópia a aba Armas não aparece sozinha.
- Se o clique na ficha do `PlayerView` e do `PixiCanvas` aceita um modo de mira sem mexer no arrasto (S4); o recurso de reserva é a lista com setas.
- Onde o jogador desliga as teclas do mapa quando um diálogo tem foco (`hudSemColisao` e o keymap do jogador).
- O espaço livre no canto de baixo à esquerda do jogador (painel e zoom).
- Se o retrato do atacante NPC no corte pode ser a imagem do token (o jogador tem a imagem do token; o retrato do personagem NPC, não).
- Se algum lugar do App abre a página Cenas de propósito para o Iniciar batalha (`abrirPagina` aparece em `App.tsx`; C confere).
- Diagrama (regra 2g): este agente não chama a skill `diagram-design`. Fluxo em texto para o orquestrador desenhar: jogador (MenuDaVez, CaixaDeReacao) para `batalha.agir`/`batalha.reagir`, `hostSession`, `batalhaNoHost` (posse, vez, recorte), `ponteDaBatalha`, `batalhaStore` (regra da `lib/batalha`, ficha pela `adventureStore`, linha do registro, efeito), `turnosRev`, broadcast, `batalhaNoHost.sync`, `batalha.estado` + `batalha.efeitos` por conexão, `playerConnection`, `main.tsx` (menu, caixa, `EfeitosDaBatalha`). Mestre: aba Batalha (`PaginaDaBatalha`) direto na store, o mesmo caminho de volta; `EfeitosDaBatalha` do mestre lê `efeitosDaCena`.

## 9. Decisões que faltam ao usuário (só as que mudam o que ele vê)

- **Q1 Onde fica "Armas por batalha".** Recomendo um select ao lado de Raça e Ofício ("1 arma" a "6 armas", vazio = sem limite), que aparece como chip "2 armas" no topo da ficha: nenhum protocolo novo, e o jogador já edita. Alternativa: campo no topo da aba Armas (campo novo no personagem, no fio e na tela).
- **Q2 Dano do Atacar com arma.** Recomendo "Força + Dano da arma" (Balmung: 160 + 5 = 165), editável; é o padrão das fichas ("(Força + 20) + Dano da Arma" é um golpe acima do básico). Alternativa: só o Dano da arma (5).
- **Q3 Modificador na reação.** Recomendo 10, 15 e 20 pelo TOTAL (dado + modificador) e o crítico só no 1 natural. Alternativa: tudo pelo dado natural, e o modificador só aparece no registro.
- **Q4 Escudo.** Recomendo que o dano gaste o Escudo primeiro e o resto vá ao HP (o livro diz que o Escudo é vida extra). Alternativa: dano só no HP, Escudo à mão.
- **Q5 Número do dano em NPC.** Recomendo mostrar o número a todos que veem a ficha atingida (é o golpe, não a vida; a vida do NPC continua oculta). Alternativa: só quem atacou e o mestre veem o número; os outros, só o tremor.
- **Q6 Contra-ataque (20).** Recomendo um atalho "Contra-atacar" para quem reagiu: Atacar ou Habilidade contra o atacante, sem gastar ação e sem reação do outro (regra do protótipo). Alternativa: só a marca "Contra-ataque!" no registro, e o mestre dá uma ação extra à mão.
- **Q7 Vez de NPC com o livro em outra página.** O painel da vez do NPC agora mora na aba Batalha (pedido do usuário). Recomendo acender um contador no marcador Batalha (vez de NPC, reações de NPC esperando), sem trocar de página sozinho. Alternativa: o livro pula para a aba Batalha sozinho quando chega a vez de um NPC.
- **Q8 Escolha das armas.** Recomendo: o jogador escolhe uma vez, no começo da batalha (ou no primeiro Atacar), e depois só o mestre troca. Alternativa: o jogador troca quando quiser, fora da vez dele.

Decidido aqui pelo livro, pelo protótipo ou pelo pedido (dizer na entrega): Concentrar gasta a Simples (ou a Bônus) e com carga 3 o golpe é Completa (livro); arredondamento para baixo; Rerolar sem limite (Ponto Saga manual, decisão 10); técnica sem ação na ficha pergunta Simples, Completa, Bônus ou Livre; Transformação apagada até a F3; Iniciar leva o livro à aba Batalha.

## Próximo passo

O orquestrador leva Q1 a Q8 ao usuário (`AskUserQuestion`, até 4 por vez, com as recomendações). Com as respostas: `programador-frontend` (A) faz a fase 0 com este arquivo como input e commita "contrato da F2"; depois A (`programador-frontend`), B (`programador-frontend`) e C (`designer-opus`, skills do Emil) em paralelo na main, com a tabela da seção 6 e as costuras S1 a S9 no prompt de cada um; o portão da seção 7 por um agente só, no fim.

## Q1 a Q8 respondidas pelo usuário (30/10/2026)
- Q1 Armas por batalha: no topo da ficha, escolha ao lado de Raça e Ofício ("1 arma" a "6 armas", vazio = sem limite), selo "3 armas" no alto.
- Q2 Dano do Atacar: Força + dano da arma (Balmung: 160 + 5 = 165). O mestre e o jogador sempre podem editar.
- Q3 Reação: 10, 15 e 20 contam pelo TOTAL (d20 + modificador). Crítico só no 1 natural.
- Q4 Escudo: o dano gasta o Escudo primeiro e o resto vai ao HP, a não ser que o golpe seja PERFURANTE (vai direto ao HP). Literal: "a não ser que seja golpe perfurante e dependendo do golpe nem o perfurante passa". Então: interruptor "Perfurante" no golpe, ligado sozinho quando a habilidade diz (perfurante, ignorando armaduras, direto na vida), e quem ataca ou o mestre pode desligar; o mestre decide no fim.
- Q5 Número do dano em NPC: todos que veem o NPC veem o número do golpe; a vida dele continua oculta.
- Q6 Contra-ataque (20): literal "Ganha uma ação, não recebe dano do ataque e pode atacar como quiser ou se mover." Então: o dano daquele golpe é zerado para quem tirou 20, e ele ganha na hora uma ação extra (Atacar, Habilidade ou Mover), fora da vez dele. Leitura minha: é uma ação normal, então o alvo do contra-ataque pode reagir como sempre (o mestre pode marcar Não reagir).
- Q7 Vez de NPC com o livro em outra aba: contador na aba Batalha, sem trocar de página sozinho.
- Q8 Escolha das armas: quando quiser, sempre dentro do limite.
