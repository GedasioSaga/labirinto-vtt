import { join } from '@tauri-apps/api/path'
import { rotuloDaParte } from '../../lib/ajusteDaFicha'
import { lerContas } from '../../lib/contasNoDisco'
import { subscribeToOpenings, useAdventureStore } from '../../stores/adventureStore'
import { useNuvemStore } from '../../stores/nuvemStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useToastStore } from '../../stores/toastStore'
import { abrirCopiaDaSala, fonteDaSalaSobre, type CopiaDaSalaNoDisco } from './chatSala'
import { pastaDaNuvemNoApp, pastaNoDisco, primitivasDoTauri } from './discoDaNuvem'
import { ligarEmissor } from './emissor'
import { lerCampanhas, registrarCampanha, type CampanhaPublicada } from './estadoNoDisco'
import { gravarRpgLeve } from './gravadorLeve'
import { criarLaco, ESPERA_DEPOIS_DA_MUDANCA_MS, type Laco } from './laco'
import { corpoDosMembros, criarMembrosPendentes, type EnvioDaLista, type MembrosPendentes } from './membrosPendentes'
import { ehFalha, falhaDoStatus, pedirComFalha, ponteSobre, transporteDoTauri, type TransporteDaNuvem } from './ponte'
import { abrirSincronizador, type AplicadorNoApp, type EscolhaDaDecisao, type Sincronizador } from './sincronizador'
import type { ResultadoNaFila } from '../../lib/nuvem/fila'

/**
 * O LOBBY LIGADO AO APP (docs/planos/lobby-jogadores-2026-11-05.md §5.5-5.6,
 * fatia A5): um sincronizador e um laço por campanha publicada
 * (`<appData>/nuvem/campanhas.json`), com o disco do Tauri, a ponte da R1, o
 * editor (`adventureStore`) e o indicador (`nuvemStore`). Quem chama:
 * `iniciarNuvem()` uma vez quando o app abre; a A6 chama `ligarCampanha`
 * depois de publicar e `decidirNoLobby` na lista "Mudanças para decidir".
 */

interface Ligada {
  sincronizador: Sincronizador
  laco: Laco
}

const ligadas = new Map<string, Ligada>()
let ouvindoAJanela = false

/** De quanto em quanto tempo a lista de contas (quem é membro) é relida. */
const RELER_CONTAS_MS = 60_000
let membros: ReadonlySet<string> = new Set()
let contasLidasEm = 0
/** A leitura em curso: as campanhas que ligam juntas esperam a mesma, em vez de seguir com `membros` vazio. */
let leituraDasContas: Promise<void> | null = null

function relerContasSePreciso(): Promise<void> {
  if (leituraDasContas !== null) return leituraDasContas
  if (Date.now() - contasLidasEm < RELER_CONTAS_MS) return Promise.resolve()
  contasLidasEm = Date.now()
  leituraDasContas = (async () => {
    const lidas = await lerContas()
    // Só a conta com e-mail entra em `membros` no servidor (§4.3): a sem e-mail edita pela sala como o mestre.
    if (lidas.lido) membros = new Set(lidas.arquivo.contas.filter((conta) => conta.email !== undefined).map((conta) => conta.id))
  })().finally(() => {
    leituraDasContas = null
  })
  return leituraDasContas
}

const aplicadorDoApp: AplicadorNoApp = {
  ajustarPastaAberta(pastaId, ajustar) {
    const { pasta, mudarRpgDaPasta } = useAdventureStore.getState()
    if (pasta === null || pasta.pastaId !== pastaId) return
    const personagens = ajustar(pasta.personagens)
    // `mudarRpgDaPasta` não emite (a mudança veio da nuvem), não marca a pasta como suja e não entra no Ctrl+Z.
    if (personagens !== null) mudarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens }))
  },
  gravarRpg: gravarRpgLeve,
  aoAbrirAPasta(pastaId, aoAbrir) {
    return subscribeToOpenings(() => {
      // O aviso sai antes de o mapa novo entrar; o `open` grava a pasta no mesmo passo, sem `await`, então o acerto vem logo depois dele.
      queueMicrotask(() => {
        if (useAdventureStore.getState().pasta?.pastaId === pastaId) aoAbrir()
      })
    })
  },
  rotuloNoHistorico(pastaId, ficha, parte, chave) {
    const { pasta } = useAdventureStore.getState()
    // O sistema da pasta só se sabe com ela aberta; fechada (ou sistema que não está neste computador), a linha leva a chave.
    const sistema = pasta === null || pasta.pastaId !== pastaId ? undefined : sistemaPorId(useRpgStore.getState().biblioteca, pasta.sistemaDeRpg)
    return sistema === undefined ? chave : rotuloDaParte(sistema, ficha, parte, chave)
  },
}

function agendar(fazer: () => void, ms: number): () => void {
  const id = setTimeout(fazer, ms)
  return () => clearTimeout(id)
}

function avisar(mensagem: string): void {
  useToastStore.getState().push('error', mensagem)
}

// ── C3: a cópia da sala do chat e a lista de jogadores que não chegou ──────

/** A cópia da sala não precisa do ritmo de 5 s das fichas: cada pedido acorda o DO, o recurso mais apertado (§7). */
const COPIA_DA_SALA_A_CADA_MS = 60_000

let membrosPendentes: Promise<MembrosPendentes> | null = null

/** Um só no app: a tela (`reenviarMembros`) e os laços mandam a lista pela mesma vez. */
export function membrosPendentesDoApp(): Promise<MembrosPendentes> {
  membrosPendentes ??= pastaDaNuvemNoApp().then((raiz) => criarMembrosPendentes(pastaNoDisco(primitivasDoTauri, raiz)))
  return membrosPendentes
}

/**
 * A lista de jogadores que ficou marcada (a tela não conseguiu mandar, ou o
 * app fechou no meio) vai de novo, relida do disco. Devolve o motivo da recusa
 * do servidor, que repetir não resolve; `null` = nada a dizer.
 */
async function reenviarMembrosPendentes(campanhaId: string, transporte: TransporteDaNuvem): Promise<string | null> {
  const pendentes = await membrosPendentesDoApp()
  if (!(await pendentes.pendentes()).has(campanhaId)) return null
  const recusas: string[] = []
  await pendentes.enviar([campanhaId], async (id): Promise<EnvioDaLista> => {
    const lidas = await lerContas()
    // Sem ler as contas não manda: a lista vazia tiraria todo mundo da campanha.
    if (!lidas.lido) return 'pendente'
    const resposta = await pedirComFalha(transporte, { rota: 'membros', campanhaId: id }, corpoDosMembros(lidas.arquivo.contas))
    if (!ehFalha(resposta) && resposta.status === 200) return 'confirmado'
    const falha = ehFalha(resposta) ? resposta : falhaDoStatus(resposta)
    if (falha.t !== 'erro') return 'pendente'
    recusas.push(falha.detalhe)
    return 'recusado'
  })
  return recusas[0] ?? null
}

interface ExtrasDaCampanha {
  campanhaId: string
  transporte: TransporteDaNuvem
  sala: CopiaDaSalaNoDisco
  /** Quando a cópia da sala foi pedida pela última vez; `null` = ainda não neste app aberto. */
  salaPedidaEm: number | null
  /** Cada aviso uma vez por campanha: o laço roda a cada 5 s. */
  avisados: Set<string>
}

function avisarUmaVez(extras: ExtrasDaCampanha, mensagem: string): void {
  if (extras.avisados.has(mensagem)) return
  extras.avisados.add(mensagem)
  avisar(mensagem)
}

/** Depois de um ciclo bom das fichas (rede e token valendo): a lista de jogadores pendente e a cópia da sala. Nunca lança. */
async function cuidarDosExtras(extras: ExtrasDaCampanha): Promise<void> {
  try {
    const recusa = await reenviarMembrosPendentes(extras.campanhaId, extras.transporte)
    if (recusa !== null) avisarUmaVez(extras, `O Lobby não aceitou a lista de jogadores: ${recusa}`)
  } catch (erro) {
    avisarUmaVez(extras, `A lista de jogadores do Lobby não foi guardada no disco: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
  const agora = Date.now()
  if (extras.salaPedidaEm !== null && agora - extras.salaPedidaEm < COPIA_DA_SALA_A_CADA_MS) return
  extras.salaPedidaEm = agora
  try {
    const copia = await extras.sala.atualizar()
    // Sem rede passa sozinho no próximo; o resto (até a ponte de antes da C3R, que não conhece a rota) aparece uma vez.
    if (copia.t !== 'ok' && copia.t !== 'sem-rede') avisarUmaVez(extras, `A cópia do chat da sala não foi gravada: ${copia.detalhe}`)
  } catch (erro) {
    avisarUmaVez(extras, `A cópia do chat da sala não foi gravada: ${erro instanceof Error ? erro.message : String(erro)}`)
  }
}

function ouvirAJanela(): void {
  if (ouvindoAJanela) return
  ouvindoAJanela = true
  // Ao focar a janela, cada campanha consulta já (§5.5).
  const aoVoltar = (): void => {
    if (document.visibilityState !== 'visible') return
    for (const { laco } of ligadas.values()) laco.cutucar(0)
  }
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('focus', aoVoltar)
}

/** Liga uma campanha publicada (ao abrir o app, ou logo depois de publicar). `false` = não ligou (o motivo vai para a tela). */
export async function ligarCampanha(campanha: CampanhaPublicada): Promise<boolean> {
  if (ligadas.has(campanha.campanhaId)) return true
  await relerContasSePreciso()
  const pasta = pastaNoDisco(primitivasDoTauri, await join(await pastaDaNuvemNoApp(), campanha.campanhaId))
  const transporte = transporteDoTauri()
  const ponte = ponteSobre(transporte)
  const extras: ExtrasDaCampanha = {
    campanhaId: campanha.campanhaId,
    transporte,
    sala: abrirCopiaDaSala(campanha.campanhaId, pasta, fonteDaSalaSobre(transporte)),
    salaPedidaEm: null,
    avisados: new Set(),
  }
  let laco: Laco | null = null
  const aberto = await abrirSincronizador(campanha, {
    ponte,
    pasta,
    app: aplicadorDoApp,
    ligarEmissor: (destino) => ligarEmissor(campanha.pastaId, destino),
    ehMembro: (contaId) => membros.has(contaId),
    agora: () => Date.now(),
    novoId: () => crypto.randomUUID(),
    agendar,
    aoMudar: (situacao) => useNuvemStore.getState().atualizar({ ...situacao, campanhaId: campanha.campanhaId, pastaId: campanha.pastaId, nome: campanha.nome }),
    avisar,
    aoEnfileirar: () => laco?.cutucar(ESPERA_DEPOIS_DA_MUDANCA_MS),
  })
  if (!aberto.ok) {
    useNuvemStore.getState().definirFalhaAoLigar(aberto.motivo)
    avisar(aberto.motivo)
    return false
  }
  const { sincronizador } = aberto
  laco = criarLaco(
    async () => {
      await relerContasSePreciso().catch(() => undefined)
      const resultado = await sincronizador.ciclo()
      if (resultado.t === 'ok') await cuidarDosExtras(extras)
      return resultado
    },
    {
      janelaVisivel: () => document.visibilityState === 'visible',
      campanhaAberta: () => useAdventureStore.getState().pasta?.pastaId === campanha.pastaId,
    },
    agendar,
    () => Date.now(),
  )
  ligadas.set(campanha.campanhaId, { sincronizador, laco })
  ouvirAJanela()
  laco.iniciar()
  return true
}

function falhaAoLigar(erro: unknown): void {
  const motivo = `O Lobby não ligou: ${erro instanceof Error ? erro.message : String(erro)}`
  useNuvemStore.getState().definirFalhaAoLigar(motivo)
  avisar(motivo)
}

/** Abre o Lobby de todas as campanhas publicadas. Nunca lança: a falha vira aviso. */
export async function iniciarNuvem(): Promise<void> {
  try {
    const raiz = pastaNoDisco(primitivasDoTauri, await pastaDaNuvemNoApp())
    // Todas juntas: uma na fila das outras ficaria sem emissor (a mudança do mestre nela sumiria no acerto) até a vez dela.
    const ligacoes = await Promise.allSettled((await lerCampanhas(raiz)).map((campanha) => ligarCampanha(campanha)))
    for (const ligacao of ligacoes) if (ligacao.status === 'rejected') falhaAoLigar(ligacao.reason)
  } catch (erro) {
    falhaAoLigar(erro)
  }
}

/** Acrescenta a campanha recém-publicada à lista do disco e a liga (a A6 chama depois do `publicar`). */
export async function registrarELigar(campanha: CampanhaPublicada): Promise<boolean> {
  const raiz = pastaNoDisco(primitivasDoTauri, await pastaDaNuvemNoApp())
  await registrarCampanha(raiz, campanha)
  return ligarCampanha(campanha)
}

/** "Mudanças para decidir" (A6). */
export async function decidirNoLobby(campanhaId: string, opId: string, escolha: EscolhaDaDecisao): Promise<ResultadoNaFila> {
  const ligada = ligadas.get(campanhaId)
  if (ligada === undefined) return { ok: false, problemas: [{ opId, motivo: 'sem-decisao', detalhe: 'O Lobby desta campanha não está ligado' }] }
  return ligada.sincronizador.decidir(opId, escolha)
}

/** Depois de colar o token ("Conta na nuvem") ou de atualizar o app: os laços parados voltam. */
export function retomarLobby(): void {
  for (const { laco } of ligadas.values()) laco.retomar()
}

/** Desliga tudo, gravando o que esperava (o `rpg.json` da última mudança). */
export async function desligarNuvem(): Promise<void> {
  const todas = [...ligadas.entries()]
  ligadas.clear()
  await Promise.all(
    todas.map(async ([campanhaId, { sincronizador, laco }]) => {
      laco.parar()
      // `fechar` desliga o emissor primeiro.
      await sincronizador.fechar()
      useNuvemStore.getState().remover(campanhaId)
    }),
  )
}
