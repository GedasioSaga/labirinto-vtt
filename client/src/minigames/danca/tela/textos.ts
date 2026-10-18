import type { DancaDesfechoMessage, DancaMotivoDoFim, DancaStatus } from '../../../net/protocoloDaDanca'
import type { MotivoDoFim } from '../partida'
import { BPM_DEMO } from '../som'
import type { MinigameDanca, MusicaDaDanca } from '../tipos'

/**
 * TEXTOS DA TELA DA DANÇA: números no jeito brasileiro e as frases do convite,
 * do resultado e dos avisos. Puro: a tela e os testes leem a mesma frase.
 */

export const fmtInt = (v: number): string => Math.round(v).toLocaleString('pt-BR')
export const fmtDec = (v: number, casas = 1): string => v.toFixed(casas).replace('.', ',')
export const fmtPct = (v: number): string => `${fmtDec(v * 100, 1)}%`
/** "+12 ms", "−8 ms", "0 ms" (sinal de menos de verdade). */
export function fmtMs(ms: number): string {
  const r = Math.round(ms)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} ms`
}

export const NOME_DA_DEMO = 'Gingado do Salão Fundo'

export function textoDaMusica(musica: MusicaDaDanca): string {
  if (musica.tipo === 'demo') return `${NOME_DA_DEMO} (faixa demo), ${BPM_DEMO} BPM`
  return `${musica.nome}, ${fmtDec(musica.bpm, 1)} BPM`
}

/** O prêmio como o convite mostra. A pista não aparece antes de ganhar: o texto dela é o próprio segredo. */
export function textoDoPremio(premio: MinigameDanca['premio']): string {
  if (premio.tipo === 'nada') return 'Nenhum'
  if (premio.tipo === 'pista') return 'Uma pista do mestre'
  return premio.texto || (premio.tipo === 'item' ? 'Um item' : 'Um bônus')
}

/** "Bia e Caio", "Bia, Caio e Davi". */
export function listaDeNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function notaSobreColegas(nomes: readonly string[]): string {
  if (nomes.length === 0) return 'Você dança sozinho. O mestre acompanha o placar ao vivo.'
  const quem = listaDeNomes(nomes)
  return `${quem} ${nomes.length === 1 ? 'dança' : 'dançam'} com você, cada um no próprio aparelho. Quem escolhe a mesma dificuldade recebe as mesmas setas.`
}

/** O status de um participante na espera do convite e no fim. */
export function textoDoStatus(status: DancaStatus): string {
  switch (status) {
    case 'convidado':
      return 'escolhendo'
    case 'pronto':
      return 'pronto'
    case 'dancando':
      return 'dançando'
    case 'terminou':
      return 'terminou'
    case 'saiu':
      return 'saiu'
    case 'fora':
      return 'de fora'
  }
}

export const TEXTO_DO_JULGAMENTO = { perfeito: 'Perfeito', bom: 'Bom', ok: 'Ok', errou: 'Errou', segurou: 'Segurou', soltou: 'Soltou' } as const
export type TextoNaPista = keyof typeof TEXTO_DO_JULGAMENTO

/** O aviso que fecha a dança sem resultado. */
export function textoDoEncerramento(motivo: DancaMotivoDoFim): { titulo: string; texto: string } {
  switch (motivo) {
    case 'mestre':
      return { titulo: 'O mestre encerrou a dança', texto: 'Nada foi ganho nem perdido.' }
    case 'fora':
      return { titulo: 'Você ficou de fora desta dança', texto: 'O mestre começou com quem já estava pronto. Fica para a próxima.' }
    case 'saiu':
      return { titulo: 'Você saiu no meio da música', texto: 'A conexão caiu durante a dança, e ela conta como não passou.' }
  }
}

/** Título do resultado: antes do desfecho, só o que é deste aparelho; depois, o do grupo. */
export function tituloDoResultado(motivo: MotivoDoFim, desfecho: Omit<DancaDesfechoMessage, 'type' | 'sessao'> | undefined): string {
  if (desfecho === undefined) return motivo === 'falhou' ? 'A vida acabou no meio da música' : 'Você terminou a música'
  if (desfecho.portaAberta) return 'A porta se abriu'
  if (desfecho.todosPassaram) return 'Desafio vencido'
  if (desfecho.seu.passou) return 'Você passou, o grupo não'
  return 'Não foi desta vez'
}

const FRASE_DO_PREMIO: Record<MinigameDanca['premio']['tipo'], (texto: string) => string> = {
  item: (t) => `${t || 'O item'} foi para a sua mochila.`,
  pista: (t) => `Pista anotada no seu caderno: ${t}`,
  bonus: (t) => `Bônus anotado no seu caderno: ${t}. O mestre aplica no próximo teste.`,
  nada: () => 'Sem prêmio além da passagem.',
}

const FRASE_DA_CONSEQUENCIA: Record<MinigameDanca['consequencia']['tipo'], (texto: string) => string> = {
  teste: (t) => `Anotado no seu caderno: ${t}. O mestre aplica no próximo teste.`,
  barulho: () => 'O barulho chamou atenção. O mestre narra o que vem.',
  espera: () => 'Dá para tentar de novo na próxima rodada.',
  nada: () => 'Nada mais acontece.',
}

/** O que coube a ESTE jogador, e o tom do bloco (bom, ruim). */
export function textoDoDesfecho(desfecho: Omit<DancaDesfechoMessage, 'type' | 'sessao'>): { texto: string; tom: 'bom' | 'ruim' | 'neutro' } {
  const { seu } = desfecho
  if (seu.passou && desfecho.todosPassaram) {
    const premio = seu.premio ?? { tipo: 'nada' as const, texto: '' }
    return { texto: FRASE_DO_PREMIO[premio.tipo](premio.texto), tom: 'bom' }
  }
  if (seu.passou) return { texto: 'Você passou, mas nem todos passaram: o prêmio só sai quando o grupo inteiro passa.', tom: 'neutro' }
  const cons = seu.consequencia ?? { tipo: 'nada' as const, texto: '' }
  return { texto: `${FRASE_DA_CONSEQUENCIA[cons.tipo](cons.texto)} Falhar não tranca a história: dá para tentar de novo quando o mestre chamar.`, tom: 'ruim' }
}
