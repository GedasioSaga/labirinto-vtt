/**
 * ROTINA ANDANDO PELO MOTOR DE CAMINHOS — a rotina de verdade num mapa com
 * sala, porta e outras fichas: o NPC contorna parede e ficha (o jogador
 * inclusive, que nunca é empurrado), abre a porta destrancada diante de si e a
 * fecha atrás, uma vez cada; trancada ele não abre e desiste do posto com o
 * motivo; nunca pula. A rotina simples (linha reta, sem obstáculo) anda
 * exatamente como antes do motor. O arquivo do mapa não ganha campo.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, Token, Wall } from '../types/map'
import { andarPeloTrajeto } from './andarPeloCaminho'
import { TOLERANCIA_ENTRE_FICHAS } from './caminhamento/busca'
import { sorteador } from './caminhamento/robo.fixture'
import { comPortasDoNpc, type PortaDoNpc } from './caminhamento/tiqueDosNpcs'
import { segmentsIntersect, wallBlocksToken } from './collision'
import type { EstadoDoMundo } from './estadoDoMundo'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { darPassoDaRotina, ESPERA_NO_POSTO_MS, type FichaAndando, ligarRotina, PASSO_DA_ROTINA_MS, passoEmPx, type RotinasAndando } from './rotinaAndando'
import { type CenaDaRotina, moverNaCena } from './rotinaDoNpc'

const G = 64
const PASSO = passoEmPx(G)
const RAIO = G / 2
/** Duas fichas de uma casa não chegam mais perto que isto (encostar não é atravessar). */
const ALCANCE = 2 * RAIO - G * TOLERANCIA_ENTRE_FICHAS
const APITO: EstadoDoMundo = { id: 'apito', nome: 'Apito', valores: ['Aurora', 'Meio', 'Brasa'], atual: 'Aurora' }
const ESTADOS = [APITO]
const CENA = 'capela'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

const FECHADA = { open: false, locked: false, kind: 'normal' } as const
const TRANCADA = { open: false, locked: true, kind: 'normal' } as const

/** Sala à direita (x 576..896, y 64..448), a porta no lado oeste (y 192..256). */
function sala(porta: Wall['door']): Wall[] {
  return [
    parede('sala-n', 576, 64, 896, 64),
    parede('sala-l', 896, 64, 896, 448),
    parede('sala-s', 576, 448, 896, 448),
    parede('sala-o1', 576, 64, 576, 192),
    parede('porta', 576, 192, 576, 256, porta),
    parede('sala-o2', 576, 256, 576, 448),
  ]
}

const AURORA = { x: 160, y: 224 }
const MEIO = { x: 736, y: 224 }
const BRASA = { x: 160, y: 544 }

function tobias(p: Point, postos: { valor: string; p: Point }[], extra: Partial<Token> = {}): Token {
  const rotina = { estadoId: 'apito', postos: postos.map(({ valor, p: q }) => ({ valor, sceneId: CENA, x: q.x, y: q.y })) }
  return { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: p.x, y: p.y, size: 1, image: null, npc: true, rotina, ...extra }
}

/** O barril parado na reta da Aurora até a porta; o herói (ficha de jogador) na reta da porta até a Brasa. */
const BARRIL: Token = { id: 'barril', characterId: null, name: 'Barril', x: 352, y: 224, size: 1, image: null }
const HEROI: Token = { id: 'heroi', characterId: 'pc-heroi', name: 'Herói', x: 352, y: 384, size: 1, image: null }

function cena(walls: Wall[], tokens: Token[], largura = 15, altura = 10): CenaDaRotina[] {
  return [{ sceneId: CENA, map: { ...createEmptyMap(CENA, CENA, largura, altura, G), walls, tokens } }]
}

const LOOP = [
  { valor: 'Aurora', p: AURORA },
  { valor: 'Meio', p: MEIO },
  { valor: 'Brasa', p: BRASA },
]

interface Rodada {
  cenas: CenaDaRotina[]
  andando: RotinasAndando
  trilha: Point[]
  portas: PortaDoNpc[]
  /** Postos onde a ficha chegou, em ordem. */
  chegadas: Point[]
  /** O que deu errado em algum tique (cruzou parede, encostou em ficha, pulou, empurrou alguém). */
  erros: string[]
  avisos: FichaAndando['aviso'][]
}

function ficha(map: MapData, id: string): Token {
  const t = map.tokens.find((token) => token.id === id)
  if (t === undefined) throw new Error(`sem a ficha ${id}`)
  return t
}

/**
 * Roda `n` tiques da rotina como o editor: passos e portas aplicados no mapa.
 * `aoTique` muda o mapa por fora antes do tique (o jogador anda, o mestre tranca).
 */
function rodar(cenas: CenaDaRotina[], andando: RotinasAndando, inicio: number, n: number, aoTique?: (tique: number, map: MapData) => MapData): Rodada {
  const r: Rodada = { cenas, andando, trilha: [], portas: [], chegadas: [], erros: [], avisos: [] }
  for (let i = 0; i < n; i += 1) {
    const [atual] = r.cenas
    if (atual === undefined) break
    const map = aoTique?.(i, atual.map) ?? atual.map
    const antes = ficha(map, 'tobias')
    const antesDaFicha = r.andando.get('tobias')
    const passo = darPassoDaRotina([{ sceneId: CENA, map }], r.andando, ESTADOS, inicio + i * PASSO_DA_ROTINA_MS)
    const depoisDoPasso = comPortasDoNpc(moverNaCena(map, passo.movimentos), passo.portas)
    const depois = ficha(depoisDoPasso, 'tobias')
    const traco = (w: Wall) => segmentsIntersect(antes, depois, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
    for (const w of map.walls) if (wallBlocksToken(w) && traco(w)) r.erros.push(`tique ${i}: cruzou ${w.id}`)
    if (Math.hypot(depois.x - antes.x, depois.y - antes.y) > PASSO + 1e-9) r.erros.push(`tique ${i}: pulou`)
    for (const outra of map.tokens) {
      if (outra.id === 'tobias') continue
      const igual = depoisDoPasso.tokens.find((t) => t.id === outra.id)
      if (igual === undefined || igual.x !== outra.x || igual.y !== outra.y) r.erros.push(`tique ${i}: empurrou ${outra.id}`)
      if (Math.hypot(outra.x - depois.x, outra.y - depois.y) < ALCANCE - 1e-6) r.erros.push(`tique ${i}: encostou em ${outra.id}`)
    }
    const fichaDepois = passo.andando.get('tobias')
    if (antesDaFicha !== undefined && fichaDepois !== undefined && fichaDepois.destino !== antesDaFicha.destino && fichaDepois.andarilho?.fim?.tipo === 'chegou') r.chegadas.push({ x: depois.x, y: depois.y })
    r.avisos.push(fichaDepois?.aviso)
    r.portas.push(...passo.portas)
    r.trilha.push({ x: depois.x, y: depois.y })
    r.cenas = [{ sceneId: CENA, map: depoisDoPasso }]
    r.andando = passo.andando
  }
  return r
}

function ligada(cenas: CenaDaRotina[]): RotinasAndando {
  return ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
}

/**
 * Uma volta inteira (Aurora, Meio, Brasa, Aurora) com as esperas nos postos:
 * chega de volta à Aurora no tique 86 e só sai de novo para o Meio no 112.
 */
const UMA_VOLTA = 100

describe('rotina pelo motor: sala, porta e outras fichas', () => {
  it('cumpre a rotina: contorna o barril e o herói, abre a porta diante de si e a fecha atrás — uma vez cada travessia', () => {
    const cenas = cena(sala(FECHADA), [tobias(AURORA, LOOP), BARRIL, HEROI])
    const r = rodar(cenas, ligada(cenas), 0, UMA_VOLTA)
    expect(r.chegadas).toEqual([MEIO, BRASA, AURORA])
    // Ida para o Meio e volta para a Brasa: duas travessias, cada uma abre e fecha.
    expect(r.portas).toEqual([
      { sceneId: CENA, wallId: 'porta', aberta: true },
      { sceneId: CENA, wallId: 'porta', aberta: false },
      { sceneId: CENA, wallId: 'porta', aberta: true },
      { sceneId: CENA, wallId: 'porta', aberta: false },
    ])
    expect(r.erros).toEqual([])
    expect(r.avisos.every((a) => a === undefined)).toBe(true)
    const [fim] = r.cenas
    expect(fim?.map.walls.find((w) => w.id === 'porta')?.door?.open).toBe(false)
    // Quem estava parado continua exatamente onde estava.
    expect(ficha(fim?.map ?? cenas[0].map, 'barril')).toEqual(BARRIL)
    expect(ficha(fim?.map ?? cenas[0].map, 'heroi')).toEqual(HEROI)
  })

  it('porta trancada: não abre nem atravessa, desiste do Meio com o motivo e segue a rotina para a Brasa e a Aurora', () => {
    const cenas = cena(sala(TRANCADA), [tobias(AURORA, LOOP), BARRIL, HEROI])
    const r = rodar(cenas, ligada(cenas), 0, UMA_VOLTA)
    expect(r.portas).toEqual([])
    expect(r.erros).toEqual([])
    expect(r.trilha.every((p) => p.x < 576)).toBe(true)
    expect(r.chegadas).toEqual(expect.arrayContaining([BRASA, AURORA]))
    expect(r.chegadas).not.toContainEqual(MEIO)
    expect(r.andando.get('tobias')?.aviso).toMatchObject({ motivo: 'porta-trancada', portas: ['porta'], fichas: [], x: MEIO.x, y: MEIO.y })
  })

  it('o mestre destranca: no loop seguinte ele abre, entra, chega ao Meio e o aviso some', () => {
    const cenas = cena(sala(TRANCADA), [tobias(AURORA, LOOP), BARRIL, HEROI])
    const trancada = rodar(cenas, ligada(cenas), 0, UMA_VOLTA)
    expect(trancada.andando.get('tobias')?.aviso?.motivo).toBe('porta-trancada')
    const destrancar = (map: MapData) => ({ ...map, walls: map.walls.map((w) => (w.id === 'porta' ? { ...w, door: FECHADA } : w)) })
    const r = rodar(trancada.cenas.map((c) => ({ ...c, map: destrancar(c.map) })), trancada.andando, UMA_VOLTA * PASSO_DA_ROTINA_MS, 2 * UMA_VOLTA)
    expect(r.chegadas).toContainEqual(MEIO)
    expect(r.portas.filter((p) => p.aberta).length).toBe(r.portas.filter((p) => !p.aberta).length)
    expect(r.erros).toEqual([])
    expect(r.andando.get('tobias')?.aviso).toBeUndefined()
  })

  it('jogador parado no único corredor: o NPC para antes dele, não o empurra nem atravessa, e desiste com o motivo dizendo quem', () => {
    // Corredor de uma casa (y 256..320) de ponta a ponta; o herói no meio dele.
    const corredor = [parede('n', 0, 256, 960, 256), parede('s', 0, 320, 960, 320)]
    const ida = [
      { valor: 'Aurora', p: { x: 96, y: 288 } },
      { valor: 'Meio', p: { x: 864, y: 288 } },
    ]
    const heroi = { ...HEROI, x: 480, y: 288 }
    const cenas = cena(corredor, [tobias({ x: 96, y: 288 }, ida), heroi])
    const r = rodar(cenas, ligada(cenas), 0, 60)
    expect(r.erros).toEqual([])
    expect(r.trilha.every((p) => p.x <= 480 - ALCANCE + 1e-6)).toBe(true)
    expect(r.avisos.find((a) => a !== undefined)).toMatchObject({ motivo: 'ocupado', fichas: ['heroi'], x: 864, y: 288 })
  })

  it('o jogador entra na frente no meio do caminho: o NPC desvia sem encostar e chega', () => {
    const ida = [
      { valor: 'Aurora', p: { x: 96, y: 288 } },
      { valor: 'Meio', p: { x: 800, y: 288 } },
    ]
    const cenas = cena([], [tobias({ x: 96, y: 288 }, ida)])
    // No tique 4 o jogador pisa a casa logo adiante, na reta do NPC.
    const entra = (tique: number, map: MapData) => (tique === 4 ? { ...map, tokens: [...map.tokens, { ...HEROI, x: 352, y: 288 }] } : map)
    const r = rodar(cenas, ligada(cenas), 0, 60, entra)
    expect(r.chegadas).toContainEqual({ x: 800, y: 288 })
    expect(r.erros).toEqual([])
  })
})

describe('rotina pelo motor: quem não anda', () => {
  it('ficha congelada pelo mestre não anda, com a rotina ligada; descongelada, segue de onde estava', () => {
    const cenas = cena(sala(FECHADA), [tobias(AURORA, LOOP, { congelado: true })])
    const parada = rodar(cenas, ligada(cenas), 0, 20)
    expect(parada.trilha.every((p) => p.x === AURORA.x && p.y === AURORA.y)).toBe(true)
    expect(parada.andando.has('tobias')).toBe(true)
    const solta = parada.cenas.map((c) => ({ ...c, map: { ...c.map, tokens: c.map.tokens.map((t) => (t.id === 'tobias' ? { ...t, congelado: false } : t)) } }))
    const r = rodar(solta, parada.andando, 20 * PASSO_DA_ROTINA_MS, 5)
    expect(r.trilha.some((p) => p.x !== AURORA.x || p.y !== AURORA.y)).toBe(true)
  })
})

describe('rotina pelo motor: a porta que ficou aberta quando ela vai para outra cena', () => {
  const SACRISTIA = 'sacristia'
  /** A sala com a porta de duas casas (y 160..288) no lado oeste: cabem duas fichas lado a lado no vão. */
  const salaDePortaLarga = (): Wall[] => [
    parede('sala-n', 576, 64, 896, 64),
    parede('sala-l', 896, 64, 896, 448),
    parede('sala-s', 576, 448, 896, 448),
    parede('sala-o1', 576, 64, 576, 160),
    parede('porta', 576, 160, 576, 288, FECHADA),
    parede('sala-o2', 576, 288, 576, 448),
  ]
  /** O Meio, uma casa e meia para dentro da porta: perto dela o bastante para, chegando, ainda tentar fechá-la. */
  const MEIO_DENTRO = { x: 672, y: 224 }
  /** Na sacristia. */
  const ALTAR = { x: 160, y: 224 }
  const postos = [
    { valor: 'Aurora', sceneId: CENA, x: AURORA.x, y: AURORA.y },
    { valor: 'Meio', sceneId: CENA, x: MEIO_DENTRO.x, y: MEIO_DENTRO.y },
    { valor: 'Brasa', sceneId: SACRISTIA, x: ALTAR.x, y: ALTAR.y },
  ]
  const npc: Token = { ...tobias(AURORA, []), rotina: { estadoId: 'apito', postos } }
  /** O herói do lado de fora, na metade de baixo do vão: fechar a porta passaria por ele. */
  const NO_VAO = { x: 552, y: 272 }
  /** Ela passou do vão (x 576) e ainda não chegou ao canto de dentro, onde fecharia a porta. */
  const PASSOU_DO_VAO = 590

  function cenas(): CenaDaRotina[] {
    return [
      { sceneId: CENA, map: { ...createEmptyMap(CENA, CENA, 15, 10, G), walls: salaDePortaLarga(), tokens: [npc] } },
      { sceneId: SACRISTIA, map: { ...createEmptyMap(SACRISTIA, SACRISTIA, 15, 10, G), walls: [], tokens: [] } },
    ]
  }

  const portaDaCapela = (cs: readonly CenaDaRotina[]) => cs.find((c) => c.sceneId === CENA)?.map.walls.find((w) => w.id === 'porta')?.door?.open
  const ondeEstaTobias = (cs: readonly CenaDaRotina[]) => cs.find((c) => c.map.tokens.some((t) => t.id === 'tobias'))?.sceneId

  /** Um tique como o editor: o passo na cena, a ficha levada para a outra (`transferToken`) e as portas de cada cena. */
  function tiqueNasCenas(cs: readonly CenaDaRotina[], andando: RotinasAndando, agora: number) {
    const passo = darPassoDaRotina(cs, andando, ESTADOS, agora)
    const levadas = passo.movimentos.filter((m) => m.de !== m.para)
    const depois = cs.map((c) => {
      const saem = new Set(levadas.filter((m) => m.de === c.sceneId).map((m) => m.tokenId))
      const entram = levadas
        .filter((m) => m.para === c.sceneId)
        .flatMap((m) => cs.flatMap((o) => o.map.tokens.filter((t) => t.id === m.tokenId)).map((t) => ({ ...t, x: m.x, y: m.y })))
      const movida = moverNaCena(c.map, passo.movimentos)
      const tokens = [...movida.tokens.filter((t) => !saem.has(t.id)), ...entram]
      return { sceneId: c.sceneId, map: comPortasDoNpc({ ...movida, tokens }, passo.portas.filter((p) => p.sceneId === c.sceneId)) }
    })
    return { ...passo, cenas: depois }
  }

  /** O herói em `p` na capela (entra, se não estava). */
  function heroiEm(cs: readonly CenaDaRotina[], p: Point): CenaDaRotina[] {
    return cs.map((c) => (c.sceneId === CENA ? { ...c, map: { ...c.map, tokens: [...c.map.tokens.filter((t) => t.id !== 'heroi'), { ...HEROI, ...p }] } } : c))
  }

  /**
   * Anda até ela parar no Meio, com o herói entrando no vão logo atrás dela: no
   * canto de dentro ela não fecha a porta (passaria por ele) e chega ao posto
   * com a porta ainda por fechar. Devolve o mundo no tique da chegada.
   */
  function ateOMeioComOHeroiNoVao() {
    let cs = cenas()
    let andando = ligarRotina(new Map(), cs, 'tobias', ESTADOS, 0)
    let entrou = false
    for (let i = 0; i < 80; i += 1) {
      const antes = cs[0]?.map.tokens.find((token) => token.id === 'tobias')
      if (!entrou && antes !== undefined && antes.x > PASSOU_DO_VAO && portaDaCapela(cs) === true) {
        cs = heroiEm(cs, NO_VAO)
        entrou = true
      }
      const r = tiqueNasCenas(cs, andando, i * PASSO_DA_ROTINA_MS)
      cs = r.cenas
      andando = r.andando
      const t = cs[0]?.map.tokens.find((token) => token.id === 'tobias')
      if (t?.x === MEIO_DENTRO.x && t.y === MEIO_DENTRO.y) return { cs, andando, chegada: i }
    }
    throw new Error('não chegou ao Meio')
  }

  /** Da chegada ao Meio até ela ir para a sacristia: o tique da ida e o mundo depois dele. */
  function ateASacristia(inicio: { cs: CenaDaRotina[]; andando: RotinasAndando; chegada: number }) {
    let { cs, andando } = inicio
    for (let i = inicio.chegada + 1; i < inicio.chegada + 30; i += 1) {
      const r = tiqueNasCenas(cs, andando, i * PASSO_DA_ROTINA_MS)
      cs = r.cenas
      andando = r.andando
      if (ondeEstaTobias(cs) === SACRISTIA) return { cs, andando, portas: r.portas }
    }
    throw new Error('não foi para a sacristia')
  }

  it('o herói no vão atrás dela: chega ao posto sem fechar; ele sai do vão na parada e, indo ela para a outra cena, a porta da capela fecha', () => {
    const noMeio = ateOMeioComOHeroiNoVao()
    expect(portaDaCapela(noMeio.cs)).toBe(true)
    expect(noMeio.andando.get('tobias')?.andarilho?.fechar).toEqual(['porta'])
    const ida = ateASacristia({ ...noMeio, cs: heroiEm(noMeio.cs, { x: HEROI.x, y: HEROI.y }) })
    expect(ida.portas).toEqual([{ sceneId: CENA, wallId: 'porta', aberta: false }])
    expect(portaDaCapela(ida.cs)).toBe(false)
    // O trecho ficou na capela: na sacristia ela começa outro, sem porta para fechar.
    expect(ida.andando.get('tobias')?.andarilho).toBeUndefined()
  })

  it('o herói segue no vão na hora de ir: a porta fica aberta (de longe ninguém fecha porta) e o herói não sai do lugar', () => {
    const ida = ateASacristia(ateOMeioComOHeroiNoVao())
    expect(ida.portas).toEqual([])
    expect(portaDaCapela(ida.cs)).toBe(true)
    expect(ida.cs[0]?.map.tokens.find((t) => t.id === 'heroi')).toEqual({ ...HEROI, ...NO_VAO })
  })

  it('voltas inteiras entre as duas cenas: toda vez que ela está na sacristia, a porta da capela está fechada', () => {
    let cs = cenas()
    let andando = ligarRotina(new Map(), cs, 'tobias', ESTADOS, 0)
    const portas: PortaDoNpc[] = []
    const naSacristia: number[] = []
    for (let i = 0; i < 2 * UMA_VOLTA; i += 1) {
      const r = tiqueNasCenas(cs, andando, i * PASSO_DA_ROTINA_MS)
      cs = r.cenas
      andando = r.andando
      portas.push(...r.portas)
      if (ondeEstaTobias(cs) !== SACRISTIA) continue
      naSacristia.push(i)
      expect(portaDaCapela(cs), `tique ${i}`).toBe(false)
    }
    // Pelo menos duas idas à sacristia, e cada ida ao Meio abriu a porta.
    expect(new Set(naSacristia.filter((i) => !naSacristia.includes(i - 1))).size).toBeGreaterThanOrEqual(2)
    expect(portas.filter((p) => p.aberta).length).toBeGreaterThanOrEqual(2)
    expect(portas.every((p) => p.sceneId === CENA)).toBe(true)
  })
})

/**
 * A ROTINA SIMPLES DE ANTES — o agendador como era antes do motor, para a
 * rotina sem obstáculo (o caminho em grade devolvia a reta): a cada tique um
 * passo reto rumo ao posto, parando nele; chegou, espera `ESPERA_NO_POSTO_MS`
 * e mira o próximo. Conferido contra o agendador antigo (commit 09a8eccf) nas
 * mesmas sementes ao trocar o motor.
 */
function rotinaDeAntes(postos: readonly Point[], inicio: Point, grid: number, tiques: number): Point[] {
  const passo = passoEmPx(grid)
  let aqui = inicio
  let destino = (postos.findIndex((p) => p.x === inicio.x && p.y === inicio.y) + 1) % postos.length
  let esperaAte = 0
  const trilha: Point[] = []
  for (let i = 0; i < tiques; i += 1) {
    const agora = i * PASSO_DA_ROTINA_MS
    const posto = postos[destino]
    if (agora >= esperaAte && posto !== undefined) {
      const noPosto = aqui.x === posto.x && aqui.y === posto.y
      const { para, resta } = andarPeloTrajeto(aqui, noPosto ? [] : [posto], passo)
      aqui = para
      if (resta.length === 0 && para.x === posto.x && para.y === posto.y) {
        destino = (destino + 1) % postos.length
        esperaAte = agora + ESPERA_NO_POSTO_MS
      }
    }
    trilha.push(aqui)
  }
  return trilha
}

describe('rotina simples (linha reta, sem obstáculo): igual a antes do motor', () => {
  it('40 rotinas sorteadas, 4 grades (45 px inclusive), postos até na borda: a mesma posição em cada tique', () => {
    const sorte = sorteador(2210)
    const grades = [45, 50, 64, 70]
    const valores = ['Aurora', 'Meio', 'Brasa']
    let comparados = 0
    for (let k = 0; k < 40; k += 1) {
      const grid = grades[k % grades.length] ?? 50
      const largura = 20
      const altura = 14
      const quantos = 2 + Math.floor(sorte() * 2)
      const postos: Point[] = []
      while (postos.length < quantos) {
        const p = { x: (Math.floor(sorte() * largura) + 0.5) * grid, y: (Math.floor(sorte() * altura) + 0.5) * grid }
        if (!postos.some((q) => q.x === p.x && q.y === p.y)) postos.push(p)
      }
      const inicio = postos[0] ?? { x: 0, y: 0 }
      const rotina = { estadoId: 'apito', postos: postos.map((p, i) => ({ valor: valores[i] ?? 'Aurora', sceneId: CENA, x: p.x, y: p.y })) }
      const npc: Token = { id: 'tobias', characterId: null, name: 'Tobias', x: inicio.x, y: inicio.y, size: 1, image: null, npc: true, rotina }
      let cenas: CenaDaRotina[] = [{ sceneId: CENA, map: { ...createEmptyMap(CENA, CENA, largura, altura, grid), tokens: [npc] } }]
      let andando = ligarRotina(new Map(), cenas, 'tobias', ESTADOS, 0)
      const agora: Point[] = []
      for (let i = 0; i < 200; i += 1) {
        const passo = darPassoDaRotina(cenas, andando, ESTADOS, i * PASSO_DA_ROTINA_MS)
        expect(passo.portas).toEqual([])
        cenas = cenas.map((c) => ({ ...c, map: moverNaCena(c.map, passo.movimentos) }))
        andando = passo.andando
        const t = cenas[0]?.map.tokens[0]
        agora.push({ x: t?.x ?? Number.NaN, y: t?.y ?? Number.NaN })
      }
      expect(agora, `rotina ${k} (grade ${grid}, postos ${JSON.stringify(postos)})`).toEqual(rotinaDeAntes(postos, inicio, grid, 200))
      comparados += 1
    }
    expect(comparados).toBe(40)
  })
})

/** As chaves gravadas no arquivo: as do mapa, as de cada ficha e as de cada parede (com a porta). */
function chavesGravadas(json: string): { mapa: string[]; tokens: string[][]; walls: string[][]; portas: string[][] } {
  const lido: unknown = JSON.parse(json)
  if (typeof lido !== 'object' || lido === null) throw new Error('mapa gravado torto')
  const itens = (nome: string): object[] => {
    const valor: unknown = Reflect.get(lido, nome)
    return Array.isArray(valor) ? valor.filter((item: unknown): item is object => typeof item === 'object' && item !== null) : []
  }
  const chaves = (item: object) => Object.keys(item).sort()
  const portas = itens('walls').map((w) => {
    const porta: unknown = Reflect.get(w, 'door')
    return typeof porta === 'object' && porta !== null ? chaves(porta) : []
  })
  return { mapa: chaves(lido), tokens: itens('tokens').map(chaves), walls: itens('walls').map(chaves), portas }
}

describe('o arquivo do mapa não ganha campo', () => {
  it('depois de andar a volta inteira (portas abertas e fechadas), o gravado tem as mesmas chaves de antes', () => {
    const cenas = cena(sala(FECHADA), [tobias(AURORA, LOOP), BARRIL, HEROI])
    const antes = chavesGravadas(serializeMap(cenas[0].map))
    const r = rodar(cenas, ligada(cenas), 0, UMA_VOLTA)
    expect(r.portas.length).toBeGreaterThan(0)
    expect(chavesGravadas(serializeMap(r.cenas[0]?.map ?? cenas[0].map))).toEqual(antes)
  })

  it('mapa salvo e reaberto do disco anda igual ao que estava na memória', () => {
    const cenas = cena(sala(FECHADA), [tobias(AURORA, LOOP), BARRIL, HEROI])
    const doDisco = cenas.map((c) => ({ ...c, map: deserializeMap(serializeMap(c.map)) }))
    const naMemoria = rodar(cenas, ligada(cenas), 0, UMA_VOLTA)
    const reaberto = rodar(doDisco, ligada(doDisco), 0, UMA_VOLTA)
    expect(reaberto.trilha).toEqual(naMemoria.trilha)
    expect(reaberto.portas).toEqual(naMemoria.portas)
  })
})
