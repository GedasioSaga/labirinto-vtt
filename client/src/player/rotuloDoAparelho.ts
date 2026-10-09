/**
 * CONTAS DOS JOGADORES: como o mestre lê este aparelho na lista da conta
 * ("Chrome no Android") — o bastante para saber qual esquecer, nada que
 * identifique a pessoa. Sai do `userAgent`; o mestre limpa e corta de novo
 * (`rotuloDoAparelho`, `lib/contasDosJogadores.ts`), porque veio do jogador.
 */

/** A ordem importa: o Edge e o Opera dizem "Chrome" também, e o Chrome diz "Safari". */
const NAVEGADORES: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

/** O iPad de hoje se diz Macintosh; a tela de toque é o que o separa (`toque`). */
const SISTEMAS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Windows/, 'Windows'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/CrOS/, 'Chromebook'],
  [/Linux/, 'Linux'],
]

function primeiro(lista: readonly (readonly [RegExp, string])[], userAgent: string): string | null {
  for (const [padrao, nome] of lista) if (padrao.test(userAgent)) return nome
  return null
}

export function rotuloDoNavegador(userAgent: string, toque = false): string {
  const navegador = primeiro(NAVEGADORES, userAgent)
  const lido = primeiro(SISTEMAS, userAgent)
  const sistema = lido === 'Mac' && toque ? 'iPad' : lido
  if (navegador !== null && sistema !== null) return `${navegador} no ${sistema}`
  return navegador ?? sistema ?? 'Navegador'
}
