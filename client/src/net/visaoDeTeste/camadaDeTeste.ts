import { setTokenPosition } from '../../lib/mapFactory'
import type { Personagem } from '../../lib/personagem'
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
 * A ficha que troca de cena no teste vira DUAS mudanças registradas juntas, uma
 * em cada cena (sai da origem, chega no destino, `escritoresDeTeste.ts`), e
 * não uma mudança do mundo inteiro: cada cena continua com o próprio memo, e
 * o mestre editar a origem não refaz o recorte da cena onde a ficha está.
 *
 * A FICHA DE PERSONAGEM que o jogador de teste cria ou edita também fica aqui
 * (`registrarPersonagem`), por id, por cima dos personagens da aventura: a
 * janela vê a ficha como o teste a deixou, e a aventura do mestre nem sabe.
 *
 * O MESTRE MOVER A FICHA ganha do teste (decisão 32, 12/11/2026): cada ficha
 * que o teste tirou do lugar guarda onde ela estava no mundo VIVO quando o
 * teste a moveu (a âncora). Se, numa leitura, o mundo vivo a mostra noutro
 * ponto (arrastar no editor, "Levar para", "Reunir grupo"…), o lugar que o
 * teste deu a ela cede: os passos dela saem, e outra mudança que a tenha
 * levado junto (o salto do veículo, descer dele) passa a deixá-la onde estava.
 * Ela segue o mundo vivo até o jogador de teste a mover de novo. Só a POSIÇÃO
 * daquela ficha cede: porta, mochila, marca e o resto do teste continuam.
 * Fica de fora a ficha que o teste fez trocar de cena (`applyTransfer`): ela
 * sai de uma cena e chega noutra, e não há "lugar de antes" numa cena só.
 *
 * Este módulo é puro: não importa store nenhuma, não lê nem grava nada fora
 * dele. Quem o liga à ponte de teste é `escritoresDeTeste.ts`.
 */

/** Uma mudança do teste numa cena. */
interface Entrada {
  transform: MapTransform
  /** Passo da ficha com este id: o próximo passo dela, logo em seguida na mesma cena, toma o lugar deste. */
  passoDe?: string
  /** As fichas que esta mudança tirou do lugar, medidas na primeira aplicação; ausente = ainda não aplicada. */
  movidas?: ReadonlySet<string>
}

/** Onde uma ficha estava no mundo vivo (px). */
interface Ponto {
  x: number
  y: number
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
  /** O personagem como o teste o deixou: troca o de mesmo id da aventura (ou entra no fim), só no teste. */
  registrarPersonagem(personagem: Personagem): void
  /** O mapa `base` com as mudanças do teste; cena sem mudança devolve o PRÓPRIO `base`. */
  aplicarNoMapa(base: MapData): MapData
  /** O mundo `base` com as mudanças do teste; nada mudando, o PRÓPRIO `base`, e cada cena intocada é a mesma de antes. */
  aplicarNoMundo(base: HostWorld): HostWorld
  /** Quantas mudanças a camada guarda, somando as cenas. */
  tamanho(): number
  /** Esquece tudo o que o teste mudou. */
  limpar(): void
}

/**
 * Os personagens da aventura com os do teste por cima. A MESMA referência de
 * cada personagem que o teste não tocou (a sessão do host compara por
 * referência para não reenviar a ficha), e a do teste enquanto ele não muda.
 */
function personagensComOsDoTeste(base: readonly Personagem[], doTeste: ReadonlyMap<string, Personagem>): Personagem[] {
  const trocados = base.map((personagem) => doTeste.get(personagem.id) ?? personagem)
  const daBase = new Set(base.map((personagem) => personagem.id))
  return [...trocados, ...[...doTeste.values()].filter((personagem) => !daBase.has(personagem.id))]
}

/** As fichas que estavam em `antes` e ficaram noutro ponto em `depois` (a que sumiu ou chegou não conta). */
function fichasTiradasDoLugar(antes: MapData, depois: MapData): ReadonlySet<string> {
  const movidas = new Set<string>()
  if (antes.tokens === depois.tokens) return movidas
  const deAntes = new Map(antes.tokens.map((t) => [t.id, t]))
  for (const token of depois.tokens) {
    const anterior = deAntes.get(token.id)
    if (anterior !== undefined && (anterior.x !== token.x || anterior.y !== token.y)) movidas.add(token.id)
  }
  return movidas
}

/** A mudança `entrada` sem mover as fichas `cedem`: elas ficam onde estavam antes dela (o resto da mudança vale). */
function semMoverAs(entrada: Entrada, cedem: readonly string[]): Entrada {
  const movidas = new Set([...(entrada.movidas ?? [])].filter((id) => !cedem.includes(id)))
  const transform: MapTransform = (antes) => {
    let depois = entrada.transform(antes)
    for (const id of cedem) {
      const ondeEstava = antes.tokens.find((t) => t.id === id)
      // `setTokenPosition` leva junto a tocha e quem ela carrega, como o passo que a tirou do lugar.
      if (ondeEstava !== undefined) depois = setTokenPosition(depois, id, ondeEstava.x, ondeEstava.y)
    }
    return depois
  }
  return entrada.passoDe === undefined ? { transform, movidas } : { transform, passoDe: entrada.passoDe, movidas }
}

export function criarCamadaDeTeste(): CamadaDeTeste {
  const porCena = new Map<string, Entrada[]>()
  const personagens = new Map<string, Personagem>()
  /** Versão de cada cena com mudança: muda a cada registro nela e quando o mestre move uma ficha dela que o teste moveu. */
  const versoes = new Map<string, number>()
  const memos = new Map<string, Memo>()
  /** Por cena: cada ficha que o teste tirou do lugar e onde ela estava no mundo vivo quando ele a moveu. */
  const ancoras = new Map<string, Map<string, Ponto>>()
  /** Contador único da vida da camada: versão nunca se repete, nem depois de `limpar`. */
  let contador = 0

  const novaVersao = (mapId: string) => {
    contador += 1
    versoes.set(mapId, contador)
  }

  const esquecerCena = (mapId: string) => {
    porCena.delete(mapId)
    versoes.delete(mapId)
    memos.delete(mapId)
    ancoras.delete(mapId)
  }

  /**
   * DECISÃO 32: as fichas que o mestre moveu de verdade desde que o teste as
   * moveu (o mundo vivo não está mais na âncora) cedem o lugar do teste. A
   * ficha que sumiu do mundo vivo não conta: a mudança sobre ela já não faz nada.
   */
  function cederAoMestre(base: MapData, entradas: readonly Entrada[]): readonly Entrada[] {
    const daCena = ancoras.get(base.id)
    if (daCena === undefined || daCena.size === 0) return entradas
    const vivas = new Map(base.tokens.map((t) => [t.id, t]))
    const cedem = [...daCena].filter(([id, ancora]) => {
      const viva = vivas.get(id)
      return viva !== undefined && (viva.x !== ancora.x || viva.y !== ancora.y)
    }).map(([id]) => id)
    if (cedem.length === 0) return entradas
    for (const id of cedem) daCena.delete(id)
    novaVersao(base.id)
    return entradas.flatMap((entrada) => {
      const tiradas = cedem.filter((id) => entrada.movidas?.has(id) === true)
      if (tiradas.length === 0) return [entrada]
      // O passo da ficha que o mestre moveu sai inteiro (a tocha e quem ela leva voltam com ela).
      if (entrada.passoDe !== undefined && tiradas.includes(entrada.passoDe)) return []
      return [semMoverAs(entrada, tiradas)]
    })
  }

  /** As mudanças sobre `base`, medindo quem cada mudança nova tirou do lugar (a âncora é o ponto vivo dela agora). */
  function reaplicar(base: MapData, entradas: Entrada[]): MapData {
    let mapa = base
    entradas.forEach((entrada, i) => {
      const depois = entrada.transform(mapa)
      if (entrada.movidas === undefined) {
        const movidas = fichasTiradasDoLugar(mapa, depois)
        entradas[i] = { ...entrada, movidas }
        const daCena = ancoras.get(base.id) ?? new Map<string, Ponto>()
        for (const id of movidas) {
          const viva = base.tokens.find((t) => t.id === id)
          // Só a ficha que existe no mundo vivo tem âncora: a que só existe no teste o mestre não move.
          if (viva !== undefined) daCena.set(id, { x: viva.x, y: viva.y })
        }
        if (daCena.size > 0) ancoras.set(base.id, daCena)
      }
      mapa = depois
    })
    return mapa
  }

  function aplicarNoMapa(base: MapData): MapData {
    const registradas = porCena.get(base.id)
    if (registradas === undefined) return base
    const memo = memos.get(base.id)
    // A MESMA referência enquanto nada muda: os caches do recorte da névoa são por referência do mapa.
    if (memo !== undefined && memo.base === base && memo.versao === versoes.get(base.id)) return memo.resultado
    const entradas = [...cederAoMestre(base, registradas)]
    if (entradas.length === 0) {
      // Só havia o lugar da ficha que o mestre moveu: a cena volta a ser a de verdade.
      esquecerCena(base.id)
      return base
    }
    porCena.set(base.id, entradas)
    const resultado = reaplicar(base, entradas)
    const versao = versoes.get(base.id)
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
      novaVersao(mapId)
    },
    registrarPersonagem(personagem) {
      personagens.set(personagem.id, personagem)
    },
    aplicarNoMapa,
    aplicarNoMundo(base) {
      // Mapa solto (sem `rpg`) não tem ficha de personagem: o que o teste guardou fica sem onde aparecer.
      const comPersonagens = base.rpg === undefined || personagens.size === 0 ? base : { ...base, rpg: { ...base.rpg, personagens: personagensComOsDoTeste(base.rpg.personagens, personagens) } }
      if (porCena.size === 0) return comPersonagens
      const open = naCena(comPersonagens.open)
      let mudou = open !== comPersonagens.open
      const background = comPersonagens.background.map((cena) => {
        const nova = naCena(cena)
        if (nova !== cena) mudou = true
        return nova
      })
      return mudou ? { ...comPersonagens, open, background } : comPersonagens
    },
    tamanho: () => [...porCena.values()].reduce((soma, entradas) => soma + entradas.length, 0) + personagens.size,
    limpar() {
      porCena.clear()
      versoes.clear()
      memos.clear()
      ancoras.clear()
      personagens.clear()
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
    salvarPersonagem: (personagem) => camada.registrarPersonagem(personagem),
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
