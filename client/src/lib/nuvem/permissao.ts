import { quemEscreveAMudanca } from './caminho'
import type { FichaGuardada, Identidade, Membro, MotivoNegado, Mudanca, OpGravada, Papel } from './tipos'

/**
 * PERMISSÃO (docs/planos/lobby-jogadores-2026-11-05.md §6.4), conferida a
 * cada mensagem, não só na entrada: membro removido ou dono trocado passam a
 * ser negados já na mensagem seguinte.
 *
 * - Mestre: tudo.
 * - Jogador: escreve só nas fichas cujo `dono` (lido do doc COMPLETO no
 *   servidor) é a conta dele — uma conta pode ter várias fichas —, nunca em
 *   caminho do mestre, nunca cria nem apaga ficha. Ficha sem dono: só o mestre.
 * - `autorDeclarado` (mesa LAN): só com a identidade do app e com um membro
 *   ativo; a permissão é a do app (o mestre), que já conferiu a edição na sala.
 */

export type Veredito = { ok: true } | { ok: false; motivo: MotivoNegado; detalhe: string }

const PERMITIDO: Veredito = { ok: true }

function negar(detalhe: string): Veredito {
  return { ok: false, motivo: 'sem-permissao', detalhe }
}

export function membroAtivo(membro: Membro | undefined): membro is Membro {
  return membro !== undefined && membro.estado === 'ativo'
}

/** O dono da ficha, do doc completo; `null` = sem dono (só o mestre edita). */
export function donoDaFicha(ficha: FichaGuardada): string | null {
  return ficha.doc.dono ?? null
}

/** O jogador vê só ficha da mesa que não foi apagada; o mestre vê tudo. */
export function podeVer(papel: Papel, ficha: FichaGuardada): boolean {
  return papel === 'mestre' || (ficha.visivel === 'mesa' && !ficha.apagada)
}

/**
 * Escreve na ficha, sem olhar o caminho. A ficha do jogador apagada continua
 * dele aqui: a op dele vira o conflito "o mestre apagou", não uma recusa seca.
 */
export function podeEscreverNaFicha(membro: Membro, ficha: FichaGuardada | undefined): boolean {
  if (membro.papel === 'mestre') return true
  if (ficha === undefined || ficha.visivel !== 'mesa') return false
  return donoDaFicha(ficha) === membro.contaId
}

/** A mudança no caminho, com o valor (cartão novo com imagem é só do mestre, 12.4), nesta ficha. */
export function permissaoDaMudanca(membro: Membro | undefined, ficha: FichaGuardada | undefined, mudanca: Pick<Mudanca, 'caminho' | 'acao' | 'valor'>): Veredito {
  if (!membroAtivo(membro)) return negar('Você não está nesta campanha')
  const quem = quemEscreveAMudanca(mudanca)
  if (quem === null) return { ok: false, motivo: 'fora-do-esquema', detalhe: 'Campo fora da tabela do Lobby' }
  if (membro.papel === 'mestre') return PERMITIDO
  if (quem === 'mestre') return negar('Só o mestre muda este campo')
  if (podeEscreverNaFicha(membro, ficha)) return PERMITIDO
  if (ficha !== undefined && donoDaFicha(ficha) === null) return negar('Ficha sem dono: só o mestre edita')
  return negar('Esta ficha não é sua')
}

/** Quem fez a mudança de fato: quem mandou, ou o jogador da sala que o app declarou. */
export interface AutorEfetivo {
  membro: Membro
  atestadoPeloApp: boolean
}

/** Só a identidade do app (o Service Token, que é o mestre com origem `app`) declara quem mexeu na sala. Do site, nem o mestre. */
export function podeDeclararAutor(quem: Pick<Identidade, 'origem'>, remetente: Membro | undefined): boolean {
  return quem.origem === 'app' && remetente !== undefined && remetente.papel === 'mestre'
}

/**
 * O autor da op. `autorDeclarado` só vale com a identidade do app
 * (`podeDeclararAutor`) e com um membro ativo; fica marcado "atestado pelo
 * app" (§6.4).
 */
export function autorDaOp(
  quem: Pick<Identidade, 'origem'>,
  remetente: Membro,
  declarado: string | undefined,
  membroDeclarado: Membro | undefined,
): { ok: true; autor: AutorEfetivo } | { ok: false; motivo: MotivoNegado; detalhe: string } {
  if (declarado === undefined) return { ok: true, autor: { membro: remetente, atestadoPeloApp: false } }
  if (!podeDeclararAutor(quem, remetente)) return { ok: false, motivo: 'sem-permissao', detalhe: 'Só o app do mestre declara quem mexeu na sala' }
  if (!membroAtivo(membroDeclarado) || membroDeclarado.contaId !== declarado) return { ok: false, motivo: 'sem-permissao', detalhe: 'Quem mexeu na sala não está nesta campanha' }
  return { ok: true, autor: { membro: membroDeclarado, atestadoPeloApp: true } }
}

/**
 * Desfazer (§5.3): o mestre desfaz qualquer op; o jogador, só a que é dele
 * (autor efetivo), numa ficha que ele vê e em que ainda escreve hoje.
 */
export function podeDesfazer(membro: Membro | undefined, ficha: FichaGuardada | undefined, alvo: Pick<OpGravada, 'autorContaId'>): Veredito {
  if (!membroAtivo(membro)) return negar('Você não está nesta campanha')
  if (membro.papel === 'mestre') return PERMITIDO
  if (ficha === undefined || !podeVer(membro.papel, ficha)) return negar('Mudança não encontrada')
  if (alvo.autorContaId !== membro.contaId) return negar('Só o mestre desfaz a mudança de outra pessoa')
  if (!podeEscreverNaFicha(membro, ficha)) return negar('Esta ficha não é mais sua')
  return PERMITIDO
}
