import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint, MapData, ParedesDoDesenho, Wall } from '../types/map'
import { cloneSceneMap } from './entityClone'
import { createEmptyMap } from './mapFactory'
import { segmentosDasParedesDoDesenho, segmentosDasParedesPresas } from './paredesDoDesenho'
import {
  deslocamentoDoDesenho,
  idDaParedePresa,
  mesclarParedesDoDesenho,
  paredesDoDesenhoDoArquivo,
  presaNaCopiaDaCena,
  sincronizarParedesDosDesenhos,
  soltarParedesDoDesenho,
  vinculosDeParedeDoArquivo,
} from './paredesPresas'

/**
 * PAREDES PRESAS AO DESENHO: "nas propriedades do pincel eu quero que tenha a
 * opção criar paredes ao redor e ter a opção de criar parede invisivel (que
 * não da para passar), e as paredes quero que der para trocar de cor e que de
 * para colocar opção de ver e não passar, e de poder não ver." Decisão dele:
 * as paredes ficam presas ao desenho (editou, moveu, apagou: acompanham), com
 * a opção de soltar.
 */

const LIGADAS: ParedesDoDesenho = { ativo: true, invisivel: false, passagem: 'bloqueia' }

function rabisco(n = 500): DrawingPoint[] {
  const pontos: DrawingPoint[] = []
  for (let k = 0; k < n; k += 1) {
    const teta = (k / n) * 4 * Math.PI
    pontos.push({ x: 400 + 150 * Math.cos(teta) + 60 * Math.cos(5.3 * teta), y: 400 + 150 * Math.sin(teta) + 60 * Math.sin(5.3 * teta) })
  }
  return pontos
}

function traco(id = 'tr', extra: Partial<Extract<Drawing, { kind: 'freehand' }>> = {}): Extract<Drawing, { kind: 'freehand' }> {
  return { id, kind: 'freehand', points: [{ x: 100, y: 100 }, { x: 160, y: 120 }, { x: 220, y: 100 }], color: '#ffffff', width: 4, ...extra }
}

function mapa(drawings: Drawing[], walls: Wall[] = [], id = 'm'): MapData {
  return { ...createEmptyMap(id, 'Teste', 30, 20, 64), drawings, walls }
}

/** O mapa com as presas já certas: o mesmo caminho da store (antes sem nada → depois). */
function sincronizado(drawings: Drawing[], walls: Wall[] = [], id = 'm'): MapData {
  return sincronizarParedesDosDesenhos(mapa([], [], id), mapa(drawings, walls, id))
}

function presas(map: MapData, desenhoId: string): Wall[] {
  return map.walls.filter((w) => w.desenhoId === desenhoId)
}

function moverPontos(d: Drawing, dx: number, dy: number): Drawing {
  if (d.kind !== 'freehand') throw new Error('só traço neste teste')
  return { ...d, points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}

describe('sincronizarParedesDosDesenhos — ligar', () => {
  it('desenho com paredes ligadas ganha uma parede presa por segmento do contorno, com ids determinísticos', () => {
    const desenho = traco('tr', { paredes: LIGADAS })
    const map = sincronizado([desenho])
    const segmentos = segmentosDasParedesPresas(desenho)
    expect(segmentos.length).toBeGreaterThan(3)
    const minhas = presas(map, 'tr')
    expect(minhas).toHaveLength(segmentos.length)
    minhas.forEach((parede, i) => {
      expect(parede.id).toBe(idDaParedePresa('tr', i))
      expect(parede).toMatchObject({ ...segmentos[i], blocksMove: true, blocksLight: true, door: null, thickness: 'thin', desenhoId: 'tr' })
      expect(parede.hidden).toBeUndefined()
      expect(parede.color).toBeUndefined()
    })
  })

  it('mesma entrada, mesmas paredes (mesmos ids e pontas)', () => {
    const a = sincronizado([traco('tr', { paredes: LIGADAS })])
    const b = sincronizado([structuredClone(traco('tr', { paredes: LIGADAS }))])
    expect(b.walls).toEqual(a.walls)
  })

  it('invisível vira hidden; "Vê mas não passa" deixa a visão passar e barra o passo; a cor vai junto', () => {
    const map = sincronizado([traco('tr', { paredes: { ativo: true, invisivel: true, passagem: 'janela', cor: '#ff0000' } })])
    for (const parede of presas(map, 'tr')) {
      expect(parede.hidden).toBe(true)
      expect(parede.blocksLight).toBe(false)
      expect(parede.blocksMove).toBe(true)
      expect(parede.color).toBe('#ff0000')
    }
  })

  it('a presa mora no piso do desenho', () => {
    const map = sincronizado([{ ...traco('tr', { paredes: LIGADAS }), piso: 2 }])
    expect(presas(map, 'tr').every((p) => p.piso === 2)).toBe(true)
  })

  it('texto e caminho não ganham parede, mesmo com o campo', () => {
    const texto: Drawing = { id: 'tx', kind: 'text', x: 0, y: 0, text: 'oi', color: '#fff', fontSize: 16, paredes: LIGADAS }
    const caminho: Drawing = { id: 'ca', kind: 'path', points: [{ x: 0, y: 0 }, { x: 99, y: 0 }], color: '#fff', width: 20, paredes: LIGADAS }
    const depois = mapa([texto, caminho])
    expect(sincronizarParedesDosDesenhos(mapa([]), depois)).toBe(depois)
  })

  it('o rabisco de 500 pontos fica com menos paredes que o contorno de meio pixel', () => {
    const desenho: Drawing = { id: 'r', kind: 'freehand', points: rabisco(), color: '#fff', width: 4, paredes: LIGADAS }
    const contorno = segmentosDasParedesDoDesenho(desenho).length
    const map = sincronizado([desenho])
    expect(contorno).toBe(768)
    expect(presas(map, 'r').length).toBeLessThan(contorno * 0.75)
  })
})

describe('sincronizarParedesDosDesenhos — acompanhar o desenho', () => {
  it('nada mudou no desenho nem nas presas: a MESMA referência', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const depois = { ...antes, tokens: [] }
    expect(sincronizarParedesDosDesenhos(antes, depois)).toBe(depois)
    const comParedeComum = { ...antes, walls: [...antes.walls, { id: 'w', x1: 0, y1: 0, x2: 9, y2: 0, blocksLight: true, blocksMove: true, door: null }] }
    expect(sincronizarParedesDosDesenhos(antes, comParedeComum)).toBe(comParedeComum)
  })

  it('mover o desenho move as presas (mesmos ids, mesma quantidade) e não deixa nenhuma no lugar antigo', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const movido = moverPontos(antes.drawings[0], 37.3, -12.6)
    const depois = sincronizarParedesDosDesenhos(antes, { ...antes, drawings: [movido] })
    const velhas = presas(antes, 'tr')
    const novas = presas(depois, 'tr')
    expect(novas.map((p) => p.id)).toEqual(velhas.map((p) => p.id))
    novas.forEach((p, i) => {
      expect(p.x1).toBeCloseTo(velhas[i].x1 + 37.3, 1)
      expect(p.y2).toBeCloseTo(velhas[i].y2 - 12.6, 1)
    })
    expect(depois.walls).toHaveLength(velhas.length)
  })

  it('arrasto de muitos quadros não acumula erro: bate com o contorno calculado na posição final', () => {
    let atual = sincronizado([traco('tr', { paredes: LIGADAS })])
    for (let quadro = 0; quadro < 60; quadro += 1) {
      atual = sincronizarParedesDosDesenhos(atual, { ...atual, drawings: [moverPontos(atual.drawings[0], 0.333, 0.777)] })
    }
    const final = segmentosDasParedesPresas(atual.drawings[0])
    presas(atual, 'tr').forEach((p, i) => {
      expect(Math.abs(p.x1 - final[i].x1)).toBeLessThanOrEqual(0.011)
      expect(Math.abs(p.y1 - final[i].y1)).toBeLessThanOrEqual(0.011)
    })
  })

  it('mudar a forma (ponto do traço, espessura) refaz as presas pelo contorno novo', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const original = antes.drawings[0]
    if (original.kind !== 'freehand') throw new Error('traço')
    const editado: Drawing = { ...original, points: original.points.map((p, i) => (i === 1 ? { x: p.x, y: p.y + 60 } : p)) }
    const depois = sincronizarParedesDosDesenhos(antes, { ...antes, drawings: [editado] })
    expect(presas(depois, 'tr').map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }))).toEqual(segmentosDasParedesPresas(editado))
    const grosso: Drawing = { ...editado, width: 20 }
    const maisGrosso = sincronizarParedesDosDesenhos(depois, { ...depois, drawings: [grosso] })
    expect(presas(maisGrosso, 'tr').map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }))).toEqual(segmentosDasParedesPresas(grosso))
  })

  it('trocar só a cor da parede mantém as pontas e troca a cor', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const depois = sincronizarParedesDosDesenhos(antes, { ...antes, drawings: [{ ...antes.drawings[0], paredes: { ...LIGADAS, cor: '#00ff00' } }] })
    expect(presas(depois, 'tr').map((p) => p.color)).toEqual(presas(antes, 'tr').map(() => '#00ff00'))
    expect(presas(depois, 'tr').map((p) => p.x1)).toEqual(presas(antes, 'tr').map((p) => p.x1))
  })

  it('apagar o desenho apaga as presas e deixa as paredes comuns', () => {
    const comum: Wall = { id: 'w', x1: 0, y1: 0, x2: 9, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })], [comum])
    const depois = sincronizarParedesDosDesenhos(antes, { ...antes, drawings: [] })
    expect(depois.walls).toEqual([comum])
  })

  it('desligar as paredes tira as presas', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const depois = sincronizarParedesDosDesenhos(antes, { ...antes, drawings: [{ ...antes.drawings[0], paredes: { ...LIGADAS, ativo: false } }] })
    expect(depois.walls).toEqual([])
  })

  it('presa mexida por fora (apagada, arrastada) volta a ser o que o desenho diz', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const [primeira, ...resto] = antes.walls
    const semUma = sincronizarParedesDosDesenhos(antes, { ...antes, walls: resto })
    expect(semUma.walls).toEqual(antes.walls)
    const arrastada = sincronizarParedesDosDesenhos(antes, { ...antes, walls: [{ ...primeira, x1: 999 }, ...resto] })
    expect(arrastada.walls).toEqual(antes.walls)
  })

  it('desfazer (voltar a um mapa de antes) devolve o próprio mapa de antes', () => {
    const passado = sincronizado([traco('tr', { paredes: LIGADAS })])
    const presente = sincronizarParedesDosDesenhos(passado, { ...passado, drawings: [moverPontos(passado.drawings[0], 50, 50)] })
    expect(sincronizarParedesDosDesenhos(presente, passado)).toBe(passado)
  })

  it('outro mapa (arquivo, cena): as presas que vêm com ele valem como estão', () => {
    const desenho = traco('tr', { paredes: LIGADAS })
    const salvo = sincronizado([desenho], [], 'outro')
    const doArquivo: MapData = structuredClone(salvo)
    const aberto = sincronizarParedesDosDesenhos(sincronizado([traco('x')]), doArquivo)
    expect(aberto).toBe(doArquivo)
  })

  it('desenho que chega de outro mapa com paredes ligadas e sem presas ganha as presas', () => {
    const aberto = sincronizarParedesDosDesenhos(mapa([]), mapa([traco('tr', { paredes: LIGADAS })], [], 'outro'))
    expect(presas(aberto, 'tr').length).toBeGreaterThan(0)
  })
})

describe('deslocamentoDoDesenho', () => {
  it('arrasto devolve o delta; mudar a forma devolve null; mudar só a cor devolve zero', () => {
    const d = traco()
    expect(deslocamentoDoDesenho(d, moverPontos(d, 5, -3))).toEqual({ dx: 5, dy: -3 })
    expect(deslocamentoDoDesenho(d, { ...d, width: 9 })).toBeNull()
    expect(deslocamentoDoDesenho(d, { ...d, color: '#000000' })).toEqual({ dx: 0, dy: 0 })
    const rect: Drawing = { id: 'r', kind: 'rect', x: 0, y: 0, w: 10, h: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0 }
    expect(deslocamentoDoDesenho(rect, { ...rect, x: 4, y: 4 })).toEqual({ dx: 4, dy: 4 })
    expect(deslocamentoDoDesenho(rect, { ...rect, w: 20 })).toBeNull()
  })
})

describe('mesclarParedesDoDesenho', () => {
  it('ligar sem valor parte do padrão', () => {
    expect(mesclarParedesDoDesenho(undefined, { ativo: true })).toEqual(LIGADAS)
  })

  it('escolher "Invisível" passa a passagem para "Vê mas não passa"; o mestre pode voltar', () => {
    const invisivel = mesclarParedesDoDesenho(LIGADAS, { invisivel: true })
    expect(invisivel).toEqual({ ativo: true, invisivel: true, passagem: 'janela' })
    expect(mesclarParedesDoDesenho(invisivel, { passagem: 'bloqueia' })).toEqual({ ativo: true, invisivel: true, passagem: 'bloqueia' })
    expect(mesclarParedesDoDesenho(LIGADAS, { invisivel: true, passagem: 'bloqueia' }).passagem).toBe('bloqueia')
  })

  it('"Padrão" da cor tira o campo; nada mudou devolve a mesma referência', () => {
    const comCor = { ...LIGADAS, cor: '#123456' }
    expect(mesclarParedesDoDesenho(comCor, { cor: undefined })).toEqual(LIGADAS)
    expect(mesclarParedesDoDesenho(comCor, { passagem: 'bloqueia' })).toBe(comCor)
  })
})

describe('soltarParedesDoDesenho', () => {
  it('as presas viram paredes comuns com id novo e o desenho desliga as paredes, guardando as escolhas', () => {
    let n = 0
    const antes = sincronizado([traco('tr', { paredes: { ...LIGADAS, cor: '#abcdef' } })])
    const depois = soltarParedesDoDesenho(antes, 'tr', () => `solta-${(n += 1)}`)
    expect(depois.drawings[0].paredes).toEqual({ ...LIGADAS, ativo: false, cor: '#abcdef' })
    expect(depois.walls).toHaveLength(antes.walls.length)
    expect(depois.walls.every((w) => w.desenhoId === undefined && w.id.startsWith('solta-'))).toBe(true)
    expect(depois.walls.map((w) => w.x1)).toEqual(antes.walls.map((w) => w.x1))
    // Soltas, o desenho não mexe mais nelas.
    expect(sincronizarParedesDosDesenhos(antes, depois)).toBe(depois)
  })

  it('religar depois de soltar cria presas novas sem colidir com as soltas', () => {
    const antes = sincronizado([traco('tr', { paredes: LIGADAS })])
    const solto = soltarParedesDoDesenho(antes, 'tr', () => crypto.randomUUID())
    const religado = sincronizarParedesDosDesenhos(solto, { ...solto, drawings: [{ ...solto.drawings[0], paredes: LIGADAS }] })
    const ids = religado.walls.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(religado.walls).toHaveLength(antes.walls.length * 2)
  })

  it('sem paredes ligadas não há o que soltar: o mesmo mapa', () => {
    const map = mapa([traco('tr')])
    expect(soltarParedesDoDesenho(map, 'tr', () => 'x')).toBe(map)
  })
})

describe('arquivo', () => {
  it('paredes certas voltam iguais; tortas somem; texto perde o campo', () => {
    const certo = traco('tr', { paredes: { ...LIGADAS, cor: '#aabbcc' } })
    expect(paredesDoDesenhoDoArquivo(certo)).toBe(certo)
    // Arquivo editado à mão: o tipo diz Drawing, o conteúdo não cumpre.
    const torto: Drawing = JSON.parse('{"id":"t","kind":"freehand","points":[],"color":"#fff","width":4,"paredes":{"ativo":"sim"}}')
    expect(paredesDoDesenhoDoArquivo(torto)).not.toHaveProperty('paredes')
    const meio: Drawing = JSON.parse('{"id":"t","kind":"freehand","points":[],"color":"#fff","width":4,"paredes":{"ativo":true,"passagem":"voa","cor":"vermelho"}}')
    expect(paredesDoDesenhoDoArquivo(meio).paredes).toEqual(LIGADAS)
    const texto: Drawing = { id: 'tx', kind: 'text', x: 0, y: 0, text: 'oi', color: '#fff', fontSize: 16, paredes: LIGADAS }
    expect(paredesDoDesenhoDoArquivo(texto)).not.toHaveProperty('paredes')
  })

  it('presa de desenho que não existe (ou sem paredes ligadas) perde o vínculo e fica como parede comum', () => {
    const presa: Wall = { id: 'p', x1: 0, y1: 0, x2: 9, y2: 0, blocksLight: true, blocksMove: true, door: null, desenhoId: 'sumiu' }
    const doDesligado: Wall = { ...presa, id: 'q', desenhoId: 'tr' }
    const lidas = vinculosDeParedeDoArquivo([presa, doDesligado], [traco('tr')])
    expect(lidas).toHaveLength(2)
    expect(lidas.every((w) => !('desenhoId' in w))).toBe(true)
    const valida: Wall = { ...presa, desenhoId: 'tr' }
    const paredes = [valida]
    expect(vinculosDeParedeDoArquivo(paredes, [traco('tr', { paredes: LIGADAS })])).toBe(paredes)
  })
})

describe('cópia da cena inteira', () => {
  it('as presas passam a ser dos desenhos copiados, com os ids deles', () => {
    const original = sincronizado([traco('tr', { paredes: LIGADAS })])
    const copia = cloneSceneMap(original, 'copia', 'Cópia', new Set())
    const desenho = copia.drawings[0]
    expect(desenho.id).not.toBe('tr')
    expect(copia.walls.map((w) => w.id)).toEqual(presas(original, 'tr').map((_, i) => idDaParedePresa(desenho.id, i)))
    expect(copia.walls.every((w) => w.desenhoId === desenho.id)).toBe(true)
  })
})

describe('presaNaCopiaDaCena', () => {
  it('a cópia passa a ser do desenho copiado, com os ids dele', () => {
    const contagem = new Map<string, number>()
    const copia: Wall = { id: 'nova', x1: 0, y1: 0, x2: 9, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const novos = new Map([['velho', 'novo']])
    expect(presaNaCopiaDaCena(copia, 'velho', novos, contagem)).toMatchObject({ id: idDaParedePresa('novo', 0), desenhoId: 'novo' })
    expect(presaNaCopiaDaCena(copia, 'velho', novos, contagem).id).toBe(idDaParedePresa('novo', 1))
    expect(presaNaCopiaDaCena(copia, 'outro', novos, contagem)).toBe(copia)
  })
})
