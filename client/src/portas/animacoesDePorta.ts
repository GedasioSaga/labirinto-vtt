import type { Graphics } from 'pixi.js'
import type { DoorState } from '../types/map'

/**
 * PORTA ANIMADA NO MAPA (Fase C, 09/10/2026) — o registro das animações de
 * abrir e fechar porta. A porta escolhe uma pelo id (`DoorState.animacao`); id
 * ausente ou desconhecido = "Sem animação", o desenho de sempre.
 *
 * Duas vêm embutidas no app e funcionam sem internet. As do pacote baixado do
 * GitHub (Fase B, `lib/pacoteDeAnimacoes.ts`) entram depois por
 * `registrarAnimacaoDePorta`, que recebe `unknown` de propósito: o módulo do
 * pacote é JavaScript carregado em tempo de execução, e o tipo declarado não
 * garante nada sobre ele.
 *
 * Este módulo não importa nada do Pixi em tempo de execução (só o tipo do
 * `Graphics`): `lib/mapFile.ts` usa o validador de id daqui, e o disco não deve
 * puxar o renderer.
 */

/** O que `pixi/drawDoors.ts` já calculou da porta, em coordenadas de MUNDO. */
export interface PortaParaDesenho {
  /** Pontas da parede-porta (o vão inteiro). */
  x1: number
  y1: number
  x2: number
  y2: number
  /** Centro do retângulo da porta, já alinhado ao pixel físico. */
  cx: number
  cy: number
  /** Sentido da parede, vetor unitário de (x1,y1) para (x2,y2). A normal (-uy, ux) aponta para o lado 'right'. */
  ux: number
  uy: number
  /** Meio comprimento da folha (a porta ocupa `DOOR_LENGTH_RATIO` do vão). */
  meioComprimento: number
  /** Espessura da folha: fixa em px de TELA, convertida para mundo. */
  espessura: number
  /** Espessura do contorno da porta aberta, em mundo. */
  contorno: number
  /** Cor da porta: a própria (`DoorState.cor`), ou laranja, vermelha se trancada. */
  cor: number
  /** Zoom da câmera (px de tela por unidade de mundo). */
  escala: number
}

export interface AnimacaoDePorta {
  /** Vai no mapa (`DoorState.animacao`) e no disco: `ID_DE_ANIMACAO_DE_PORTA`. */
  id: string
  /** Nome no seletor "Animação ao abrir". */
  nome: string
  /** Duração de fechada a aberta. Meio caminho (inverteu no meio) leva a fração que falta. */
  duracaoMs: number
  /**
   * Duração de aberta a fechada, quando é outra (o giro fecha mais depressa do
   * que abre). Ausente = `duracaoMs`. Só as embutidas a usam: o contrato do
   * pacote (`lib/pacoteDeAnimacoes.ts`) segue com uma duração só.
   */
  duracaoFecharMs?: number
  /**
   * Som que acompanha o caminho (`portas/somDePorta.ts`). Ausente = porta
   * muda, como as de antes do som. O pacote pode trazer o campo; cliente velho
   * o ignora, e valor que este app não conhece também fica de fora.
   */
  som?: SomDaAnimacaoDePorta
  /**
   * Desenha a porta num ponto do caminho: `progresso` 0 = fechada, 1 = aberta,
   * já com a curva aplicada (quem anima é `pixi/animadorDePortas.ts`).
   * `abrindo` diz para onde vai. Só ACRESCENTA ao `g`: as outras portas estão
   * no mesmo Graphics, então nada de `clear()`. Nos extremos o desenho deve
   * bater com o da porta parada — no fim do caminho quem pinta é `drawDoors`.
   */
  desenhar: (g: Graphics, porta: PortaParaDesenho, progresso: number, abrindo: boolean) => void
}

/** Id de animação no mapa e no disco: curto, minúsculo, sem espaço. Fora disso o campo é descartado. */
export const ID_DE_ANIMACAO_DE_PORTA = /^[a-z0-9-]{1,40}$/

export function idDeAnimacaoDePortaValido(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_DE_ANIMACAO_DE_PORTA.test(valor)
}

/**
 * Os sons que o app sabe sintetizar para uma animação de porta: `rangido` é a
 * folha de dobradiça (trinco + rangido ao abrir, rangido curto + trinco ao
 * fechar); `trinco` é só o estalo da lingueta, a porta de correr. Mora aqui, e
 * não em `somDePorta.ts`, porque o disco e o pacote validam o campo sem puxar
 * o áudio.
 */
export const SONS_DA_ANIMACAO_DE_PORTA = ['rangido', 'trinco'] as const
export type SomDaAnimacaoDePorta = (typeof SONS_DA_ANIMACAO_DE_PORTA)[number]

export function somDaAnimacaoDePortaValido(valor: unknown): valor is SomDaAnimacaoDePorta {
  return SONS_DA_ANIMACAO_DE_PORTA.some((som) => som === valor)
}

/** Nome longo demais quebraria o seletor do painel. */
export const NOME_DE_ANIMACAO_MAX = 60
/** Teto da duração vinda de fora: porta que leva 10 s para abrir é defeito do pacote, não escolha. */
export const DURACAO_DE_ANIMACAO_MAX_MS = 3000

/**
 * Retângulo girado com a parede, centrado em `(cx, cy)`: `u` é o sentido da
 * folha. Só o path (quem chama dá o `fill`/`stroke`). O MESMO traço da porta
 * parada (`pixi/drawDoors.ts`): a animação parte e chega no desenho exato dela.
 */
export function tracarRetanguloDaPorta(g: Graphics, cx: number, cy: number, ux: number, uy: number, meioComprimento: number, meiaEspessura: number): void {
  const px = -uy
  const py = ux
  const ax = ux * meioComprimento
  const ay = uy * meioComprimento
  const bx = px * meiaEspessura
  const by = py * meiaEspessura
  g.poly([cx - ax - bx, cy - ay - by, cx + ax - bx, cy + ay - by, cx + ax + bx, cy + ay + by, cx - ax + bx, cy - ay + by], true)
}

/**
 * Batente: o contorno da porta ABERTA — é o desenho da aberta parada
 * (`pixi/drawDoors.ts`) e vai por baixo da folha nas animações. Com a folha no
 * lugar (progresso 0) o preenchimento cobre o contorno e a porta parece a
 * fechada de sempre; com a folha fora, sobra exatamente a aberta de sempre.
 */
export function desenharBatente(g: Graphics, porta: PortaParaDesenho): void {
  tracarRetanguloDaPorta(g, porta.cx, porta.cy, porta.ux, porta.uy, porta.meioComprimento - porta.contorno / 2, porta.espessura / 2 - porta.contorno / 2)
  g.stroke({ width: porta.contorno, color: porta.cor, join: 'miter' })
}

/**
 * Ângulo da folha aberta em "Girar na dobradiça": 70 graus, o mesmo da
 * medalha da ficha (`components/livro/MedalhaDaPorta.tsx`), que gira junto.
 */
export const GIRO_ABERTA_RAD = (70 * Math.PI) / 180

/**
 * SOMBRA SOB A FOLHA (fatia 22): a folha que sai do lugar "descola" do chão e
 * deixa uma sombra para baixo e para a direita da TELA (a luz de cima à
 * esquerda das sombras da interface). Tudo opaco, sem alfa: a cópia da porta
 * por cima do telhado (`player/PlayerView.tsx`) pinta o mesmo desenho em cima
 * deste, e alfa somaria. O "suave" vem de duas camadas chapadas (a penumbra
 * mais clara e maior, o miolo mais escuro) e de a sombra crescer e sumir com
 * o caminho: zero nos extremos, então a porta parada não muda.
 */
export const SOMBRA_DA_FOLHA_TELA_PX = 2
/** A penumbra passa da folha por este tanto em cada lado, em px de tela. */
export const PENUMBRA_DA_FOLHA_TELA_PX = 0.75
/** O escuro para onde a sombra puxa a cor da porta (o papel escuro do grimório). */
export const ESCURO_DA_SOMBRA = 0x100d09
const MISTURA_DA_PENUMBRA = 0.4
const MISTURA_DO_MIOLO = 0.65

/** Mistura canal a canal de `a` para `b`: `t` 0 = `a`, 1 = `b`. */
export function misturarCor(a: number, b: number, t: number): number {
  const canal = (deslocamento: number): number => {
    const de = (a >> deslocamento) & 0xff
    const para = (b >> deslocamento) & 0xff
    return Math.round(de + (para - de) * t) << deslocamento
  }
  return canal(16) | canal(8) | canal(0)
}

/** Sobe e desce com o caminho: 0 nos extremos, 1 no meio. Fora de (0, 1) é exatamente 0. */
function elevacaoDaFolha(progresso: number): number {
  return progresso <= 0 || progresso >= 1 ? 0 : Math.sin(Math.PI * progresso)
}

/** A folha de centro `(cx, cy)`, sentido `(dx, dy)`, com a sombra por baixo quando está fora do lugar. */
function desenharFolha(g: Graphics, porta: PortaParaDesenho, progresso: number, cx: number, cy: number, dx: number, dy: number, meioComprimento: number): void {
  const meiaEspessura = porta.espessura / 2
  const elevacao = elevacaoDaFolha(progresso)
  if (elevacao > 0) {
    const px = 1 / (Number.isFinite(porta.escala) && porta.escala > 0 ? porta.escala : 1)
    const desvio = SOMBRA_DA_FOLHA_TELA_PX * elevacao * px
    const penumbra = PENUMBRA_DA_FOLHA_TELA_PX * elevacao * px
    tracarRetanguloDaPorta(g, cx + desvio, cy + desvio, dx, dy, meioComprimento + penumbra, meiaEspessura + penumbra)
    g.fill({ color: misturarCor(porta.cor, ESCURO_DA_SOMBRA, MISTURA_DA_PENUMBRA) })
    tracarRetanguloDaPorta(g, cx + desvio, cy + desvio, dx, dy, meioComprimento, meiaEspessura)
    g.fill({ color: misturarCor(porta.cor, ESCURO_DA_SOMBRA, MISTURA_DO_MIOLO) })
  }
  tracarRetanguloDaPorta(g, cx, cy, dx, dy, meioComprimento, meiaEspessura)
  g.fill({ color: porta.cor })
}

/** Fração de `x` dentro de [a, b], presa entre 0 e 1. */
function trecho(x: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (x - a) / (b - a)))
}

/** Entrada e saída suaves (smoothstep): a fase começa e termina parada, sem degrau na velocidade. */
function suave(x: number): number {
  return x * x * (3 - 2 * x)
}

/**
 * Onde o giro começa a recolher a folha para a dobradiça. Começa antes do fim
 * do giro para as duas fases se fundirem num gesto só.
 */
export const GIRAR_INICIO_DO_RECOLHER = 0.62

/**
 * "Girar na dobradiça": a folha gira em torno da ponta de (x1,y1) até 70
 * graus, para o lado da normal — o mesmo lado no mestre e no jogador (o
 * jogador não recebe `opensFrom`, então o lado não pode depender dele). O
 * ângulo anda com o progresso, então a folha do mapa e a da medalha estão no
 * mesmo ângulo a cada quadro. A porta aberta do minimapa é só o contorno: no
 * fim do giro a folha RECOLHE para dentro da dobradiça (opaca o tempo todo,
 * nada de esmaecer). Fechando, o mesmo caminho ao contrário: a folha sai da
 * dobradiça e gira até o lugar. O desenho só depende do progresso, então
 * inverter no meio volta dali mesmo, sem salto.
 */
function desenharGirar(g: Graphics, porta: PortaParaDesenho, progresso: number): void {
  desenharBatente(g, porta)
  const p = Math.min(1, Math.max(0, progresso))
  const meioComprimento = porta.meioComprimento * (1 - suave(trecho(p, GIRAR_INICIO_DO_RECOLHER, 1)))
  if (meioComprimento <= 0) return
  const angulo = GIRO_ABERTA_RAD * p
  const nx = -porta.uy
  const ny = porta.ux
  // Sentido da folha girada: entre o da parede (fechada) e o da normal (aberta).
  const dx = porta.ux * Math.cos(angulo) + nx * Math.sin(angulo)
  const dy = porta.uy * Math.cos(angulo) + ny * Math.sin(angulo)
  const dobradicaX = porta.cx - porta.ux * porta.meioComprimento
  const dobradicaY = porta.cy - porta.uy * porta.meioComprimento
  desenharFolha(g, porta, p, dobradicaX + dx * meioComprimento, dobradicaY + dy * meioComprimento, dx, dy, meioComprimento)
}

/**
 * "Deslizar": a folha corre ao longo da parede para dentro dela, do lado de
 * (x2,y2), como porta de correr. Sobra no vão só o pedaço que ainda não
 * entrou, preso à ponta de (x2,y2); aberta, não sobra nada além do batente.
 * A sombra diz que a folha saiu do trilho de descanso e some quando assenta.
 */
function desenharDeslizar(g: Graphics, porta: PortaParaDesenho, progresso: number): void {
  desenharBatente(g, porta)
  const p = Math.min(1, Math.max(0, progresso))
  const meioPedaco = porta.meioComprimento * (1 - p)
  if (meioPedaco <= 0) return
  const desvio = porta.meioComprimento * p
  desenharFolha(g, porta, p, porta.cx + porta.ux * desvio, porta.cy + porta.uy * desvio, porta.ux, porta.uy, meioPedaco)
}

/**
 * Durações: a porta é movimento NO mapa, visto algumas dezenas de vezes por
 * sessão — fica na faixa de gaveta/modal (200-500 ms), puxada para baixo para
 * não atrasar quem está andando. O giro anda mais chão que o deslize, e
 * fecha mais depressa do que abre (300/260 ms, os do protótipo aprovado: os
 * tokens `gr.portaAbre`/`gr.portaFecha` do `theme.ts` dizem o mesmo à medalha).
 */
export const GIRAR_DURACAO_MS = 300
export const GIRAR_FECHAR_DURACAO_MS = 260
export const DESLIZAR_DURACAO_MS = 240

export const ANIMACOES_EMBUTIDAS: readonly AnimacaoDePorta[] = [
  { id: 'girar', nome: 'Girar na dobradiça', duracaoMs: GIRAR_DURACAO_MS, duracaoFecharMs: GIRAR_FECHAR_DURACAO_MS, som: 'rangido', desenhar: desenharGirar },
  { id: 'deslizar', nome: 'Deslizar', duracaoMs: DESLIZAR_DURACAO_MS, som: 'trinco', desenhar: desenharDeslizar },
]

/** Duração do caminho inteiro no sentido pedido: abrir usa `duracaoMs`; fechar, `duracaoFecharMs` quando há. */
export function duracaoDoSentido(animacao: AnimacaoDePorta, abrindo: boolean): number {
  return abrindo ? animacao.duracaoMs : (animacao.duracaoFecharMs ?? animacao.duracaoMs)
}

/** Embutidas primeiro, na ordem acima; as de fora depois, na ordem em que chegaram. */
let lista: readonly AnimacaoDePorta[] = ANIMACOES_EMBUTIDAS
const ouvintes = new Set<() => void>()

/**
 * Todas as animações, para o seletor do painel. A referência só muda quando o
 * registro muda: serve de `getSnapshot` para `useSyncExternalStore`.
 */
export function listarAnimacoesDePorta(): readonly AnimacaoDePorta[] {
  return lista
}

/** Avisa quando uma animação entra ou sai do registro. Devolve o cancelamento. */
export function assinarAnimacoesDePorta(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** A animação do id, ou `null` = sem animação (ausente, ou de um pacote que este app não tem). */
export function animacaoDePorta(id: string | undefined): AnimacaoDePorta | null {
  if (id === undefined) return null
  return lista.find((animacao) => animacao.id === id) ?? null
}

function trocarLista(nova: readonly AnimacaoDePorta[]): void {
  lista = nova
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Registra uma animação vinda de FORA (pacote da Fase B). Confere tudo em
 * tempo de execução e recusa, devolvendo `false`, o que não tem a forma do
 * contrato. Id de embutida é recusado: as embutidas são o que funciona sem
 * internet e não mudam por download. O mesmo id de fora registrado de novo
 * substitui o anterior (versão nova do pacote).
 *
 * A função `desenhar` de fora é chamada por `Reflect.apply`, sem `this`: o
 * contrato é uma função solta, e assim o tipo `Function` do `typeof` serve
 * sem afirmar uma assinatura que não dá para conferir.
 */
export function registrarAnimacaoDePorta(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || !idDeAnimacaoDePortaValido(info.id)) return false
  const id = info.id
  if (ANIMACOES_EMBUTIDAS.some((embutida) => embutida.id === id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_ANIMACAO_MAX) return false
  if (!('duracaoMs' in info) || typeof info.duracaoMs !== 'number') return false
  const duracaoMs = info.duracaoMs
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0 || duracaoMs > DURACAO_DE_ANIMACAO_MAX_MS) return false
  if (!('desenhar' in info) || typeof info.desenhar !== 'function') return false
  const desenharDeFora = info.desenhar
  // Som é enfeite opcional: valor que este app não conhece não recusa a animação, só a deixa muda.
  const som = 'som' in info && somDaAnimacaoDePortaValido(info.som) ? { som: info.som } : {}
  const animacao: AnimacaoDePorta = {
    id,
    nome,
    duracaoMs,
    ...som,
    desenhar: (g, porta, progresso, abrindo) => {
      Reflect.apply(desenharDeFora, undefined, [g, porta, progresso, abrindo])
    },
  }
  trocarLista([...lista.filter((existente) => existente.id !== id), animacao])
  return true
}

/**
 * A porta com outra "Animação ao abrir": `null` tira o campo (sem animação,
 * como porta de mapa antigo), não grava `undefined` nem string vazia.
 */
export function portaComAnimacao(door: DoorState, id: string | null): DoorState {
  const { animacao: _anterior, ...semAnimacao } = door
  return id === null ? semAnimacao : { ...semAnimacao, animacao: id }
}

/** Tira todas as de fora (o pacote novo substitui o anterior inteiro). As embutidas ficam. */
export function esquecerAnimacoesDePortaDeFora(): void {
  if (lista === ANIMACOES_EMBUTIDAS) return
  trocarLista(ANIMACOES_EMBUTIDAS)
}
