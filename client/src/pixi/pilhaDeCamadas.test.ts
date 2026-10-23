import { describe, expect, it } from 'vitest'
import type { CamadaId, ModeloDeCamadas } from '../types/map'
import { FAIXAS_EDITOR, faixaPrincipal, type ParDeFaixa } from '../lib/camadas/ordem'
import { CAMADAS_PADRAO, MODELO_PADRAO } from '../lib/camadas/padrao'
import { ALFA_DO_TELHADO_TRANSPARENTE } from '../stores/telhadosNoEditor'
import type { MapData } from '../types/map'
import { createEmptyMap } from '../lib/mapFactory'
import { SHAPES_LAYERS, createShapesRedrawer, type ShapesLayer, type ShapesSnapshot } from './shapesRedraw'
import {
  alfaDoTelhadoNoEditor,
  criarPilha,
  criarPorNo,
  distribuir,
  ordenarFilhos,
  paresDosItens,
  planejarPilha,
  type EntradaDaPilha,
  type NoPlanejado,
  type PaiDaPilha,
  type Pilha,
} from './pilhaDeCamadas'

const SECRETO = 0.4

class NoFalso {
  alpha = 1
  constructor(readonly nome: string) {}
}

class PaiFalso implements PaiDaPilha<NoFalso> {
  children: NoFalso[] = []
  movimentos = 0
  addChildAt(no: NoFalso, indice: number): NoFalso {
    // Como o Pixi: mesmo pai no mesmo índice não mexe; senão sai de onde está e entra no índice.
    const atual = this.children.indexOf(no)
    if (atual === indice) return no
    if (atual >= 0) this.children.splice(atual, 1)
    this.children.splice(indice, 0, no)
    this.movimentos += 1
    return no
  }
  removeChild(no: NoFalso): NoFalso {
    const atual = this.children.indexOf(no)
    if (atual >= 0) this.children.splice(atual, 1)
    return no
  }
}

interface Montagem {
  pai: PaiFalso
  pilha: Pilha<NoFalso>
  bases: Map<string, NoFalso>
  criadosAte: NoPlanejado[]
  descartados: NoPlanejado[]
}

/** O `world` de hoje: um nó por faixa, na ordem do `addChild`. */
function montar(): Montagem {
  const pai = new PaiFalso()
  const bases = new Map(FAIXAS_EDITOR.map((f) => [f.id, new NoFalso(f.id)]))
  for (const f of FAIXAS_EDITOR) {
    const no = bases.get(f.id)
    if (no !== undefined) pai.children.push(no)
  }
  const criadosAte: NoPlanejado[] = []
  const descartados: NoPlanejado[] = []
  const pilha = criarPilha<NoFalso>({
    pai,
    faixas: FAIXAS_EDITOR,
    base: (faixa) => {
      const no = bases.get(faixa)
      if (no === undefined) throw new Error(`faixa sem nó: ${faixa}`)
      return no
    },
    criar: (plano) => {
      criadosAte.push(plano)
      return new NoFalso(plano.chave)
    },
    descartar: (_no, plano) => descartados.push(plano),
    alfaProprio: (faixa) => (faixa.startsWith('secret') ? SECRETO : 1),
    lerAlfa: (no) => no.alpha,
    definirAlfa: (no, alfa) => {
      no.alpha = alfa
    },
  })
  pai.movimentos = 0
  return { pai, pilha, bases, criadosAte, descartados }
}

function modelo(ids: readonly CamadaId[]): ModeloDeCamadas {
  return { ordem: ids.map((id) => ({ id })) }
}

/** A lista padrão com `camada` tirada e posta logo acima de `acimaDe`. */
function movida(camada: CamadaId, acimaDe: CamadaId): ModeloDeCamadas {
  const sem = CAMADAS_PADRAO.filter((c) => c !== camada)
  const i = sem.indexOf(acimaDe as (typeof sem)[number])
  return modelo([...sem.slice(0, i + 1), camada, ...sem.slice(i + 1)])
}

/** Todo par nativo tem item (cada faixa de camada desenha alguma coisa). */
const PARES_NATIVOS: ParDeFaixa[] = FAIXAS_EDITOR.flatMap((f) => f.camadas.map((camada) => ({ faixa: f.id, camada })))

function entrada(m: ModeloDeCamadas, extra: Partial<EntradaDaPilha> = {}): EntradaDaPilha {
  return { modelo: m, alfa: () => 1, pares: PARES_NATIVOS, ...extra }
}

const nomes = (pai: PaiFalso): string[] => pai.children.map((n) => n.nome)

describe('pilha de camadas: mapa de hoje', () => {
  it('com o modelo padrão não mexe em nada: um nó de hoje por faixa, na ordem do addChild, nenhum criado', () => {
    const { pai, pilha } = montar()
    expect(pilha.atualizar(entrada(MODELO_PADRAO))).toBe(0)
    expect(pai.movimentos).toBe(0)
    expect(nomes(pai)).toEqual(FAIXAS_EDITOR.map((f) => f.id))
    expect(pilha.criados()).toBe(0)
    expect(pai.children).toHaveLength(FAIXAS_EDITOR.length)
    for (const f of FAIXAS_EDITOR) expect(pilha.nosDaFaixa(f.id)).toHaveLength(1)
  })

  it('o plano padrão é exatamente um nó-base por faixa (modelo vazio também)', () => {
    for (const m of [MODELO_PADRAO, modelo([])]) {
      const plano = planejarPilha(FAIXAS_EDITOR, entrada(m))
      expect(plano.map((p) => p.chave)).toEqual(FAIXAS_EDITOR.map((f) => f.id))
      expect(plano.every((p) => p.base)).toBe(true)
    }
  })

  it('sem opacidade, todo nó fica com o alpha de hoje (1; 0,4 no secreto)', () => {
    const { pilha, bases } = montar()
    pilha.atualizar(entrada(MODELO_PADRAO))
    expect(bases.get('stairsGraphics')?.alpha).toBe(1)
    expect(bases.get('secretStairsGraphics')?.alpha).toBe(SECRETO)
    expect(bases.get('propsContainer')?.alpha).toBe(1)
    expect(bases.get('telhadosContainer')?.alpha).toBe(1)
  })
})

describe('pilha de camadas: a lista manda', () => {
  it('Chão logo acima de Salas: acima do fundo da sala, abaixo de paredes, portas, escadas, móveis, luzes e fichas; os nomes dos lugares ficam no alto', () => {
    const { pai, pilha } = montar()
    expect(pilha.atualizar(entrada(movida('chao', 'salas')))).toBeGreaterThan(0)
    const em = (id: string) => nomes(pai).indexOf(id)
    for (const chao of ['floorGraphics', 'mapRasterSprite']) {
      expect(em(chao)).toBeGreaterThan(em('regionsContainer'))
      for (const acima of ['wallsGraphics', 'doorsGraphics', 'stairsGraphics', 'propsContainer', 'lightsContainer', 'tokensContainer']) {
        expect(em(chao), `${chao} abaixo de ${acima}`).toBeLessThan(em(acima))
      }
    }
    expect(em('roomNamesContainer')).toBeGreaterThan(em('wallsGraphics'))
    expect(em('nomesDosLugaresContainer')).toBeGreaterThan(em('propsContainer'))
    // Só os containers de hoje mudaram de lugar: nada criado, nada a repintar.
    expect(pilha.criados()).toBe(0)
    expect(pai.children).toHaveLength(FAIXAS_EDITOR.length)
  })

  it('Escadas logo acima de Salas: abaixo de Objetos, Paredes e Portas e acima do chão', () => {
    const { pai, pilha } = montar()
    pilha.atualizar(entrada(movida('escadas', 'salas')))
    const em = (id: string) => nomes(pai).indexOf(id)
    for (const escada of ['stairsGraphics', 'secretStairsGraphics']) {
      expect(em(escada)).toBeGreaterThan(em('floorGraphics'))
      for (const acima of ['propsContainer', 'wallsGraphics', 'doorsGraphics']) expect(em(escada)).toBeLessThan(em(acima))
    }
    expect(pilha.criados()).toBe(0)
  })

  it('camada livre entre Objetos e Iluminação fica entre as duas; sem itens, nem nasce', () => {
    const livre: CamadaId = 'livre_bau'
    const ids = [...CAMADAS_PADRAO.slice(0, 9), livre, ...CAMADAS_PADRAO.slice(9)]
    expect(ids[8]).toBe('decoracao')
    const vazia = montar()
    vazia.pilha.atualizar(entrada(modelo(ids)))
    expect(vazia.pilha.criados()).toBe(0)

    const { pai, pilha } = montar()
    pilha.atualizar(entrada(modelo(ids), { pares: [...PARES_NATIVOS, { faixa: 'propsContainer', camada: livre }] }))
    const em = (id: string) => nomes(pai).indexOf(id)
    const no = 'propsContainer|livre_bau'
    expect(pilha.criados()).toBe(1)
    expect(em(no)).toBeGreaterThan(em('propsContainer'))
    expect(em(no)).toBeLessThan(em('lightsContainer'))
    // Os itens da livre vão para o nó dela; o resto continua no de hoje.
    const nos = pilha.nosDaFaixa('propsContainer')
    expect(nos.map((n) => n.camadas)).toEqual([['objetos', 'decoracao'], [livre]])
  })

  it('propriedade: para qualquer permutação da lista (semente fixa), os nós principais seguem a lista', () => {
    const livre: CamadaId = 'livre_x'
    let semente = 20261023
    // mulberry32: mesma semente = mesmas permutações.
    const aleatorio = (): number => {
      semente = (semente + 0x6d2b79f5) | 0
      let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let rodada = 0; rodada < 300; rodada++) {
      const ids: CamadaId[] = [...CAMADAS_PADRAO, livre]
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1))
        ;[ids[i], ids[j]] = [ids[j], ids[i]]
      }
      const { pai, pilha } = montar()
      pilha.atualizar(entrada(modelo(ids), { pares: [...PARES_NATIVOS, { faixa: 'propsContainer', camada: livre }] }))
      const altura = (camada: CamadaId): number => {
        const faixa = faixaPrincipal(camada, FAIXAS_EDITOR) ?? 'propsContainer'
        const no = pilha.nosDaFaixa(faixa).find((n) => n.camadas.includes(camada))
        if (no === undefined) throw new Error(`sem nó para ${camada} em ${faixa}`)
        return pai.children.indexOf(no.no)
      }
      const alturas = ids.map(altura)
      for (let k = 1; k < ids.length; k++) {
        // Igual só quando as duas desenham no mesmo nó (Objetos e Decoração juntas nos móveis).
        expect(alturas[k], `rodada ${rodada}: ${ids.join(',')} — ${ids[k - 1]} antes de ${ids[k]}`).toBeGreaterThanOrEqual(alturas[k - 1])
      }
      // Nada some nem duplica: os nós de hoje continuam todos lá, uma vez cada.
      expect(new Set(pai.children).size).toBe(pai.children.length)
      expect(pai.children.length).toBe(FAIXAS_EDITOR.length + pilha.criados())
    }
  })

  it('reordenar remonta SEM recriar nós nem mudar a assinatura de repintura; voltar ao padrão restaura a ordem', () => {
    const { pai, pilha, criadosAte } = montar()
    pilha.atualizar(entrada(MODELO_PADRAO))
    const assinatura = pilha.assinatura()
    const antes = [...pai.children]
    expect(pilha.atualizar(entrada(movida('chao', 'salas')))).toBeGreaterThan(0)
    expect(pilha.atualizar(entrada(movida('escadas', 'salas')))).toBeGreaterThan(0)
    expect(pilha.assinatura()).toBe(assinatura)
    expect(criadosAte).toHaveLength(0)
    pilha.atualizar(entrada(MODELO_PADRAO))
    expect(pai.children).toEqual(antes)
    expect(pilha.assinatura()).toBe(assinatura)
  })

  it('o mesmo modelo de novo não mexe em nada', () => {
    const { pai, pilha } = montar()
    pilha.atualizar(entrada(movida('chao', 'salas')))
    const movimentos = pai.movimentos
    expect(pilha.atualizar(entrada(movida('chao', 'salas')))).toBe(0)
    expect(pai.movimentos).toBe(movimentos)
  })

  it('faixa dividida que se separa ganha nó próprio só com itens, e o nó criado sai quando esvazia', () => {
    const { pai, pilha, descartados } = montar()
    // Portas logo acima de Escadas: a faixa das paredes (paredes + portas) se separa.
    const m = movida('portas', 'escadas')
    pilha.atualizar(entrada(m))
    expect(pilha.nosDaFaixa('wallsGraphics').map((n) => n.camadas)).toEqual([['paredes'], ['portas']])
    const em = (id: string) => nomes(pai).indexOf(id)
    expect(em('wallsGraphics|portas')).toBeGreaterThan(em('secretStairsGraphics'))
    // Sem porta nenhuma, o nó das portas na faixa das paredes some.
    pilha.atualizar(entrada(m, { pares: PARES_NATIVOS.filter((p) => !(p.faixa === 'wallsGraphics' && p.camada === 'portas')) }))
    expect(pilha.nosDaFaixa('wallsGraphics').map((n) => n.camadas)).toEqual([['paredes']])
    expect(descartados.map((p) => p.chave)).toEqual(['wallsGraphics|portas'])
    expect(pai.children.some((n) => n.nome === 'wallsGraphics|portas')).toBe(false)
  })
})

describe('pilha de camadas: opacidade', () => {
  it('camada com 0,4 põe 0,4 no alpha do nó (vezes o próprio da faixa) e NÃO remonta nem muda a assinatura', () => {
    const { pai, pilha, bases } = montar()
    pilha.atualizar(entrada(MODELO_PADRAO))
    const assinatura = pilha.assinatura()
    const alfa = (c: CamadaId): number => (c === 'escadas' || c === 'tokens' ? 0.4 : 1)
    expect(pilha.atualizar(entrada(MODELO_PADRAO, { alfa }))).toBe(0)
    expect(pai.movimentos).toBe(0)
    expect(pilha.assinatura()).toBe(assinatura)
    expect(bases.get('stairsGraphics')?.alpha).toBe(0.4)
    expect(bases.get('secretStairsGraphics')?.alpha).toBeCloseTo(0.4 * SECRETO, 10)
    expect(bases.get('tokensContainer')?.alpha).toBe(0.4)
    expect(bases.get('lightsContainer')?.alpha).toBe(1)
    // Faixa fixa (grade, seleção) não é tocada.
    const grade = bases.get('gridGraphics')
    if (grade === undefined) throw new Error('sem grade')
    grade.alpha = 0.6
    pilha.atualizar(entrada(MODELO_PADRAO, { alfa }))
    expect(grade.alpha).toBe(0.6)
  })

  it('Objetos a 40% com Decoração a 100%: a faixa dos móveis se separa e cada nó leva a sua opacidade', () => {
    const { pai, pilha, bases } = montar()
    pilha.atualizar(entrada(MODELO_PADRAO, { alfa: (c) => (c === 'objetos' ? 0.4 : 1) }))
    const nos = pilha.nosDaFaixa('propsContainer')
    expect(nos.map((n) => n.camadas)).toEqual([['objetos'], ['decoracao']])
    expect(nos[0].no).toBe(bases.get('propsContainer'))
    expect(nos[0].no.alpha).toBe(0.4)
    expect(nos[1].no.alpha).toBe(1)
    const em = (id: string) => nomes(pai).indexOf(id)
    expect(em('propsContainer|decoracao')).toBe(em('propsContainer') + 1)
  })

  it('Telhados: opacidade da camada x (Transparente ? 0,32 : 1)', () => {
    expect(alfaDoTelhadoNoEditor(1, true)).toBe(ALFA_DO_TELHADO_TRANSPARENTE)
    expect(alfaDoTelhadoNoEditor(1, false)).toBe(1)
    expect(alfaDoTelhadoNoEditor(0.5, true)).toBeCloseTo(0.5 * ALFA_DO_TELHADO_TRANSPARENTE, 10)
    expect(alfaDoTelhadoNoEditor(0.5, false)).toBe(0.5)
  })
})

describe('reordenar não repinta (portões de shapesRedraw)', () => {
  function snapshot(map: MapData, camadas: string): ShapesSnapshot {
    return { map, selection: [], activeTool: 'select', selectedConcealZoneId: null, selectedPinId: null, travel: [], cameraScale: 1, rendererResolution: 1, rotatingRoom: false, camadas }
  }

  it('mapa com só a lista de camadas mudada e a mesma assinatura da pilha: nenhuma camada repinta; assinatura nova repinta as que dividem itens por nó', () => {
    const pinturas: ShapesLayer[] = []
    const espia = (camada: ShapesLayer) => () => {
      pinturas.push(camada)
    }
    const paint: Record<ShapesLayer, () => void> = {
      floor: espia('floor'), gridMask: espia('gridMask'), floorSelection: espia('floorSelection'), mapLines: espia('mapLines'),
      mapFrame: espia('mapFrame'), regions: espia('regions'), perigos: espia('perigos'), drawings: espia('drawings'),
      texturas: espia('texturas'), relevo: espia('relevo'), carimbos: espia('carimbos'), hazards: espia('hazards'),
      areaTriggers: espia('areaTriggers'), faccoes: espia('faccoes'), conveyors: espia('conveyors'), roomNames: espia('roomNames'),
      nomesDosLugares: espia('nomesDosLugares'), walls: espia('walls'), stairs: espia('stairs'), nuvens: espia('nuvens'),
      lights: espia('lights'), watchCones: espia('watchCones'), patrolRoutes: espia('patrolRoutes'), concealZones: espia('concealZones'),
      pins: espia('pins'), textLabels: espia('textLabels'), handles: espia('handles'), areaOutline: espia('areaOutline'),
    }
    expect(Object.keys(paint)).toHaveLength(SHAPES_LAYERS.length)
    const redesenhar = createShapesRedrawer(paint)
    const { pilha } = montar()
    pilha.atualizar(entrada(MODELO_PADRAO))
    const mapa = createEmptyMap('m', 'Mapa', 8, 8, 64)
    redesenhar(snapshot(mapa, pilha.assinatura()))
    expect(pinturas.length).toBeGreaterThan(0)

    pinturas.length = 0
    const movido = movida('chao', 'salas')
    pilha.atualizar(entrada(movido))
    expect(redesenhar(snapshot({ ...mapa, modeloCamadas: movido }, pilha.assinatura()))).toEqual([])
    expect(pinturas).toEqual([])

    // Objetos e Decoração com opacidades diferentes: a faixa dos móveis se separa e a assinatura muda.
    pilha.atualizar(entrada(movido, { alfa: (c) => (c === 'objetos' ? 0.4 : 1) }))
    expect(redesenhar(snapshot({ ...mapa, modeloCamadas: movido }, pilha.assinatura()))).toEqual(['mapLines', 'drawings', 'walls', 'stairs', 'lights'])
  })
})

describe('distribuir e pares', () => {
  it('um renderer por nó: o de hoje no nó de hoje, o criado nasce na primeira pintura e sai com o nó', () => {
    const base = new NoFalso('base')
    const criado = new NoFalso('criado')
    const soltos: string[] = []
    let feitos = 0
    const porNo = criarPorNo(base, 'hoje', () => `novo${(feitos += 1)}`, (r) => soltos.push(r))
    expect(porNo.de(base)).toBe('hoje')
    expect(feitos).toBe(0)
    expect(porNo.de(criado)).toBe('novo1')
    expect(porNo.de(criado)).toBe('novo1')
    porNo.soltar(base)
    porNo.soltar(criado)
    expect(soltos).toEqual(['novo1'])
    expect(porNo.todos()).toEqual(['hoje'])
  })

  const nosFalsos = (lista: { camadas: CamadaId[]; base: boolean }[]) => lista.map((n, i) => ({ no: new NoFalso(`n${i}`), ...n }))

  it('faixa com um nó só devolve o MESMO array (portão Object.is), sem olhar os itens', () => {
    const itens = [{ id: 'a' }, { id: 'b' }]
    let perguntas = 0
    const baldes = distribuir(itens, nosFalsos([{ camadas: ['paredes', 'portas'], base: true }]), () => {
      perguntas += 1
      return 'paredes'
    })
    expect(baldes).toHaveLength(1)
    expect(baldes[0].itens).toBe(itens)
    expect(perguntas).toBe(0)
  })

  it('com vários nós, cada item vai ao nó da camada dele, na ordem de antes; camada sem nó cai no de hoje', () => {
    const itens: { id: string; camada: CamadaId }[] = [
      { id: 'a', camada: 'portas' },
      { id: 'b', camada: 'paredes' },
      { id: 'c', camada: 'livre_x' },
      { id: 'd', camada: 'portas' },
      { id: 'e', camada: 'tokens' },
    ]
    const nos = nosFalsos([
      { camadas: ['livre_x'], base: false },
      { camadas: ['paredes'], base: true },
      { camadas: ['portas'], base: false },
    ])
    const baldes = distribuir(itens, nos, (item) => item.camada)
    expect(baldes.map((b) => b.itens.map((i) => i.id))).toEqual([['c'], ['b', 'e'], ['a', 'd']])
  })

  it('pares dos itens: um por camada presente', () => {
    const pares = paresDosItens('tokensContainer', [{ c: 'tokens' }, { c: 'livre_a' }, { c: 'tokens' }], (i: { c: CamadaId }) => i.c)
    expect(pares).toEqual([
      { faixa: 'tokensContainer', camada: 'tokens' },
      { faixa: 'tokensContainer', camada: 'livre_a' },
    ])
  })

  it('ordenarFilhos não toca no filho que não está na lista (a exportação põe um por instantes)', () => {
    const pai = new PaiFalso()
    const [a, b, c, x] = ['a', 'b', 'c', 'x'].map((n) => new NoFalso(n))
    pai.children.push(a, x, b, c)
    ordenarFilhos(pai, [c, a, b])
    expect(nomes(pai).filter((n) => n !== 'x')).toEqual(['c', 'a', 'b'])
    expect(pai.children).toContain(x)
  })
})
