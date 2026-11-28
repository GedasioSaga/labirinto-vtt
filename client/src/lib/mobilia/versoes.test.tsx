import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Prop } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import { deserializeMap, serializeMap } from '../mapFile'
import { criarMovel, mobiliaParaJogador, propMobiliaFromFile } from '../mobilia'
import { trocarObraNoTeste } from '../estiloDoMapa'
import { useMapStore } from '../../stores/mapStore'
import { chaveDoMovel } from '../../pixi/rasterDosMoveis'
import { pintarMovel, type DesenhoDoMovel } from '../../texturas/meioTermo/moveis'
import { VERSOES_DESENHADAS } from '../../texturas/meioTermo/moveis/versoes'
import { MobiliaControls } from '../../components/MobiliaControls'
import { VERSOES_DO_MOVEL } from './versoes'
import { luzDoObjeto } from '../luzDoFogo'

/**
 * VERSÕES DENTRO DO OBJETO (I0-a de `docs/design/arte-temas/PLANO.md`, 28/11/2026): um campo só,
 * `Prop.mobiliaVersao`, escolhido no painel do objeto ("Versão"), salvo no mapa e igual ao reabrir. O nicho funerário
 * (Fechado | Aberto) e a pirâmide em degraus (Seca | Alagada) já tinham o desenho e ganham o caminho.
 */
const GRADE = 50
const TETO_DE_QUEM_PINTA_MS = 60_000

function mapaCom(props: Prop[]): MapData {
  return { ...createEmptyMap('m-cripta', 'Cripta', 1000, 1000, GRADE), props }
}

function reabrir(map: MapData): Prop {
  const [prop] = deserializeMap(serializeMap(map)).props
  if (prop === undefined) throw new Error('o objeto sumiu do mapa')
  return prop
}

/** Os pixels do desenho a 1 px por px do protótipo: a cena tem funções de pintura, que não se comparam por valor. */
function pintado(desenho: DesenhoDoMovel): Uint8ClampedArray {
  return pintarMovel(desenho, 1).pixels
}

function imagemDe(prop: Prop): Uint8ClampedArray {
  const chave = chaveDoMovel(prop, 1, 1)
  if (chave === null) throw new Error(`${prop.mobilia} perdeu o desenho com textura`)
  return pintado(chave.desenho)
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  trocarObraNoTeste(true)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  trocarObraNoTeste()
})

describe('versões dentro do objeto', () => {
  it('mapa antigo sem o campo abre na 1ª versão; versão desconhecida, a 1ª e a de outro tipo somem', () => {
    const nicho = criarMovel('nichoFunerario', { x: 100, y: 100 }, GRADE, 'nicho-1')
    expect('mobiliaVersao' in nicho).toBe(false)
    // O mapa salvo antes do campo volta do disco igual, e o desenho é o de sempre (o Fechado), sem versão na chave.
    const antigo = reabrir(mapaCom([nicho]))
    expect('mobiliaVersao' in antigo).toBe(false)
    expect(chaveDoMovel(antigo, 1, 1)?.desenho.versao).toBeUndefined()
    expect(imagemDe(antigo)).toEqual(imagemDe(nicho))
    // Versão torta, a 1ª (não se grava) e a da pirâmide somem na leitura; no caixão, a do nicho também.
    for (const torta of ['quebrado', 'fechado', 'alagada', '']) {
      expect('mobiliaVersao' in propMobiliaFromFile({ ...nicho, mobiliaVersao: torta })).toBe(false)
    }
    const caixao = criarMovel('caixao', { x: 100, y: 100 }, GRADE, 'caixao-1')
    expect('mobiliaVersao' in propMobiliaFromFile({ ...caixao, mobiliaVersao: 'aberto' })).toBe(false)
    expect('mobiliaVersao' in mobiliaParaJogador({ ...nicho, mobiliaVersao: 'quebrado' })).toBe(false)
  })

  // Pinta 8 imagens (a pirâmide tem 4 x 4 casas): o teto é de quem pinta, não de quem clica.
  it('escolher a versão no painel desenha a versão, salva e reabre igual; a 1ª volta sem campo', { timeout: TETO_DE_QUEM_PINTA_MS }, () => {
    const nicho = criarMovel('nichoFunerario', { x: 200, y: 200 }, GRADE, 'nicho-1')
    const esticado = { ...nicho, width: nicho.width * 1.5 }
    useMapStore.setState({ map: mapaCom([esticado]), selection: [], past: [], future: [] })
    const doMapa = (): Prop => useMapStore.getState().map.props[0]
    const nada = (): void => {}
    const render = (prop: Prop): void =>
      act(() =>
        root.render(
          <MobiliaControls
            parte="essencial"
            prop={prop}
            onTipoChange={nada}
            onVistaChange={nada}
            onFormaChange={nada}
            onVersaoChange={(id, versao) => useMapStore.getState().trocarVersaoDoMovel(id, versao)}
            onAparenciaChange={nada}
          />,
        ),
      )
    const botao = (nome: string): HTMLButtonElement | undefined =>
      [...container.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="Versão"] [role="radio"]')].find((b) => b.textContent === nome)

    render(doMapa())
    expect(botao('Fechado')?.getAttribute('aria-checked')).toBe('true')
    act(() => botao('Aberto')?.click())
    // Um passo no desfazer, a pegada esticada fica, e o desenho é o Aberto do L05 (o mesmo da `variante` 1).
    expect(useMapStore.getState().past).toHaveLength(1)
    const aberto = doMapa()
    expect(aberto.mobiliaVersao).toBe('aberto')
    expect([aberto.x, aberto.y, aberto.width, aberto.height]).toEqual([esticado.x, esticado.y, esticado.width, esticado.height])
    const chave = chaveDoMovel(aberto, 1, 1)
    expect(chave?.desenho.versao).toBe('aberto')
    expect(chave?.desenho.variante).toBeUndefined()
    if (chave === null) throw new Error('o nicho perdeu o desenho com textura')
    expect(pintado(chave.desenho)).toEqual(pintado({ ...chave.desenho, versao: undefined, variante: 1 }))
    expect(imagemDe(aberto)).not.toEqual(imagemDe(esticado))
    // O mesmo veio: a versão não entra na semente.
    expect(chave.desenho.semente).toBe(chaveDoMovel(esticado, 1, 1)?.desenho.semente)

    // Salvar e reabrir: a mesma versão, o mesmo desenho, e o painel marca o Aberto.
    const reaberto = reabrir(useMapStore.getState().map)
    expect(reaberto.mobiliaVersao).toBe('aberto')
    expect(imagemDe(reaberto)).toEqual(imagemDe(aberto))
    render(reaberto)
    expect(botao('Aberto')?.getAttribute('aria-checked')).toBe('true')
    // O jogador recebe a versão junto do tipo.
    expect(mobiliaParaJogador(reaberto).mobiliaVersao).toBe('aberto')

    // Voltar à 1ª apaga o campo: o mapa salvo fica igual ao de antes da troca.
    act(() => botao('Fechado')?.click())
    expect('mobiliaVersao' in doMapa()).toBe(false)
    expect(serializeMap(useMapStore.getState().map)).toBe(serializeMap(mapaCom([esticado])))

    // A pirâmide pelo mesmo caminho: a Alagada é a `variante` 1 do desenho do L08.
    const piramide = criarMovel('piramideEmDegraus', { x: 300, y: 300 }, GRADE, 'piramide-1')
    useMapStore.setState({ map: mapaCom([piramide]), selection: [], past: [], future: [] })
    useMapStore.getState().trocarVersaoDoMovel('piramide-1', 'alagada')
    const alagada = reabrir(useMapStore.getState().map)
    expect(alagada.mobiliaVersao).toBe('alagada')
    const chaveAlagada = chaveDoMovel(alagada, 1, 1)
    if (chaveAlagada === null) throw new Error('a pirâmide perdeu o desenho com textura')
    expect(pintado(chaveAlagada.desenho)).toEqual(pintado({ ...chaveAlagada.desenho, versao: undefined, variante: 1 }))
  })

  it('toda versão da tabela (menos a 1ª) tem desenho, e todo desenho tem linha na tabela', () => {
    const naTabela = Object.entries(VERSOES_DO_MOVEL).flatMap(([tipo, versoes]) => (versoes?.opcoes.slice(1) ?? []).map((o) => `${tipo}:${o.id}`))
    const desenhadas = Object.entries(VERSOES_DESENHADAS).flatMap(([tipo, versoes]) => Object.keys(versoes ?? {}).map((id) => `${tipo}:${id}`))
    expect(naTabela.length).toBeGreaterThan(0)
    expect(desenhadas.sort()).toEqual(naTabela.sort())
  })

  it('o lustre apagado e o caído (L03) não acendem, o aceso acende como sempre', () => {
    const lustre = criarMovel('lustreDeVelas', { x: 100, y: 100 }, GRADE, 'lustre-1')
    expect(luzDoObjeto(lustre)).not.toBeNull()
    expect(luzDoObjeto({ ...lustre, mobiliaVersao: 'apagado' })).toBeNull()
    expect(luzDoObjeto(reabrir(mapaCom([{ ...lustre, mobiliaVersao: 'caido' }])))).toBeNull()
  })
})
