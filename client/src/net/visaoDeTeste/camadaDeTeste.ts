import type { MapData } from '../../types/map'
import type { HostScene, HostWorld } from '../hostSession'
import type { DestinoDasMudancas, MapTransform } from '../playerChanges'
import type { FantasmaDeTeste } from './tipos'

/**
 * VISÃO DE JOGADOR — a CAMADA DE TESTE. O que o jogador de teste muda no Jogar
 * (andar, porta, piso, veículo, cadeado, marca, mochila, nome da ficha) não
 * entra no mapa do mestre: fica numa lista de mudanças, reaplicada sobre o
 * mundo VIVO do editor a cada vez que a ponte de teste o lê. Assim a edição do
 * mestre continua aparecendo na janela de teste, e o que o teste mudou fica
 * por cima dela.
 *
 * Cada mudança é a mesma transformação pura que o jogo de verdade grava
 * (`net/playerChanges.ts`), e devolve o próprio mapa quando a ficha ou a
 * porta já não existe: a mudança sobre algo que o mestre apagou não faz nada.
 *
 * A chave é o `MapData.id` da cena, a mesma da sessão do host: o mestre trocar
 * a cena aberta não perde nem muda de lugar o que o teste fez.
 *
 * Este módulo é puro: não importa store nenhuma, não lê nem grava nada fora
 * dele. Quem o liga à ponte de teste é `escritoresDeTeste.ts`.
 */

/** Uma mudança do teste numa cena. */
interface Entrada {
  transform: MapTransform
  /** Passo da ficha com este id: o próximo passo dela, logo em seguida na mesma cena, toma o lugar deste. */
  passoDe?: string
}

/** O resultado da última aplicação numa cena: vale enquanto a base e a versão da cena forem as mesmas. */
interface Memo {
  base: MapData
  versao: number
  resultado: MapData
}

export interface CamadaDeTeste {
  /**
   * Guarda `transform` na cena `mapId` (`MapData.id`), por cima do que já
   * havia. `passoDe`: é o passo da ficha com esse id, e o passo anterior dela,
   * se foi a última mudança da cena, sai (o passo novo já leva ao ponto final).
   */
  registrar(mapId: string, transform: MapTransform, passoDe?: string): void
  /** O mapa `base` com as mudanças do teste; cena sem mudança devolve o PRÓPRIO `base`. */
  aplicarNoMapa(base: MapData): MapData
  /** O mundo `base` com as mudanças do teste; nada mudando, o PRÓPRIO `base`, e cada cena intocada é a mesma de antes. */
  aplicarNoMundo(base: HostWorld): HostWorld
  /** Quantas mudanças a camada guarda, somando as cenas. */
  tamanho(): number
  /** Esquece tudo o que o teste mudou. */
  limpar(): void
}

export function criarCamadaDeTeste(): CamadaDeTeste {
  const porCena = new Map<string, Entrada[]>()
  /** Versão de cada cena com mudança: muda a cada registro nela, e só nela (as outras cenas guardam o resultado). */
  const versoes = new Map<string, number>()
  const memos = new Map<string, Memo>()
  /** Contador único da vida da camada: versão nunca se repete, nem depois de `limpar`. */
  let contador = 0

  function aplicarNoMapa(base: MapData): MapData {
    const entradas = porCena.get(base.id)
    if (entradas === undefined) return base
    const versao = versoes.get(base.id)
    const memo = memos.get(base.id)
    // A MESMA referência enquanto nada muda: os caches do recorte da névoa são por referência do mapa.
    if (memo !== undefined && memo.base === base && memo.versao === versao) return memo.resultado
    const resultado = entradas.reduce((mapa, entrada) => entrada.transform(mapa), base)
    if (versao !== undefined) memos.set(base.id, { base, versao, resultado })
    return resultado
  }

  const naCena = (cena: HostScene): HostScene => {
    const map = aplicarNoMapa(cena.map)
    return map === cena.map ? cena : { ...cena, map }
  }

  return {
    registrar(mapId, transform, passoDe) {
      const entradas = porCena.get(mapId) ?? []
      const ultima = entradas.at(-1)
      const entrada: Entrada = passoDe === undefined ? { transform } : { transform, passoDe }
      // Passos seguidos da mesma ficha viram um só: andar pelo mapa inteiro não faz a lista crescer.
      if (passoDe !== undefined && ultima !== undefined && ultima.passoDe === passoDe) entradas[entradas.length - 1] = entrada
      else entradas.push(entrada)
      porCena.set(mapId, entradas)
      contador += 1
      versoes.set(mapId, contador)
    },
    aplicarNoMapa,
    aplicarNoMundo(base) {
      if (porCena.size === 0) return base
      const open = naCena(base.open)
      let mudou = open !== base.open
      const background = base.background.map((cena) => {
        const nova = naCena(cena)
        if (nova !== cena) mudou = true
        return nova
      })
      return mudou ? { ...base, open, background } : base
    },
    tamanho: () => [...porCena.values()].reduce((soma, entradas) => soma + entradas.length, 0),
    limpar() {
      porCena.clear()
      versoes.clear()
      memos.clear()
    },
  }
}

/** O `MapData.id` da cena `sceneId` do mundo (ausente = a cena aberta); `null` = cena fora do mundo servido. */
export function mapaDaCena(world: HostWorld, sceneId: string | undefined): string | null {
  if (sceneId === undefined) return world.open.map.id
  const cena = [world.open, ...world.background].find((s) => s.sceneId === sceneId)
  return cena === undefined ? null : cena.map.id
}

const temMarca = (map: MapData, markId: string): boolean => (map.marcas ?? []).some((m) => m.id === markId)

/**
 * As mudanças do jogador de teste vão para a camada, nunca para as stores.
 * `mundoBase` é o mundo vivo do editor, SEM a camada. O "cena aberta" de uma
 * mudança é resolvido para o `MapData.id` na hora do registro: se o mestre
 * trocar de cena depois, a mudança continua na cena onde aconteceu.
 */
export function destinoDaCamada(camada: CamadaDeTeste, mundoBase: () => HostWorld): DestinoDasMudancas {
  return {
    aplicar(sceneId, transform, passoDe) {
      const mapId = mapaDaCena(mundoBase(), sceneId)
      // A cena saiu do mundo entre a validação da sessão e aqui: a mudança não tem onde ficar.
      if (mapId !== null) camada.registrar(mapId, transform, passoDe)
    },
    cenaComMarca(markId) {
      // A marca pode ter sido deixada no próprio teste: procura no mundo como o teste o vê.
      const mundo = camada.aplicarNoMundo(mundoBase())
      if (temMarca(mundo.open.map, markId)) return undefined
      const cena = mundo.background.find((s) => temMarca(s.map, markId))
      return cena === undefined || cena.sceneId === null ? null : cena.sceneId
    },
  }
}

/** Onde a ficha `tokenId` está no mundo: a cena (`MapData.id`) e o ponto; `null` = em cena nenhuma. */
function ondeEsta(world: HostWorld, tokenId: string): FantasmaDeTeste | null {
  for (const cena of [world.open, ...world.background]) {
    const token = cena.map.tokens.find((t) => t.id === tokenId)
    if (token !== undefined) return { tokenId, mapId: cena.map.id, x: token.x, y: token.y }
  }
  return null
}

/** Os dois dizem o mesmo (ausente e `null` são "sem fantasma"). */
export function mesmoFantasma(a: FantasmaDeTeste | null | undefined, b: FantasmaDeTeste | null | undefined): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return (a ?? null) === (b ?? null)
  return a.tokenId === b.tokenId && a.mapId === b.mapId && a.x === b.x && a.y === b.y
}

/**
 * O FANTASMA da ficha de teste no editor: onde ela está no teste (`noTeste`),
 * só quando o teste a tirou do lugar de verdade (`real`). `null` = ela está no
 * mesmo ponto da mesma cena nos dois, ou não está no mundo do teste.
 */
export function fantasmaDaFicha(real: HostWorld, noTeste: HostWorld, tokenId: string): FantasmaDeTeste | null {
  // Camada sem nada nas cenas servidas: o mundo do teste É o de verdade.
  if (real === noTeste) return null
  const noTesteEsta = ondeEsta(noTeste, tokenId)
  if (noTesteEsta === null) return null
  return mesmoFantasma(ondeEsta(real, tokenId), noTesteEsta) ? null : noTesteEsta
}
