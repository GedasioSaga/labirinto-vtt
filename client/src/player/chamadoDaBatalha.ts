/**
 * BATALHA (conserto de 18/11/2026, "às vezes não aparece para reagir"): o que chama o jogador de volta ao mapa ao
 * vivo, numa chave que muda quando chega algo novo: o golpe esperando a reação de ficha dele, a vez dele, e no
 * Dragon Ball a pendência que ele responde agora e a declaração da iniciativa. `''` = nada espera por ele.
 * O menu da vez e a caixa REAÇÃO são do mapa ao vivo: a tela (`player/main.tsx`) solta a aba de outro andar
 * quando a chave muda para algo não vazio. Tipos estruturais, só com o que a chave lê.
 */

/** O recorte One Piece (`EstadoParaJogador`), no que a chave lê. */
export interface BatalhaQueChama {
  reacoes?: readonly { golpeId: string; tokenId: string; por?: string }[]
  minhaVez: boolean
  vez: string | null
  rodada: number
}

/** A vista Dragon Ball (`VistaDBT`), no que a chave lê. */
export interface VistaDBTQueChama {
  pendencias: readonly { id: string; combatenteId: string; ativa: boolean }[]
  declaracoes: readonly { combatenteId: string }[]
  minhaVez: boolean
  vez: string | null
  rodada: number
  turno: { n: number }
}

export function chamadoDaBatalha(estado: BatalhaQueChama | undefined, vistaDBT: VistaDBTQueChama | undefined): string {
  if (estado !== undefined) {
    const reacoes = (estado.reacoes ?? []).map((reacao) => `${reacao.golpeId}:${reacao.tokenId}:${reacao.por ?? ''}`).join(',')
    const vez = estado.minhaVez ? `${estado.vez ?? ''}:${estado.rodada}` : ''
    return reacoes === '' && vez === '' ? '' : `${reacoes}|${vez}`
  }
  if (vistaDBT === undefined) return ''
  const pendencias = vistaDBT.pendencias
    .filter((pendencia) => pendencia.ativa)
    .map((pendencia) => `${pendencia.id}:${pendencia.combatenteId}`)
    .join(',')
  const declaracoes = vistaDBT.declaracoes.map((declaracao) => declaracao.combatenteId).join(',')
  const vez = vistaDBT.minhaVez ? `${vistaDBT.vez ?? ''}:${vistaDBT.rodada}:${vistaDBT.turno.n}` : ''
  return pendencias === '' && declaracoes === '' && vez === '' ? '' : `${pendencias}|${declaracoes}|${vez}`
}
