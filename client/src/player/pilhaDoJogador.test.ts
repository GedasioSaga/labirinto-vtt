/**
 * A pilha do jogador com contêineres falsos (fatia 4 de
 * `docs/planos/camadas-fase3-2026-10-22.md`): a lista manda DENTRO de cada zona
 * da névoa, a névoa nunca sai do lugar, e a opacidade da camada é o `alpha`
 * do nó, sem repintar.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaDoJogador, CamadaId, MapData, Prop } from '../types/map'
import { FAIXAS_JOGADOR } from '../lib/camadas/ordem'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { buildLightAt, buildWallFromDraft } from '../lib/drawingFactory'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { distribuir, type PaiDaPilha } from '../pixi/pilhaDeCamadas'
import { criarParesDoJogador, criarPilhaDoJogador, entradaDoJogador, nosEmPar } from './pilhaDoJogador'

type MapaDaPilha = Pick<MapData, 'camadasDoJogador' | 'walls' | 'props' | 'stairs' | 'drawings'>

interface NoFalso {
  readonly nome: string
  alpha: number
}

class PaiFalso implements PaiDaPilha<NoFalso> {
  children: NoFalso[] = []
  addChildAt(no: NoFalso, indice: number): NoFalso {
    const atual = this.children.indexOf(no)
    if (atual >= 0) this.children.splice(atual, 1)
    this.children.splice(indice, 0, no)
    return no
  }
  removeChild(no: NoFalso): NoFalso {
    this.children = this.children.filter((n) => n !== no)
    return no
  }
}

const NEVOA = ['fogUnknown', 'knownMask', 'fogDim', 'visionMask', 'concealed']
const SOB = new Set(FAIXAS_JOGADOR.filter((f) => f.zona === 'sob-a-nevoa').map((f) => f.id))
const SOBRE = new Set(FAIXAS_JOGADOR.filter((f) => f.zona === 'sobre-a-nevoa').map((f) => f.id))

function montar() {
  const pai = new PaiFalso()
  const bases = new Map(FAIXAS_JOGADOR.map((f) => [f.id, { nome: f.id, alpha: 1 }]))
  const base = (faixa: string): NoFalso => {
    const no = bases.get(faixa)
    if (no === undefined) throw new Error(`faixa ${faixa} sem nó`)
    return no
  }
  pai.children = FAIXAS_JOGADOR.map((f) => base(f.id))
  const pilha = criarPilhaDoJogador<NoFalso>({
    pai,
    base,
    criar: (plano) => ({ nome: plano.chave, alpha: 1 }),
    descartar: () => {},
    lerAlfa: (no) => no.alpha,
    definirAlfa: (no, alfa) => {
      no.alpha = alfa
    },
  })
  /** A faixa de cada filho do mundo, de baixo para cima (o nó criado leva `faixa|camada`). */
  const ordem = (): string[] => pai.children.map((n) => n.nome.split('|')[0])
  return { pai, pilha, base, ordem }
}

function lista(ids: readonly CamadaId[], alfas: Partial<Record<CamadaId, number>> = {}): CamadaDoJogador[] {
  return ids.map((id) => (alfas[id] === undefined ? { id } : { id, alfa: alfas[id] }))
}

function mover(ids: readonly CamadaId[], camada: CamadaId, paraDepoisDe: CamadaId | null): CamadaId[] {
  const sem = ids.filter((id) => id !== camada)
  const i = paraDepoisDe === null ? 0 : sem.indexOf(paraDepoisDe) + 1
  return [...sem.slice(0, i), camada, ...sem.slice(i)]
}

/** Toda faixa da planta abaixo da névoa, toda faixa de cima acima, e a névoa inteira, contígua e na ordem. */
function conferirZonas(ordem: readonly string[]): void {
  const inicioDaNevoa = ordem.indexOf(NEVOA[0])
  expect(ordem.slice(inicioDaNevoa, inicioDaNevoa + NEVOA.length)).toEqual(NEVOA)
  ordem.forEach((faixa, i) => {
    if (SOB.has(faixa)) expect(i, `${faixa} sob a névoa`).toBeLessThan(inicioDaNevoa)
    if (SOBRE.has(faixa)) expect(i, `${faixa} sobre a névoa`).toBeGreaterThanOrEqual(inicioDaNevoa + NEVOA.length)
  })
  expect(ordem[0]).toBe('mapBackground')
}

describe('pilha do jogador: a lista manda dentro da zona', () => {
  it('sem camadasDoJogador (mapa antigo, ou nada difere): o mundo de hoje, um nó por faixa, nada se move', () => {
    const { pilha, ordem, pai } = montar()
    expect(pilha.atualizar(entradaDoJogador({}, []))).toBe(0)
    expect(ordem()).toEqual(FAIXAS_JOGADOR.map((f) => f.id))
    expect(pilha.criados()).toBe(0)
    expect(pai.children.every((n) => n.alpha === 1)).toBe(true)
  })

  it('Chão logo acima de Salas (caso aceito): o chão pinta sobre o fundo das salas, abaixo de desenhos, paredes e móveis', () => {
    const { pilha, ordem } = montar()
    pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(mover(CAMADAS_PADRAO, 'chao', 'salas')) }, []))
    const o = ordem()
    for (const chao of ['raster', 'floor']) {
      expect(o.indexOf(chao)).toBeGreaterThan(o.indexOf('regions'))
      for (const acima of ['drawings', 'regionStrokes', 'props', 'walls', 'lights', 'roomNames']) expect(o.indexOf(chao), `${chao} < ${acima}`).toBeLessThan(o.indexOf(acima))
    }
    conferirZonas(o)
  })

  it('Escadas logo acima de Salas (caso aceito): abaixo de desenhos, paredes, portas e móveis', () => {
    const { pilha, ordem } = montar()
    pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(mover(CAMADAS_PADRAO, 'escadas', 'salas')) }, []))
    const o = ordem()
    expect(o.indexOf('stairs')).toBeGreaterThan(o.indexOf('regions'))
    for (const acima of ['drawings', 'props', 'walls', 'doors']) expect(o.indexOf('stairs'), `stairs < ${acima}`).toBeLessThan(o.indexOf(acima))
    conferirZonas(o)
  })

  it('camada sobre a névoa posta no fundo da lista não desce: Telhados e Tokens no fundo continuam acima da névoa', () => {
    const { pilha, ordem } = montar()
    pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(mover(mover(CAMADAS_PADRAO, 'telhados', null), 'tokens', null)) }, []))
    conferirZonas(ordem())
  })

  it('camada da planta posta acima do telhado continua sob a névoa (Paredes no topo da lista)', () => {
    const { pilha, ordem, pai } = montar()
    // Paredes lisas e com porta no mapa: a faixa `walls` divide as duas camadas.
    const pares = [{ faixa: 'walls', camada: 'paredes' as const }, { faixa: 'walls', camada: 'portas' as const }]
    pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(mover(CAMADAS_PADRAO, 'paredes', 'telhados')) }, pares))
    conferirZonas(ordem())
    const nomes = pai.children.map((n) => n.nome)
    // Dentro da zona da planta ela fica logo acima da vizinha de baixo que mora na zona (Anotações: o Texto);
    // as portas continuam no container de hoje, onde estavam.
    expect(nomes.indexOf('walls|paredes')).toBe(nomes.indexOf('textLabels') + 1)
    expect(nomes.indexOf('walls')).toBe(nomes.indexOf('stairs') + 1)
  })

  it('propriedade: 300 permutações (semente fixa) nunca tiram faixa da zona nem mexem na névoa', () => {
    let semente = 0x5eed
    const aleatorio = (): number => {
      // mulberry32: mesma semente, mesma sequência.
      semente = (semente + 0x6d2b79f5) | 0
      let t = semente
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const { pilha, ordem, pai } = montar()
    const todos = new Set(pai.children)
    const livre: CamadaId = 'livre_abc123'
    for (let rodada = 0; rodada < 300; rodada++) {
      const ids: CamadaId[] = [...CAMADAS_PADRAO, livre]
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1))
        ;[ids[i], ids[j]] = [ids[j], ids[i]]
      }
      // Um móvel e uma escada na livre: os nós criados também ficam na zona deles.
      const pares = [{ faixa: 'props', camada: livre }, { faixa: 'stairs', camada: livre }]
      pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(ids) }, pares))
      conferirZonas(ordem())
      // Nenhum nó de hoje some: só muda de lugar.
      for (const no of todos) expect(pai.children).toContain(no)
    }
  })
})

describe('pilha do jogador: opacidade = alpha do nó', () => {
  it('Escadas a 40%: só o nó das escadas muda, nada se move e a assinatura (portão de repintura) fica', () => {
    const { pilha, base } = montar()
    pilha.atualizar(entradaDoJogador({}, []))
    const assinatura = pilha.assinatura()
    const daFaixa = pilha.assinaturaDa('stairs')
    expect(pilha.atualizar(entradaDoJogador({ camadasDoJogador: lista(CAMADAS_PADRAO, { escadas: 0.4 }) }, []))).toBe(0)
    expect(base('stairs').alpha).toBe(0.4)
    expect(base('walls').alpha).toBe(1)
    expect(base('fogUnknown').alpha).toBe(1)
    expect(pilha.assinatura()).toBe(assinatura)
    expect(pilha.assinaturaDa('stairs')).toBe(daFaixa)
  })

  it('Decoração com opacidade diferente de Objetos: os móveis dela ganham nó próprio nas quatro faixas, com o alpha dela', () => {
    const { pilha, base } = montar()
    const props: Prop[] = [
      { id: 'cadeira', x: 0, y: 0, width: 10, height: 10, src: '', linkedMapPath: null },
      { id: 'tapete', x: 0, y: 0, width: 10, height: 10, src: '', linkedMapPath: null, layer: 'decoracao' },
    ]
    const map: MapaDaPilha = { camadasDoJogador: lista(CAMADAS_PADRAO, { decoracao: 0.4 }), walls: [], props, stairs: [], drawings: [] }
    pilha.atualizar(entradaDoJogador(map, criarParesDoJogador()(map)))
    for (const faixa of ['props', 'chamasCamada', 'propImages', 'propLabels']) {
      const nos = pilha.nosDaFaixa(faixa)
      expect(nos.map((n) => n.camadas.join('+')), faixa).toEqual(['objetos', 'decoracao'])
      expect(nos[0].no).toBe(base(faixa))
      expect(nos.map((n) => n.no.alpha), faixa).toEqual([1, 0.4])
    }
    const baldes = distribuir(props, pilha.nosDaFaixa('props'), (p) => (p.layer === 'decoracao' ? 'decoracao' : 'objetos'))
    expect(baldes.map((b) => b.itens.map((p) => p.id))).toEqual([['cadeira'], ['tapete']])
    expect(nosEmPar(pilha.nosDaFaixa('propImages'), pilha.nosDaFaixa('propLabels'))).toHaveLength(2)
  })

  it('caminho rápido: mapa sem camada escolhida, um nó por faixa, a MESMA lista para os portões', () => {
    const { pilha } = montar()
    const props: Prop[] = [{ id: 'cadeira', x: 0, y: 0, width: 10, height: 10, src: '', linkedMapPath: null }]
    const map: MapaDaPilha = { walls: [], props, stairs: [], drawings: [] }
    pilha.atualizar(entradaDoJogador(map, criarParesDoJogador()(map)))
    const [balde] = distribuir(props, pilha.nosDaFaixa('props'), () => 'objetos')
    expect(balde.itens).toBe(props)
    expect(pilha.criados()).toBe(0)
  })
})

describe('LIMITACAO ATUAL da fatia 4 (a fatia 3b/4b vira este teste; pré-requisito da fatia 8)', () => {
  // Com camada escolhida, retângulo da porta e halo (doors, doorHints),
  // fichas, luzes e pinos ficam no container de hoje: ordem e opacidade da
  // camada NATIVA deles. Não há interface para escolher camada de item antes
  // da fatia 8; quando a 3b/4b dividir esses itens por nó, este teste fica
  // vermelho e vira o aceite dela.
  it('LIMITACAO ATUAL: fichas, luzes, pinos e o retângulo e o halo da porta numa livre NÃO ganham par', () => {
    const livre: CamadaId = 'livre_k3j9x2'
    const base = createEmptyMap('m-limite', 'Limite', 10, 10, 50)
    const map: MapData = {
      ...base,
      camadasDoJogador: lista([...CAMADAS_PADRAO, livre]),
      tokens: [{ id: 'bia', characterId: null, name: 'Bia', x: 75, y: 75, size: 1, image: null, camada: livre }],
      lights: [{ ...buildLightAt('luz', { x: 100, y: 100 }, 50), camada: livre }],
      pins: [{ ...buildPin('pino', { x: 150, y: 150 }, 'exclamacao'), camada: livre }],
      walls: [{ ...buildWallFromDraft('porta', { x: 200, y: 100 }, { x: 250, y: 100 }), door: { kind: 'normal', open: false, locked: false }, camada: livre }],
    }
    const pares = criarParesDoJogador()(map)
    const faixasNaLivre = pares.filter((p) => p.camada === livre).map((p) => p.faixa)
    // Só o traço da parede da porta divide (faixa `walls`); o resto fica no container de hoje.
    expect(faixasNaLivre).toEqual(['walls'])
    for (const faixa of ['tokens', 'lights', 'farLights', 'pins', 'doors', 'doorHints', 'portasNoTelhado', 'lastSeen']) {
      expect(pares.some((p) => p.faixa === faixa), faixa).toBe(false)
    }
  })
})
