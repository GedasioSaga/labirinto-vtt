import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

/**
 * ATUALIZAÇÃO PELO GITHUB, PERGUNTANDO ANTES.
 *
 * O app procura em segundo plano ao abrir; achando versão nova, a tela inicial
 * pergunta ("Atualizar agora" / "Depois"). Este arquivo tem duas metades:
 *
 * - a LÓGICA PURA (o que mostrar depois de uma procura, o "Depois" desta
 *   abertura, a porcentagem do download), testada sem Tauri;
 * - a PORTA para o plugin (`portaDoTauri`), a única que fala com o updater,
 *   o process e o Rust. Os testes trocam a porta por uma falsa.
 *
 * A assinatura do pacote é conferida pelo PRÓPRIO plugin com a chave pública
 * de `tauri.conf.json`: download adulterado falha no `downloadAndInstall`.
 */

/** Procura disparada sozinha ao abrir o app, ou pelo botão "Procurar atualizações". */
export type OrigemDaProcura = 'abertura' | 'botao'

export type FaseDaAtualizacao =
  | { tipo: 'parado' }
  | { tipo: 'procurando' }
  | { tipo: 'disponivel'; versao: string; notas: string }
  | { tipo: 'baixando'; versao: string; notas: string; percentual: number | null }
  | { tipo: 'reiniciando'; versao: string }
  | { tipo: 'em-dia'; versaoAtual: string | null }
  | { tipo: 'aviso'; mensagem: string }

export const MENSAGEM_SALA_ABERTA = 'Feche a sala de jogo antes de atualizar: instalar fecha o app.'
export const MENSAGEM_SEM_CONEXAO = 'Não deu para procurar agora. Confira a internet e tente de novo.'
export const MENSAGEM_FALHA_NA_INSTALACAO = 'Não deu para atualizar agora. Tente de novo mais tarde.'

/**
 * O que a abertura do app já fez. Vive pelo processo inteiro (módulo), não pela
 * tela: voltar do editor remonta a tela inicial, e isso não é "abrir o app" —
 * nem procura de novo nem esquece o "Depois". Na próxima abertura o módulo
 * nasce zerado e a pergunta volta.
 */
export interface MemoriaDaAbertura {
  jaProcurou: boolean
  adiada: boolean
}

export function novaMemoriaDaAbertura(): MemoriaDaAbertura {
  return { jaProcurou: false, adiada: false }
}

export const memoriaDaAbertura: MemoriaDaAbertura = novaMemoriaDaAbertura()

export interface ResultadoDaProcura {
  origem: OrigemDaProcura
  salaAberta: boolean
  adiadaNestaAbertura: boolean
  /** `null` = o servidor respondeu e não há versão mais nova. */
  achada: { versao: string; notas: string } | null
  versaoAtual: string | null
  /** A procura falhou (sem internet, release sem `latest.json`, timeout). */
  falhou: boolean
}

/**
 * Decide o que a tela mostra depois de uma procura. Procura automática NUNCA
 * fala de erro nem de "já está em dia": quem não pediu não quer saber. Sala
 * aberta bloqueia sempre, porque instalar fecha o app e derruba os jogadores.
 */
export function decidirDepoisDaProcura(r: ResultadoDaProcura): FaseDaAtualizacao {
  const pediu = r.origem === 'botao'
  if (r.salaAberta) return pediu ? { tipo: 'aviso', mensagem: MENSAGEM_SALA_ABERTA } : { tipo: 'parado' }
  if (r.falhou) return pediu ? { tipo: 'aviso', mensagem: MENSAGEM_SEM_CONEXAO } : { tipo: 'parado' }
  if (r.achada === null) return pediu ? { tipo: 'em-dia', versaoAtual: r.versaoAtual } : { tipo: 'parado' }
  // "Depois" vale para a procura sozinha; o botão é a pessoa pedindo de novo.
  if (!pediu && r.adiadaNestaAbertura) return { tipo: 'parado' }
  return { tipo: 'disponivel', versao: r.achada.versao, notas: r.achada.notas.trim() }
}

/** Porcentagem inteira de 0 a 100; `null` quando o servidor não disse o tamanho. */
export function percentualBaixado(baixado: number, total: number | null): number | null {
  if (total === null || !Number.isFinite(total) || total <= 0) return null
  const bruto = Math.round((baixado / total) * 100)
  return Math.min(100, Math.max(0, bruto))
}

export function textoEmDia(versaoAtual: string | null): string {
  return versaoAtual ? `Você está na versão mais nova (${versaoAtual}).` : 'Você está na versão mais nova.'
}

/** Versão nova achada, pronta para baixar e instalar. */
export interface AtualizacaoAchada {
  versao: string
  notas: string
  /** Baixa, confere a assinatura e instala; no Windows o instalador fecha o app. */
  instalar(aoProgredir: (baixado: number, total: number | null) => void): Promise<void>
}

/** Tudo o que a tela precisa do mundo de fora. */
export interface PortaDoAtualizador {
  /** Há updater aqui? Fora do app (vite no navegador, testes) não há. */
  disponivel(): boolean
  procurar(): Promise<AtualizacaoAchada | null>
  versaoAtual(): Promise<string>
  salaAberta(): Promise<boolean>
  reiniciar(): Promise<void>
}

/** A procura não pode pendurar a tela: rede ruim vira "não deu" em 15 s. */
const TEMPO_MAXIMO_DA_PROCURA_MS = 15_000

/**
 * A porta real. POR QUE `isTauri()` E NÃO A PONTE (`temPonteDoApp`): as
 * jornadas e2e instalam só a ponte `__TAURI_INTERNALS__` para simular o disco
 * (ver `lib/foraDoApp.ts`); lá não há updater, e o botão não deve aparecer.
 * `isTauri()` lê a marca que só o app de verdade põe.
 */
export const portaDoTauri: PortaDoAtualizador = {
  disponivel: () => isTauri(),

  async procurar() {
    const update = await check({ timeout: TEMPO_MAXIMO_DA_PROCURA_MS })
    if (update === null) return null
    return {
      versao: update.version,
      notas: update.body ?? '',
      async instalar(aoProgredir) {
        let baixado = 0
        let total: number | null = null
        await update.downloadAndInstall((evento) => {
          if (evento.event === 'Started') total = evento.data.contentLength ?? null
          if (evento.event === 'Progress') baixado += evento.data.chunkLength
          aoProgredir(baixado, total)
        })
      },
    }
  },

  versaoAtual: () => getVersion(),

  async salaAberta() {
    try {
      return await invoke<boolean>('net_room_open')
    } catch (erro) {
      // Sem resposta do Rust, o seguro é supor sala aberta: oferecer a
      // atualização no escuro poderia derrubar uma mesa em andamento.
      console.warn('atualização: não deu para saber se há sala aberta', erro)
      return true
    }
  },

  reiniciar: () => relaunch(),
}
