import {
  aparelhoDoHash,
  APARELHO_TOKEN_PADRAO,
  chaveDoNome,
  comAparelho,
  comVistoEm,
  contasNaSala,
  gastarComoConferir,
  hashDoAparelho,
  novoIdDeAparelho,
  novoTokenDeAparelho,
  pinConfere,
  pinValido,
  rotuloDoAparelho,
  type ArquivoDeContas,
  type ContaNaSala,
  type ContasNaSala,
} from '../lib/contasDosJogadores'
import type { AccountRefusedReason } from './protocol'

/**
 * CONTAS DOS JOGADORES — a porta da sala: confere nome + PIN e o aparelho
 * lembrado, segura quem tenta adivinhar e dá o segredo do aparelho novo. A
 * ponte (`hostBridge.ts`) chama isto ANTES da sessão: a sessão é síncrona e o
 * PBKDF2 não é, e a sessão só recebe quem já passou (`joinWithAccount`).
 *
 * Os freios, do mais fino ao mais largo:
 *  - por NOME: `FALHAS_ANTES_DO_BLOQUEIO` erros seguidos bloqueiam o nome por
 *    `BLOQUEIO_INICIAL_MS`, e cada erro depois disso dobra o bloqueio até
 *    `BLOQUEIO_MAX_MS`. Vale para nome com ou sem conta: o bloqueio não conta
 *    a ninguém quais nomes existem. Duas conferências do mesmo nome ao mesmo
 *    tempo não acontecem (a segunda espera, recusada como bloqueada);
 *  - por CONEXÃO: uma entrada no ar por conexão, e a conexão recusada cai (a
 *    ponte a derruba, como no código errado) — cada nova tentativa paga um
 *    socket novo, que o Rust limita por IP;
 *  - da SALA: no máximo `PINS_POR_JANELA` conferências de PIN por minuto, de
 *    todo mundo junto — é o teto do custo de CPU do PBKDF2 no computador do
 *    mestre. O aparelho lembrado (um SHA-256) não entra nele.
 * Nome errado e PIN errado dão a MESMA recusa (`invalid`) e o mesmo tempo
 * (`gastarComoConferir`). PIN e segredo nunca vão a log nem a aviso.
 */

export const FALHAS_ANTES_DO_BLOQUEIO = 5
export const BLOQUEIO_INICIAL_MS = 30_000
export const BLOQUEIO_MAX_MS = 15 * 60_000
/** Nome sem erro há um dia esquece os erros de antes. */
const ESQUECER_FALHAS_MS = 24 * 60 * 60_000
/** Acima disso a lista de nomes errados é varrida (só sobram os recentes). */
const NOMES_GUARDADOS_MAX = 500
export const PINS_POR_JANELA = 30
export const JANELA_DOS_PINS_MS = 60_000

export type VeredictoDaConta = { ok: true; conta: ContaNaSala } | { ok: false; motivo: AccountRefusedReason; esperarS?: number }

export interface PortaDasContas {
  /** Espera a primeira leitura do disco: abrir a sala antes dela deixaria o "Só com conta" desligado. */
  prontas(): Promise<void>
  /** O que a sessão lê a cada `join` sem conta. */
  naSala(): ContasNaSala
  entrarComPin(nome: string, pin: string): Promise<VeredictoDaConta>
  entrarComAparelho(token: string): Promise<VeredictoDaConta>
  /** Lembra um aparelho novo da conta e devolve o segredo dele (vai UMA vez ao jogador); `null` = não gravou. */
  lembrarAparelho(contaId: string, rotulo: string): Promise<string | null>
}

export interface DepsDaPorta {
  prontas: () => Promise<void>
  ler: () => ArquivoDeContas
  /** Aplica `mudar` ao arquivo de AGORA e grava; lança se não gravou. */
  alterar: (mudar: (arquivo: ArquivoDeContas) => ArquivoDeContas) => Promise<void>
  now?: () => number
}

interface FalhasDoNome {
  seguidas: number
  bloqueadoAte: number
  ultima: number
}

const segundosAte = (ms: number): number => Math.max(1, Math.ceil(ms / 1000))

const bloqueado = (ms: number): VeredictoDaConta => ({ ok: false, motivo: 'locked', esperarS: segundosAte(ms) })

const INVALIDA: VeredictoDaConta = { ok: false, motivo: 'invalid' }
const APARELHO_ESQUECIDO: VeredictoDaConta = { ok: false, motivo: 'device' }

export function criarPortaDasContas(deps: DepsDaPorta): PortaDasContas {
  const now = deps.now ?? Date.now
  const falhasPorNome = new Map<string, FalhasDoNome>()
  const nomesNoAr = new Set<string>()
  let conferenciasRecentes: number[] = []

  const esquecerFalhasVelhas = (agora: number) => {
    if (falhasPorNome.size <= NOMES_GUARDADOS_MAX) return
    for (const [chave, falhas] of falhasPorNome) if (agora - falhas.ultima > ESQUECER_FALHAS_MS) falhasPorNome.delete(chave)
  }

  const registrarFalha = (chave: string) => {
    const agora = now()
    const antes = falhasPorNome.get(chave)
    const seguidas = antes === undefined || agora - antes.ultima > ESQUECER_FALHAS_MS ? 1 : antes.seguidas + 1
    const excesso = seguidas - FALHAS_ANTES_DO_BLOQUEIO
    const bloqueadoAte = excesso < 0 ? 0 : agora + Math.min(BLOQUEIO_MAX_MS, BLOQUEIO_INICIAL_MS * 2 ** excesso)
    falhasPorNome.set(chave, { seguidas, bloqueadoAte, ultima: agora })
    esquecerFalhasVelhas(agora)
  }

  /** O nome ou a sala estão segurando quem tenta: o veredito sai sem gastar o PBKDF2. */
  const freio = (chave: string): VeredictoDaConta | null => {
    const agora = now()
    const falhas = falhasPorNome.get(chave)
    if (falhas !== undefined && falhas.bloqueadoAte > agora) return bloqueado(falhas.bloqueadoAte - agora)
    if (nomesNoAr.has(chave)) return bloqueado(0)
    conferenciasRecentes = conferenciasRecentes.filter((quando) => agora - quando < JANELA_DOS_PINS_MS)
    const maisVelha = conferenciasRecentes[0]
    if (maisVelha !== undefined && conferenciasRecentes.length >= PINS_POR_JANELA) return bloqueado(maisVelha + JANELA_DOS_PINS_MS - agora)
    conferenciasRecentes.push(agora)
    return null
  }

  const conferirPin = async (chave: string, pin: string): Promise<VeredictoDaConta> => {
    const conta = deps.ler().contas.find((candidata) => chaveDoNome(candidata.nome) === chave)
    if (conta === undefined) {
      // Nome sem conta paga o mesmo PBKDF2: a resposta não chega antes por ele não existir.
      await gastarComoConferir(pin)
      registrarFalha(chave)
      return INVALIDA
    }
    const confere = await pinConfere(pin, conta.pin)
    // A conta pode ter sido apagada (ou o PIN trocado) enquanto conferia: vale a de AGORA.
    const atual = deps.ler().contas.find((candidata) => candidata.id === conta.id)
    if (!confere || atual === undefined || atual.pin !== conta.pin) {
      registrarFalha(chave)
      return INVALIDA
    }
    falhasPorNome.delete(chave)
    return { ok: true, conta: { id: atual.id, nome: atual.nome } }
  }

  return {
    prontas: () => deps.prontas(),

    naSala: () => contasNaSala(deps.ler()),

    entrarComPin: async (nome, pin) => {
      await deps.prontas()
      const chave = chaveDoNome(nome)
      const freado = freio(chave)
      if (freado !== null) return freado
      // O `join` já foi validado (`parseJoin`); conferir de novo custa nada e não depende de quem chama.
      if (chave.length === 0 || !pinValido(pin)) {
        registrarFalha(chave)
        return INVALIDA
      }
      nomesNoAr.add(chave)
      try {
        return await conferirPin(chave, pin)
      } finally {
        nomesNoAr.delete(chave)
      }
    },

    entrarComAparelho: async (token) => {
      await deps.prontas()
      if (!APARELHO_TOKEN_PADRAO.test(token)) return APARELHO_ESQUECIDO
      const achado = aparelhoDoHash(deps.ler(), await hashDoAparelho(token))
      if (achado === null) return APARELHO_ESQUECIDO
      const { conta, aparelho } = achado
      try {
        await deps.alterar((arquivo) => comVistoEm(arquivo, conta.id, aparelho.id, now()))
      } catch {
        // O "visto em" é só para o mestre ler na lista: sem ele, a entrada vale igual.
      }
      return { ok: true, conta: { id: conta.id, nome: conta.nome } }
    },

    lembrarAparelho: async (contaId, rotulo) => {
      const token = novoTokenDeAparelho()
      const agora = now()
      const aparelho = { id: novoIdDeAparelho(), hash: await hashDoAparelho(token), rotulo: rotuloDoAparelho(rotulo), criado: agora, vistoEm: agora }
      try {
        await deps.alterar((arquivo) => comAparelho(arquivo, contaId, aparelho))
      } catch {
        return null
      }
      // Conta apagada no meio: o segredo não abriria nada.
      const gravado = deps.ler().contas.some((conta) => conta.id === contaId && conta.aparelhos.some((atual) => atual.id === aparelho.id))
      return gravado ? token : null
    },
  }
}
