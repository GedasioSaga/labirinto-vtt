// FATIA 7 (camadas livres): criar, renomear, ordenar e apagar, funções puras.
// `docs/planos/camadas-fase3-2026-10-22.md`, seção "Fatia 7".
import { describe, expect, it } from 'vitest'
import { addRoom, addToken, createEmptyMap, setRoomRoof } from '../mapFactory'
import { buildRoomFromDraft } from '../drawingFactory'
import type { CamadaId, MapData } from '../../types/map'
import { contextoDeCamadas } from './consulta'
import { CAMADAS_PADRAO, ehCamadaId } from './padrao'
import { MAX_CAMADAS_LIVRES, apagarCamadaLivre, criarCamadaLivre, moverCamada, renomearCamada } from './modelo'
import { NOME_DE_CAMADA_MAX, PONTOS_POR_CARACTERE_MAX, idDeCamadaDoArquivo, lerNomeDeCamada } from './arquivo'

function mapaComSala(): MapData {
  const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 0, y: 0 }, { x: 256, y: 256 }, undefined, undefined, 'Salão')
  let map = addRoom(createEmptyMap('m', 'Mapa', 10, 10, 64), sala.region, sala.walls)
  map = setRoomRoof(map, 'r1', true)
  return addToken(map, { id: 't1', characterId: null, name: 'Ana', x: 64, y: 64, size: 1, image: null })
}

function ids(map: MapData): CamadaId[] {
  return contextoDeCamadas(map).ordem.slice()
}

describe('criar camada livre', () => {
  it('id = livre_ + 8 hexa aleatórios, NUNCA derivado do nome; o formato recusa livre_Segredo_do_Lich', () => {
    const criada = criarCamadaLivre(mapaComSala(), { nome: 'Segredo do Lich' })
    expect(criada).not.toBeNull()
    const id = criada?.id ?? ''
    expect(id).toMatch(/^livre_[0-9a-f]{8}$/)
    expect(id.toLowerCase()).not.toContain('segredo')
    expect(id.toLowerCase()).not.toContain('lich')
    expect(ehCamadaId('livre_Segredo_do_Lich')).toBe(false)
    expect(ehCamadaId('livre_segredodolich')).toBe(false)
    expect(ehCamadaId(id)).toBe(true)
    // Dois nomes iguais, dois ids diferentes: o id não sai do nome.
    const outra = criada === null ? null : criarCamadaLivre(criada.map, { nome: 'Segredo do Lich' })
    expect(outra?.id).not.toBe(id)
  })

  it('nasce no topo da lista (sem linha aberta) ou logo acima de `acimaDe`, com o nome "Nova camada", "Nova camada 2"…', () => {
    const base = mapaComSala()
    const a = criarCamadaLivre(base, {})
    if (a === null) throw new Error('não criou')
    expect(ids(a.map)).toEqual([...CAMADAS_PADRAO, a.id])
    expect(a.map.modeloCamadas?.ordem.at(-1)).toEqual({ id: a.id, nome: 'Nova camada' })
    const b = criarCamadaLivre(a.map, { acimaDe: 'salas' })
    if (b === null) throw new Error('não criou')
    expect(ids(b.map).indexOf(b.id)).toBe(ids(b.map).indexOf('salas') + 1)
    expect(b.map.modeloCamadas?.ordem.find((c) => c.id === b.id)?.nome).toBe('Nova camada 2')
    // Nasce visível para todos, a 100% e destravada (decisão do usuário).
    const camadas = contextoDeCamadas(b.map)
    expect([camadas.mestreVe(b.id), camadas.jogadorVe(b.id), camadas.travada(b.id), camadas.alfa(b.id)]).toEqual([true, true, false, 1])
    // O mapa de antes não ganha versão nova só por ter camada livre.
    expect(b.map.versaoDasCamadas).toBe(base.versaoDasCamadas)
  })

  it(`teto de ${MAX_CAMADAS_LIVRES} livres (13 + ${MAX_CAMADAS_LIVRES} = 64, o que o jogador aceita): a seguinte não nasce`, () => {
    let map = mapaComSala()
    for (let i = 0; i < MAX_CAMADAS_LIVRES; i += 1) {
      const criada = criarCamadaLivre(map, {})
      if (criada === null) throw new Error(`parou em ${i}`)
      map = criada.map
    }
    expect(criarCamadaLivre(map, {})).toBeNull()
  })
})

describe('renomear', () => {
  const criada = criarCamadaLivre(mapaComSala(), {})
  if (criada === null) throw new Error('não criou')
  const { map, id } = criada
  const nomeDe = (m: MapData): string | undefined => m.modeloCamadas?.ordem.find((c) => c.id === id)?.nome

  it.each([
    ['emoji (família inteira, sem partir)', '👨‍👩‍👧 Família', '👨‍👩‍👧 Família'],
    ['cirílico', 'Склеп', 'Склеп'],
    ['japonês', '地下牢の秘密', '地下牢の秘密'],
    ['árabe', 'سرداب الملك', 'سرداب الملك'],
    ['controle e marca de direção saem', `Cripta${String.fromCodePoint(0x202e, 0x7)} sec`, 'Cripta sec'],
    ['espaços em fila viram um', '  Torre   alta  ', 'Torre alta'],
  ])('%s', (_caso, entrada, esperado) => {
    expect(nomeDe(renomearCamada(map, id, entrada))).toBe(esperado)
  })

  it(`teto de ${NOME_DE_CAMADA_MAX} caracteres visíveis (emoji conta 1)`, () => {
    const longo = 'Ω'.repeat(NOME_DE_CAMADA_MAX + 5)
    expect(Array.from(nomeDe(renomearCamada(map, id, longo)) ?? '')).toHaveLength(NOME_DE_CAMADA_MAX)
    const emojis = '👨‍👩‍👧'.repeat(NOME_DE_CAMADA_MAX + 1)
    expect(lerNomeDeCamada(emojis)).toBe('👨‍👩‍👧'.repeat(NOME_DE_CAMADA_MAX))
    // Letra com acento combinado sem fim não passa do teto de unidades.
    expect((lerNomeDeCamada(`a${String.fromCodePoint(0x301).repeat(500)}`) ?? '').length).toBeLessThanOrEqual(PONTOS_POR_CARACTERE_MAX)
  })

  it('em branco, igual ao de antes, camada padrão ou desconhecida: o MESMO mapa (sem passo vazio no Ctrl+Z)', () => {
    expect(renomearCamada(map, id, '   ')).toBe(map)
    expect(renomearCamada(map, id, 'Nova camada')).toBe(map)
    expect(renomearCamada(map, 'paredes', 'Muros')).toBe(map)
    expect(renomearCamada(map, 'livre_0badc0de', 'X')).toBe(map)
  })
})

describe('ordenar', () => {
  it('mover muda a lista (de baixo para cima); voltar à ordem padrão tira o modelo (mapa igual ao de antes)', () => {
    const base = mapaComSala()
    const movido = moverCamada(base, 'chao', 2)
    expect(ids(movido).slice(0, 3)).toEqual(['salas', 'desenhos', 'chao'])
    const voltou = moverCamada(movido, 'chao', 0)
    expect(ids(voltou)).toEqual(CAMADAS_PADRAO)
    expect(voltou.modeloCamadas).toBeUndefined()
    expect(moverCamada(base, 'chao', 0)).toBe(base)
    expect(moverCamada(base, 'livre_0badc0de', 0)).toBe(base)
    // Índice fora da lista fica no extremo.
    expect(ids(moverCamada(base, 'chao', 99)).at(-1)).toBe('chao')
  })
})

describe('apagar camada livre', () => {
  it('os itens dela VOLTAM à camada padrão do tipo, a conta diz quantos, e o estado da camada sai do mapa', () => {
    const criada = criarCamadaLivre(mapaComSala(), {})
    if (criada === null) throw new Error('não criou')
    const { id } = criada
    let map: MapData = {
      ...criada.map,
      versaoDasCamadas: 2,
      hiddenLayers: [id],
      lockedLayers: [id],
      ocultasDoJogador: [id],
      opacidadeDasCamadas: { [id]: 0.5 },
      walls: criada.map.walls.map((w, i) => (i < 2 ? { ...w, camada: id } : w)),
      tokens: criada.map.tokens.map((t) => ({ ...t, camada: id })),
      regions: criada.map.regions.map((r) => (r.room ? { ...r, room: { ...r.room, camadaDoTelhado: id } } : r)),
    }
    expect(contarNa(map, id)).toBe(4)
    const apagada = apagarCamadaLivre(map, id)
    expect(apagada.voltaram).toBe(4)
    expect(apagada.estavaEscondidaDosJogadores).toBe(true)
    map = apagada.map
    expect(ids(map)).toEqual(CAMADAS_PADRAO)
    expect(map.modeloCamadas).toBeUndefined()
    const camadas = contextoDeCamadas(map)
    expect(map.walls.slice(0, 2).map((w) => camadas.camadaDe('parede', w))).toEqual(['paredes', 'paredes'])
    expect(camadas.camadaDe('ficha', map.tokens[0])).toBe('tokens')
    expect(JSON.stringify(map)).not.toContain(id)
  })

  it('camada padrão ou desconhecida: nada muda', () => {
    const base = mapaComSala()
    expect(apagarCamadaLivre(base, 'paredes')).toEqual({ map: base, voltaram: 0, estavaEscondidaDosJogadores: false })
    expect(apagarCamadaLivre(base, 'livre_0badc0de').map).toBe(base)
  })
})

describe('id desconhecido falha FECHADO para os jogadores', () => {
  it('item numa livre apagada do modelo (ou com id fora do formato) e escondida: os jogadores não veem', () => {
    const base = mapaComSala()
    for (const camada of ['livre_0badc0de', 'livre_Segredo_do_Lich']) {
      const map: MapData = { ...base, tokens: base.tokens.map((t) => ({ ...t, camada: camada as CamadaId })), hiddenLayers: [camada as CamadaId] } // as: id cru, como viria de um mapa velho em memória
      expect(contextoDeCamadas(map).jogadorVeItem('ficha', map.tokens[0])).toBe(false)
    }
  })

  it('id de antes no arquivo vira hexa estável (o item fica na camada dele, e o texto nunca é o id)', () => {
    const id = idDeCamadaDoArquivo('livre_Segredo_do_Lich')
    expect(id).toMatch(/^livre_[0-9a-f]{16}$/)
    expect(idDeCamadaDoArquivo('livre_Segredo_do_Lich')).toBe(id)
    expect(idDeCamadaDoArquivo('livre_com espaço')).toBeUndefined()
    expect(idDeCamadaDoArquivo('livre_0badc0de')).toBe('livre_0badc0de')
  })
})

function contarNa(map: MapData, id: CamadaId): number {
  return map.walls.filter((w) => w.camada === id).length + map.tokens.filter((t) => t.camada === id).length + map.regions.filter((r) => r.room?.camadaDoTelhado === id).length
}
