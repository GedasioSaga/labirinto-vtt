// CAMADAS: O ITEM DESENHA NO NÓ DA CAMADA DELE (fase 3, fatias 3b e 4b: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE PROVA, lendo a ordem REAL dos nós do Pixi (`data-ordem-dos-nos`: faixa e camadas de cada nó, de baixo
// para cima), não a lista que o teste mandou:
// (1) EDITOR: ficha, pino e telhado numa livre A no FUNDO da lista e noutra B no TOPO ganham nó próprio; o nó de
//     A fica abaixo do de hoje e o de B acima; trocar A e B na lista troca os nós. Esconder B do mestre tira a
//     ficha de B da tela (a de A fica).
// (2) JOGADOR, pela rota do WebSocket com o recorte REAL do host (`filterMapForPlayer`): ficha, pino, luz (perto e
//     de longe), porta (retângulo, halo, cópia sobre o telhado) e linha do chão de A e de B ganham nó; A abaixo de B
//     dentro da zona, e o pacote seguinte com a lista trocada troca os nós.
// (3) HOST: com B escondida só dos jogadores, nada de B chega (nem item, nem o id): fichas, luzes, pinos, portas,
//     linhas, marcadores, salas, chão, carimbos, telhados e texto. A tela do jogador perde os nós de B.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { buildLightAt, buildRoomFromDraft, buildTextDrawing, buildWallFromDraft } from '../src/lib/drawingFactory'
import { buildFloorPiece } from '../src/lib/floorTool'
import { buildBlocosShape } from '../src/lib/floorBlocks'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { addDrawing, addFloorPiece, addLight, addPin, addRoom, addToken, buildPin, createEmptyMap } from '../src/lib/mapFactory'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import { CAMADAS_PADRAO } from '../src/lib/camadas/padrao'
import type { CamadaId, MapData, ModeloDeCamadas, Region, RegionPoint, Wall } from '../src/types/map'

const GRADE = 64
const COLUNAS = 20
const LINHAS = 12
const FICHA = 'ficha-ana'
const A: CamadaId = 'livre_a1b2c3d4'
const B: CamadaId = 'livre_e5f6a7b8'
const PORTA = { kind: 'normal', open: false, locked: false } as const

test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1280, height: 800 } })

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

const modelo = (ids: readonly CamadaId[]): ModeloDeCamadas => ({ ordem: ids.map((id) => ({ id })) })

/** A sala com teto na camada `camada` (a sala e as paredes ficam nas padrão). */
function salaComTeto(id: string, paredes: [string, string, string, string], de: { x: number; y: number }, ate: { x: number; y: number }, camada: CamadaId): { region: Region; walls: Wall[] } {
  const sala = buildRoomFromDraft(id, paredes, de, ate, undefined, undefined, `Sala ${id}`)
  const room = { ...(sala.region.room ?? { shape: 'rect' as const, name: `Sala ${id}` }), roof: true, camadaDoTelhado: camada }
  return { region: { ...sala.region, room }, walls: sala.walls }
}

/**
 * Duas salas com teto (um em A, outro em B) e, de cada tipo, um item em A e outro em B, FORA das salas: a porta
 * de sala com teto fechado não vai ao jogador (o teto vira contorno liso), então as portas são soltas.
 */
function mapaDasDuas(lista: readonly CamadaId[]): MapData {
  let map = createEmptyMap('camadas-itens', 'Itens no nó', COLUNAS, LINHAS, GRADE)
  const salaA = salaComTeto('ra', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 448, y: 320 }, A)
  const salaB = salaComTeto('rb', ['w5', 'w6', 'w7', 'w8'], { x: 576, y: 64 }, { x: 960, y: 320 }, B)
  map = addRoom(map, salaA.region, salaA.walls)
  map = addRoom(map, salaB.region, salaB.walls)
  map = addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 1088, y: 448, size: 1, image: null })
  map = addToken(map, { id: 't-a', characterId: null, name: 'Bia', x: 160, y: 480, size: 1, image: null, camada: A })
  map = addToken(map, { id: 't-b', characterId: null, name: 'Caio', x: 672, y: 480, size: 1, image: null, camada: B })
  map = addPin(map, { ...buildPin('p-a', { x: 288, y: 480 }, 'exclamacao'), camada: A })
  map = addPin(map, { ...buildPin('p-b', { x: 800, y: 480 }, 'exclamacao'), camada: B })
  map = addLight(map, { ...buildLightAt('l-a', { x: 224, y: 608 }, GRADE), camada: A })
  map = addLight(map, { ...buildLightAt('l-b', { x: 736, y: 608 }, GRADE), camada: B })
  const porta = (id: string, x: number, camada: CamadaId): Wall => ({ ...buildWallFromDraft(id, { x, y: 544 }, { x: x + GRADE, y: 544 }), door: PORTA, camada })
  map = { ...map, walls: [...map.walls, porta('d-a', 1024, A), porta('d-b', 1152, B)] }
  const linha = (id: string, y: number, camada: CamadaId) => ({ id, points: [{ x: 64, y }, { x: 960, y }], closed: false, dotted: false, color: '#ffffff', width: 2, camada })
  return { ...map, lines: [linha('ln-a', 704, A), linha('ln-b', 736, B)], versaoDasCamadas: 2, modeloCamadas: modelo(lista) }
}

async function quadros(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
}

/** Os nós REAIS da pilha (`data-ordem-dos-nos`), de BAIXO para CIMA, como "faixa:camada+camada". */
async function nosDaPilha(page: Page): Promise<string[]> {
  const bruto = (await page.locator('[data-ordem-dos-nos]').first().getAttribute('data-ordem-dos-nos')) ?? ''
  return bruto === '' ? [] : bruto.split(',')
}

/** O índice do nó da faixa que desenha `camada` sozinha (nó criado) ou entre outras (o de hoje); -1 = não há. */
function noDe(nos: readonly string[], faixa: string, camada: CamadaId): number {
  return nos.findIndex((no) => {
    const [deFaixa, camadas] = no.split(':')
    return deFaixa === faixa && camadas.split('+').includes(camada)
  })
}

async function trocarMapa(page: Page, mudar: Partial<MapData>): Promise<void> {
  await page.evaluate(async (campos) => {
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    useMapStore.setState((s) => ({ map: { ...s.map, ...campos } }))
  }, mudar)
  await quadros(page)
}

const FAIXAS_DO_EDITOR = ['tokensContainer', 'pinsContainer', 'telhadosContainer'] as const
const NATIVA_NO_EDITOR: Record<(typeof FAIXAS_DO_EDITOR)[number], CamadaId> = { tokensContainer: 'tokens', pinsContainer: 'anotacoes', telhadosContainer: 'telhados' }

test.describe('editor: o item de camada escolhida desenha no nó da camada', () => {
  test('ficha, pino e telhado: A no fundo da lista abaixo do nó de hoje, B no topo acima; trocar A e B troca os nós', async ({ page }) => {
    await enterEditor(page)
    await page.evaluate(async (mapa) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.getState().loadMap(mapa)
      useMapStore.getState().setActiveTool('select')
    }, mapaDasDuas([...CAMADAS_PADRAO]))
    // O modelo é cópia em memória (a leitura o tira): entra pela store, com os itens já nas livres.
    await trocarMapa(page, { modeloCamadas: modelo([A, ...CAMADAS_PADRAO, B]), versaoDasCamadas: 2 })
    await expect.poll(async () => noDe(await nosDaPilha(page), 'tokensContainer', B), { message: 'o nó da ficha de B não nasceu' }).toBeGreaterThanOrEqual(0)
    let nos = await nosDaPilha(page)
    for (const faixa of FAIXAS_DO_EDITOR) {
      const hoje = noDe(nos, faixa, NATIVA_NO_EDITOR[faixa])
      expect(noDe(nos, faixa, A), `${faixa}: A abaixo do de hoje (${nos.join(' ')})`).toBeLessThan(hoje)
      expect(noDe(nos, faixa, A), `${faixa}: A tem nó`).toBeGreaterThanOrEqual(0)
      expect(noDe(nos, faixa, B), `${faixa}: B acima do de hoje`).toBeGreaterThan(hoje)
    }

    await trocarMapa(page, { modeloCamadas: modelo([B, ...CAMADAS_PADRAO, A]) })
    await expect.poll(async () => {
      const agora = await nosDaPilha(page)
      return noDe(agora, 'tokensContainer', B) < noDe(agora, 'tokensContainer', A)
    }).toBe(true)
    nos = await nosDaPilha(page)
    for (const faixa of FAIXAS_DO_EDITOR) {
      const hoje = noDe(nos, faixa, NATIVA_NO_EDITOR[faixa])
      expect(noDe(nos, faixa, B), `${faixa}: B no fundo agora`).toBeLessThan(hoje)
      expect(noDe(nos, faixa, A), `${faixa}: A no topo agora`).toBeGreaterThan(hoje)
    }
  })

  test('esconder B do mestre tira a ficha de B da tela; a de A fica', async ({ page }) => {
    await enterEditor(page)
    await page.evaluate(async (mapa) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.getState().loadMap(mapa)
      useMapStore.getState().setActiveTool('select')
    }, mapaDasDuas([...CAMADAS_PADRAO]))
    await trocarMapa(page, { modeloCamadas: modelo([...CAMADAS_PADRAO, A, B]), versaoDasCamadas: 2 })
    await page.evaluate(async () => {
      const { useAdventureStore } = await import('/src/stores/adventureStore.ts')
      useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 1 } } })
    })
    await page.mouse.move(1270, 790)
    await quadros(page)
    const caixa = await page.locator('[data-ordem-dos-nos]').first().boundingBox()
    if (caixa === null) throw new Error('o canvas do editor não tem caixa')
    const recorte = (x: number, y: number) => ({ x: caixa.x + x - 40, y: caixa.y + y - 40, width: 80, height: 80 })
    const fichaB = async () => page.screenshot({ clip: recorte(672, 480) })
    const fichaA = async () => page.screenshot({ clip: recorte(160, 480) })
    const comB = await fichaB()
    const comA = await fichaA()
    await trocarMapa(page, { hiddenLayers: [B] })
    await quadros(page)
    expect((await fichaB()).equals(comB), 'a ficha de B continuou na tela com B escondida do mestre').toBe(false)
    expect((await fichaA()).equals(comA), 'a ficha de A mudou sem ninguém mexer em A').toBe(true)
  })
})

/** O recorte REAL do host com a ficha da Ana atribuída, mandado depois do `welcome`. */
function snapshotDoHost(map: MapData, rev: number): string {
  const recorte = filterMapForPlayer(map, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map))
  const visao = [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)]
  return JSON.stringify({ type: 'snapshot', rev, map: recorte.map, vision: visao, explored: encodeExploration(createExploration(map)), ownTokens: [FICHA], concealed: [], sceneName: map.name })
}

const FAIXAS_DO_JOGADOR = ['tokens', 'pins', 'lights', 'farLights', 'doors', 'doorHints', 'portasNoTelhado', 'mapLines'] as const

/** Todo tipo que pode escolher camada, em B: o host não pode deixar passar nenhum com B escondida dos jogadores. */
function mapaComTudoEmB(): MapData {
  let map = mapaDasDuas([...CAMADAS_PADRAO, A, B])
  const sala = buildRoomFromDraft('rs', ['w9', 'w10', 'w11', 'w12'], { x: 1024, y: 64 }, { x: 1216, y: 256 }, undefined, undefined, 'Sala secreta')
  map = addRoom(map, { ...sala.region, camada: B }, sala.walls)
  const forma = buildBlocosShape(GRADE, [{ col: 17, row: 9 }])
  if (forma === null) throw new Error('sem forma de chão')
  map = addFloorPiece(map, { ...buildFloorPiece('chao-b', forma, 'add'), camada: B })
  map = addDrawing(map, { ...buildTextDrawing('texto-b', { x: 1100, y: 600 }, '#ffffff', 20), camada: B })
  return {
    ...map,
    markers: [{ id: 'mk-b', cx: 1100, cy: 700, w: 32, h: 32, rotation: 0, color: '#ffffff', camada: B }],
    carimbos: [{ id: 'ca-b', tipo: 'pedra', x: 1150, y: 650, tamanho: 64, giro: 0, camada: B }],
  }
}

test.describe('jogador: o item de camada escolhida desenha no nó da camada', () => {
  test('ficha, pino, luz, porta e linha de A e de B ganham nó, A abaixo de B; a lista trocada troca os nós; B escondida não chega', async ({ page }) => {
    test.setTimeout(150_000)
    let mapa = mapaDasDuas([...CAMADAS_PADRAO, A, B])
    let socket: WebSocketRoute | null = null
    let rev = 0
    const enviados: string[] = []
    const mandar = () => {
      if (socket === null) throw new Error('o jogador ainda não entrou')
      rev += 1
      const pacote = snapshotDoHost(mapa, rev)
      enviados.push(pacote)
      socket.send(pacote)
    }
    await page.routeWebSocket(
      (url) => url.pathname === '/ws',
      (ws) => {
        ws.onMessage((bruto) => {
          const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
          if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
          socket = ws
          ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
          mandar()
        })
      },
    )
    await page.goto('/player.html')
    await page.getByLabel('Código da sala').fill('CAMADA')
    await page.getByLabel('Seu nome').fill('Ana')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
    // O pacote leva a lista com A e B (as duas têm itens) e os itens com a camada.
    expect(enviados[0]).toContain(A)
    expect(enviados[0]).toContain(B)
    await expect.poll(async () => noDe(await nosDaPilha(page), 'tokens', B), { message: 'o nó da ficha de B não nasceu no jogador' }).toBeGreaterThanOrEqual(0)
    let nos = await nosDaPilha(page)
    for (const faixa of FAIXAS_DO_JOGADOR) {
      expect(noDe(nos, faixa, A), `${faixa}: A tem nó (${nos.join(' ')})`).toBeGreaterThanOrEqual(0)
      expect(noDe(nos, faixa, B), `${faixa}: B acima de A`).toBeGreaterThan(noDe(nos, faixa, A))
    }

    mapa = { ...mapa, modeloCamadas: modelo([...CAMADAS_PADRAO, B, A]) }
    mandar()
    await expect.poll(async () => {
      const agora = await nosDaPilha(page)
      return noDe(agora, 'tokens', A) > noDe(agora, 'tokens', B)
    }).toBe(true)
    nos = await nosDaPilha(page)
    for (const faixa of FAIXAS_DO_JOGADOR) expect(noDe(nos, faixa, A), `${faixa}: A acima de B agora`).toBeGreaterThan(noDe(nos, faixa, B))

    // B escondida SÓ dos jogadores: nada dela no pacote, e os nós dela saem da tela do jogador.
    mapa = { ...mapaComTudoEmB(), ocultasDoJogador: [B] }
    mandar()
    const ultimo = enviados[enviados.length - 1]
    // Nem o id de B (lista, campo `camada`, telhado da sala de B) em lugar nenhum do pacote.
    expect(ultimo).not.toContain(B)
    const recebido = (JSON.parse(ultimo) as { map: MapData }).map // as: o pacote acabou de sair de JSON.stringify de um MapData
    const ids = (lista: readonly { id: string }[] | undefined): string[] => (lista === undefined ? [] : lista.map((item) => item.id))
    const chegaram = [recebido.tokens, recebido.pins, recebido.lights, recebido.lines, recebido.markers, recebido.carimbos, recebido.regions, recebido.floor, recebido.drawings, recebido.walls].flatMap(ids)
    for (const id of ['t-b', 'p-b', 'l-b', 'ln-b', 'mk-b', 'ca-b', 'rs', 'd-b', 'chao-b', 'texto-b']) expect(chegaram, id).not.toContain(id)
    // A continua chegando: o corte é da camada, não do tipo.
    for (const id of ['t-a', 'p-a', 'l-a', 'ln-a', 'd-a']) expect(chegaram, id).toContain(id)
    await expect.poll(async () => (await nosDaPilha(page)).some((no) => no.includes(B)), { message: 'um nó de B ficou na tela do jogador' }).toBe(false)
    nos = await nosDaPilha(page)
    for (const faixa of FAIXAS_DO_JOGADOR) expect(noDe(nos, faixa, A), `${faixa}: A segue com nó`).toBeGreaterThanOrEqual(0)
  })
})
