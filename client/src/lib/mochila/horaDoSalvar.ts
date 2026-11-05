/**
 * MOCHILA NA FICHA — a HORA DO ÚLTIMO SALVAR de um `map.json`
 * (docs/planos/lobby-jogadores-2026-11-05.md §8.1, fatia A2; decisão 12.2:
 * "a mochila do mapa salvo por último vale").
 *
 * O `mtime` do arquivo diz quando ele foi gravado, não quando o mestre salvou
 * o mapa: renomear e duplicar na tela Carregar Mapa (`renameMap`,
 * `duplicateMap` em `lib/mapFileIO.ts`) regravam o `map.json` sem ninguém ter
 * jogado. Essas duas gravações deixam no arquivo o campo `savedAtMs` com a
 * hora que o mapa já tinha (o campo, se já havia, senão o `mtime` de antes); a
 * migração lê o campo primeiro e o `mtime` só na falta dele.
 *
 * O editor NÃO escreve o campo: `deserializeMap` só traz os campos que
 * conhece, então abrir e salvar no editor larga o campo, e a hora volta a ser
 * o `mtime` — que aí é mesmo a do último salvar.
 *
 * Sem import nenhum de propósito: `lib/mapFileIO.ts` usa este arquivo, e ele
 * não pode puxar nada que volte para lá.
 */

/** O campo no `map.json` (ms desde a época). */
export const CAMPO_DA_HORA_DO_SALVAR = 'savedAtMs'

function horaValida(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : undefined
}

/** A hora gravada num `map.json` já lido; ausente ou torta (texto, zero, negativa) = `undefined`. */
export function horaDoSalvarDoArquivo(mapa: unknown): number | undefined {
  if (typeof mapa !== 'object' || mapa === null || !(CAMPO_DA_HORA_DO_SALVAR in mapa)) return undefined
  return horaValida(mapa[CAMPO_DA_HORA_DO_SALVAR])
}

/** O mesmo, do texto do arquivo; texto torto = `undefined`. */
export function horaDoSalvarDoTexto(texto: string): number | undefined {
  try {
    return horaDoSalvarDoArquivo(JSON.parse(texto))
  } catch {
    return undefined
  }
}

/**
 * O texto do `map.json` (o que `serializeMap` devolve) com a hora do último
 * salvar dentro. Hora inválida (o disco não disse) ou texto que não é um
 * objeto: o texto volta como veio, e a migração fica com o `mtime`.
 */
export function comHoraDoSalvar(textoDoMapa: string, horaMs: number): string {
  const hora = horaValida(horaMs)
  if (hora === undefined) return textoDoMapa
  let mapa: unknown
  try {
    mapa = JSON.parse(textoDoMapa)
  } catch {
    return textoDoMapa
  }
  if (typeof mapa !== 'object' || mapa === null || Array.isArray(mapa)) return textoDoMapa
  return JSON.stringify({ ...mapa, [CAMPO_DA_HORA_DO_SALVAR]: hora }, null, 2)
}
