import { useEffect, useMemo } from 'react'
import { ehFichaDoAcervo, fichasDasPecas, precisaMigrar, type LugaresDasFichas } from '../lib/fichasNoAcervo'
import { raizDaCopia } from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import type { Token } from '../types/map'
import { fichasNoAcervoAtivas, personagensAtivos, sistemaAtivo, temRpgNoMapa, useAdventureStore } from '../stores/adventureStore'
import type { TamanhoDaVista } from '../stores/criarToken'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import { abrirFichaDaPeca, apagarCopiasDoAcervo, apagarFichaDoAcervo, criarFichaDaPeca, criarNpcNoAcervo, fazerCopiaDaFicha, garantirMigracao, guardarLugarDaFicha, useAvisoDaMigracaoStore } from '../stores/fichasNoAcervo'
import { ligarFichaAosTokens } from '../stores/ligarFichaNoToken'
import { useMapStore } from '../stores/mapStore'
import { casaSobOPonteiro, porPersonagemNoMapa, tokenSobOPonteiro } from '../stores/porPersonagemNoMapa'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { useToastStore } from '../stores/toastStore'
import { useTokenLibraryStore } from '../stores/tokenLibraryStore'
import type { ContagemNoMapa } from './LinhaDaFichaNoAcervo'
import type { FichasDoAcervo } from './TokenLibraryPanel'

/** O mapa do editor: o elemento do canvas (o mesmo do soltar do acervo) e o tamanho da vista. */
export interface MapaDoEditor {
  host: () => HTMLElement | null
  vista: () => TamanhoDaVista | null
}

const SEM_LUGARES: LugaresDasFichas = {}

/**
 * Quais fichas os tokens do mapa usam, numa chave de texto ("id:2|id:1"). Texto,
 * e não um Map: o seletor da store compara por `Object.is`, e o acervo só
 * re-renderiza quando um token ganha ou perde ficha — não a cada arrasto de token.
 */
function chaveDosLigados(tokens: readonly Pick<Token, 'characterId'>[]): string {
  const conta = new Map<string, number>()
  for (const token of tokens) if (token.characterId !== null) conta.set(token.characterId, (conta.get(token.characterId) ?? 0) + 1)
  return [...conta.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, n]) => `${id}:${n}`)
    .join('|')
}

function contagemDaChave(chave: string, personagens: readonly Personagem[]): ContagemNoMapa {
  const porFicha = new Map<string, number>()
  for (const parte of chave === '' ? [] : chave.split('|')) {
    const corte = parte.lastIndexOf(':')
    porFicha.set(parte.slice(0, corte), Number(parte.slice(corte + 1)))
  }
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const porFamilia = new Map<string, number>()
  for (const personagem of personagens) {
    if (!ehFichaDoAcervo(personagem)) continue
    const raiz = raizDaCopia(personagem, porId) ?? personagem
    porFamilia.set(raiz.id, (porFamilia.get(raiz.id) ?? 0) + (porFicha.get(personagem.id) ?? 0))
  }
  return { porFicha, porFamilia }
}

/**
 * MIGRAÇÃO AO ABRIR (NOTAS §Migração 1): o dono das fichas tem NPC e ainda não
 * tem `fichasNoAcervo`, e o acervo foi lido de verdade → migra uma vez. Sem o
 * acervo lido, não migra (o painel já mostra o aviso de acervo não lido).
 */
export function useMigracaoDasFichasNoAcervo(): void {
  const personagens = useAdventureStore(personagensAtivos)
  const lugares = useAdventureStore(fichasNoAcervoAtivas)
  const lido = useTokenLibraryStore((state) => state.podeOrganizar)
  const precisa = useMemo(() => precisaMigrar(personagens, lugares), [personagens, lugares])
  useEffect(() => {
    if (precisa && lido) void garantirMigracao()
  }, [precisa, lido])
}

/**
 * As fichas de NPC da aventura aberta para o acervo de tokens. `undefined` no
 * mapa sem aventura ou sem sistema (decisão 17): o acervo fica como antes, só
 * com os tokens do app.
 */
export function useFichasDoAcervo(mapa: MapaDoEditor): FichasDoAcervo | undefined {
  const temRpg = useAdventureStore(temRpgNoMapa)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const lugares = useAdventureStore(fichasNoAcervoAtivas) ?? SEM_LUGARES
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const chave = useMapStore((state) => chaveDosLigados(state.map.tokens))
  const avisoDaMigracao = useAvisoDaMigracaoStore((state) => state.aviso)
  const pedidosDeMostrar = useAvisoDaMigracaoStore((state) => state.pedidosDeMostrar)
  const contagem = useMemo(() => contagemDaChave(chave, personagens), [chave, personagens])
  const fichaPorPeca = useMemo(() => fichasDasPecas(personagens, lugares), [personagens, lugares])
  if (!temRpg || sistemaId === undefined) return undefined
  const sistema = sistemaPorId(biblioteca, sistemaId)
  // A barra de vida das cópias no acervo: o mesmo recurso e a mesma conta da barra sob o token.
  const recurso = recursoDeVida(sistema ?? null)
  return {
    personagens,
    lugares,
    contagem,
    vidaDe: (personagem) => (recurso === null ? null : vidaDoPersonagem(personagem, recurso)),
    avisoDaMigracao,
    pedidosDeMostrar,
    sistemaId,
    fichaDaPeca: (pecaId) => fichaPorPeca.get(pecaId) ?? null,
    abrirFichaDaPeca,
    criarFichaDaPeca: sistema === undefined ? undefined : (item) => void criarFichaDaPeca(item, sistema),
    onEntendi: () => useAvisoDaMigracaoStore.getState().entendi(),
    onNovoNpc:
      sistema === undefined
        ? undefined
        : () => {
            if (!criarNpcNoAcervo(sistema)) useToastStore.getState().push('error', 'Não deu para criar o NPC: este mapa ainda não é uma aventura nem está numa pasta com sistema.')
          },
    acoes: {
      abrir: (personagemId) => useRpgStore.getState().abrirFicha(personagemId),
      porNoCentro: (personagem) => void porPersonagemNoMapa(personagem, undefined, mapa.vista()),
      copiar: fazerCopiaDaFicha,
      mover: (personagem, pastaId) => void guardarLugarDaFicha(personagem.id, pastaId),
      apagar: (personagemId) => void apagarFichaDoAcervo(personagemId),
      apagarCopias: (personagemIds) => void apagarCopiasDoAcervo(personagemIds),
    },
    arrasto: {
      casaNaTela: (clientX, clientY) => casaSobOPonteiro(mapa.host(), clientX, clientY)?.tela ?? null,
      tokenNaTela: (clientX, clientY) => {
        const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
        return token === null ? null : { tela: token.tela, nome: token.nome, quantos: token.tokenIds.length }
      },
      onSoltarNoMapa: (personagem, clientX, clientY) => {
        // Em cima de um token, a ficha LIGA a ele (ou à seleção de vários); fora de token, nasce um token novo.
        const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
        if (token !== null) {
          void ligarFichaAosTokens(personagem.id, token.tokenIds)
          return true
        }
        const casa = casaSobOPonteiro(mapa.host(), clientX, clientY)
        if (casa === null) return false
        void porPersonagemNoMapa(personagem, casa.mundo, mapa.vista())
        return true
      },
    },
  }
}
