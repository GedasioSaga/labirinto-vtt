import { defaultMapsDir, listSavedMaps } from '../../lib/mapFileIO'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { LigaCena } from '../../lib/preparo/tipos'
import { selectionOfItem } from '../../lib/selectionModel'
import { useAdventureStore } from '../../stores/adventureStore'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { useMapStore } from '../../stores/mapStore'
import { cenaDoLinkNaAventura } from './catalogo'

/**
 * O LINK DO ROTEIRO ABRE A MESA (plano §2, "Como liga com o Labirinto"): pela
 * chave do mapa, depois a cena (`switchScene`) e o pino (`goToPin`). Fora do
 * editor, o mapa abre primeiro pela porta de sempre (que pergunta antes de
 * trocar um mapa com trabalho não salvo). O que sumiu vira aviso, nunca erro.
 */

/** O que só o App sabe fazer: abrir um arquivo no editor e trocar de tela. */
export interface PonteDaMesa {
  /** O map.json aberto no editor agora (`null` = nenhum). */
  readonly caminhoAberto: () => string | null
  /** Abre o arquivo no editor, com a pasta dele (o mesmo do Carregar mapa). */
  readonly abrirArquivo: (caminho: string) => Promise<void>
  /**
   * Troca para o editor e resolve quando o mapa dele já atende pedido de
   * câmera: o PixiCanvas descarta o pedido que chega antes de montar, e o pino
   * pedido cedo demais virava o enquadramento do mapa inteiro.
   */
  readonly irAoEditor: () => Promise<void>
  /** Com trabalho não salvo em outro mapa, pergunta antes; roda `seguir` se puder. */
  readonly antesDeTrocar: (seguir: () => Promise<void>) => void
  readonly avisar: (texto: string, tipo: 'info' | 'error') => void
}

const ESPERA_DA_CENA_MS = 15_000
/** O mapa que não monta nesse prazo (sem WebGL, por exemplo) não segura o link: a cena e o pino ainda se escolhem. */
const ESPERA_DO_MAPA_MS = 8_000

function esperarOMapa(ponte: PonteDaMesa): Promise<void> {
  return new Promise((pronto) => {
    const relogio = setTimeout(pronto, ESPERA_DO_MAPA_MS)
    const fim = () => {
      clearTimeout(relogio)
      pronto()
    }
    ponte.irAoEditor().then(fim, fim)
  })
}

function normalizado(caminho: string): string {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** A chave (pasta em `<appData>/maps`) de um map.json, ou `null` se ele mora fora dali. */
export function chaveDoCaminho(caminho: string, pastaDosMapas: string): string | null {
  const raiz = `${normalizado(pastaDosMapas)}/`
  const arquivo = normalizado(caminho)
  if (!arquivo.startsWith(raiz)) return null
  // A chave volta com a caixa original: a parte depois da raiz, até a primeira barra.
  const resto = caminho.replace(/\\/g, '/').slice(raiz.length)
  const chave = resto.split('/')[0]
  return chave === undefined || chave === '' ? null : chave
}

/** A chave do mapa aberto no editor (pela pasta, senão pelo caminho). */
export async function chaveDoMapaAberto(caminhoAberto: string | null): Promise<string | null> {
  const daPasta = useAdventureStore.getState().pasta?.chave
  if (daPasta !== undefined) return daPasta
  return caminhoAberto === null ? null : chaveDoCaminho(caminhoAberto, await defaultMapsDir())
}

/** Espera a cena chegar do disco (as de fundo carregam depois da primeira). `false` = não abriu. */
function esperarCena(sceneId: string): Promise<boolean> {
  const pronta = (): boolean | null => {
    const { activeSceneId, cache } = useAdventureStore.getState()
    if (activeSceneId === sceneId) return true
    const slot = cache[sceneId]
    if (slot === undefined || slot.status === 'carregando') return null
    return slot.status === 'ok'
  }
  const agora = pronta()
  if (agora !== null) return Promise.resolve(agora)
  return new Promise((resolver) => {
    const relogio = setTimeout(() => {
      parar()
      resolver(false)
    }, ESPERA_DA_CENA_MS)
    const parar = useAdventureStore.subscribe(() => {
      const depois = pronta()
      if (depois === null) return
      clearTimeout(relogio)
      parar()
      resolver(depois)
    })
  })
}

/** No mapa já aberto: vai à cena e ao pino. Devolve o aviso do que não deu; `null` = chegou. */
export async function irNaCena(alvo: LigaCena): Promise<string | null> {
  const { adventure } = useAdventureStore.getState()
  let sceneId = alvo.sceneId === '' ? null : alvo.sceneId
  // O link de quando o mapa não tinha cenas: com cenas, vale a que mora no map.json da raiz (ela ganhou um id novo).
  if (alvo.sceneId === '' && adventure !== null) {
    sceneId = cenaDoLinkNaAventura(adventure.scenes, '')
    if (sceneId === null) return 'A cena deste link não existe mais.'
  }
  if (sceneId !== null) {
    if (adventure === null || !adventure.scenes.some((cena) => cena.id === sceneId)) return 'A cena deste link não existe mais.'
    if (!(await esperarCena(sceneId))) return 'A cena deste link não abriu.'
  }
  if (alvo.pinoId !== undefined) return useAdventureStore.getState().goToPin(sceneId, alvo.pinoId) ? null : 'O pino deste link não existe mais.'
  if (sceneId !== null && useAdventureStore.getState().activeSceneId !== sceneId && !useAdventureStore.getState().switchScene(sceneId)) return 'A cena deste link não abriu.'
  return null
}

/** Do Prelúdio (ou do Roteiro, para outro mapa): abre o mapa pela chave e vai à cena e ao pino. */
export function abrirNaMesa(alvo: LigaCena, ponte: PonteDaMesa): void {
  void (async () => {
    try {
      const mapa = (await listSavedMaps()).find((entrada) => entrada.id === alvo.chave)
      if (mapa === undefined) {
        ponte.avisar('O mapa deste link não existe mais.', 'error')
        return
      }
      if (mapa.damaged === true) {
        ponte.avisar('O mapa deste link não abriu: o arquivo dele está danificado.', 'error')
        return
      }
      const mesmo = (await chaveDoMapaAberto(ponte.caminhoAberto())) === alvo.chave
      const seguir = async () => {
        try {
          if (!mesmo) await ponte.abrirArquivo(mapa.path)
          await esperarOMapa(ponte)
          const aviso = await irNaCena(alvo)
          if (aviso !== null) ponte.avisar(aviso, 'error')
        } catch (erro) {
          ponte.avisar(`Não deu para abrir o mapa: ${erro instanceof Error ? erro.message : String(erro)}`, 'error')
        }
      }
      if (mesmo) await seguir()
      else ponte.antesDeTrocar(seguir)
    } catch (erro) {
      ponte.avisar(`Não deu para achar o mapa: ${erro instanceof Error ? erro.message : String(erro)}`, 'error')
    }
  })()
}

/**
 * No editor: a ficha do link. Seleciona o boneco dela na cena aberta e abre a
 * página Ficha do Livro do mestre. Devolve o aviso quando não há boneco aqui.
 */
export function abrirFichaNaCena(alvo: Extract<AlvoNaMesa, { tipo: 'ficha' }>, nome: string): string | null {
  const pasta = useAdventureStore.getState().pasta
  if (pasta !== null && pasta.pastaId !== alvo.pastaId) return `${nome} é de outra pasta: abra um mapa daquela pasta para ver a ficha.`
  const { map } = useMapStore.getState()
  const boneco = map.tokens.find((token) => token.characterId === alvo.personagemId)
  if (boneco === undefined) return `Nenhum boneco de ${nome} nesta cena.`
  // PISOS NA MESMA CENA: a câmera e o piso vão juntos até o boneco (no térreo, o do 1º piso ficaria selecionado e invisível).
  useAdventureStore.getState().goToPointNoPiso(null, { x: boneco.x, y: boneco.y }, boneco.piso ?? 0)
  // Depois do piso: trocar de piso limpa a seleção.
  useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: boneco.id }))
  useLivroDoMestreStore.getState().abrirPagina('ficha')
  return null
}
