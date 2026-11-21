/**
 * AS CHAVES NOVAS (21/11): ferro, bronze, prata, ouro, pedra e osso, cada uma
 * com uma argola de desenho próprio (os quatro naipes, sol, lua, estrela,
 * águia, serpente, coroa, crânio, folhas, roda). Toda chave é desenhada em pé
 * (a argola em cima, os dentes embaixo, à direita) e deitada a 45 graus, como
 * as duas chaves do v2: a argola no alto à esquerda.
 *
 * O corpo inteiro (argola, colar, haste, dentes) é uma `uniao`: um contorno só
 * em volta de tudo, sem costura entre as partes.
 *
 * Puro: sem React, sem disco.
 */
import type { IdDaChave } from '../tipos'
import { caminhoDaEstrela, caminhoDaRoda, COR_DO_VAO, furoDaForma, METAIS, tom, uniao, type Metal } from './tracos'

/** Os dentes: um degrau, dois degraus, ou dos dois lados da haste (a chave mestra). */
type Dentes = 'simples' | 'degraus' | 'duplo'

const DENTES: Readonly<Record<Dentes, string>> = {
  simples: '<path d="M25 33h6v2.6h-2.4v2.2h2.4v3.6h-6z"/>',
  degraus: '<path d="M25 31.6h4.6v2.8h2v3h-2v3.8H25z"/>',
  duplo: '<path d="M25 33.4h5.4v3h-2.2v1.8h2.2v3.2H25zM23 33.4h-5.4v3h2.2v1.8h-2.2v3.2H23z"/>',
}

interface Desenho {
  metal: Metal
  /** As formas da argola, sem `fill` nem `stroke` (entram na `uniao` do corpo). Centro perto de (24, 10.5). */
  argola: string
  /** O que vai por cima do corpo: os furos e o relevo. */
  detalhe?: string
  dentes: Dentes
  /** A largura da haste (a de pedra é mais grossa). */
  haste?: number
}

function chave({ metal, argola, detalhe = '', dentes, haste = 2.8 }: Desenho): string {
  const x = 24 - haste / 2
  const corpo = `<rect x="${x}" y="15" width="${haste}" height="27" rx="${haste / 2}"/><rect x="20.4" y="18.6" width="7.2" height="2.8" rx="1.2"/>${DENTES[dentes]}${argola}`
  return (
    '<g transform="rotate(-45 24 24)">' +
    uniao(corpo, metal.cor, metal.escuro, 1.3) +
    `<path d="M21.4 20h5.2" stroke="${tom(metal.cor, 0.78)}" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M${(x + 0.75).toFixed(2)} 23.4v13" stroke="${metal.luz}" stroke-width=".9" stroke-linecap="round" opacity=".75"/>` +
    detalhe +
    '</g>'
  )
}

const ESPADA = 'M24 2.2c-4.2 4.2-8.4 6.8-8.4 10.4 0 2.6 2 4.4 4.4 4.4 1.2 0 2.2-.4 3-1.2l-.8 2.6h3.6l-.8-2.6c.8.8 1.8 1.2 3 1.2 2.4 0 4.4-1.8 4.4-4.4 0-3.6-4.2-6.2-8.4-10.4z'
const CORACAO = 'M24 18.6c-5.4-3.8-8.8-6.8-8.8-10.4 0-2.6 2-4.6 4.4-4.6 1.8 0 3.4 1 4.4 2.6 1-1.6 2.6-2.6 4.4-2.6 2.4 0 4.4 2 4.4 4.6 0 3.6-3.4 6.6-8.8 10.4z'
const LOSANGO = 'M24 1.8l7.6 9L24 19.8l-7.6-9z'
const SOL = caminhoDaEstrela(24, 10.5, 12, 8.8, 6.4)
const ESTRELA = caminhoDaEstrela(24, 10.4, 5, 9.4, 4.3)
const COROA = 'M16.4 16.6l-1.6-9.4 4.6 3.4L24 3.4l4.6 7.2 4.6-3.4-1.6 9.4z'

function furo(x: number, y: number, r: number): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${COR_DO_VAO}"/>`
}

/** O miolo do SVG de cada chave nova, no quadro de 48 x 48. */
export const ARTE_DAS_CHAVES: Readonly<Record<IdDaChave, string>> = {
  'chave-espadas': chave({ metal: METAIS.ferro, argola: `<path d="${ESPADA}"/>`, detalhe: furoDaForma(ESPADA, 24, 10.4, 0.4), dentes: 'simples' }),
  'chave-copas': chave({ metal: METAIS.bronze, argola: `<path d="${CORACAO}"/>`, detalhe: furoDaForma(CORACAO, 24, 10.2, 0.42), dentes: 'degraus' }),
  'chave-ouros': chave({ metal: METAIS.ouro, argola: `<path d="${LOSANGO}"/>`, detalhe: furoDaForma(LOSANGO, 24, 10.8, 0.42), dentes: 'simples' }),
  'chave-paus': chave({
    metal: METAIS.ferroNegro,
    argola: '<circle cx="24" cy="5.6" r="3.9"/><circle cx="19.3" cy="11.6" r="3.9"/><circle cx="28.7" cy="11.6" r="3.9"/><path d="M22.4 11.6h3.2l1 6h-5.2z"/>',
    detalhe: furo(24, 10, 1.5),
    dentes: 'degraus',
  }),
  'chave-sol': chave({
    metal: METAIS.ouro,
    argola: `<path d="${SOL}"/>`,
    detalhe: `<circle cx="24" cy="10.5" r="4.4" fill="none" stroke="${METAIS.ouro.escuro}" stroke-width="1.1"/>${furo(24, 10.5, 2.1)}`,
    dentes: 'simples',
  }),
  'chave-lua': chave({ metal: METAIS.prata, argola: '<path d="M27 3.2A8 8 0 1 0 27 17.8A7.6 7.6 0 0 1 27 3.2z"/>', dentes: 'degraus' }),
  'chave-estrela': chave({ metal: METAIS.prata, argola: `<path d="${ESTRELA}"/>`, detalhe: furo(24, 10.8, 1.7), dentes: 'simples' }),
  'chave-aguia': chave({
    metal: METAIS.bronze,
    argola: '<circle cx="24" cy="10.5" r="8.4"/>',
    detalhe:
      `<circle cx="24" cy="10.5" r="5.9" fill="${tom(METAIS.bronze.cor, 0.84)}" stroke="${METAIS.bronze.escuro}" stroke-width="1"/>` +
      `<g fill="${METAIS.bronze.escuro}"><circle cx="23.2" cy="9.6" r="3"/><path d="M25.6 8l3.8 1.8-3.4 1.6zM20.6 10.6h4.8l.8 4.8h-6.2z"/></g>` +
      `<circle cx="24" cy="8.8" r=".7" fill="${METAIS.bronze.luz}"/>`,
    dentes: 'degraus',
  }),
  'chave-serpente': (() => {
    const v = METAIS.verdete
    const anel = 'M24 17c-4.2 0-7.4-3-7.4-6.8S19.8 3.6 24 3.6s7.4 2.8 7.4 6.6c0 2.6-1.4 4.6-3.6 5.6'
    return chave({
      metal: v,
      argola: '<circle cx="24" cy="17" r="2"/>',
      detalhe:
        `<path d="${anel}" stroke="${v.escuro}" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="${anel}" stroke="${v.cor}" stroke-width="3.8" fill="none" stroke-linecap="round"/>` +
        `<path d="${anel}" stroke="${tom(v.cor, 0.78)}" stroke-width="1.3" fill="none" stroke-dasharray="1.4 2.4"/>` +
        `<ellipse cx="28.6" cy="16.2" rx="3" ry="2.2" transform="rotate(-30 28.6 16.2)" fill="${v.cor}" stroke="${v.escuro}" stroke-width="1.6"/>${furo(29.4, 15.6, 0.6)}`,
      dentes: 'simples',
    })
  })(),
  'chave-coroa': chave({
    metal: METAIS.ouro,
    argola: `<path d="${COROA}"/><rect x="16.2" y="15.8" width="15.6" height="3.2" rx="1"/><circle cx="14.8" cy="7" r="1.4"/><circle cx="24" cy="3.2" r="1.4"/><circle cx="33.2" cy="7" r="1.4"/>`,
    detalhe: furo(24, 11.8, 1.6),
    dentes: 'degraus',
  }),
  'chave-pedra': chave({
    metal: METAIS.pedra,
    argola: '<circle cx="24" cy="10.5" r="8.2"/>',
    detalhe: `${furo(24, 10.5, 3.4)}<path d="M18.6 6.2l2.4 2.8-.8 2.6" stroke="${METAIS.pedra.escuro}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    dentes: 'degraus',
    haste: 4.2,
  }),
  'chave-osso': chave({
    metal: METAIS.osso,
    argola: '<circle cx="20.4" cy="7" r="3.6"/><circle cx="27.6" cy="7" r="3.6"/><path d="M20.4 7h7.2v5.6H20.4zM21.2 12h5.6l-.8 5h-4z"/>',
    detalhe: `<path d="M22.8 27.4v5" stroke="${tom(METAIS.osso.cor, 0.8)}" stroke-width=".9" stroke-linecap="round"/>`,
    dentes: 'degraus',
  }),
  'chave-cranio': chave({
    metal: METAIS.osso,
    argola: '<circle cx="24" cy="9.2" r="6.8"/><rect x="20" y="12.6" width="8" height="5.2" rx="1.6"/>',
    detalhe: `${furo(21.4, 9.6, 1.9)}${furo(26.6, 9.6, 1.9)}<path d="M24 12.2l-1 1.8h2z" fill="${COR_DO_VAO}"/><path d="M22.4 15.8v1.6M24 15.8v1.6M25.6 15.8v1.6" stroke="${METAIS.osso.escuro}" stroke-width=".8"/>`,
    dentes: 'simples',
  }),
  'chave-mestra': chave({
    metal: METAIS.ferro,
    argola: '<circle cx="24" cy="4.8" r="3.4"/><circle cx="18.6" cy="10.2" r="3.4"/><circle cx="29.4" cy="10.2" r="3.4"/><circle cx="24" cy="15.4" r="3.4"/><circle cx="24" cy="10.2" r="4.2"/>',
    detalhe: `${furo(24, 10.2, 1.9)}${furo(24, 4.8, 1.1)}${furo(18.6, 10.2, 1.1)}${furo(29.4, 10.2, 1.1)}`,
    dentes: 'duplo',
  }),
  'chave-roda': chave({
    metal: METAIS.latao,
    argola: `<path d="${caminhoDaRoda(24, 10.5, 8, 8.8, 7)}"/>`,
    detalhe: `<circle cx="24" cy="10.5" r="4.6" fill="none" stroke="${tom(METAIS.latao.cor, 0.72)}" stroke-width="1.1"/>${furo(24, 10.5, 2.6)}`,
    dentes: 'simples',
  }),
}
