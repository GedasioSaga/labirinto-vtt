/**
 * `camadasDoJogador` NO RECORTE (fatia 4 de `docs/planos/camadas-fase3-2026-10-22.md`):
 * o host manda à tela do jogador as camadas que ele vê, na ordem da lista,
 * com a opacidade quando não é 1 — só o id, nunca o nome —, e só quando algo
 * difere do padrão (mapa antigo: o recorte de sempre). Ficha, objeto, pino e
 * luz levam a `camada` válida para a tela pôr o item no nó dela.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData, ModeloDeCamadas } from '../types/map'
import { CAMADAS_PADRAO, MODELO_PADRAO } from './camadas/padrao'
import { filterMapForGroup, filterMapForPlayer, planOfWholeMap, type PlayerMapView } from './fogFilter'
import { MAPAS_CONGELADOS, mapaCompleto, recorteEmJson } from './__fixtures__/recorteDeCamadas'

const JOGADOR = 'jogador'
const RAIO = 5000
const NOME_SECRETO = 'Segredo do Lich'
const LIVRE: CamadaId = 'livre_19e8b9d7'
const VAZIA: CamadaId = 'livre_d78173e9'

function recortes(map: MapData): [string, PlayerMapView][] {
  const remembered = planOfWholeMap(map)
  const doJogador = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['olho'] }, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, remembered)
  const daMesa = filterMapForGroup(map, [{ tokenIds: ['olho'], visionRadius: RAIO }], undefined, undefined, undefined, { remembered })
  return [['jogador', doJogador], ['mesa', daMesa]]
}

function modelo(ids: readonly CamadaId[], nomes: Partial<Record<CamadaId, string>> = {}): ModeloDeCamadas {
  return { ordem: ids.map((id) => (nomes[id] === undefined ? { id } : { id, nome: nomes[id] })) }
}

function v2(extra: Partial<MapData> = {}): MapData {
  return { ...mapaCompleto(), versaoDasCamadas: 2, ocultasDoJogador: [], ...extra }
}

/** A lista padrão com Chão logo acima de Salas (caso aceito pelo usuário em 22/10). */
const CHAO_SOBRE_SALAS: CamadaId[] = ['salas', 'chao', ...CAMADAS_PADRAO.slice(2)]

describe('camadasDoJogador: só quando difere do padrão', () => {
  it('mapa antigo: nenhum recorte congelado ganha o campo (o JSON segue o de b934f2a1)', () => {
    for (const caso of MAPAS_CONGELADOS) {
      const recorte = recorteEmJson(caso, [])
      expect(JSON.stringify(recorte), caso.nome).not.toContain('camadasDoJogador')
    }
  })

  it('mapa v2 com a lista padrão e tudo a 100%: sem o campo, mesmo com camada escondida dos jogadores', () => {
    for (const map of [v2(), v2({ modeloCamadas: MODELO_PADRAO }), v2({ ocultasDoJogador: ['paredes', 'chao'] })]) {
      for (const [quem, view] of recortes(map)) expect(Object.keys(view.map), quem).not.toContain('camadasDoJogador')
    }
  })

  it('a ordem da lista vai como está, de baixo para cima', () => {
    for (const [quem, view] of recortes(v2({ modeloCamadas: modelo(CHAO_SOBRE_SALAS) }))) {
      expect(view.map.camadasDoJogador, quem).toEqual(CHAO_SOBRE_SALAS.map((id) => ({ id })))
    }
  })

  it('a opacidade vai só onde não é 1', () => {
    for (const [quem, view] of recortes(v2({ opacidadeDasCamadas: { decoracao: 0.4, objetos: 1 } }))) {
      expect(view.map.camadasDoJogador, quem).toEqual(CAMADAS_PADRAO.map((id) => (id === 'decoracao' ? { id, alfa: 0.4 } : { id })))
    }
  })

  it('só as camadas que o jogador vê: a escondida dos jogadores não entra, nem pelo id', () => {
    const map = v2({ modeloCamadas: modelo(CHAO_SOBRE_SALAS), ocultasDoJogador: ['escadas', 'telhados'] })
    for (const [quem, view] of recortes(map)) {
      expect(view.map.camadasDoJogador?.map((c) => c.id), quem).toEqual(CHAO_SOBRE_SALAS.filter((id) => id !== 'escadas' && id !== 'telhados'))
    }
  })
})

describe('camadasDoJogador e a camada livre: só o id, nunca o nome', () => {
  const comLivre = (ocultas: CamadaId[]): MapData => {
    const base = v2()
    return {
      ...base,
      modeloCamadas: modelo([...CAMADAS_PADRAO, LIVRE, VAZIA], { [LIVRE]: NOME_SECRETO, [VAZIA]: 'Cofre vazio' }),
      ocultasDoJogador: ocultas,
      opacidadeDasCamadas: { [LIVRE]: 0.5 },
      props: base.props.map((p) => ({ ...p, camada: LIVRE })),
      tokens: base.tokens.map((t) => (t.id === 'olho' ? t : { ...t, camada: LIVRE })),
    }
  }

  it('a livre com itens à vista vai na ordem, com a opacidade; a vazia não vai; nome nenhum atravessa', () => {
    for (const [quem, view] of recortes(comLivre([]))) {
      expect(view.map.camadasDoJogador, quem).toEqual([...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE, alfa: 0.5 }])
      const texto = JSON.stringify(view.map)
      expect(texto, quem).not.toContain(NOME_SECRETO)
      expect(texto, quem).not.toContain('Cofre vazio')
      expect(texto, quem).not.toContain(VAZIA)
    }
  })

  it('a livre escondida dos jogadores não vai, nem os itens dela', () => {
    for (const [quem, view] of recortes(comLivre([LIVRE]))) {
      expect(JSON.stringify(view.map), quem).not.toContain(LIVRE)
      expect(Object.keys(view.map), quem).not.toContain('camadasDoJogador')
    }
  })
})

describe('camada nos itens que vão ao jogador', () => {
  it('ficha, objeto, pino e luz levam a camada escolhida (id válido)', () => {
    const base = v2()
    const map: MapData = {
      ...base,
      modeloCamadas: modelo([...CAMADAS_PADRAO, LIVRE], { [LIVRE]: NOME_SECRETO }),
      props: base.props.map((p) => ({ ...p, camada: LIVRE })),
      tokens: base.tokens.map((t) => (t.id === 'olho' ? t : { ...t, camada: 'objetos' })),
      pins: (base.pins ?? []).map((p) => ({ ...p, camada: LIVRE })),
      lights: base.lights.map((l) => ({ ...l, camada: 'tokens' })),
    }
    for (const [quem, view] of recortes(map)) {
      expect(view.map.props.length, quem).toBeGreaterThan(0)
      expect(view.map.props.every((p) => p.camada === LIVRE), quem).toBe(true)
      expect(view.map.tokens.filter((t) => t.id !== 'olho').every((t) => t.camada === 'objetos'), quem).toBe(true)
      expect((view.map.pins ?? []).every((p) => p.camada === LIVRE), quem).toBe(true)
      expect(view.map.lights.every((l) => l.camada === 'tokens'), quem).toBe(true)
      expect(JSON.stringify(view.map), quem).not.toContain(NOME_SECRETO)
    }
  })

  it('camada torta ou livre que o modelo não tem não atravessa: o item vai sem o campo', () => {
    const base = v2()
    const torta: unknown = 'Segredo do Lich'
    const map: MapData = {
      ...base,
      props: base.props.map((p) => ({ ...p, camada: 'livre_d30eefbd' })),
      lights: base.lights.map((l) => Object.assign({}, l, { camada: torta })),
    }
    for (const [quem, view] of recortes(map)) {
      expect(view.map.props.some((p) => 'camada' in p && p.camada !== undefined), quem).toBe(false)
      expect(view.map.lights.some((l) => 'camada' in l && l.camada !== undefined), quem).toBe(false)
      expect(JSON.stringify(view.map), quem).not.toContain(NOME_SECRETO)
    }
  })
})
