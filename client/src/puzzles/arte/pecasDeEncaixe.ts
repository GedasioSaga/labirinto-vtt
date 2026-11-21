/**
 * AS PEÇAS NOVAS PARA PÔR NUM ENCAIXE (21/11): medalhões, joias, engrenagens,
 * olhos de estátua, brasões, estatuetas, manivela, orbes, placa, máscaras e as
 * seis peças inteiras das metades (`metades.ts`). Mesmo traço das 13 do v2:
 * quadro de 48 x 48, contorno na própria cor a ~55%, um risco de luz no alto à
 * esquerda, poucas cores por peça.
 *
 * Puro: sem React, sem disco.
 */
import type { IdDaPecaDeEncaixe } from '../tipos'
import {
  baseDeMedalhao,
  caminhoDaEstrela,
  caminhoDoPoligono,
  COR_DO_VAO,
  engrenagem,
  escudo,
  LIGAS_DO_MEDALHAO,
  METAIS,
  tom,
  uniao,
  type LigaDoMedalhao,
} from './tracos'

/** O creme dos emblemas dos brasões do v2 (a árvore, o lobo). */
const CREME = '#e9e3cf'

function medalhao(liga: LigaDoMedalhao, emblema: (liga: LigaDoMedalhao) => string): string {
  return baseDeMedalhao(liga) + emblema(liga)
}

function cervo(l: LigaDoMedalhao): string {
  return (
    `<path d="M21.6 19.6c-3.4-1.3-5.8-4.3-6.2-8.6M17.1 15.9l-3.9-1M19.2 18.2l-.4-4.2M26.4 19.6c3.4-1.3 5.8-4.3 6.2-8.6M30.9 15.9l3.9-1M28.8 18.2l.4-4.2" stroke="${l.relevo}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M20.8 21.4c-1.8-1.4-3.8-1.6-5.4-.8 1 1.6 2.8 2.6 4.9 2.6zM27.2 21.4c1.8-1.4 3.8-1.6 5.4-.8-1 1.6-2.8 2.6-4.9 2.6z" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M20.2 20.8c1.1-1 2.4-1.5 3.8-1.5s2.7.5 3.8 1.5c.3 4.6-.6 9.2-2 12.2-.5 1.1-1.1 1.6-1.8 1.6s-1.3-.5-1.8-1.6c-1.4-3-2.3-7.6-2-12.2z" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="22.1" cy="25" r="1.1" fill="${l.relevo}"/><circle cx="25.9" cy="25" r="1.1" fill="${l.relevo}"/><ellipse cx="24" cy="32.2" rx="1.3" ry=".9" fill="${l.relevo}"/>` +
    `<path d="M24 22.4v4.4" stroke="${l.relevoClaro}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`
  )
}

function coruja(l: LigaDoMedalhao): string {
  return (
    `<path d="M17.6 16.8l-1.4-4.6 4.6 2.6zM30.4 16.8l1.4-4.6-4.6 2.6z" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M16.5 21c0-4.6 3.3-7.8 7.5-7.8s7.5 3.2 7.5 7.8v6.4c0 5-3.3 8.6-7.5 8.6s-7.5-3.6-7.5-8.6z" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="2"/>` +
    `<circle cx="20.6" cy="21.2" r="3.3" fill="${l.relevoClaro}" stroke="${l.relevo}" stroke-width="1.6"/><circle cx="27.4" cy="21.2" r="3.3" fill="${l.relevoClaro}" stroke="${l.relevo}" stroke-width="1.6"/>` +
    `<circle cx="20.8" cy="21.4" r="1.4" fill="${l.relevo}"/><circle cx="27.2" cy="21.4" r="1.4" fill="${l.relevo}"/><path d="M22.8 24.4h2.4L24 27.2z" fill="${l.relevo}"/>` +
    `<path d="M20.5 30l1.7 1.3 1.8-1.3 1.8 1.3 1.7-1.3M21.4 33l1.3 1 1.3-1 1.3 1 1.3-1M21.8 36v1.6M26.2 36v1.6" stroke="${l.relevo}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  )
}

function peixe(l: LigaDoMedalhao): string {
  return (
    `<path d="M12.5 22c3-4.4 7-6.6 11.4-6.6 4 0 7 2 9.4 4.6l4.2-3.6v11.2l-4.2-3.6c-2.4 2.6-5.4 4.6-9.4 4.6-4.4 0-8.4-2.2-11.4-6.6z" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="17.4" cy="21.2" r="1.3" fill="${l.relevo}"/>` +
    `<path d="M21.4 17.8c1.2 2.6 1.2 5.6 0 8.2M25.2 20.2c1 1.2 1 2.8 0 4M28.6 20.4c.9 1.1.9 2.5 0 3.6" stroke="${l.relevo}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M14 32.4c2-1.4 3.6-1.4 5 0s3 1.4 5 0 3-1.4 5 0 3 1.4 5 0" stroke="${l.relevo}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M15.6 19.6c1.4-1.4 3-2.4 4.8-2.8" stroke="${l.relevoClaro}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".85"/>`
  )
}

function serpente(l: LigaDoMedalhao): string {
  const corpo = 'M30.5 15.2c-4-2-9.4-1.4-12.6 2.2-3.4 3.8-3.2 9.6.6 12.8 3.6 3 9 2.4 11.6-1.2 2.2-3.2 1.4-7.4-1.8-9.2-2.6-1.4-5.8-.4-6.8 2.2-.8 2 .4 4 2.4 4.2'
  return (
    `<path d="${corpo}" stroke="${l.relevo}" stroke-width="5.2" fill="none" stroke-linecap="round"/>` +
    `<path d="${corpo}" stroke="${l.relevoCheio}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<path d="${corpo}" stroke="${l.relevoClaro}" stroke-width="1" fill="none" stroke-dasharray="1.2 2.6" opacity=".7"/>` +
    `<ellipse cx="32.2" cy="15.6" rx="3.4" ry="2.4" transform="rotate(22 32.2 15.6)" fill="${l.relevoCheio}" stroke="${l.relevo}" stroke-width="1.8"/>` +
    `<circle cx="33" cy="15" r=".8" fill="${l.relevo}"/><path d="M35.2 17.2l2 .6M35.2 17.2l1.4 1.6" stroke="${l.relevo}" stroke-width="1" stroke-linecap="round"/>`
  )
}

/** Joia lapidada em degraus (a esmeralda): o octógono comprido, a mesa e os cantos. */
function joiaEmDegraus(cor: string, contorno: string, brilho: string): string {
  return (
    `<path d="M17.5 7.5h13l5.5 5.5v22l-5.5 5.5h-13L12 35V13z" fill="${cor}" stroke="${contorno}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M19.5 13h9l2.5 2.5v17L28.5 35h-9L17 32.5v-17zM17.5 7.5l2 5.5M30.5 7.5l-2 5.5M36 13l-5 2.5M36 35l-5-2.5M30.5 40.5l-2-5.5M17.5 40.5l2-5.5M12 35l5-2.5M12 13l5 2.5" stroke="${contorno}" stroke-width="1.3" fill="none" opacity=".8" stroke-linejoin="round"/>` +
    `<path d="M20 16.6v8" stroke="${brilho}" stroke-width="2" stroke-linecap="round"/>`
  )
}

/** Joia redonda (o rubi): a mesa de oito lados e as facetas até a borda. */
function joiaRedonda(cor: string, contorno: string, brilho: string): string {
  const giro = Math.PI / 8
  let facetas = ''
  for (let k = 0; k < 8; k++) {
    const angulo = giro + (k * Math.PI) / 4
    facetas += `M${(24 + Math.sin(angulo) * 7.6).toFixed(2)} ${(24 - Math.cos(angulo) * 7.6).toFixed(2)}L${(24 + Math.sin(angulo) * 15.5).toFixed(2)} ${(24 - Math.cos(angulo) * 15.5).toFixed(2)}`
  }
  return (
    `<circle cx="24" cy="24" r="15.5" fill="${cor}" stroke="${contorno}" stroke-width="2"/>` +
    `<path d="${caminhoDoPoligono(24, 24, 8, 7.6, giro)}${facetas}" stroke="${contorno}" stroke-width="1.3" fill="none" opacity=".8" stroke-linejoin="round"/>` +
    `<path d="M14.6 19a10.4 10.4 0 0 1 5-5.6" stroke="${brilho}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  )
}

/** Joia em gota (a ametista). */
function joiaEmGota(cor: string, contorno: string, brilho: string): string {
  return (
    `<path d="M24 6.5c5.4 6.2 12.5 13.6 12.5 21.5a12.5 12.5 0 0 1-25 0c0-7.9 7.1-15.3 12.5-21.5z" fill="${cor}" stroke="${contorno}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M24 16c2.8 3.2 6 6.8 6 10.6a6 6 0 0 1-12 0c0-3.8 3.2-7.4 6-10.6zM24 6.5V16M11.5 28H18M30 28h6.5M24 32.6v7.9M15.2 36.8l4.4-5.6M32.8 36.8l-4.4-5.6" stroke="${contorno}" stroke-width="1.3" fill="none" opacity=".8" stroke-linejoin="round"/>` +
    `<path d="M18.8 22.6c.8-2 2-3.8 3.4-5.4" stroke="${brilho}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  )
}

/** Pedra lisa, sem lapidação (o ônix): o oval com a faixa clara por dentro. */
function joiaLisa(cor: string, contorno: string, faixa: string, brilho: string): string {
  return (
    `<ellipse cx="24" cy="24" rx="12" ry="15.5" fill="${cor}" stroke="${contorno}" stroke-width="2"/>` +
    `<ellipse cx="24" cy="24.4" rx="8.2" ry="11.4" fill="none" stroke="${faixa}" stroke-width="1.5"/>` +
    `<path d="M17.2 17.4c1-3 3-5.2 5.6-6" stroke="${brilho}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85"/>`
  )
}

/** O olho de estátua: a amêndoa de mármore, a íris de pedra, a pupila e o brilho. */
function olhoDeEstatua(iris: string, contornoDaIris: string, brilho: string): string {
  return (
    '<path d="M10.6 16.6c3.9-4.2 8.4-6.4 13.4-6.4s9.5 2.2 13.4 6.4" stroke="#8f8572" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M6.5 24c4.6-7.4 10.6-11 17.5-11s12.9 3.6 17.5 11c-4.6 7.4-10.6 11-17.5 11S11.1 31.4 6.5 24z" fill="#ddd6c4" stroke="#6f6656" stroke-width="2.2" stroke-linejoin="round"/>' +
    `<circle cx="24" cy="24" r="7.4" fill="${iris}" stroke="${contornoDaIris}" stroke-width="1.8"/>` +
    `<circle cx="24" cy="24" r="4.9" fill="none" stroke="${tom(iris, 0.8)}" stroke-width="1.1"/>` +
    `<circle cx="24" cy="24" r="2.9" fill="${tom(contornoDaIris, 0.7)}"/><circle cx="21.6" cy="21.4" r="1.4" fill="${brilho}"/>` +
    '<path d="M10.4 25.6c1.4 1.8 3 3.2 4.8 4.4" stroke="#f2ede1" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>'
  )
}

/** A torre de ameias do brasão. */
function torre(contorno: string): string {
  return (
    `<path d="M18 33.5v-15h-1.5V14h3v2h2.4v-2h4.2v2h2.4v-2h3v4.5H30v15z" fill="${CREME}" stroke="${contorno}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M22 33.5v-4.2a2 2 0 0 1 4 0v4.2z" fill="${contorno}"/><rect x="23" y="21" width="2" height="3.2" rx="1" fill="${contorno}"/>`
  )
}

function corvo(contorno: string): string {
  const formas =
    '<path d="M19.5 27c0-4.6 3.4-7.6 7.4-7.6 3.2 0 5.4 2 6.2 4.8l1.4 6.6-4.2-1.6c-1.4 1.6-3.4 2.4-5.4 2.4-3.2 0-5.4-1.8-5.4-4.6z"/>' +
    '<circle cx="20.6" cy="19.6" r="3.6"/><path d="M17.4 18.6l-4.4 1.6 4.6 1.2z"/>'
  return (
    uniao(formas, CREME, contorno, 0.9) +
    `<circle cx="19.9" cy="19" r=".9" fill="${contorno}"/>` +
    `<path d="M23.6 24.4c2 .2 4.4 1.6 5.6 3.6M23.4 31.4l-.6 3.2M26.2 31.4l.4 3.2" stroke="${contorno}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  )
}

function rosa(): string {
  return (
    '<path d="M24 25.6v9" stroke="#4c5c3c" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M24 30.2c-2.6-.2-4.4-1.6-5-3.6 2.4-.2 4.2.8 5 3.6zM24 32c2.6-.2 4.4-1.6 5-3.6-2.4-.2-4.2.8-5 3.6z" fill="#7f9a64" stroke="#4c5c3c" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<circle cx="24" cy="19.6" r="6" fill="#a8454b" stroke="#5a2226" stroke-width="1.8"/>' +
    '<path d="M24 16.4c1.8 0 3 1.2 3 2.8s-1.4 2.6-3 2.6c-1.2 0-2-.8-2-1.8 0-.8.6-1.4 1.4-1.4M18.8 20.8c1.2 2.4 3 3.6 5.2 3.6s4-1.2 5.2-3.6" stroke="#5a2226" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
  )
}

const MADEIRA = { cor: '#8a6040', escuro: '#33231a', luz: '#b58a60' } as const
const ONIX = { cor: '#45434a', escuro: '#18171b', luz: '#8d8a96' } as const

function cavalo(): string {
  return (
    `<path d="M18.2 36c-.6-4.2.6-7.4 3-9.6-1.8.4-3.8.2-5.4-.8-1.6-1-2.2-2.6-1.6-4L21.4 14.6c.4-2 1.6-3.6 3.4-4.4l1-2.2 1.6 2.6c4 1.6 6 6 5.6 11.4-.4 5.8-1.8 10.2-2.8 14z" fill="${MADEIRA.cor}" stroke="${MADEIRA.escuro}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="22.8" cy="16.6" r="1.1" fill="${MADEIRA.escuro}"/><circle cx="15.6" cy="22.4" r=".8" fill="${MADEIRA.escuro}"/>` +
    `<path d="M27.8 12.6c2.4 1.6 3.8 4.2 4 7.4M28.6 17.8c1 1.6 1.4 3.4 1.4 5.4" stroke="#5a3d26" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M19.6 32.6c-.2-2 .2-3.8 1.2-5.4" stroke="${MADEIRA.luz}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M13.5 40.5h21l-1.8-4.6H15.3z" fill="#6b4a2e" stroke="${MADEIRA.escuro}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M16.4 37.6h15.2" stroke="${MADEIRA.luz}" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>`
  )
}

function gato(): string {
  const formas =
    '<circle cx="24" cy="19.5" r="5.2"/><path d="M19.4 17.6l-.8-5.8 4.2 3.2zM28.6 17.6l.8-5.8-4.2 3.2z"/>' +
    '<path d="M18.6 37.6c-.8-5.6.6-10.4 3.6-13.4h3.6c3 3 4.4 7.8 3.6 13.4z"/>'
  return (
    `<path d="M29.2 36.6c2.8-.4 4.6-2.2 4.4-4.8" stroke="${ONIX.escuro}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M29.2 36.6c2.8-.4 4.6-2.2 4.4-4.8" stroke="${ONIX.cor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    uniao(formas, ONIX.cor, ONIX.escuro, 1) +
    `<ellipse cx="21.9" cy="19.4" rx="1.3" ry=".9" fill="${METAIS.ouro.cor}"/><ellipse cx="26.1" cy="19.4" rx="1.3" ry=".9" fill="${METAIS.ouro.cor}"/>` +
    `<path d="M21.2 24.6c1.8.8 3.8.8 5.6 0" stroke="${METAIS.ouro.cor}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M20.4 17.2a4 4 0 0 1 2.2-2.2M20.4 34.4c-.2-2.4.2-4.6 1.2-6.4" stroke="${ONIX.luz}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<rect x="15.5" y="37.4" width="17" height="3.2" rx="1" fill="#6b6872" stroke="${ONIX.escuro}" stroke-width="1.8"/>`
  )
}

function manivela(): string {
  const ferro = METAIS.ferro
  return (
    `<path d="M15.5 15.5 31 31" stroke="${ferro.escuro}" stroke-width="7" stroke-linecap="round"/><path d="M15.5 15.5 31 31" stroke="${ferro.cor}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M17.4 16.2l12 12" stroke="${ferro.luz}" stroke-width="1" stroke-linecap="round" opacity=".7"/>` +
    `<rect x="28" y="31" width="14" height="7" rx="3.5" transform="rotate(30 35 34.5)" fill="#9a6a3c" stroke="#4d3520" stroke-width="2"/>` +
    `<path d="M31.4 32.4l7.4 4.2" stroke="#c49566" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>` +
    `<circle cx="31" cy="31" r="2.6" fill="${ferro.cor}" stroke="${ferro.escuro}" stroke-width="1.6"/>` +
    `<rect x="9" y="9" width="10" height="10" rx="2.2" fill="${ferro.cor}" stroke="${ferro.escuro}" stroke-width="2.2"/>` +
    `<rect x="12.2" y="12.2" width="3.6" height="3.6" rx=".6" fill="${COR_DO_VAO}"/>` +
    `<path d="M10.8 12.4c.4-1 1-1.6 2-1.8" stroke="${ferro.luz}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
  )
}

/** O orbe na base de garras: a esfera, uma névoa por dentro e o brilho. */
function orbe(cor: string, contorno: string, nevoa: string, brilho: string, base: { cor: string; escuro: string }): string {
  return (
    `<path d="M16.5 40.5h15l-2.2-4.8H18.7z" fill="${base.cor}" stroke="${base.escuro}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M19.2 35.8l-1.6-2.6M28.8 35.8l1.6-2.6M24 35.8v-1.6" stroke="${base.escuro}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="24" cy="21.5" r="13.5" fill="${cor}" stroke="${contorno}" stroke-width="2"/>` +
    `<path d="M14.6 24.4c3-1.8 6.4-1.6 9 .2s5.6 2 8.6.2M17.6 29.4c2.2-1 4.4-1 6.4.2" stroke="${nevoa}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M15.4 16.6a10 10 0 0 1 5.6-5" stroke="${brilho}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="28.6" cy="14.6" r="1" fill="${brilho}" opacity=".7"/>`
  )
}

function placaDeRunas(): string {
  const b = LIGAS_DO_MEDALHAO.bronze
  return (
    `<rect x="8" y="11" width="32" height="26" rx="2.5" fill="${b.fora}" stroke="${b.contornoFora}" stroke-width="2.2"/>` +
    `<rect x="11.2" y="14.2" width="25.6" height="19.6" rx="1.5" fill="${b.dentro}" stroke="${b.contornoDentro}" stroke-width="1.3"/>` +
    `<path d="M17.5 18.6v10.8M17.5 21.2l3.2-2.6M17.5 24.4l3.2-2.6M24 18.6v10.8M24 18.6l3 3-3 3M30.5 18.6v10.8M28 21.8l5 4.4M33 21.8l-5 4.4" stroke="${b.relevo}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="10.6" cy="13.6" r="1.2" fill="${b.relevoClaro}" stroke="${b.contornoFora}"/><circle cx="37.4" cy="13.6" r="1.2" fill="${b.relevoClaro}" stroke="${b.contornoFora}"/><circle cx="10.6" cy="34.4" r="1.2" fill="${b.relevoClaro}" stroke="${b.contornoFora}"/><circle cx="37.4" cy="34.4" r="1.2" fill="${b.relevoClaro}" stroke="${b.contornoFora}"/>` +
    `<path d="M14 12.6h9" stroke="${b.luz}" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>`
  )
}

function mascaraDeOuro(): string {
  const o = METAIS.ouro
  return (
    `<path d="M12 13c4-2.6 8-3.8 12-3.8s8 1.2 12 3.8c.4 8.4-.8 15-4 19.6-2.2 3.2-5 5-8 5s-5.8-1.8-8-5c-3.2-4.6-4.4-11.2-4-19.6z" fill="${o.cor}" stroke="${o.escuro}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M15.6 20.4c1.6-1.6 3.2-2.2 5-1.6.4.8.4 1.6 0 2.4-1.8.6-3.4 0-5-.8zM32.4 20.4c-1.6-1.6-3.2-2.2-5-1.6-.4.8-.4 1.6 0 2.4 1.8.6 3.4 0 5-.8z" fill="${COR_DO_VAO}" stroke="${o.escuro}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M15 17.4c1.8-1.2 3.8-1.6 6-1.2M33 17.4c-1.8-1.2-3.8-1.6-6-1.2M24 19.4v7.2l-1.8 1.4M24 26.6l1.8 1.4" stroke="${tom(o.cor, 0.7)}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M20.4 31.2c2.4.8 4.8.8 7.2 0" stroke="${o.escuro}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M24 11.4l1.6 2-1.6 2-1.6-2z" fill="${o.luz}" stroke="${o.escuro}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M14.4 15.4c.2 4 .8 7.6 2 10.6" stroke="${o.luz}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>`
  )
}

function mascaraDePrata(): string {
  const p = METAIS.prata
  return (
    '<path d="M13.4 17.6l-4.4-1.6M34.6 17.6l4.4-1.6M13.6 20l-3.6 1.4M34.4 20l3.6 1.4" stroke="#4d5f7a" stroke-width="2" stroke-linecap="round"/>' +
    `<path d="M13 14.4c3.4-3.2 7.2-4.8 11-4.8s7.6 1.6 11 4.8c.6 7.6-.6 13.6-3.6 17.6-2 2.8-4.6 4.4-7.4 4.4s-5.4-1.6-7.4-4.4c-3-4-4.2-10-3.6-17.6z" fill="${p.cor}" stroke="${p.escuro}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M16.4 21.8c1.2-2.6 5-2.6 6.2 0-1.8 1-4.4 1-6.2 0zM31.6 21.8c-1.2-2.6-5-2.6-6.2 0 1.8 1 4.4 1 6.2 0zM19 28.2c3.2 2.4 6.8 2.4 10 0-.6 3-2.6 4.6-5 4.6s-4.4-1.6-5-4.6z" fill="${COR_DO_VAO}" stroke="${p.escuro}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M16.6 18.2c1.4-1 3.2-1.4 5-1M31.4 18.2c-1.4-1-3.2-1.4-5-1" stroke="${tom(p.cor, 0.72)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    `<path d="M15.2 16.8c.4-1 1-1.8 2-2.4" stroke="${p.luz}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
  )
}

// ------------------------------------------------------------------ as peças inteiras das metades

function tabuaDeRunas(): string {
  const p = METAIS.pedra
  return (
    `<path d="M11 40V15.5C11 10.8 16.8 7.5 24 7.5S37 10.8 37 15.5V40z" fill="${p.cor}" stroke="${p.escuro}" stroke-width="2.2" stroke-linejoin="round"/>` +
    '<path d="M14.5 37V16.4c0-3.2 4.2-5.6 9.5-5.6s9.5 2.4 9.5 5.6V37z" fill="none" stroke="#77726a" stroke-width="1.3"/>' +
    '<path d="M18.5 17.5v6.4M18.5 17.5l3 2.2-3 2.2M24 17.5v6.4M22 19.4l4 2.2M29.5 17.5v6.4M27.5 17.5l2 3 2-3M18.5 27.5l3 6.4M21.5 27.5l-3 6.4M24 27.5v6.4M24 30.6h2.6M27.6 27.5v6.4h3.8" stroke="#3f3c36" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    `<path d="M13.4 14.4c1.2-2.4 4-4 7.4-4.6" stroke="${p.luz}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`
  )
}

function discoDoEclipse(): string {
  const b = LIGAS_DO_MEDALHAO.bronze
  return (
    `<circle cx="24" cy="24" r="18.5" fill="${b.fora}" stroke="${b.contornoFora}" stroke-width="2.4"/>` +
    `<path d="M24 9.5a14.5 14.5 0 0 0 0 29z" fill="${METAIS.ouro.cor}"/><path d="M24 9.5a14.5 14.5 0 0 1 0 29z" fill="${METAIS.prata.cor}"/>` +
    `<circle cx="24" cy="24" r="14.5" fill="none" stroke="${b.contornoDentro}" stroke-width="1.4"/><path d="M24 9.5v29" stroke="${b.contornoDentro}" stroke-width="1.2"/>` +
    `<path d="M18.6 16.4v2.6M18.6 29v2.6M11.4 24H14M13.4 18.8l1.8 1.8M13.4 29.2l1.8-1.8" stroke="${METAIS.ouro.escuro}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<circle cx="18.6" cy="24" r="4" fill="#f0d266" stroke="${METAIS.ouro.escuro}" stroke-width="1.5"/>` +
    `<path d="M31 18.2a6.4 6.4 0 1 0 0 11.6 5.2 5.2 0 1 1 0-11.6z" fill="#f3efe2" stroke="${METAIS.prata.escuro}" stroke-width="1.5"/>` +
    `<circle cx="34" cy="17.4" r=".9" fill="#f3efe2"/><circle cx="34.8" cy="30.4" r=".8" fill="#f3efe2"/>` +
    `<path d="M10.6 17.4a15.8 15.8 0 0 1 7-7.2" stroke="${b.luz}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".75"/>`
  )
}

function espelhoDeBronze(): string {
  const b = LIGAS_DO_MEDALHAO.bronze
  return (
    `<path d="M21.6 32.6h4.8l.8 9.4c0 1-1.4 1.6-3.2 1.6s-3.2-.6-3.2-1.6z" fill="${b.fora}" stroke="${b.contornoFora}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M21.4 37.2h5.2" stroke="${b.contornoFora}" stroke-width="1.3"/>` +
    `<circle cx="24" cy="19.5" r="14" fill="${b.fora}" stroke="${b.contornoFora}" stroke-width="2.2"/>` +
    `<circle cx="24" cy="19.5" r="10.6" fill="#c9d2d4" stroke="${b.contornoDentro}" stroke-width="1.5"/>` +
    `<circle cx="24" cy="7.2" r="1" fill="${b.relevoClaro}"/><circle cx="36.3" cy="19.5" r="1" fill="${b.relevoClaro}"/><circle cx="24" cy="31.8" r="1" fill="${b.relevoClaro}"/><circle cx="11.7" cy="19.5" r="1" fill="${b.relevoClaro}"/>` +
    '<path d="M17.4 17.4c1-2.8 3.2-4.8 6-5.6M18.4 22.4l2.4-2.4" stroke="#f2f6f6" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>'
  )
}

function seloReal(): string {
  let bordas = '<circle cx="24" cy="24" r="14.2"/>'
  for (let k = 0; k < 12; k++) {
    const angulo = (k * Math.PI) / 6
    bordas += `<circle cx="${(24 + Math.sin(angulo) * 14.4).toFixed(2)}" cy="${(24 - Math.cos(angulo) * 14.4).toFixed(2)}" r="3.6"/>`
  }
  return (
    uniao(bordas, '#9a3d3f', '#521d20', 1.1) +
    '<circle cx="24" cy="24" r="10.6" fill="#ab4849" stroke="#6a2628" stroke-width="1.4"/>' +
    '<path d="M17.4 28.4h13.2l1.2-9-4 3.2L24 16.6l-3.8 6-4-3.2z" fill="#c25a59" stroke="#521d20" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M17.8 30.6h12.4" stroke="#521d20" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M15 17.6a10.6 10.6 0 0 1 5-4.6" stroke="#d98381" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>'
  )
}

function estrelaDePrata(): string {
  const p = METAIS.prata
  return (
    `<circle cx="24" cy="7" r="2.8" fill="none" stroke="${p.escuro}" stroke-width="3.6"/><circle cx="24" cy="7" r="2.8" fill="none" stroke="${p.cor}" stroke-width="1.6"/>` +
    `<path d="${caminhoDaEstrela(24, 26, 8, 15.5, 8.2)}" fill="${p.cor}" stroke="${p.escuro}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="${caminhoDaEstrela(24, 26, 8, 8.2, 4.8, Math.PI / 8)}" fill="${p.luz}" stroke="${tom(p.cor, 0.7)}" stroke-width="1.2" stroke-linejoin="round"/>` +
    '<circle cx="24" cy="26" r="2.6" fill="#6f8fb8" stroke="#3d5373" stroke-width="1.2"/>'
  )
}

function coroaDeBronze(): string {
  const b = METAIS.bronze
  return (
    `<path d="M11 33.5l-1.6-17 7.6 6.4L24 11l7 11.9 7.6-6.4-1.6 17z" fill="${b.cor}" stroke="${b.escuro}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<circle cx="9.4" cy="16.4" r="1.9" fill="${b.luz}" stroke="${b.escuro}" stroke-width="1.4"/><circle cx="24" cy="10.8" r="1.9" fill="${b.luz}" stroke="${b.escuro}" stroke-width="1.4"/><circle cx="38.6" cy="16.4" r="1.9" fill="${b.luz}" stroke="${b.escuro}" stroke-width="1.4"/>` +
    `<rect x="10.5" y="32.6" width="27" height="6" rx="1.2" fill="${tom(b.cor, 0.9)}" stroke="${b.escuro}" stroke-width="2.2"/>` +
    '<circle cx="17" cy="35.6" r="1.6" fill="#a8454b"/><circle cx="24" cy="35.6" r="1.6" fill="#5f9a72"/><circle cx="31" cy="35.6" r="1.6" fill="#6f8fb8"/>' +
    `<path d="M14 30.4l-.8-7.6" stroke="${b.luz}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`
  )
}

/** O miolo do SVG de cada peça nova de encaixe, no quadro de 48 x 48. */
export const ARTE_DAS_PECAS_DE_ENCAIXE: Readonly<Record<IdDaPecaDeEncaixe, string>> = {
  'med-cervo': medalhao(LIGAS_DO_MEDALHAO.latao, cervo),
  'med-coruja': medalhao(LIGAS_DO_MEDALHAO.prata, coruja),
  'med-peixe': medalhao(LIGAS_DO_MEDALHAO.bronze, peixe),
  'med-serpente': medalhao(LIGAS_DO_MEDALHAO.latao, serpente),
  'joia-esmeralda': joiaEmDegraus('#5f9a72', '#2f5a3e', '#bfe3c8'),
  'joia-rubi': joiaRedonda('#b0444a', '#5e1f24', '#f0b7b7'),
  'joia-ametista': joiaEmGota('#8b6aa6', '#4a3460', '#dccbec'),
  'joia-onix': joiaLisa('#45434a', '#18171b', '#6b6872', '#a19eaa'),
  'engr-latao': engrenagem(12, 19.5, 16, '#c9a45c', true),
  'engr-cobre': engrenagem(10, 17.5, 13.5, '#b5694c', false),
  'olho-jade': olhoDeEstatua('#5f9a7e', '#2f5a46', '#e3f2e8'),
  'olho-obsidiana': olhoDeEstatua('#46444c', '#161519', '#c9c6d2'),
  'bra-torre': escudo('#9a5450', '#5a2e2c', '#c48580') + torre('#5a2e2c'),
  'bra-corvo': escudo('#55585e', '#26282c', '#80848b') + corvo('#26282c'),
  'bra-rosa': escudo('#c4a052', '#6e5931', '#e2c886') + rosa(),
  'fig-cavalo': cavalo(),
  'fig-gato': gato(),
  manivela: manivela(),
  'orbe-cristal': orbe('#a9c4cf', '#4f6b77', '#d6e6ec', '#f2f8fa', { cor: LIGAS_DO_MEDALHAO.bronze.fora, escuro: LIGAS_DO_MEDALHAO.bronze.contornoFora }),
  'orbe-sombra': orbe('#4f4762', '#231e2e', '#857aa0', '#b3a9c9', { cor: METAIS.ferroNegro.cor, escuro: METAIS.ferroNegro.escuro }),
  'placa-runas': placaDeRunas(),
  'mascara-ouro': mascaraDeOuro(),
  'mascara-prata': mascaraDePrata(),
  'tabua-runas': tabuaDeRunas(),
  'disco-eclipse': discoDoEclipse(),
  'espelho-bronze': espelhoDeBronze(),
  'selo-real': seloReal(),
  'estrela-prata': estrelaDePrata(),
  'coroa-bronze': coroaDeBronze(),
}
