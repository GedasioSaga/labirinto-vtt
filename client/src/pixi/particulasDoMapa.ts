import { BufferImageSource, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import { soltaFumacaEBrasas, type FogoQueIlumina } from '../lib/luzDoFogo'
import type { ParticulasDaTela } from '../lib/particulasDaCena'

/**
 * PARTÍCULAS DO MAPA (pedido do mestre de 09/11/2026: "partículas de fumaça
 * preta e brasas"). Fumaça escura e brasas que sobem dos fogos da cena, iguais
 * no mestre e no jogador. O mapa guarda só a quantidade
 * (`lib/particulasDaCena.ts`); aqui mora o desenho.
 *
 * A camada fica no PALCO, logo acima do mundo, e copia a câmera dele a cada
 * quadro: a brasa não escurece com a tinta da noite e a pilha de camadas do
 * mundo (tinta, neblina, contorno) segue com os filhos de sempre. Por estar
 * acima da névoa do jogador, a tela dele a RECORTA pelo que ele enxerga
 * (`recortar`): partícula nunca aparece por cima do preto.
 *
 * Quem decide se elas nascem espalhadas (cena sem fogo) é quem conhece a cena
 * inteira (`ParticulasDaTela.espalhar`): o mestre pelos objetos dele, o jogador
 * pelo aviso do host no recorte.
 *
 * Custo: o teto de partículas vivas vem da cena e é dividido entre os fogos À
 * VISTA, então mapa com 60 fogos custa o mesmo que mapa com um. Um Sprite por
 * partícula, todos na mesma textura (um lote por efeito).
 *
 * RASCUNHO: `AJUSTE_DAS_PARTICULAS` são os números que o mestre ajusta.
 */
export const AJUSTE_DAS_PARTICULAS = {
  fumaca: {
    cor: 0x0c0b0d,
    alfa: 0.42,
    /** Quanto dura cada tufo, do mais curto ao mais longo (s). */
    vidaS: { min: 3.5, max: 6 },
    /** O tufo nasce pequeno e abre enquanto sobe (diâmetro em casas). */
    tamanhoEmCasas: { nasce: 0.55, morre: 1.9 },
    sobeEmCasasPorS: { min: 0.28, max: 0.5 },
    ventoEmCasasPorS: 0.14,
    balancoEmCasasPorS: 0.1,
  },
  brasas: {
    cores: [0xffd27a, 0xff9a3c, 0xff5a1f],
    alfa: 0.95,
    vidaS: { min: 1.4, max: 3.2 },
    tamanhoEmCasas: { nasce: 0.13, morre: 0.06 },
    sobeEmCasasPorS: { min: 0.5, max: 1.1 },
    ventoEmCasasPorS: 0.2,
    balancoEmCasasPorS: 0.3,
  },
  /** Sem nenhum fogo na cena, as partículas nascem espalhadas pela vista, nesta fração do teto. */
  fracaoSemFogo: 0.6,
  /** Fogo até esta distância da borda da vista ainda solta partículas (casas). */
  margemDaVistaEmCasas: 3,
  /** Passo máximo do relógio: a aba que volta do fundo não solta uma rajada (ms). */
  passoMaximoMs: 50,
} as const

/** Lado da textura da partícula: um disco macio, branco, que cada efeito tinge. */
const LADO_DA_BOLHA = 32
/** De quanto em quanto tempo a camada relê o "menos movimento" do sistema e avisa a contagem (ms). */
const CONFERIR_MS = 1000

function criarTexturaDaBolha(): Texture {
  const pixels = new Uint8Array(LADO_DA_BOLHA * LADO_DA_BOLHA * 4)
  const centro = LADO_DA_BOLHA / 2
  for (let y = 0; y < LADO_DA_BOLHA; y += 1) {
    for (let x = 0; x < LADO_DA_BOLHA; x += 1) {
      const t = Math.min(1, Math.hypot(x + 0.5 - centro, y + 0.5 - centro) / centro)
      // Queda suave até a borda (sem aresta): branco pré-multiplicado, a cor entra pelo `tint`.
      const valor = Math.round(255 * (1 - t) * (1 - t))
      const i = (y * LADO_DA_BOLHA + x) * 4
      pixels[i] = valor
      pixels[i + 1] = valor
      pixels[i + 2] = valor
      pixels[i + 3] = valor
    }
  }
  const source = new BufferImageSource({
    resource: pixels,
    width: LADO_DA_BOLHA,
    height: LADO_DA_BOLHA,
    format: 'rgba8unorm',
    alphaMode: 'premultiplied-alpha',
    scaleMode: 'linear',
  })
  return new Texture({ source })
}

/** Onde as partículas aparecem, em px de mundo. */
export interface RecorteDasParticulas {
  /** O que o jogador enxerga agora (os anéis da visão): só aí elas aparecem. */
  ver: readonly (readonly RegionPoint[])[]
  /** O preto das zonas ocultas dentro da visão: aí também não. */
  esconder: readonly (readonly RegionPoint[])[]
}

export interface MovimentoDasParticulas {
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  /** O mundo (a câmera): a camada copia a posição e a escala dele. */
  mundo: Container
  /** O tamanho da tela em px (o `app.screen`). */
  tela: () => { width: number; height: number }
}

/** O que a tela anota para a medida e a conferência (`data-particulas`). */
export interface EstadoDasParticulas {
  ligadas: boolean
  vivas: number
}

export interface ParticulasDoMapa {
  readonly camada: Container
  /**
   * `cena` é o id do mapa na tela: trocou, as partículas da cena anterior somem
   * na hora (as coordenadas delas eram de outro mapa). `entrada` nula = sem
   * partículas nesta cena (as vivas terminam de apagar e o relógio sai).
   */
  atualizar: (cena: string, entrada: ParticulasDaTela | null) => void
  /** O recorte da tela do jogador; `null` (a tela do mestre) = sem recorte. Só refaz quando o conteúdo muda. */
  recortar: (recorte: RecorteDasParticulas | null) => void
  destruir: () => void
}

type Efeito = 'fumaca' | 'brasas'

interface Particula {
  sprite: Sprite
  idade: number
  vida: number
  /** Velocidade de subida (px de mundo por s). */
  sobe: number
  /** Fase do balanço (rad). */
  fase: number
}

interface Fonte {
  x: number
  y: number
  largura: number
  altura: number
}

function entre(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function criarParticulasDoMapa(movimento: MovimentoDasParticulas, opcoes: { aoMudar?: (estado: EstadoDasParticulas) => void } = {}): ParticulasDoMapa {
  const camada = new Container()
  camada.label = 'particulas'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  camada.visible = false
  const camadas: Record<Efeito, Container> = { fumaca: new Container(), brasas: new Container() }
  // O recorte do jogador são duas máscaras, uma dentro da outra: a de fora deixa
  // só o que ele enxerga, a de dentro tira o preto das zonas ocultas. As duas
  // moram na camada, então andam com a câmera junto das partículas.
  const noQueVe = new Container()
  const foraDoOculto = new Container()
  const mascaraDoQueVe = new Graphics()
  const mascaraDoOculto = new Graphics()
  mascaraDoQueVe.visible = false
  mascaraDoOculto.visible = false
  foraDoOculto.addChild(camadas.fumaca, camadas.brasas)
  noQueVe.addChild(foraDoOculto)
  camada.addChild(noQueVe, mascaraDoQueVe, mascaraDoOculto)

  let textura: Texture | null = null
  const vivas: Record<Efeito, Particula[]> = { fumaca: [], brasas: [] }
  const livres: Record<Efeito, Sprite[]> = { fumaca: [], brasas: [] }
  const aNascer: Record<Efeito, number> = { fumaca: 0, brasas: 0 }
  let entrada: ParticulasDaTela | null = null
  let cenaNaTela: string | null = null
  let recorteLido: RecorteDasParticulas | null = null
  let fogosLidos: readonly FogoQueIlumina[] | null = null
  let fontes: Fonte[] = []
  const fontesNaVista: Fonte[] = []
  let noRelogio = false
  let reduzido = false
  let conferidoEm = 0
  let avisado = ''

  function avisar(): void {
    const estado: EstadoDasParticulas = { ligadas: noRelogio && !reduzido, vivas: vivas.fumaca.length + vivas.brasas.length }
    const chave = `${estado.ligadas}:${estado.vivas}`
    if (chave === avisado) return
    avisado = chave
    opcoes.aoMudar?.(estado)
  }

  function soltar(efeito: Efeito): void {
    for (const p of vivas[efeito]) {
      p.sprite.visible = false
      livres[efeito].push(p.sprite)
    }
    vivas[efeito].length = 0
    aNascer[efeito] = 0
  }

  function nascer(efeito: Efeito, dados: ParticulasDaTela, vista: { x: number; y: number; largura: number; altura: number }): void {
    const ajuste = AJUSTE_DAS_PARTICULAS[efeito]
    if (textura === null) textura = criarTexturaDaBolha()
    let sprite = livres[efeito].pop()
    if (sprite === undefined) {
      sprite = new Sprite({ texture: textura, anchor: 0.5 })
      if (efeito === 'brasas') sprite.blendMode = 'add'
      camadas[efeito].addChild(sprite)
    }
    const fonte = dados.espalhar ? undefined : fontesNaVista[Math.floor(Math.random() * fontesNaVista.length)]
    if (fonte === undefined) {
      // Cena sem fogo: espalhadas pela vista.
      sprite.x = vista.x + Math.random() * vista.largura
      sprite.y = vista.y + Math.random() * vista.altura
    } else {
      // Do miolo do fogo, um pouco acima do centro.
      sprite.x = fonte.x + (Math.random() - 0.5) * fonte.largura * 0.5
      sprite.y = fonte.y - fonte.altura * 0.1 + (Math.random() - 0.5) * fonte.altura * 0.3
    }
    sprite.tint = efeito === 'fumaca' ? AJUSTE_DAS_PARTICULAS.fumaca.cor : AJUSTE_DAS_PARTICULAS.brasas.cores[Math.floor(Math.random() * AJUSTE_DAS_PARTICULAS.brasas.cores.length)] ?? AJUSTE_DAS_PARTICULAS.brasas.cores[0]
    sprite.alpha = 0
    sprite.visible = true
    vivas[efeito].push({
      sprite,
      idade: 0,
      vida: entre(ajuste.vidaS.min, ajuste.vidaS.max),
      sobe: entre(ajuste.sobeEmCasasPorS.min, ajuste.sobeEmCasasPorS.max) * dados.grid,
      fase: Math.random() * Math.PI * 2,
    })
  }

  function andar(efeito: Efeito, dados: ParticulasDaTela, dt: number): void {
    const ajuste = AJUSTE_DAS_PARTICULAS[efeito]
    const lista = vivas[efeito]
    const vento = ajuste.ventoEmCasasPorS * dados.grid
    const balanco = ajuste.balancoEmCasasPorS * dados.grid
    for (let i = lista.length - 1; i >= 0; i -= 1) {
      const p = lista[i]
      if (p === undefined) continue
      p.idade += dt
      const t = p.idade / p.vida
      if (t >= 1) {
        p.sprite.visible = false
        livres[efeito].push(p.sprite)
        // Tira sem deslocar a lista: o último ocupa o lugar.
        const ultimo = lista.pop()
        if (ultimo !== undefined && ultimo !== p) lista[i] = ultimo
        continue
      }
      const diametro = (ajuste.tamanhoEmCasas.nasce + (ajuste.tamanhoEmCasas.morre - ajuste.tamanhoEmCasas.nasce) * t) * dados.grid
      p.sprite.scale.set(diametro / LADO_DA_BOLHA)
      if (efeito === 'fumaca') {
        // O tufo perde força enquanto sobe e abre.
        p.sprite.x += (vento + balanco * Math.sin(p.idade * 0.9 + p.fase)) * dt
        p.sprite.y -= p.sobe * (1 - 0.45 * t) * dt
        p.sprite.alpha = ajuste.alfa * Math.min(1, t / 0.15) * (1 - t)
      } else {
        p.sprite.x += (vento + balanco * Math.sin(p.idade * 3.1 + p.fase)) * dt
        p.sprite.y -= p.sobe * dt
        // A brasa pisca e apaga no fim.
        p.sprite.alpha = ajuste.alfa * (1 - t * t) * (0.72 + 0.28 * Math.sin(p.idade * 17 + p.fase))
      }
    }
  }

  function lerFontes(dados: ParticulasDaTela): void {
    if (dados.objetos === fogosLidos) return
    fogosLidos = dados.objetos
    fontes = dados.objetos.filter(soltaFumacaEBrasas).map((f) => ({ x: f.x, y: f.y, largura: f.width, altura: f.height }))
  }

  const tick = (relogio: Ticker): void => {
    const dados = entrada
    if (dados === null) return
    const agora = performance.now()
    if (agora - conferidoEm >= CONFERIR_MS) {
      conferidoEm = agora
      reduzido = movimento.reducedMotion()
      avisar()
    }
    if (reduzido) {
      if (camada.visible) {
        soltar('fumaca')
        soltar('brasas')
        camada.visible = false
      }
      if (dados.fumaca <= 0 && dados.brasas <= 0) sairDoRelogio()
      return
    }
    camada.visible = true
    // A câmera do mundo: as partículas vivem em px de mundo.
    const { mundo } = movimento
    camada.position.copyFrom(mundo.position)
    camada.scale.copyFrom(mundo.scale)
    const escala = mundo.scale.x
    if (!(escala > 0)) return
    const tela = movimento.tela()
    const vista = { x: -mundo.position.x / escala, y: -mundo.position.y / escala, largura: tela.width / escala, altura: tela.height / escala }
    lerFontes(dados)
    const margem = AJUSTE_DAS_PARTICULAS.margemDaVistaEmCasas * dados.grid
    fontesNaVista.length = 0
    for (const f of fontes) {
      if (f.x >= vista.x - margem && f.x <= vista.x + vista.largura + margem && f.y >= vista.y - margem && f.y <= vista.y + vista.altura + margem) fontesNaVista.push(f)
    }
    // Cena sem fogo (quem diz é quem tem a cena inteira): espalhadas, em menor número. Com fogo, mas nenhum à vista: nada nasce.
    const fator = dados.espalhar ? AJUSTE_DAS_PARTICULAS.fracaoSemFogo : fontesNaVista.length === 0 ? 0 : 1
    const dt = Math.min(relogio.deltaMS, AJUSTE_DAS_PARTICULAS.passoMaximoMs) / 1000
    const efeitos: readonly Efeito[] = ['fumaca', 'brasas']
    for (const efeito of efeitos) {
      const teto = Math.floor(dados[efeito] * fator)
      if (teto <= 0 && vivas[efeito].length === 0) continue
      const ajuste = AJUSTE_DAS_PARTICULAS[efeito]
      // O ritmo que mantém o teto cheio: teto dividido pela vida média.
      aNascer[efeito] = Math.min(4, aNascer[efeito] + (teto / ((ajuste.vidaS.min + ajuste.vidaS.max) / 2)) * dt)
      while (aNascer[efeito] >= 1 && vivas[efeito].length < teto) {
        aNascer[efeito] -= 1
        nascer(efeito, dados, vista)
      }
      andar(efeito, dados, dt)
    }
    // Desligadas: as que já subiam terminam de apagar, e só então o relógio sai.
    if (dados.fumaca <= 0 && dados.brasas <= 0 && vivas.fumaca.length + vivas.brasas.length === 0) sairDoRelogio()
  }

  function sairDoRelogio(): void {
    if (!noRelogio) return
    noRelogio = false
    movimento.ticker.remove(tick)
    entrada = null
    soltar('fumaca')
    soltar('brasas')
    camada.visible = false
    avisar()
  }

  function recortar(recorte: RecorteDasParticulas | null): void {
    if (recorte === recorteLido || (recorte !== null && recorteLido !== null && recorte.ver === recorteLido.ver && recorte.esconder === recorteLido.esconder)) return
    recorteLido = recorte
    mascaraDoQueVe.clear()
    mascaraDoOculto.clear()
    const ver = recorte === null ? [] : recorte.ver.filter((anel) => anel.length >= 3)
    const esconder = recorte === null ? [] : recorte.esconder.filter((anel) => anel.length >= 3)
    for (const anel of ver) mascaraDoQueVe.poly([...anel], true)
    if (ver.length > 0) mascaraDoQueVe.fill({ color: 0xffffff })
    for (const anel of esconder) mascaraDoOculto.poly([...anel], true)
    if (esconder.length > 0) mascaraDoOculto.fill({ color: 0xffffff })
    // Jogador que não enxerga nada não vê partícula nenhuma.
    noQueVe.visible = recorte === null || ver.length > 0
    noQueVe.mask = ver.length > 0 ? mascaraDoQueVe : null
    mascaraDoQueVe.visible = ver.length > 0
    if (esconder.length > 0) foraDoOculto.setMask({ mask: mascaraDoOculto, inverse: true })
    else foraDoOculto.mask = null
    mascaraDoOculto.visible = esconder.length > 0
  }

  function atualizar(cena: string, nova: ParticulasDaTela | null): void {
    if (cena !== cenaNaTela) {
      // Outra cena: as vivas eram de outro mapa, em outras coordenadas.
      cenaNaTela = cena
      soltar('fumaca')
      soltar('brasas')
    }
    const ligada = nova !== null && (nova.fumaca > 0 || nova.brasas > 0) && nova.grid > 0
    if (ligada) {
      entrada = nova
      if (noRelogio) return
      noRelogio = true
      conferidoEm = 0
      movimento.ticker.add(tick)
      return
    }
    // Sem efeito ligado: nada novo nasce (teto 0) e o relógio sai quando a última apagar.
    if (entrada !== null && (entrada.fumaca > 0 || entrada.brasas > 0)) entrada = { ...entrada, fumaca: 0, brasas: 0 }
  }

  function destruir(): void {
    if (noRelogio) movimento.ticker.remove(tick)
    noRelogio = false
    entrada = null
    camada.destroy({ children: true })
    textura?.destroy(true)
    textura = null
  }

  return { camada, atualizar, recortar, destruir }
}
