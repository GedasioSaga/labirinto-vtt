/**
 * A ORDEM DE DESENHO por camada (`docs/planos/camadas-fase3-2026-10-22.md`,
 * "Ordem e render"). As FAIXAS são a ordem de `world.addChild` de hoje, de
 * baixo para cima, copiada do código; `ordemDeRender` diz em que altura cada
 * par (faixa, camada) entra, a partir da lista de camadas do mestre.
 *
 * Função pura: não sabe de Pixi. Quem monta a pilha (fatias 3 e 4) cria um
 * container por entrada que tiver itens.
 */
import type { CamadaId, CamadaPadraoId, ModeloDeCamadas } from '../../types/map'
import { CAMADAS_PADRAO, ehCamadaPadrao, indicePadrao, type TipoDeObjeto } from './padrao'

/** Só no jogador: o lado da névoa. Reordenar camadas só permuta DENTRO da zona. */
export type ZonaDaNevoa = 'sob-a-nevoa' | 'sobre-a-nevoa'

export interface Faixa {
  /** O nome do container no código (`pixi/PixiCanvas.tsx`, `player/PlayerView.tsx`). */
  readonly id: string
  /** Os tipos de objeto cujo campo `camada` decide onde o item vai. Vazio = faixa derivada (nome de sala, máscara, textura presa em Terreno) ou fixa. */
  readonly tipos: readonly TipoDeObjeto[]
  /**
   * As camadas padrão que moram nesta faixa hoje. Vazia = FIXA (fundo, grade,
   * névoa, zona oculta, ferramentas de edição): fica onde está, fora da lista.
   * Duas camadas na mesma faixa (paredes e portas nas linhas; Objetos e
   * Decoração nos móveis) desenham hoje no MESMO container, na ordem do array:
   * enquanto as duas estão no lugar, continuam juntas, pixel por pixel.
   */
  readonly camadas: readonly CamadaPadraoId[]
  readonly zona?: ZonaDaNevoa
}

/** Um container da pilha: a faixa e as camadas cujos itens vão nele. Lista vazia = faixa fixa. */
export interface EntradaDaOrdem {
  readonly faixa: string
  readonly camadas: readonly CamadaId[]
}

/** Item de um tipo numa camada que não é a nativa da faixa dele (ex.: parede posta em Tokens). */
export interface ParDeFaixa {
  readonly faixa: string
  readonly camada: CamadaId
}

const FIXA: readonly CamadaPadraoId[] = []

function faixa(id: string, tipos: readonly TipoDeObjeto[], camadas: readonly CamadaPadraoId[], zona?: ZonaDaNevoa): Faixa {
  return zona === undefined ? { id, tipos, camadas } : { id, tipos, camadas, zona }
}

/**
 * Editor (`pixi/PixiCanvas.tsx` ~1257-1330). Notas do que o código faz hoje:
 * `mapRasterSprite` é o chão (com linhas e marcadores) em imagem, no modo raster;
 * perigo, zona de perigo, gatilho, esteira e nomes dos lugares somem com Salas
 * (`hiddenLayers.includes('salas')` ou `visibleRegions`), por isso são de Salas;
 * cones de vigia e rotas de patrulha NÃO seguem o olho de Tokens hoje e
 * facções vêm do filtro de território: ficam fixos.
 */
export const FAIXAS_EDITOR: readonly Faixa[] = [
  faixa('backgroundSprite', [], FIXA),
  faixa('mapBoundsGraphics', [], FIXA),
  faixa('mapFrameContainer', [], FIXA),
  faixa('mapRasterSprite', ['peca'], ['chao']),
  faixa('floorGraphics', ['peca'], ['chao']),
  faixa('mapLinesGraphics', ['linha', 'marcador'], ['paredes', 'portas']),
  faixa('regionsContainer', ['regiao'], ['salas']),
  faixa('perigosGraphics', [], ['salas']),
  faixa('gridFloorMask', [], FIXA),
  faixa('gridOutsideMask', [], FIXA),
  faixa('gridOutsideGraphics', [], FIXA),
  faixa('gridGraphics', [], FIXA),
  faixa('gridAlignOverlayGraphics', [], FIXA),
  faixa('hazardsGraphics', [], ['salas']),
  faixa('areaTriggersGraphics', [], ['salas']),
  faixa('faccoesGraphics', [], FIXA),
  faixa('conveyorsGraphics', [], ['salas']),
  faixa('drawingsGraphics', ['desenho'], ['desenhos']),
  faixa('secretDrawingsGraphics', ['desenho'], ['desenhos']),
  faixa('texturas', [], ['terreno']),
  faixa('relevoContainer', [], ['terreno']),
  faixa('regionStrokesContainer', ['regiao'], ['salas']),
  faixa('pathsGraphics', ['desenho'], ['anotacoes']),
  faixa('secretPathsGraphics', ['desenho'], ['anotacoes']),
  faixa('carimbos', ['carimbo'], ['terreno']),
  // `drawWalls` recebe TODAS as paredes visíveis, com porta ou sem: as portas também desenham aqui.
  faixa('wallsGraphics', ['parede'], ['paredes', 'portas']),
  faixa('doorsGraphics', ['parede'], ['portas']),
  faixa('stairsGraphics', ['escada'], ['escadas']),
  faixa('secretStairsGraphics', ['escada'], ['escadas']),
  faixa('nuvensContainer', [], ['terreno']),
  faixa('roomNamesContainer', ['regiao'], ['salas']),
  faixa('textLabelsContainer', ['desenho'], ['anotacoes']),
  faixa('propsContainer', ['objeto'], ['objetos', 'decoracao']),
  faixa('lightsContainer', ['luz'], ['iluminacao']),
  faixa('watchConesGraphics', [], FIXA),
  faixa('patrolRoutesGraphics', [], FIXA),
  // MODO BATALHA (B5): a grade de batalha por cima da planta e abaixo de nomes,
  // fichas e pinos. No editor o telhado já fica acima das fichas, então ela fica abaixo dele.
  faixa('gradeDaBatalha', [], FIXA),
  faixa('nomesDosLugaresContainer', [], ['salas']),
  faixa('tokensContainer', ['ficha'], ['tokens']),
  faixa('concealZonesContainer', [], FIXA),
  faixa('pinsContainer', ['pino'], ['anotacoes']),
  faixa('telhadosContainer', ['telhado'], ['telhados']),
  // Objeto Fogo (27/10/2026): as chamas POR CIMA do telhado (a casa queimando vista de fora), `pixi/fogosDoMapa.ts`.
  faixa('fogosContainer', [], FIXA),
  faixa('fantasmaDeTesteContainer', [], FIXA),
  faixa('straightenGhostGraphics', [], FIXA),
  faixa('floorSelectionGraphics', [], FIXA),
  faixa('handlesGraphics', [], FIXA),
  faixa('hoverGraphics', [], FIXA),
  faixa('areaSelectionOutlineGraphics', [], FIXA),
  faixa('draftGraphics', [], FIXA),
  faixa('anelDoPincelGraphics', [], FIXA),
  faixa('areaMarqueeGraphics', [], FIXA),
  faixa('guidesGraphics', [], FIXA),
  faixa('angleIndicatorContainer', [], FIXA),
  faixa('guideLabelsContainer', [], FIXA),
]

const SOB: ZonaDaNevoa = 'sob-a-nevoa'
const SOBRE: ZonaDaNevoa = 'sobre-a-nevoa'

/**
 * Jogador (`player/PlayerView.tsx` ~3055-3138): a planta sob a névoa, as 5
 * faixas da névoa (fixas, sem zona) e, por cima, luz de longe, telhados,
 * porta no telhado, pílulas, marcas, pinos e fichas. As máscaras andam com o
 * container que recortam. `walls` com paredes e portas por analogia com o
 * editor (não conferido no `drawWalls` do jogador).
 */
export const FAIXAS_JOGADOR: readonly Faixa[] = [
  faixa('mapBackground', [], FIXA, SOB),
  faixa('raster', ['peca'], ['chao'], SOB),
  faixa('floor', ['peca'], ['chao'], SOB),
  faixa('mapLines', ['linha', 'marcador'], ['paredes', 'portas'], SOB),
  faixa('regions', ['regiao'], ['salas'], SOB),
  faixa('perigos', [], ['salas'], SOB),
  faixa('gridMask', [], FIXA, SOB),
  faixa('grid', [], FIXA, SOB),
  faixa('drawings', ['desenho'], ['desenhos'], SOB),
  faixa('texturasMask', [], ['terreno'], SOB),
  faixa('texturasContainer', [], ['terreno'], SOB),
  faixa('relevoMask', [], ['terreno'], SOB),
  faixa('relevoContainer', [], ['terreno'], SOB),
  faixa('regionStrokes', ['regiao'], ['salas'], SOB),
  faixa('paths', ['desenho'], ['anotacoes'], SOB),
  faixa('carimbosMask', [], ['terreno'], SOB),
  faixa('carimbosContainer', ['carimbo'], ['terreno'], SOB),
  faixa('props', ['objeto'], ['objetos', 'decoracao'], SOB),
  faixa('chamasCamada', ['objeto'], ['objetos', 'decoracao'], SOB),
  faixa('propImages', ['objeto'], ['objetos', 'decoracao'], SOB),
  faixa('stairs', ['escada'], ['escadas'], SOB),
  faixa('walls', ['parede'], ['paredes', 'portas'], SOB),
  faixa('doorHints', ['parede'], ['portas'], SOB),
  faixa('doors', ['parede'], ['portas'], SOB),
  faixa('nuvens', [], ['terreno'], SOB),
  faixa('roomNames', ['regiao'], ['salas'], SOB),
  faixa('textLabels', ['desenho'], ['anotacoes'], SOB),
  faixa('propLabels', ['objeto'], ['objetos', 'decoracao'], SOB),
  faixa('lights', ['luz'], ['iluminacao'], SOB),
  faixa('hazardsMask', [], ['salas'], SOB),
  faixa('hazards', [], ['salas'], SOB),
  faixa('triggers', [], ['salas'], SOB),
  faixa('fogUnknown', [], FIXA),
  faixa('knownMask', [], FIXA),
  faixa('fogDim', [], FIXA),
  faixa('visionMask', [], FIXA),
  faixa('concealed', [], FIXA),
  faixa('farLights', ['luz'], ['iluminacao'], SOBRE),
  faixa('roofCut', ['telhado'], ['telhados'], SOBRE),
  faixa('roofs', ['telhado'], ['telhados'], SOBRE),
  faixa('peekedRoofs', ['telhado'], ['telhados'], SOBRE),
  faixa('peekMask', ['telhado'], ['telhados'], SOBRE),
  faixa('portasNoTelhado', ['parede'], ['portas'], SOBRE),
  // As chamas do objeto Fogo, por cima dos telhados: só chega fogo que a visão (ou o telhado à vista) deixou passar (`fogFilter.ts`).
  faixa('fogos', [], FIXA, SOBRE),
  // MODO BATALHA (B5): acima da névoa e dos telhados, abaixo de pílulas, marcas, pinos e fichas.
  faixa('gradeDaBatalha', [], FIXA, SOBRE),
  faixa('nomesDosLugares', [], ['salas'], SOBRE),
  faixa('marks', [], FIXA, SOBRE),
  faixa('pins', ['pino'], ['anotacoes'], SOBRE),
  faixa('lastSeen', ['ficha'], ['tokens'], SOBRE),
  faixa('tokens', ['ficha'], ['tokens'], SOBRE),
]

/**
 * O tipo de objeto que É a camada. A faixa dele dá a altura da camada na
 * pilha (a FAIXA PRINCIPAL); as outras faixas da camada são de hoje e se
 * entrelaçam com as vizinhas (nome de sala logo abaixo das fichas, linha de
 * parede no chão, caminho sob as paredes).
 */
const TIPO_PRINCIPAL: Record<CamadaPadraoId, TipoDeObjeto> = {
  chao: 'peca',
  salas: 'regiao',
  desenhos: 'desenho',
  terreno: 'carimbo',
  paredes: 'parede',
  portas: 'parede',
  escadas: 'escada',
  objetos: 'objeto',
  decoracao: 'objeto',
  iluminacao: 'luz',
  tokens: 'ficha',
  anotacoes: 'pino',
  telhados: 'telhado',
}

/**
 * A faixa principal da camada: a primeira com o tipo dela em que ela mora
 * sozinha; sem nenhuma assim (Paredes divide a faixa das paredes com Portas;
 * Objetos e Decoração dividem a dos móveis), a primeira com o tipo dela.
 * No editor, as principais seguem a lista padrão de baixo para cima.
 * undefined = camada livre, ou a zona do jogador não tem a camada.
 */
export function faixaPrincipal(camada: CamadaId, faixas: readonly Faixa[]): string | undefined {
  if (!ehCamadaPadrao(camada)) return undefined
  const tipo = TIPO_PRINCIPAL[camada]
  const comOTipo = faixas.filter((f) => f.camadas.includes(camada) && f.tipos.includes(tipo))
  const sozinha = comOTipo.find((f) => f.camadas.length === 1)
  if (sozinha !== undefined) return sozinha.id
  return comOTipo.length > 0 ? comOTipo[0].id : undefined
}

/**
 * As camadas padrão que "seguem a ordem padrão": a maior subsequência da lista
 * com índice padrão crescente. Empate de tamanho: fica a que mantém as
 * posições mais baixas da lista — na troca de duas vizinhas, a de CIMA na
 * lista é a que mudou (ela vira bloco acima da outra). Camada padrão que falta
 * no modelo conta como no lugar: mapa com modelo incompleto abre como hoje.
 */
function camadasNoLugar(lista: readonly CamadaId[]): Set<CamadaId> {
  const padrao = lista.filter(ehCamadaPadrao)
  const indices = padrao.map(indicePadrao)
  // maior[i] = tamanho da maior subsequência crescente que COMEÇA em i.
  const maior = indices.map(() => 1)
  for (let i = indices.length - 1; i >= 0; i--) {
    for (let j = i + 1; j < indices.length; j++) {
      if (indices[j] > indices[i]) maior[i] = Math.max(maior[i], maior[j] + 1)
    }
  }
  const noLugar = new Set<CamadaId>()
  let falta = Math.max(0, ...maior)
  let ultimo = -1
  for (let i = 0; i < padrao.length && falta > 0; i++) {
    if (maior[i] === falta && indices[i] > ultimo) {
      noLugar.add(padrao[i])
      ultimo = indices[i]
      falta -= 1
    }
  }
  for (const camada of CAMADAS_PADRAO) if (!lista.includes(camada)) noLugar.add(camada)
  return noLugar
}

/**
 * Faixa dividida (Paredes e Portas nas linhas e nas paredes; Objetos e
 * Decoração nos móveis) com outra camada ENTRE as duas na lista: a de cima
 * deixa de estar no lugar e vira bloco, para a do meio ficar entre elas na
 * tela (a lista manda; lacuna da revisão da fatia 1, decidida na fatia 3).
 * Sem nada entre as duas (ou só camada livre sem itens), continuam juntas no
 * container de hoje.
 */
function separarDivididas(noLugar: Set<CamadaId>, lista: readonly CamadaId[], faixas: readonly Faixa[], livresComItens: ReadonlySet<CamadaId>): void {
  for (const f of faixas) {
    for (let k = 1; k < f.camadas.length; k++) {
      const baixo = f.camadas[k - 1]
      const cima = f.camadas[k]
      if (!noLugar.has(baixo) || !noLugar.has(cima)) continue
      // Camada que falta no modelo conta como no lugar, sem nada entre ela e a vizinha.
      const iBaixo = lista.indexOf(baixo)
      const entre = iBaixo < 0 ? [] : lista.slice(iBaixo + 1, Math.max(iBaixo + 1, lista.indexOf(cima)))
      if (entre.some((c) => ehCamadaPadrao(c) || livresComItens.has(c))) noLugar.delete(cima)
    }
  }
}

interface Posto {
  readonly entrada: EntradaDaOrdem
  /** true = entrou como bloco (camada movida, livre ou item de outro tipo), não é faixa de hoje. */
  readonly bloco: boolean
}

/** Uma zona (ou o editor inteiro): faixas de hoje no lugar e blocos encaixados pela lista. */
function ordenarZona(
  faixas: readonly Faixa[],
  lista: readonly CamadaId[],
  noLugar: ReadonlySet<CamadaId>,
  extras: readonly ParDeFaixa[],
): EntradaDaOrdem[] {
  const posicao = new Map(faixas.map((f, i) => [f.id, i]))
  const postos: Posto[] = []
  for (const f of faixas) {
    const camadas = f.camadas.filter((c) => noLugar.has(c))
    if (f.camadas.length === 0 || camadas.length > 0) postos.push({ entrada: { faixa: f.id, camadas }, bloco: false })
  }

  // Bloco que cai no fundo da lista entra logo acima do fundo fixo (fundo, moldura).
  let cursor = postos.findIndex((p) => p.entrada.camadas.length > 0) - 1
  if (cursor < -1) cursor = postos.length - 1

  const inserir = (entradas: EntradaDaOrdem[]): void => {
    postos.splice(cursor + 1, 0, ...entradas.map((entrada) => ({ entrada, bloco: true })))
    cursor += entradas.length
  }

  // Só as camadas no lugar com faixa principal NESTA zona servem de piso ou de teto.
  const principalDe = new Map<CamadaId, string>()
  for (const camada of lista) {
    const principal = faixaPrincipal(camada, faixas)
    if (principal !== undefined && noLugar.has(camada)) principalDe.set(camada, principal)
  }
  const indiceFixo = (faixaId: string): number => postos.findIndex((p) => !p.bloco && p.entrada.faixa === faixaId)

  /**
   * Âncora de uma camada no lugar: a faixa dela mais alta que ainda fica entre
   * a principal dela e a principal da próxima camada no lugar da lista. Assim
   * o que vem entre as duas na lista fica entre as duas na tela, mesmo quando
   * a de baixo tem faixa lá no alto (Salas: nome do lugar logo abaixo das
   * fichas). Sem piso, sem teto ou com o teto abaixo do piso (no jogador, os
   * móveis de hoje ficam sob as escadas), vale a faixa mais alta dela.
   */
  const ancoraDe = (camada: CamadaId, acima: readonly CamadaId[]): number => {
    const daCamada = postos.flatMap((p, i) => (!p.bloco && p.entrada.camadas.includes(camada) ? [i] : []))
    if (daCamada.length === 0) return -1
    const maisAlta = daCamada[daCamada.length - 1]
    const piso = principalDe.get(camada)
    const proxima = acima.find((c) => principalDe.has(c))
    const teto = proxima === undefined ? undefined : principalDe.get(proxima)
    if (piso === undefined || teto === undefined) return maisAlta
    const iPiso = indiceFixo(piso)
    const iTeto = indiceFixo(teto)
    if (iTeto < iPiso) return maisAlta
    // `<=`: com a principal dividida (Objetos e Decoração nos móveis), a âncora é a própria faixa dividida.
    const noVao = daCamada.filter((i) => i >= iPiso && i <= iTeto)
    return noVao.length > 0 ? noVao[noVao.length - 1] : maisAlta
  }

  lista.forEach((camada, k) => {
    const deOutroTipo = extras
      .filter((par) => par.camada === camada && posicao.has(par.faixa))
      .map((par) => par.faixa)
    if (noLugar.has(camada)) {
      // Blocos já postos logo acima da âncora (de camadas mais baixas na lista) ficam embaixo — empate estável.
      const ancora = ancoraDe(camada, lista.slice(k + 1))
      if (ancora >= 0) {
        cursor = ancora
        while (cursor + 1 < postos.length && postos[cursor + 1].bloco) cursor += 1
      }
      inserir(blocoDe(deOutroTipo, camada, posicao))
    } else {
      const nativas = faixas.filter((f) => f.camadas.some((c) => c === camada)).map((f) => f.id)
      inserir(blocoDe(nativas.concat(deOutroTipo), camada, posicao))
    }
  })
  return postos.map((p) => p.entrada)
}

/** As faixas de um bloco, sem repetir, na ordem de hoje. */
function blocoDe(ids: readonly string[], camada: CamadaId, posicao: ReadonlyMap<string, number>): EntradaDaOrdem[] {
  return [...new Set(ids)]
    .sort((a, b) => (posicao.get(a) ?? 0) - (posicao.get(b) ?? 0))
    .map((faixaId) => ({ faixa: faixaId, camadas: [camada] }))
}

/**
 * A pilha de desenho, de baixo para cima.
 *
 * - Camada padrão que segue a ordem padrão mantém as faixas de hoje.
 * - Camada movida ou livre vira um BLOCO contínuo (as faixas dela na ordem de
 *   hoje) logo acima da ÂNCORA da camada no lugar abaixo dela na lista: a
 *   faixa mais alta dessa camada que ainda fica abaixo da faixa principal da
 *   próxima camada no lugar (ver `ancoraDe`). Assim ela fica entre as duas
 *   vizinhas da lista, como o mestre vê. No fundo da lista, logo acima do
 *   fundo fixo.
 * - `extras`: item de um tipo numa camada que não é a da faixa dele. Numa
 *   camada no lugar, entra logo acima da âncora dela; numa movida ou livre,
 *   dentro do bloco. Par já nativo, de faixa fixa ou de camada que não existe
 *   é ignorado.
 * - Empate (dois blocos logo acima da mesma faixa, como um pino em Objetos e
 *   uma parede em Decoração, que ancoram os dois na faixa dividida dos
 *   móveis): fica embaixo o que veio antes na lista — com a lista padrão, o
 *   da camada de menor índice padrão.
 * - No jogador cada zona da névoa se ordena sozinha: reordenar não atravessa a névoa.
 *
 * Com o modelo padrão (e sem extras) o resultado é idêntico às faixas de hoje.
 */
export function ordemDeRender(modelo: ModeloDeCamadas, faixas: readonly Faixa[], extras: readonly ParDeFaixa[] = []): EntradaDaOrdem[] {
  const lista = [...new Set(modelo.ordem.map((c) => c.id))]
  const noLugar = camadasNoLugar(lista)
  const existe = (camada: CamadaId) => lista.includes(camada) || noLugar.has(camada)
  const faixaPorId = new Map(faixas.map((f) => [f.id, f]))
  const validos = extras.filter((par) => {
    const f = faixaPorId.get(par.faixa)
    return f !== undefined && f.camadas.length > 0 && !f.camadas.some((c) => c === par.camada) && existe(par.camada)
  })
  // Depois de `validos`: separar só tira do lugar camada que está na lista, então `existe` não muda.
  separarDivididas(noLugar, lista, faixas, new Set(validos.map((par) => par.camada)))
  const processadas = lista.concat([...noLugar].filter((c) => !lista.includes(c)))

  const saida: EntradaDaOrdem[] = []
  let inicio = 0
  while (inicio < faixas.length) {
    let fim = inicio
    while (fim + 1 < faixas.length && faixas[fim + 1].zona === faixas[inicio].zona) fim += 1
    const zona = faixas.slice(inicio, fim + 1)
    const ids = new Set(zona.map((f) => f.id))
    saida.push(...ordenarZona(zona, processadas, noLugar, validos.filter((par) => ids.has(par.faixa))))
    inicio = fim + 1
  }
  return saida
}
