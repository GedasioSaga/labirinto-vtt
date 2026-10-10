import { Container, Graphics, Text, type Ticker } from 'pixi.js'
import {
  TINTA_DA_PILULA,
  arranjarPilulas,
  atrasoNaCascata,
  quadroDaAparicao,
  type Arranjo,
  type LugarComNome,
  type QuadroDaAparicao,
} from '../lib/nomesDosLugares'
import { theme } from '../theme'

/**
 * NOMES DOS LUGARES no palco (`lib/nomesDosLugares.ts`): uma pílula por lugar,
 * com a haste até ele e um ponto no chão, como no protótipo "Maquete".
 *
 * Cada pílula mora no MUNDO, na âncora do lugar, com escala 1/zoom: arrastar
 * a câmera não custa nada (o mundo leva as pílulas junto), e o zoom só troca
 * a escala e refaz a colisão (`setCameraScale`) — nenhum desenho é refeito.
 * O relógio de quadros só roda durante a aparição (até 5 s); parado, nada é
 * redesenhado por quadro.
 */

/** Medidas da pílula em px de TELA (tamanho fixo em qualquer zoom). */
export const MEDIDAS_DA_PILULA = {
  fonte: 14,
  /** Espaço entre letras do nome em caixa alta (0,05 em, como no protótipo). */
  entreLetras: 0.7,
  respiroX: 10,
  altura: 22,
  /** Largura mínima: nome curto ("Poço") não vira um botão atarracado. */
  larguraMinima: 40,
  /** Da âncora até a base da pílula. */
  haste: 22,
  hasteLargura: 2,
  ponto: 3.5,
  aro: 2,
  /** Respiro entre duas pílulas na colisão. */
  folga: 4,
  /** Nome comprido demais é cortado com reticências: no celular de 390 px, pílula mais larga que a tela não diz nada. */
  maxCaracteres: 26,
} as const

/** Quanto uma pílula pode subir na colisão: três andares de pílula. Acima disso some neste zoom. */
const TETO_DE_SUBIDA = 3 * (MEDIDAS_DA_PILULA.altura + MEDIDAS_DA_PILULA.folga)
/** Nome que os jogadores não veem, no editor do mestre: a mesma meia-tinta da plaquinha. */
const ALFA_ESMAECIDO = 0.55
/** Haste clara com um halo escuro fino: lê sobre chão claro e escuro, sem contorno grosso. */
const COR_DA_HASTE = 0xffffff
const ALFA_DA_HASTE = 0.95
const ALFA_DO_HALO = 0.18
/** Largura média de uma letra maiúscula em negrito, em múltiplos da fonte, para quando o Pixi não mede (testes). */
const LARGURA_DA_LETRA = 0.68
/**
 * Caixa alta não tem descendente: centrada pela caixa da linha, a letra fica
 * alta na pílula. Meio px para baixo assenta o nome no meio óptico.
 */
const AJUSTE_OPTICO_Y = 0.5
/** Sombra macia sob a pílula, em camadas (sem filtro de desfoque, que pesaria a cada quadro): [cresce, desce, alfa]. */
const CAMADAS_DA_SOMBRA: readonly (readonly [number, number, number])[] = [
  [3, 3, 0.05],
  [1.5, 2.5, 0.08],
  [0, 1.5, 0.16],
]

/** O que o renderer precisa para animar. Sem isto (testes, exportação de imagem), a pílula aparece já assentada. */
export interface MovimentoDasPilulas {
  /** O relógio de quadros do Pixi (`app.ticker`): o renderer só se inscreve enquanto alguma pílula aparece. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido quando uma cascata começa: a pessoa pode mudar com o app aberto. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  now?: () => number
}

export interface EntradaDosNomes {
  /** Id da cena. Trocou = o mapa abriu de novo: tudo some e a cascata recomeça. */
  cena: string
  /** Os lugares que ESTA tela pode mostrar agora, na ordem da cascata (`lugaresComNome`). */
  lugares: readonly LugarComNome[]
  /**
   * Lugar novo entra com a aparição. `false` (o jogador desligou "Efeitos do
   * mapa", ou o aparelho já perdeu o WebGL): aparece já assentado.
   */
  animar: boolean
}

export interface NomesDosLugaresRenderer {
  /** O contêiner das pílulas: vai no mundo, acima dos nomes de sala e abaixo das fichas e pinos. */
  camada: Container
  /** `null` = chave desligada: tudo sai, e religar é como abrir o mapa (a cascata volta). */
  atualizar: (entrada: EntradaDosNomes | null) => void
  /** Só o zoom mudou: a escala de cada pílula e a colisão (em px de tela). */
  setCameraScale: (escala: number) => void
  /** O lugar cujo nome está no campo de edição do mestre: a pílula sai enquanto o campo está aberto. */
  setLugarEmEdicao: (id: string | null) => void
  /** Termina a aparição em curso agora (exportar imagem no meio da cascata). */
  concluirAparicao: () => void
  /** O lugar cuja pílula está sob o ponto, em px do canvas (o mesmo espaço de `event.global`), ou `null`. */
  lugarEm: (x: number, y: number) => string | null
  /** Desmonte: sai do relógio e destrói as pílulas. */
  destruir: () => void
}

interface Pilula {
  lugar: LugarComNome
  /** Texto, cor e esmaecido do último desenho: igual, não redesenha. */
  aparencia: string
  raiz: Container
  haste: Graphics
  ponto: Graphics
  /** Sobe (e desliza de lado) a pílula na colisão; a haste estica até ela. */
  elevador: Container
  /** A parte que aparece (cresce e sobe), com a origem na base do centro: nasce da haste. */
  corpo: Container
  fundo: Graphics
  texto: Text
  largura: number
  /** Quanto subiu e deslizou na colisão; `null` = não coube neste zoom. */
  arranjo: Arranjo | null
  /** Quando a aparição desta pílula começa, em ms; `null` = assentada. */
  inicio: number | null
}

function textoDaPilula(texto: string): string {
  const maiusculo = texto.toLocaleUpperCase('pt-BR')
  const letras = [...maiusculo]
  return letras.length > MEDIDAS_DA_PILULA.maxCaracteres ? `${letras.slice(0, MEDIDAS_DA_PILULA.maxCaracteres - 1).join('').trimEnd()}…` : maiusculo
}

/**
 * Largura do nome rasterizado. Só o Pixi sabe, e só onde há canvas 2D: no
 * jsdom dos testes a medida estoura, e vale a estimativa por letra (que erra
 * sobrando, o lado certo de errar numa colisão).
 */
function larguraDoTexto(texto: Text, conteudo: string): number {
  try {
    const largura = texto.width
    if (Number.isFinite(largura) && largura > 0) return largura
  } catch {
    // Sem canvas 2D: cai na estimativa abaixo.
  }
  const letras = [...conteudo].length
  return letras * MEDIDAS_DA_PILULA.fonte * LARGURA_DA_LETRA + Math.max(0, letras - 1) * MEDIDAS_DA_PILULA.entreLetras
}

function aparenciaDe(lugar: LugarComNome): string {
  return `${lugar.texto}\u0000${lugar.fundo}\u0000${lugar.esmaecido ? 1 : 0}`
}

/** A haste tem 1 px de altura e cresce pela escala vertical: esticar na colisão não redesenha nada. */
function desenharHaste(g: Graphics): void {
  const { hasteLargura } = MEDIDAS_DA_PILULA
  g.clear()
  g.rect(-hasteLargura, -1, hasteLargura * 2, 1).fill({ color: 0x000000, alpha: ALFA_DO_HALO })
  g.rect(-hasteLargura / 2, -1, hasteLargura, 1).fill({ color: COR_DA_HASTE, alpha: ALFA_DA_HASTE })
}

function desenharPonto(g: Graphics, cor: number): void {
  const { ponto, aro } = MEDIDAS_DA_PILULA
  g.clear()
  g.circle(0, 1, ponto + aro + 1).fill({ color: 0x000000, alpha: 0.2 })
  g.circle(0, 0, ponto + aro).fill({ color: COR_DA_HASTE })
  g.circle(0, 0, ponto).fill({ color: cor })
}

function desenharFundo(g: Graphics, largura: number, cor: number): void {
  const { altura } = MEDIDAS_DA_PILULA
  const raio = altura / 2
  g.clear()
  for (const [cresce, desce, alfa] of CAMADAS_DA_SOMBRA) {
    g.roundRect(-largura / 2 - cresce, -altura - cresce + desce, largura + cresce * 2, altura + cresce * 2, raio + cresce).fill({ color: 0x000000, alpha: alfa })
  }
  g.roundRect(-largura / 2, -altura, largura, altura, raio).fill({ color: cor })
}

const ASSENTADA: QuadroDaAparicao = { alfa: 1, escala: 1, descida: 0, terminou: true }

export function createNomesDosLugaresRenderer(movimento?: MovimentoDasPilulas): NomesDosLugaresRenderer {
  const relogio = movimento?.now ?? (() => performance.now())
  const camada = new Container()
  camada.label = 'nomesDosLugares'
  camada.eventMode = 'none'
  const pilulas = new Map<string, Pilula>()
  /** A pílula de cada raiz na camada: o toque anda pela ordem de pintura. */
  const porRaiz = new WeakMap<Container, Pilula>()
  /** Lugares que já apareceram nesta cena: o que volta (saiu da memória e voltou) não aparece de novo. */
  const vistos = new Set<string>()
  let cena: string | null = null
  let escala = 1
  let emEdicao: string | null = null
  let reduzido = false
  let noRelogio = false

  function aplicar(p: Pilula, quadro: QuadroDaAparicao): void {
    p.raiz.alpha = quadro.alfa * (p.lugar.esmaecido ? ALFA_ESMAECIDO : 1)
    p.corpo.scale.set(quadro.escala)
    p.corpo.y = quadro.descida
  }

  function visivel(p: Pilula): boolean {
    return p.arranjo !== null && p.lugar.id !== emEdicao
  }

  const passo = () => {
    const agora = relogio()
    let falta = false
    for (const p of pilulas.values()) {
      if (p.inicio === null) continue
      const quadro = quadroDaAparicao(agora - p.inicio, reduzido)
      aplicar(p, quadro)
      if (quadro.terminou) p.inicio = null
      else falta = true
    }
    if (!falta) sairDoRelogio()
  }

  function entrarNoRelogio(): void {
    if (noRelogio || movimento === undefined) return
    movimento.ticker.add(passo)
    noRelogio = true
  }

  function sairDoRelogio(): void {
    if (!noRelogio || movimento === undefined) return
    movimento.ticker.remove(passo)
    noRelogio = false
  }

  function pintar(p: Pilula, lugar: LugarComNome): void {
    const conteudo = textoDaPilula(lugar.texto)
    p.texto.text = conteudo
    p.largura = Math.max(MEDIDAS_DA_PILULA.larguraMinima, Math.ceil(larguraDoTexto(p.texto, conteudo)) + MEDIDAS_DA_PILULA.respiroX * 2)
    desenharFundo(p.fundo, p.largura, lugar.fundo)
    desenharPonto(p.ponto, lugar.fundo)
    p.aparencia = aparenciaDe(lugar)
  }

  function criar(lugar: LugarComNome): Pilula {
    const raiz = new Container()
    raiz.label = `nomeDoLugar:${lugar.id}`
    const haste = new Graphics()
    desenharHaste(haste)
    const ponto = new Graphics()
    const elevador = new Container()
    const corpo = new Container()
    const fundo = new Graphics()
    const texto = new Text({
      text: '',
      style: {
        // A fonte condensada do app (`theme.font.utility`) é a das legendas em
        // caixa alta, "leitura de legenda de mapa" — a prima da Barlow Condensed do protótipo.
        fontFamily: theme.font.utility,
        fontSize: MEDIDAS_DA_PILULA.fonte,
        fontWeight: '700',
        letterSpacing: MEDIDAS_DA_PILULA.entreLetras,
        fill: TINTA_DA_PILULA,
      },
    })
    texto.anchor.set(0.5, 0.5)
    texto.y = -MEDIDAS_DA_PILULA.altura / 2 + AJUSTE_OPTICO_Y
    corpo.addChild(fundo, texto)
    elevador.addChild(corpo)
    raiz.addChild(haste, ponto, elevador)
    const p: Pilula = { lugar, aparencia: '', raiz, haste, ponto, elevador, corpo, fundo, texto, largura: 0, arranjo: { subida: 0, deslize: 0 }, inicio: null }
    porRaiz.set(raiz, p)
    pintar(p, lugar)
    return p
  }

  /** Colisão em px de tela; aplica a subida, a haste e quem some neste zoom. */
  function arranjar(): void {
    const arranjos = arranjarPilulas(
      [...pilulas.values()].map((p) => ({ id: p.lugar.id, x: p.lugar.ancora.x * escala, y: p.lugar.ancora.y * escala, largura: p.largura, altura: MEDIDAS_DA_PILULA.altura })),
      {
        haste: MEDIDAS_DA_PILULA.haste,
        folga: MEDIDAS_DA_PILULA.folga,
        raioDoPonto: MEDIDAS_DA_PILULA.ponto + MEDIDAS_DA_PILULA.aro,
        tetoDeSubida: TETO_DE_SUBIDA,
      },
    )
    for (const p of pilulas.values()) {
      const arranjo = arranjos.get(p.lugar.id)
      p.arranjo = arranjo === undefined ? { subida: 0, deslize: 0 } : arranjo
      const altura = MEDIDAS_DA_PILULA.haste + (p.arranjo?.subida ?? 0)
      p.elevador.y = -altura
      // O deslize anda com o CONTEÚDO, não com a origem: a pílula cresce a partir
      // de onde a haste encosta (o gatilho), e não do meio dela.
      p.corpo.pivot.x = -(p.arranjo?.deslize ?? 0)
      p.haste.scale.y = altura
      p.raiz.visible = visivel(p)
    }
  }

  function esvaziar(): void {
    sairDoRelogio()
    for (const p of pilulas.values()) p.raiz.destroy({ children: true })
    pilulas.clear()
    vistos.clear()
    camada.removeChildren()
  }

  function atualizar(entrada: EntradaDosNomes | null): void {
    if (entrada === null || entrada.cena !== cena) {
      esvaziar()
      cena = entrada?.cena ?? null
    }
    if (entrada === null) return

    const chegando: Pilula[] = []
    let mudou = false
    const agora = new Set(entrada.lugares.map((l) => l.id))
    for (const [id, p] of pilulas) {
      if (agora.has(id)) continue
      p.raiz.destroy({ children: true })
      pilulas.delete(id)
      // A que saiu pode ter empurrado vizinhas para cima (ou para fora do
      // teto): sem refazer a colisão, elas ficariam subidas sobre um vão até o
      // próximo zoom.
      mudou = true
    }

    for (const lugar of entrada.lugares) {
      const existente = pilulas.get(lugar.id)
      if (existente !== undefined) {
        if (existente.aparencia !== aparenciaDe(lugar)) {
          pintar(existente, lugar)
          mudou = true
        }
        if (existente.lugar.ancora.x !== lugar.ancora.x || existente.lugar.ancora.y !== lugar.ancora.y) mudou = true
        const esmaecidoMudou = existente.lugar.esmaecido !== lugar.esmaecido
        existente.lugar = lugar
        // A meia-tinta mora no alpha da raiz, que só `aplicar` grava: a pílula já
        // assentada não passa mais pelo relógio. Durante a aparição, o próximo
        // quadro já lê o `esmaecido` novo.
        if (esmaecidoMudou && existente.inicio === null) aplicar(existente, ASSENTADA)
        existente.raiz.position.set(lugar.ancora.x, lugar.ancora.y)
        continue
      }
      const p = criar(lugar)
      p.raiz.position.set(lugar.ancora.x, lugar.ancora.y)
      p.raiz.scale.set(1 / escala)
      pilulas.set(lugar.id, p)
      mudou = true
      if (entrada.animar && movimento !== undefined && !vistos.has(lugar.id)) chegando.push(p)
      else aplicar(p, ASSENTADA)
      vistos.add(lugar.id)
    }

    // A ordem de pintura segue a da cascata: a pílula de baixo na tela por cima da de cima.
    const ordem = entrada.lugares.flatMap((l) => {
      const p = pilulas.get(l.id)
      return p === undefined ? [] : [p.raiz]
    })
    if (ordem.length !== camada.children.length || ordem.some((raiz, i) => camada.children[i] !== raiz)) {
      camada.removeChildren()
      if (ordem.length > 0) camada.addChild(...ordem)
    }

    if (chegando.length > 0) {
      reduzido = movimento?.reducedMotion() ?? false
      const inicio = relogio()
      chegando.forEach((p, i) => {
        p.inicio = inicio + atrasoNaCascata(i, chegando.length, reduzido)
        // Já no estado de antes de aparecer: nada pisca inteiro até o primeiro quadro.
        aplicar(p, quadroDaAparicao(-1, reduzido))
      })
      entrarNoRelogio()
    }
    if (mudou) arranjar()
  }

  function setCameraScale(novaEscala: number): void {
    if (!Number.isFinite(novaEscala) || novaEscala <= 0 || novaEscala === escala) return
    escala = novaEscala
    for (const p of pilulas.values()) p.raiz.scale.set(1 / escala)
    if (pilulas.size > 0) arranjar()
  }

  function setLugarEmEdicao(id: string | null): void {
    if (id === emEdicao) return
    emEdicao = id
    for (const p of pilulas.values()) p.raiz.visible = visivel(p)
  }

  function concluirAparicao(): void {
    for (const p of pilulas.values()) {
      if (p.inicio === null) continue
      p.inicio = null
      aplicar(p, ASSENTADA)
    }
    sairDoRelogio()
  }

  function lugarEm(x: number, y: number): string | null {
    // De trás para a frente: a pílula pintada por cima ganha o toque.
    if (!camada.visible) return null
    const raizes = camada.children
    for (let i = raizes.length - 1; i >= 0; i -= 1) {
      const p = porRaiz.get(raizes[i])
      if (p === undefined || !p.raiz.visible || p.raiz.alpha <= 0) continue
      if (p.fundo.getBounds().containsPoint(x, y)) return p.lugar.id
    }
    return null
  }

  function destruir(): void {
    esvaziar()
    cena = null
    if (!camada.destroyed) camada.destroy({ children: true })
  }

  return { camada, atualizar, setCameraScale, setLugarEmEdicao, concluirAparicao, lugarEm, destruir }
}
