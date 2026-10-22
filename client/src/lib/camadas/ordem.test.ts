import { describe, expect, it } from 'vitest'
import type { CamadaId, ModeloDeCamadas } from '../../types/map'
import { FAIXAS_EDITOR, FAIXAS_JOGADOR, ordemDeRender, type EntradaDaOrdem } from './ordem'
import { CAMADAS_PADRAO, MODELO_PADRAO } from './padrao'

/**
 * A ordem de `world.addChild` de hoje, ESCRITA POR EXTENSO a partir do código
 * (`pixi/PixiCanvas.tsx` ~1257-1330), de baixo para cima. Lista vazia = faixa
 * fixa (fundo, grade, zona oculta, edição). Se alguém mexer na ordem do
 * PixiCanvas, esta lista e `FAIXAS_EDITOR` precisam mudar juntas.
 */
const EDITOR_HOJE: [string, string[]][] = [
  ['backgroundSprite', []],
  ['mapBoundsGraphics', []],
  ['mapFrameContainer', []],
  ['mapRasterSprite', ['chao']],
  ['floorGraphics', ['chao']],
  ['mapLinesGraphics', ['paredes', 'portas']],
  ['regionsContainer', ['salas']],
  ['perigosGraphics', ['salas']],
  ['gridFloorMask', []],
  ['gridOutsideMask', []],
  ['gridOutsideGraphics', []],
  ['gridGraphics', []],
  ['gridAlignOverlayGraphics', []],
  ['hazardsGraphics', ['salas']],
  ['areaTriggersGraphics', ['salas']],
  ['faccoesGraphics', []],
  ['conveyorsGraphics', ['salas']],
  ['drawingsGraphics', ['desenhos']],
  ['secretDrawingsGraphics', ['desenhos']],
  ['texturas', ['terreno']],
  ['relevoContainer', ['terreno']],
  ['regionStrokesContainer', ['salas']],
  ['pathsGraphics', ['anotacoes']],
  ['secretPathsGraphics', ['anotacoes']],
  ['carimbos', ['terreno']],
  ['wallsGraphics', ['paredes', 'portas']],
  ['doorsGraphics', ['portas']],
  ['stairsGraphics', ['escadas']],
  ['secretStairsGraphics', ['escadas']],
  ['nuvensContainer', ['terreno']],
  ['roomNamesContainer', ['salas']],
  ['textLabelsContainer', ['anotacoes']],
  ['propsContainer', ['objetos', 'decoracao']],
  ['lightsContainer', ['iluminacao']],
  ['watchConesGraphics', []],
  ['patrolRoutesGraphics', []],
  ['nomesDosLugaresContainer', ['salas']],
  ['tokensContainer', ['tokens']],
  ['concealZonesContainer', []],
  ['pinsContainer', ['anotacoes']],
  ['telhadosContainer', ['telhados']],
  ['fantasmaDeTesteContainer', []],
  ['straightenGhostGraphics', []],
  ['floorSelectionGraphics', []],
  ['handlesGraphics', []],
  ['hoverGraphics', []],
  ['areaSelectionOutlineGraphics', []],
  ['draftGraphics', []],
  ['anelDoPincelGraphics', []],
  ['areaMarqueeGraphics', []],
  ['guidesGraphics', []],
  ['angleIndicatorContainer', []],
  ['guideLabelsContainer', []],
]

/** A ordem de hoje do jogador (`player/PlayerView.tsx` ~3055-3138): planta sob a névoa, névoa, e o que fica por cima dela. */
const JOGADOR_HOJE: [string, string[]][] = [
  ['mapBackground', []],
  ['raster', ['chao']],
  ['floor', ['chao']],
  ['mapLines', ['paredes', 'portas']],
  ['regions', ['salas']],
  ['perigos', ['salas']],
  ['gridMask', []],
  ['grid', []],
  ['drawings', ['desenhos']],
  ['texturasMask', ['terreno']],
  ['texturasContainer', ['terreno']],
  ['relevoMask', ['terreno']],
  ['relevoContainer', ['terreno']],
  ['regionStrokes', ['salas']],
  ['paths', ['anotacoes']],
  ['carimbosMask', ['terreno']],
  ['carimbosContainer', ['terreno']],
  ['props', ['objetos', 'decoracao']],
  ['chamasCamada', ['objetos', 'decoracao']],
  ['propImages', ['objetos', 'decoracao']],
  ['stairs', ['escadas']],
  ['walls', ['paredes', 'portas']],
  ['doorHints', ['portas']],
  ['doors', ['portas']],
  ['nuvens', ['terreno']],
  ['roomNames', ['salas']],
  ['textLabels', ['anotacoes']],
  ['propLabels', ['objetos', 'decoracao']],
  ['lights', ['iluminacao']],
  ['hazardsMask', ['salas']],
  ['hazards', ['salas']],
  ['triggers', ['salas']],
  ['fogUnknown', []],
  ['knownMask', []],
  ['fogDim', []],
  ['visionMask', []],
  ['concealed', []],
  ['farLights', ['iluminacao']],
  ['roofCut', ['telhados']],
  ['roofs', ['telhados']],
  ['peekedRoofs', ['telhados']],
  ['peekMask', ['telhados']],
  ['portasNoTelhado', ['portas']],
  ['nomesDosLugares', ['salas']],
  ['marks', []],
  ['pins', ['anotacoes']],
  ['lastSeen', ['tokens']],
  ['tokens', ['tokens']],
]

function pares(ordem: readonly EntradaDaOrdem[]): [string, string[]][] {
  return ordem.map((e) => [e.faixa, [...e.camadas]])
}

function modelo(ids: readonly CamadaId[]): ModeloDeCamadas {
  return { ordem: ids.map((id) => ({ id })) }
}

/** A lista padrão com `id` tirado e posto logo acima de `acimaDe` (ou no fundo, com null). */
function moverPara(id: CamadaId, acimaDe: CamadaId | null, base: readonly CamadaId[] = CAMADAS_PADRAO): CamadaId[] {
  const sem = base.filter((c) => c !== id)
  const onde = acimaDe === null ? 0 : sem.indexOf(acimaDe) + 1
  return [...sem.slice(0, onde), id, ...sem.slice(onde)]
}

describe('FAIXAS de hoje', () => {
  it('copiam fielmente a ordem do editor e do jogador, com a camada padrão de cada faixa', () => {
    expect(FAIXAS_EDITOR.map((f) => [f.id, [...f.camadas]])).toEqual(EDITOR_HOJE)
    expect(FAIXAS_JOGADOR.map((f) => [f.id, [...f.camadas]])).toEqual(JOGADOR_HOJE)
  })

  it('no jogador, tudo da planta fica sob a névoa e só luz de longe, telhado, porta no telhado, pílula, marca, pino e ficha ficam por cima', () => {
    const sobre = FAIXAS_JOGADOR.filter((f) => f.zona === 'sobre-a-nevoa').map((f) => f.id)
    const semZona = FAIXAS_JOGADOR.filter((f) => f.zona === undefined).map((f) => f.id)
    expect(sobre).toEqual(['farLights', 'roofCut', 'roofs', 'peekedRoofs', 'peekMask', 'portasNoTelhado', 'nomesDosLugares', 'marks', 'pins', 'lastSeen', 'tokens'])
    expect(semZona).toEqual(['fogUnknown', 'knownMask', 'fogDim', 'visionMask', 'concealed'])
  })
})

describe('ordemDeRender', () => {
  it('com o modelo padrão devolve EXATAMENTE as faixas de hoje (editor e jogador)', () => {
    expect(pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR))).toEqual(EDITOR_HOJE)
    expect(pares(ordemDeRender(MODELO_PADRAO, FAIXAS_JOGADOR))).toEqual(JOGADOR_HOJE)
  })

  it('camada padrão que falta no modelo fica onde está hoje (modelo vazio = hoje)', () => {
    expect(pares(ordemDeRender({ ordem: [] }, FAIXAS_EDITOR))).toEqual(EDITOR_HOJE)
  })

  it('camada livre vazia não muda nada', () => {
    const ids = moverPara('livre_vazia', 'paredes', [...CAMADAS_PADRAO, 'livre_vazia'])
    expect(pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR))).toEqual(EDITOR_HOJE)
  })

  it('camada movida vira bloco inteiro acima da faixa mais alta da camada logo abaixo; no fundo, logo acima do fundo fixo', () => {
    const ordem = pares(ordemDeRender(modelo(moverPara('tokens', null)), FAIXAS_EDITOR))
    expect(ordem.slice(0, 5)).toEqual([
      ['backgroundSprite', []],
      ['mapBoundsGraphics', []],
      ['mapFrameContainer', []],
      ['tokensContainer', ['tokens']],
      ['mapRasterSprite', ['chao']],
    ])
    expect(ordem.filter(([id]) => id !== 'tokensContainer')).toEqual(EDITOR_HOJE.filter(([id]) => id !== 'tokensContainer'))

    // Terreno acima de Escadas: as 4 faixas dele saem do meio e viram um bloco só, logo acima da escada secreta.
    const terreno = pares(ordemDeRender(modelo(moverPara('terreno', 'escadas')), FAIXAS_EDITOR)).map(([id]) => id)
    const depoisDaEscada = terreno.indexOf('secretStairsGraphics')
    expect(terreno.slice(depoisDaEscada, depoisDaEscada + 5)).toEqual(['secretStairsGraphics', 'texturas', 'relevoContainer', 'carimbos', 'nuvensContainer'])
  })

  it('na troca de duas vizinhas, a de cima na lista é a que mudou; faixa dividida (linhas, paredes) se separa', () => {
    const ids = moverPara('paredes', 'portas')
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR))
    const i = ordem.findIndex(([id]) => id === 'doorsGraphics')
    expect(ordem.find(([id]) => id === 'mapLinesGraphics')).toEqual(['mapLinesGraphics', ['portas']])
    expect(ordem.slice(i - 1, i + 4)).toEqual([
      ['wallsGraphics', ['portas']],
      ['doorsGraphics', ['portas']],
      ['mapLinesGraphics', ['paredes']],
      ['wallsGraphics', ['paredes']],
      ['stairsGraphics', ['escadas']],
    ])
  })

  it('camada livre com itens vira bloco acima da faixa mais alta da camada abaixo dela', () => {
    const ids = moverPara('livre_a', 'paredes', [...CAMADAS_PADRAO, 'livre_a'])
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR, [{ faixa: 'propsContainer', camada: 'livre_a' }, { faixa: 'floorGraphics', camada: 'livre_a' }]))
    const i = ordem.findIndex(([id]) => id === 'wallsGraphics')
    expect(ordem.slice(i, i + 4)).toEqual([
      ['wallsGraphics', ['paredes', 'portas']],
      ['floorGraphics', ['livre_a']],
      ['propsContainer', ['livre_a']],
      ['doorsGraphics', ['portas']],
    ])
  })

  it('item de outro tipo numa camada padrão no lugar fica logo acima da faixa mais alta dela', () => {
    const ordem = pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR, [{ faixa: 'wallsGraphics', camada: 'tokens' }]))
    const i = ordem.findIndex(([id]) => id === 'tokensContainer')
    expect(ordem.slice(i, i + 3)).toEqual([['tokensContainer', ['tokens']], ['wallsGraphics', ['tokens']], ['concealZonesContainer', []]])
  })

  it('par que já é nativo, de faixa fixa ou de camada inexistente é ignorado', () => {
    const extras = [
      { faixa: 'wallsGraphics', camada: 'paredes' },
      { faixa: 'gridGraphics', camada: 'tokens' },
      { faixa: 'propsContainer', camada: 'livre_sumiu' },
      { faixa: 'naoExiste', camada: 'tokens' },
    ] as const satisfies readonly { faixa: string; camada: CamadaId }[] // `as const` só fixa os literais; o `satisfies` confere a forma

    expect(pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR, extras))).toEqual(EDITOR_HOJE)
  })

  it('empate (dois blocos logo acima da mesma faixa) fica estável: embaixo o ancorado na camada de menor índice padrão', () => {
    // Objetos e Decoração dividem a faixa dos móveis: os dois blocos caem logo acima dela.
    const ids: CamadaId[] = [...CAMADAS_PADRAO]
    ids.splice(ids.indexOf('objetos') + 1, 0, 'livre_a')
    ids.splice(ids.indexOf('decoracao') + 1, 0, 'livre_b')
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR, [{ faixa: 'wallsGraphics', camada: 'livre_b' }, { faixa: 'pinsContainer', camada: 'livre_a' }]))
    const i = ordem.findIndex(([id]) => id === 'propsContainer')
    expect(ordem.slice(i, i + 4)).toEqual([
      ['propsContainer', ['objetos', 'decoracao']],
      ['pinsContainer', ['livre_a']],
      ['wallsGraphics', ['livre_b']],
      ['lightsContainer', ['iluminacao']],
    ])
  })

  it('no jogador, reordenar só permuta dentro da zona: Tokens no fundo vai para o começo do que fica sobre a névoa', () => {
    const ordem = pares(ordemDeRender(modelo(moverPara('tokens', null)), FAIXAS_JOGADOR)).map(([id]) => id)
    const i = ordem.indexOf('concealed')
    expect(ordem.slice(i, i + 4)).toEqual(['concealed', 'lastSeen', 'tokens', 'farLights'])
    expect(ordem.slice(0, i)).toEqual(JOGADOR_HOJE.slice(0, i).map(([id]) => id))
  })

  it('é pura: não mexe no modelo e devolve o mesmo resultado a cada chamada', () => {
    const m = modelo(moverPara('salas', 'tokens'))
    const antes = JSON.stringify(m)
    const a = pares(ordemDeRender(m, FAIXAS_EDITOR))
    expect(pares(ordemDeRender(m, FAIXAS_EDITOR))).toEqual(a)
    expect(JSON.stringify(m)).toBe(antes)
  })
})
