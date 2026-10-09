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
  /** Cor da porta: laranja, ou vermelha se trancada. */
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

/** Ângulo da folha aberta em "Girar na dobradiça": perpendicular à parede. */
export const GIRO_ABERTA_RAD = Math.PI / 2

/**
 * "Girar na dobradiça": a folha gira em torno da ponta de (x1,y1) até ficar
 * perpendicular, para o lado da normal — o mesmo lado no mestre e no jogador
 * (o jogador não recebe `opensFrom`, então o lado não pode depender dele).
 * A porta aberta do minimapa é só o contorno: a folha some no fim do giro. A
 * opacidade cai pelo cubo do progresso, então a folha fica sólida quase o
 * giro inteiro e só esmaece no último terço, em vez de virar fantasma no meio.
 */
function desenharGirar(g: Graphics, porta: PortaParaDesenho, progresso: number): void {
  desenharBatente(g, porta)
  const opacidade = 1 - progresso ** 3
  if (opacidade <= 0) return
  const angulo = GIRO_ABERTA_RAD * progresso
  const nx = -porta.uy
  const ny = porta.ux
  // Sentido da folha girada: entre o da parede (fechada) e o da normal (aberta).
  const dx = porta.ux * Math.cos(angulo) + nx * Math.sin(angulo)
  const dy = porta.uy * Math.cos(angulo) + ny * Math.sin(angulo)
  const dobradicaX = porta.cx - porta.ux * porta.meioComprimento
  const dobradicaY = porta.cy - porta.uy * porta.meioComprimento
  tracarRetanguloDaPorta(g, dobradicaX + dx * porta.meioComprimento, dobradicaY + dy * porta.meioComprimento, dx, dy, porta.meioComprimento, porta.espessura / 2)
  g.fill({ color: porta.cor, alpha: opacidade })
}

/**
 * "Deslizar": a folha corre ao longo da parede para dentro dela, do lado de
 * (x2,y2), como porta de correr. Sobra no vão só o pedaço que ainda não
 * entrou, preso à ponta de (x2,y2); aberta, não sobra nada além do batente.
 */
function desenharDeslizar(g: Graphics, porta: PortaParaDesenho, progresso: number): void {
  desenharBatente(g, porta)
  const meioPedaco = porta.meioComprimento * (1 - progresso)
  if (meioPedaco <= 0) return
  const desvio = porta.meioComprimento * progresso
  tracarRetanguloDaPorta(g, porta.cx + porta.ux * desvio, porta.cy + porta.uy * desvio, porta.ux, porta.uy, meioPedaco, porta.espessura / 2)
  g.fill({ color: porta.cor })
}

/**
 * Durações: a porta é movimento NO mapa, visto algumas dezenas de vezes por
 * sessão — fica na faixa de gaveta/modal (200-500 ms), puxada para baixo para
 * não atrasar quem está andando. O giro anda mais chão que o deslize.
 */
export const GIRAR_DURACAO_MS = 280
export const DESLIZAR_DURACAO_MS = 240

export const ANIMACOES_EMBUTIDAS: readonly AnimacaoDePorta[] = [
  { id: 'girar', nome: 'Girar na dobradiça', duracaoMs: GIRAR_DURACAO_MS, desenhar: desenharGirar },
  { id: 'deslizar', nome: 'Deslizar', duracaoMs: DESLIZAR_DURACAO_MS, desenhar: desenharDeslizar },
]

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
  const animacao: AnimacaoDePorta = {
    id,
    nome,
    duracaoMs,
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
