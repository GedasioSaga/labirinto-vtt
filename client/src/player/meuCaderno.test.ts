/**
 * LEVAR O MAPA E O CADERNO PARA CASA: o arquivo que o jogador baixa.
 *
 * O que importa aqui é o que NÃO entra: o arquivo sai do recorte que o host já
 * mandou (`filterMapForPlayer`), e nada do que a névoa, a zona oculta, a sala
 * secreta ou o nome oculto escondem pode aparecer nele — nem o nome da cena,
 * nem ficha alheia, nem o id do mapa.
 */
import { describe, expect, it } from 'vitest'
import type { ClueEntry } from '../net/protocol'
import type { PersonalNote } from '../lib/minhasNotas'
import type { MapData, Region, Token } from '../types/map'
import { createExploration, markRings } from '../lib/exploration'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { CADERNO_MAX_CENAS, lembrarCena, montarCaderno, nomeDoArquivoDoCaderno, type CenaLembrada } from './meuCaderno'

const RAIO = 700
const GRADE = 50
const posse = { duda: ['heroi'] }
const QUANDO = new Date(2026, 8, 24, 20, 30)

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#3a3f45',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

/** Cena com tudo o que o mestre esconde perto da Duda, e uma sala longe demais para ela ver. */
function cripta(): MapData {
  return {
    ...createEmptyMap('cena-cripta-do-farol', 'Cripta do Farol', 40, 10, GRADE),
    fog: { mode: 'per-token', revealed: [] },
    tokens: [ficha('heroi', 'Duda', 150, 150), ficha('npc', 'Capataz traidor', 250, 200)],
    regions: [
      sala('r-salao', 'Salão', 50, 50, 350, 350),
      sala('r-cofre', 'Cofre do Mestre', 360, 380, 460, 480, { secret: true }),
      sala('r-proibida', 'Sala Proibida', 50, 360, 340, 490, { room: { shape: 'rect', name: 'Sala Proibida', nameHiddenFromPlayers: true } }),
      sala('r-ninho', 'Ninho', 420, 60, 600, 340),
      sala('r-longe', 'Sala Distante', 1600, 50, 1900, 350),
    ],
    concealZones: [
      {
        id: 'z1',
        name: 'zona-do-ninho',
        revealed: false,
        points: [
          { x: 400, y: 40 },
          { x: 620, y: 40 },
          { x: 620, y: 360 },
          { x: 400, y: 360 },
        ],
      },
    ],
  }
}

/** O que a Duda recebe desta cena, como o host manda: recorte + memória marcada depois. */
function recebido(map: MapData) {
  const view = filterMapForPlayer(map, 'duda', posse, RAIO)
  const explored = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
  markRings(explored, view.vision, view.blocked)
  return { map: view.map, vision: view.vision, explored, concealed: view.concealed, ownTokens: posse.duda }
}

function caderno(cenas: readonly CenaLembrada[], pistas: ClueEntry[] = [], notas: PersonalNote[] = []): string {
  return montarCaderno({ cenas, pistas, notas, personagem: 'Duda', geradoEm: QUANDO })
}

describe('meu caderno: o que o recorte escondeu não entra no arquivo', () => {
  it('a sala que ela vê entra com o nome; sala secreta, nome oculto, sala na zona e sala longe não', () => {
    const html = caderno(lembrarCena([], recebido(cripta())))
    expect(html).toContain('Salão')
    for (const escondido of ['Cofre do Mestre', 'Sala Proibida', 'Ninho', 'zona-do-ninho', 'Sala Distante']) {
      expect(html).not.toContain(escondido)
    }
  })

  it('nem o nome da cena, nem o id do mapa, nem a ficha alheia: a cena é "Cena 1" e só a ficha dela aparece', () => {
    const cenas = lembrarCena([], recebido(cripta()))
    const html = caderno(cenas)
    expect(html).toContain('Cena 1')
    expect(html).not.toContain('Cripta do Farol')
    expect(html).not.toContain('cena-cripta-do-farol')
    expect(html).not.toContain('Capataz')
    // Da ficha alheia não fica nem a posição guardada: só a da Duda.
    expect(cenas[0]?.minhasFichas).toEqual([{ x: 150, y: 150, size: 1 }])
    expect(JSON.stringify(cenas)).not.toContain('Capataz')
  })

  it('a zona oculta sai preta por cima, e o mapa só mostra o que ela conhece (recorte pela memória)', () => {
    const html = caderno(lembrarCena([], recebido(cripta())))
    expect(html).toMatch(/<clipPath id="k0">.*<polygon points=/)
    expect(html).toContain('clip-path="url(#k0)"')
    expect(html).toMatch(/<polygon points="[^"]+" fill="#000"\/>/)
  })

  it('arquivo sem rede e sem script: política de conteúdo fechada e nenhum endereço de fora', () => {
    const pista: ClueEntry = { id: 'c1', title: 'Bilhete', text: 'Veja em https://exemplo.com', image: 'https://exemplo.com/x.png', at: QUANDO.getTime() }
    const html = caderno(lembrarCena([], recebido(cripta())), [pista])
    expect(html).toContain(`default-src 'none'; img-src data:`)
    expect(html).not.toMatch(/<script/i)
    // O texto da pista entra como texto; a foto de rede não vira <img>.
    expect(html).toContain('Veja em https://exemplo.com')
    expect(html).not.toContain('src="https://')
    expect(html).not.toMatch(/<img/i)
  })
})

describe('meu caderno: pistas e notas (os recados saíram do caderno)', () => {
  it('texto da mesa e da nota entra escapado: HTML do mestre, do colega ou dele aparece literal', () => {
    const pista: ClueEntry = { id: 'c1', title: '<b>Carta</b>', text: '<img src=x onerror=alert(1)>', image: null, at: QUANDO.getTime(), from: 'Gabi "&" Bruno' }
    const nota: PersonalNote = { id: 'n1', mapId: 'm-x', x: 1, y: 1, text: '<script>alert(1)</script> fujam' }
    const html = caderno([], [pista], [nota])
    expect(html).toContain('&lt;b&gt;Carta&lt;/b&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('mostrada por Gabi &quot;&amp;&quot; Bruno')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; fujam')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<img/i)
  })

  it('foto embutida da pista entra; SVG e caminho de disco não', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const pistas: ClueEntry[] = [
      { id: 'a', title: 'Foto', text: '', image: png, at: 1 },
      { id: 'b', title: 'Vetor', text: '', image: 'data:image/svg+xml;base64,PHN2Zz4=', at: 2 },
      { id: 'c', title: 'Disco', text: '', image: 'C:\\mestre\\segredo.png', at: 3 },
    ]
    const html = caderno([], pistas)
    expect(html.match(/<img /g)?.length).toBe(1)
    expect(html).toContain(`<img src="${png}"`)
    expect(html).not.toContain('segredo.png')
    expect(html).not.toContain('svg+xml')
  })

  it('sem nada ainda: cada seção diz o que falta, e o arquivo sai mesmo assim', () => {
    const html = caderno([])
    expect(html).toContain('Nenhuma cena explorada ainda.')
    expect(html).toContain('Nenhuma pista ainda.')
    expect(html).toContain('Nenhuma nota ainda.')
    expect(html).not.toContain('Recados')
    expect(html).toContain('<title>Caderno de Duda</title>')
  })

  it('as notas vão por mapa, com o nome que o arquivo dá à cena; mapa que o arquivo não guardou fica em "Outro lugar"', () => {
    const cenas = lembrarCena([], recebido(cripta()))
    const notas: PersonalNote[] = [
      { id: 'n1', mapId: cripta().id, x: 1, y: 1, text: 'baú trancado' },
      { id: 'n2', mapId: 'm-esquecido', x: 2, y: 2, text: 'rato morto' },
    ]
    const html = caderno(cenas, [], notas)
    const secao = html.slice(html.indexOf('<h2>Minhas notas</h2>'))
    expect(secao.indexOf('<h3>Cena 1</h3>')).toBeLessThan(secao.indexOf('baú trancado'))
    expect(secao.indexOf('<h3>Outro lugar</h3>')).toBeLessThan(secao.indexOf('rato morto'))
    expect(secao.indexOf('baú trancado')).toBeLessThan(secao.indexOf('<h3>Outro lugar</h3>'))
  })
})

describe('meu caderno: as cenas guardadas', () => {
  const torre = () => ({ ...cripta(), id: 'cena-torre', name: 'Torre Secreta' })

  it('guarda cada cena uma vez, na ordem da primeira chegada; voltar não renumera', () => {
    let cenas = lembrarCena([], recebido(cripta()))
    cenas = lembrarCena(cenas, recebido(torre()))
    cenas = lembrarCena(cenas, recebido(cripta()))
    expect(cenas.map((c) => c.mapId)).toEqual(['cena-cripta-do-farol', 'cena-torre'])
    const html = caderno(cenas)
    expect(html).toContain('Cena 2')
    expect(html).not.toContain('Torre Secreta')
  })

  it('a cena que ele deixou perde a visão ao vivo e fica só com a memória', () => {
    let cenas = lembrarCena([], recebido(cripta()))
    expect(cenas[0]?.vision.length).toBeGreaterThan(0)
    cenas = lembrarCena(cenas, recebido(torre()))
    expect(cenas[0]?.vision).toEqual([])
    expect(cenas[0]?.explored).toBeDefined()
    expect(cenas[1]?.vision.length).toBeGreaterThan(0)
  })

  it('a cena atual leva o selo "onde você está", só ela', () => {
    let cenas = lembrarCena([], recebido(cripta()))
    cenas = lembrarCena(cenas, recebido(torre()))
    const html = caderno(cenas)
    expect(html.match(/onde você está/g)?.length).toBe(1)
    expect(html.indexOf('onde você está')).toBeGreaterThan(html.indexOf('Cena 2'))
  })

  it('voltou à Cena 1: o selo vai com ele, e a Cena 2 fica só com a memória', () => {
    let cenas = lembrarCena([], recebido(cripta()))
    cenas = lembrarCena(cenas, recebido(torre()))
    cenas = lembrarCena(cenas, recebido(cripta()))
    expect(cenas.map((c) => c.atual)).toEqual([true, false])
    expect(cenas[1]?.vision).toEqual([])
    const html = caderno(cenas)
    expect(html.match(/onde você está/g)?.length).toBe(1)
    expect(html.indexOf('onde você está')).toBeGreaterThan(html.indexOf('Cena 1'))
    expect(html.indexOf('onde você está')).toBeLessThan(html.indexOf('Cena 2'))
  })

  it('snapshot sem memória não apaga a memória que já estava guardada', () => {
    const primeiro = recebido(cripta())
    const cenas = lembrarCena(lembrarCena([], primeiro), { ...primeiro, explored: undefined })
    expect(cenas[0]?.explored).toBe(primeiro.explored)
  })

  it('cena sem nada conhecido sai com o aviso, sem mapa', () => {
    const vazio = { ...recebido(cripta()), vision: [], explored: undefined }
    const html = caderno(lembrarCena([], vazio))
    expect(html).toContain('Nada explorado nesta cena.')
    expect(html).not.toContain('<svg')
  })

  it(`passou de ${CADERNO_MAX_CENAS} cenas, sai a mais antiga`, () => {
    const base = recebido(cripta())
    let cenas: CenaLembrada[] = []
    for (let i = 0; i <= CADERNO_MAX_CENAS; i += 1) cenas = lembrarCena(cenas, { ...base, map: { ...base.map, id: `m${i}` } })
    expect(cenas.length).toBe(CADERNO_MAX_CENAS)
    expect(cenas[0]?.mapId).toBe('m1')
  })
})

describe('meu caderno: nome do arquivo', () => {
  it('personagem e data, sem o que o Windows recusa', () => {
    expect(nomeDoArquivoDoCaderno('Caio', QUANDO)).toBe('Caio - meu caderno - 24-09-2026.html')
    expect(nomeDoArquivoDoCaderno('A/B: "C"?', QUANDO)).toBe('AB C - meu caderno - 24-09-2026.html')
    expect(nomeDoArquivoDoCaderno('  ', QUANDO)).toBe('Meu caderno - 24-09-2026.html')
  })
})
