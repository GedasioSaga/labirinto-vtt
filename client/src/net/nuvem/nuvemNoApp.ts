import { join } from '@tauri-apps/api/path'
import { lerContas } from '../../lib/contasNoDisco'
import { useAdventureStore } from '../../stores/adventureStore'
import { useNuvemStore } from '../../stores/nuvemStore'
import { useToastStore } from '../../stores/toastStore'
import { pastaDaNuvemNoApp, pastaNoDisco, primitivasDoTauri } from './discoDaNuvem'
import { ligarEmissor } from './emissor'
import { lerCampanhas, registrarCampanha, type CampanhaPublicada } from './estadoNoDisco'
import { gravarRpgLeve } from './gravadorLeve'
import { criarLaco, ESPERA_DEPOIS_DA_MUDANCA_MS, type Laco } from './laco'
import { ponteSobre, transporteDoTauri } from './ponte'
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
  desligarEmissor: () => void
}

const ligadas = new Map<string, Ligada>()
let ouvindoAJanela = false

/** De quanto em quanto tempo a lista de contas (quem é membro) é relida. */
const RELER_CONTAS_MS = 60_000
let membros: ReadonlySet<string> = new Set()
let contasLidasEm = 0

async function relerContasSePreciso(): Promise<void> {
  if (Date.now() - contasLidasEm < RELER_CONTAS_MS) return
  contasLidasEm = Date.now()
  const lidas = await lerContas()
  // Só a conta com e-mail entra em `membros` no servidor (§4.3): a sem e-mail edita pela sala como o mestre.
  if (lidas.lido) membros = new Set(lidas.arquivo.contas.filter((conta) => conta.email !== undefined).map((conta) => conta.id))
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
}

function agendar(fazer: () => void, ms: number): () => void {
  const id = setTimeout(fazer, ms)
  return () => clearTimeout(id)
}

function avisar(mensagem: string): void {
  useToastStore.getState().push('error', mensagem)
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
  const ponte = ponteSobre(transporteDoTauri())
  let laco: Laco | null = null
  const aberto = await abrirSincronizador(campanha, {
    ponte,
    pasta,
    app: aplicadorDoApp,
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
      return sincronizador.ciclo()
    },
    {
      janelaVisivel: () => document.visibilityState === 'visible',
      campanhaAberta: () => useAdventureStore.getState().pasta?.pastaId === campanha.pastaId,
    },
    agendar,
    () => Date.now(),
  )
  ligadas.set(campanha.campanhaId, { sincronizador, laco, desligarEmissor: ligarEmissor(campanha.pastaId, sincronizador.destino) })
  ouvirAJanela()
  laco.iniciar()
  return true
}

/** Abre o Lobby de todas as campanhas publicadas. Nunca lança: a falha vira aviso. */
export async function iniciarNuvem(): Promise<void> {
  try {
    const raiz = pastaNoDisco(primitivasDoTauri, await pastaDaNuvemNoApp())
    for (const campanha of await lerCampanhas(raiz)) await ligarCampanha(campanha)
  } catch (erro) {
    const motivo = `O Lobby não ligou: ${erro instanceof Error ? erro.message : String(erro)}`
    useNuvemStore.getState().definirFalhaAoLigar(motivo)
    avisar(motivo)
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
    todas.map(async ([campanhaId, { sincronizador, laco, desligarEmissor }]) => {
      laco.parar()
      desligarEmissor()
      await sincronizador.fechar()
      useNuvemStore.getState().remover(campanhaId)
    }),
  )
}
