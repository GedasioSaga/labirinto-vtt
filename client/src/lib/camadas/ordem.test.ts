import { describe, expect, it } from 'vitest'
import type { CamadaId, CamadaPadraoId, ModeloDeCamadas } from '../../types/map'
import { FAIXAS_EDITOR, FAIXAS_JOGADOR, faixaPrincipal, ordemDeRender, type EntradaDaOrdem, type Faixa, type ParDeFaixa } from './ordem'
import { CAMADAS_PADRAO, MODELO_PADRAO, ehCamadaPadrao } from './padrao'

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
  ['fogosContainer', []],
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
  ['fogos', []],
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
    expect(sobre).toEqual(['farLights', 'roofCut', 'roofs', 'peekedRoofs', 'peekMask', 'portasNoTelhado', 'fogos', 'nomesDosLugares', 'marks', 'pins', 'lastSeen', 'tokens'])
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
    const ids = moverPara('livre_65422961', 'paredes', [...CAMADAS_PADRAO, 'livre_65422961'])
    expect(pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR))).toEqual(EDITOR_HOJE)
  })

  it('camada movida vira bloco inteiro logo acima da âncora da camada abaixo; no fundo, logo acima do fundo fixo', () => {
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

  it('camada livre com itens vira bloco logo acima da âncora da camada abaixo dela; entre Paredes e Portas, separa a faixa das paredes', () => {
    const ids = moverPara('livre_1fbcd429', 'paredes', [...CAMADAS_PADRAO, 'livre_1fbcd429'])
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR, [{ faixa: 'propsContainer', camada: 'livre_1fbcd429' }, { faixa: 'floorGraphics', camada: 'livre_1fbcd429' }]))
    const i = ordem.findIndex(([id]) => id === 'wallsGraphics')
    // Fatia 3: a lista manda, então Portas (acima da livre) vira bloco acima dela, com as três faixas dela.
    expect(ordem.slice(i, i + 7)).toEqual([
      ['wallsGraphics', ['paredes']],
      ['floorGraphics', ['livre_1fbcd429']],
      ['propsContainer', ['livre_1fbcd429']],
      ['mapLinesGraphics', ['portas']],
      ['wallsGraphics', ['portas']],
      ['doorsGraphics', ['portas']],
      ['stairsGraphics', ['escadas']],
    ])
  })

  it('item de outro tipo numa camada padrão no lugar fica logo acima da âncora dela', () => {
    const ordem = pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR, [{ faixa: 'wallsGraphics', camada: 'tokens' }]))
    const i = ordem.findIndex(([id]) => id === 'tokensContainer')
    expect(ordem.slice(i, i + 3)).toEqual([['tokensContainer', ['tokens']], ['wallsGraphics', ['tokens']], ['concealZonesContainer', []]])
  })

  it('par que já é nativo, de faixa fixa ou de camada inexistente é ignorado', () => {
    const extras = [
      { faixa: 'wallsGraphics', camada: 'paredes' },
      { faixa: 'gridGraphics', camada: 'tokens' },
      { faixa: 'propsContainer', camada: 'livre_f75c687b' },
      { faixa: 'naoExiste', camada: 'tokens' },
    ] as const satisfies readonly { faixa: string; camada: CamadaId }[] // `as const` só fixa os literais; o `satisfies` confere a forma

    expect(pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR, extras))).toEqual(EDITOR_HOJE)
  })

  it('camada entre Objetos e Decoração separa a faixa dos móveis: cada bloco fica entre as vizinhas da lista', () => {
    // Fatia 3 (a lista manda): antes, as duas livres caíam juntas acima da faixa dividida.
    const ids: CamadaId[] = [...CAMADAS_PADRAO]
    ids.splice(ids.indexOf('objetos') + 1, 0, 'livre_1fbcd429')
    ids.splice(ids.indexOf('decoracao') + 1, 0, 'livre_1cbccf70')
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR, [{ faixa: 'wallsGraphics', camada: 'livre_1cbccf70' }, { faixa: 'pinsContainer', camada: 'livre_1fbcd429' }]))
    const i = ordem.findIndex(([id]) => id === 'propsContainer')
    expect(ordem.slice(i, i + 5)).toEqual([
      ['propsContainer', ['objetos']],
      ['pinsContainer', ['livre_1fbcd429']],
      ['propsContainer', ['decoracao']],
      ['wallsGraphics', ['livre_1cbccf70']],
      ['lightsContainer', ['iluminacao']],
    ])
  })

  it('sem nada entre Paredes e Portas (ou Objetos e Decoração), a faixa dividida continua junta', () => {
    const ids: CamadaId[] = [...CAMADAS_PADRAO, 'livre_1fbcd429']
    const ordem = pares(ordemDeRender(modelo(ids), FAIXAS_EDITOR, [{ faixa: 'propsContainer', camada: 'livre_1fbcd429' }]))
    expect(ordem.find(([id]) => id === 'wallsGraphics')).toEqual(['wallsGraphics', ['paredes', 'portas']])
    expect(ordem.find(([id]) => id === 'propsContainer')).toEqual(['propsContainer', ['objetos', 'decoracao']])
  })

  it('camada livre VAZIA entre Paredes e Portas e entre Objetos e Decoração não separa nada: as faixas continuam juntas', () => {
    const ids: CamadaId[] = [...CAMADAS_PADRAO]
    ids.splice(ids.indexOf('paredes') + 1, 0, 'livre_1fbcd429')
    ids.splice(ids.indexOf('objetos') + 1, 0, 'livre_1cbccf70')
    // Itens da livre_1dbcd103 só: as do meio estão vazias.
    const ordem = pares(ordemDeRender(modelo([...ids, 'livre_1dbcd103']), FAIXAS_EDITOR, [{ faixa: 'propsContainer', camada: 'livre_1dbcd103' }]))
    expect(ordem.find(([id]) => id === 'mapLinesGraphics')).toEqual(['mapLinesGraphics', ['paredes', 'portas']])
    expect(ordem.find(([id]) => id === 'wallsGraphics')).toEqual(['wallsGraphics', ['paredes', 'portas']])
    expect(ordem.find(([id]) => id === 'propsContainer')).toEqual(['propsContainer', ['objetos', 'decoracao']])
    expect(ordem.filter(([, camadas]) => camadas.includes('livre_1fbcd429') || camadas.includes('livre_1cbccf70'))).toEqual([])
  })

  it('DESEMPATE ESTÁVEL: pino em Objetos e parede em Decoração (lista padrão) ancoram na mesma faixa dos móveis; o de Objetos fica embaixo', () => {
    const extras: ParDeFaixa[] = [
      { faixa: 'wallsGraphics', camada: 'decoracao' },
      { faixa: 'pinsContainer', camada: 'objetos' },
    ]
    const ordem = pares(ordemDeRender(MODELO_PADRAO, FAIXAS_EDITOR, extras))
    const i = ordem.findIndex(([id]) => id === 'propsContainer')
    expect(ordem.slice(i, i + 4)).toEqual([
      ['propsContainer', ['objetos', 'decoracao']],
      ['pinsContainer', ['objetos']],
      ['wallsGraphics', ['decoracao']],
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

/** Os ids da pilha, de baixo para cima. */
function ids(ordem: readonly EntradaDaOrdem[]): string[] {
  return ordem.map((e) => e.faixa)
}

/** Posição da entrada `faixa` que tem a camada (a faixa pode aparecer duas vezes, dividida). */
function onde(ordem: readonly EntradaDaOrdem[], faixa: string, camada: CamadaId): number {
  return ordem.findIndex((e) => e.faixa === faixa && e.camadas.includes(camada))
}

describe('ordemDeRender: a lista manda, mesmo com Salas dona de faixas lá no alto', () => {
  it('Chão logo acima de Salas fica ABAIXO de paredes, portas, móveis, luzes e fichas (editor e jogador)', () => {
    const m = modelo(moverPara('chao', 'salas'))
    const editor = ordemDeRender(m, FAIXAS_EDITOR)
    const chao = onde(editor, 'floorGraphics', 'chao')
    expect(chao).toBeGreaterThan(onde(editor, 'regionsContainer', 'salas'))
    for (const faixa of ['wallsGraphics', 'doorsGraphics', 'propsContainer', 'lightsContainer', 'tokensContainer']) {
      expect(chao, faixa).toBeLessThan(ids(editor).indexOf(faixa))
    }
    // O bloco do Chão cai entre a última faixa de Salas antes de Desenhos e a primeira de Desenhos.
    expect(ids(editor).slice(chao - 2, chao + 2)).toEqual(['conveyorsGraphics', 'mapRasterSprite', 'floorGraphics', 'drawingsGraphics'])

    const jogador = ordemDeRender(m, FAIXAS_JOGADOR)
    const chaoJ = onde(jogador, 'floor', 'chao')
    expect(chaoJ).toBeGreaterThan(onde(jogador, 'regions', 'salas'))
    for (const faixa of ['walls', 'doors', 'props', 'lights', 'tokens']) expect(chaoJ, faixa).toBeLessThan(ids(jogador).indexOf(faixa))
  })

  it('Escadas logo acima de Salas fica abaixo de Objetos (editor e jogador)', () => {
    const m = modelo(moverPara('escadas', 'salas'))
    const editor = ordemDeRender(m, FAIXAS_EDITOR)
    expect(onde(editor, 'secretStairsGraphics', 'escadas')).toBeLessThan(onde(editor, 'propsContainer', 'objetos'))
    expect(onde(editor, 'stairsGraphics', 'escadas')).toBeGreaterThan(onde(editor, 'regionsContainer', 'salas'))
    const jogador = ordemDeRender(m, FAIXAS_JOGADOR)
    expect(onde(jogador, 'stairs', 'escadas')).toBeLessThan(onde(jogador, 'props', 'objetos'))
    expect(onde(jogador, 'stairs', 'escadas')).toBeGreaterThan(onde(jogador, 'regions', 'salas'))
  })

  it('camada livre entre Objetos e Iluminação fica entre as duas (editor e jogador)', () => {
    const m = modelo(moverPara('livre_16bcc5fe', 'decoracao', [...CAMADAS_PADRAO, 'livre_16bcc5fe']))
    const editor = ordemDeRender(m, FAIXAS_EDITOR, [{ faixa: 'floorGraphics', camada: 'livre_16bcc5fe' }, { faixa: 'wallsGraphics', camada: 'livre_16bcc5fe' }])
    const livre = editor.flatMap((e, i) => (e.camadas.includes('livre_16bcc5fe') ? [i] : []))
    expect(livre).toHaveLength(2)
    expect(Math.min(...livre)).toBeGreaterThan(onde(editor, 'propsContainer', 'objetos'))
    expect(Math.max(...livre)).toBeLessThan(onde(editor, 'lightsContainer', 'iluminacao'))

    const jogador = ordemDeRender(m, FAIXAS_JOGADOR, [{ faixa: 'floor', camada: 'livre_16bcc5fe' }, { faixa: 'walls', camada: 'livre_16bcc5fe' }])
    const livreJ = jogador.flatMap((e, i) => (e.camadas.includes('livre_16bcc5fe') ? [i] : []))
    expect(livreJ).toHaveLength(2)
    expect(Math.min(...livreJ)).toBeGreaterThan(onde(jogador, 'propImages', 'objetos'))
    expect(Math.max(...livreJ)).toBeLessThan(onde(jogador, 'lights', 'iluminacao'))
  })

  it('a faixa principal de cada camada no editor segue a lista padrão de baixo para cima', () => {
    const principais = CAMADAS_PADRAO.map((c) => faixaPrincipal(c, FAIXAS_EDITOR))
    expect(principais).toEqual(CAMADAS_PADRAO.map((c) => PRINCIPAL_EDITOR[c]))
    const alturas = principais.map((id) => FAIXAS_EDITOR.findIndex((f) => f.id === id))
    expect(alturas).toEqual([...alturas].sort((a, b) => a - b))
  })
})

/**
 * Onde o grosso dos itens de cada camada desenha no editor, ESCRITO À MÃO (a
 * propriedade abaixo não confia em `faixaPrincipal`). Objetos e Decoração
 * dividem a faixa dos móveis.
 */
const PRINCIPAL_EDITOR: Record<CamadaPadraoId, string> = {
  chao: 'mapRasterSprite',
  salas: 'regionsContainer',
  desenhos: 'drawingsGraphics',
  terreno: 'carimbos',
  paredes: 'wallsGraphics',
  portas: 'doorsGraphics',
  escadas: 'stairsGraphics',
  objetos: 'propsContainer',
  decoracao: 'propsContainer',
  iluminacao: 'lightsContainer',
  tokens: 'tokensContainer',
  anotacoes: 'pinsContainer',
  telhados: 'telhadosContainer',
}

/** Sorteio com semente (mulberry32): a mesma semente dá as mesmas listas a cada rodada. */
function sorteador(semente: number): () => number {
  let estado = semente >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function embaralhar<T>(itens: readonly T[], sorteio: () => number): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1))
    const guardado = copia[i]
    copia[i] = copia[j]
    copia[j] = guardado
  }
  return copia
}

/** Cada par (faixa, camada) e cada faixa fixa, uma linha por par: serve para conferir que nada some nem duplica. */
function inventario(entradas: readonly { faixa: string; camadas: readonly string[] }[]): string[] {
  return entradas.flatMap((e) => (e.camadas.length === 0 ? [`${e.faixa}|`] : e.camadas.map((c) => `${e.faixa}|${c}`))).sort()
}

function inventarioDeHoje(faixas: readonly Faixa[], extras: readonly ParDeFaixa[]): string[] {
  return inventario([...faixas.map((f) => ({ faixa: f.id, camadas: f.camadas })), ...extras.map((p) => ({ faixa: p.faixa, camadas: [p.camada] }))])
}

describe('ordemDeRender: propriedade, para qualquer permutação da lista', () => {
  const LIVRES: CamadaId[] = ['livre_1fbcd429', 'livre_1cbccf70']
  const EXTRAS_EDITOR: ParDeFaixa[] = [
    { faixa: 'wallsGraphics', camada: 'livre_1fbcd429' },
    { faixa: 'floorGraphics', camada: 'livre_1fbcd429' },
    { faixa: 'propsContainer', camada: 'livre_1cbccf70' },
    { faixa: 'pinsContainer', camada: 'livre_1cbccf70' },
  ]
  const EXTRAS_JOGADOR: ParDeFaixa[] = [
    { faixa: 'walls', camada: 'livre_1fbcd429' },
    { faixa: 'tokens', camada: 'livre_1cbccf70' },
  ]
  const RODADAS = 400
  const sorteio = sorteador(20261022)
  const listas = Array.from({ length: RODADAS }, () => embaralhar([...CAMADAS_PADRAO, ...LIVRES], sorteio))

  /** Onde a camada "está" para a lista: a faixa principal (camada padrão) ou todas as entradas (livre). */
  function posicoes(ordem: readonly EntradaDaOrdem[], camada: CamadaId): number[] {
    if (ehCamadaPadrao(camada)) return [onde(ordem, PRINCIPAL_EDITOR[camada], camada)]
    return ordem.flatMap((e, i) => (e.camadas.includes(camada) ? [i] : []))
  }

  it('no editor, a ordem das faixas principais e dos blocos livres respeita a lista', () => {
    const falhas: string[] = []
    for (const lista of listas) {
      const ordem = ordemDeRender(modelo(lista), FAIXAS_EDITOR, EXTRAS_EDITOR)
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const baixo = posicoes(ordem, lista[i])
          const cima = posicoes(ordem, lista[j])
          if (Math.max(...baixo) < Math.min(...cima)) continue
          // Mesma entrada: Objetos e Decoração no lugar, juntos na faixa dos móveis.
          if (baixo.length === 1 && cima.length === 1 && baixo[0] === cima[0]) continue
          // Quem vem entre duas camadas que dividem a faixa principal não cabe entre elas: fica acima da faixa dividida.
          const dividida = ordem[Math.min(...cima)].camadas.some((c) => c !== lista[j] && lista.indexOf(c) < i)
          if (dividida) continue
          falhas.push(`${lista.join(',')}: ${lista[i]} devia ficar abaixo de ${lista[j]}`)
        }
      }
    }
    expect(falhas.slice(0, 5)).toEqual([])
  })

  it('nada some nem duplica, e no jogador nada atravessa a névoa', () => {
    const zonaDe = new Map(FAIXAS_JOGADOR.map((f) => [f.id, f.zona ?? 'nevoa']))
    const zonasDeHoje = FAIXAS_JOGADOR.map((f) => f.zona ?? 'nevoa').filter((z, i, todas) => i === 0 || todas[i - 1] !== z)
    for (const lista of listas) {
      const editor = ordemDeRender(modelo(lista), FAIXAS_EDITOR, EXTRAS_EDITOR)
      expect(inventario(editor)).toEqual(inventarioDeHoje(FAIXAS_EDITOR, EXTRAS_EDITOR))
      const jogador = ordemDeRender(modelo(lista), FAIXAS_JOGADOR, EXTRAS_JOGADOR)
      expect(inventario(jogador)).toEqual(inventarioDeHoje(FAIXAS_JOGADOR, EXTRAS_JOGADOR))
      const zonas = jogador.map((e) => zonaDe.get(e.faixa)).filter((z, i, todas) => i === 0 || todas[i - 1] !== z)
      expect(zonas).toEqual(zonasDeHoje)
    }
  })
})
