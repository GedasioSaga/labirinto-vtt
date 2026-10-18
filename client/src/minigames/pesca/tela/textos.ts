import type { PescaMotivoDoFim } from '../../../net/protocoloDaPesca'
import type { CenaDaPesca, FaseDaPesca } from '../arte'
import { DIF, faixa, rngDe, type DificuldadeSim, type FaixaDoLance, type Raridade } from '../sim'

/**
 * AS FRASES DA TELA DA PESCA, tiradas do protótipo aprovado
 * (docs/design/minigame-pesca/prototipo/index.html, `textoHud`,
 * `pintarResultado`). Puras: o motor, a tela e o teste leem daqui.
 */

export const RARIDADE: Readonly<Record<Raridade, string>> = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', lendario: 'Lendário' }
export const FAIXA: Readonly<Record<FaixaDoLance, string>> = { perto: 'Perto', medio: 'Médio', longe: 'Longe' }

const TEXTO_FAIXA: Readonly<Record<DificuldadeSim, Readonly<Record<FaixaDoLance, string>>>> = {
  normal: { perto: 'Perto: peixe miúdo, 1 estrela.', medio: 'Médio: 2 estrelas, mais incomuns.', longe: 'Longe: 3 estrelas e os maiores.' },
  extremo: { perto: 'Perto: peixe miúdo, 1 estrela.', medio: 'Médio: 2 estrelas; os raros começam.', longe: 'Longe: 3 estrelas; raros e o lendário moram aqui.' },
}

/** Número com vírgula, como o protótipo (`fmtDec`). */
export const fmtDec = (v: number, casas = 1): string => v.toFixed(casas).replace('.', ',')
const pct = (v: number): string => `${Math.round(v * 100)}%`

export type TomDoHud = '' | 'bom' | 'ruim' | 'alerta'
export interface TextoDoHud {
  titulo: string
  dica: string
  tom: TomDoHud
}

/** O título e a dica da coluna durante o lance (o `textoHud` do protótipo). */
export function textoDoHud(J: Readonly<CenaDaPesca>): TextoDoHud {
  const d = DIF[J.dif]
  switch (J.fase) {
    case 'lance':
      return J.carregando
        ? { titulo: `Força ${pct(J.forca)}`, dica: TEXTO_FAIXA[J.dif][faixa(J.forca)], tom: '' }
        : { titulo: 'Lance', dica: 'Segure para encher a força e solte para lançar. Mais longe, peixe melhor e mais estrelas.', tom: '' }
    case 'voo':
      return { titulo: `Lançou: ${FAIXA[faixa(J.dist)].toLowerCase()}, ${pct(J.dist)}`, dica: 'A boia vai cair na água.', tom: '' }
    case 'espera':
      return { titulo: 'Esperando', dica: 'Aperte quando aparecer o !. Antes disso a linha volta vazia.', tom: '' }
    case 'cedo':
      return { titulo: 'Puxou cedo', dica: 'A linha voltou vazia. Lance de novo.', tom: 'ruim' }
    case 'fisgada':
      return { titulo: 'Fisgou! Aperte já', dica: `Você tem ${fmtDec(d.janela)} s.`, tom: 'alerta' }
    case 'puxada': {
      const e = J.puxada
      if (e === null) return { titulo: 'Puxando', dica: '', tom: '' }
      const bau = e.bau !== null && e.bau.estado === 'visivel'
      return {
        titulo: `Medidor ${pct(e.m)}`,
        dica: bau
          ? 'Baú na água! Segure-o dentro da barra até encher. Enquanto ele estiver na barra, o medidor não cai.'
          : 'Segure para subir a barra verde e mantenha o peixe dentro dela. Cheio, pegou; vazio, escapou.',
        tom: e.dentro ? 'bom' : '',
      }
    }
    case 'final': {
      const r = J.resultado
      if (r?.tipo === 'pegou') return { titulo: 'Pegou!', dica: r.peixe.nome, tom: 'bom' }
      if (r?.tipo === 'escapou') return { titulo: 'Escapou', dica: 'O medidor zerou.', tom: 'ruim' }
      return { titulo: 'Fugiu', dica: 'Demorou para fisgar.', tom: 'ruim' }
    }
    default:
      return { titulo: '', dica: '', tom: '' }
  }
}

/** O que sai no baú pego: só texto, como o prêmio (a pesca não entrega item). */
const ITENS_BAU = ['3 moedas de prata', 'uma isca de cobre', 'um anzol de osso', 'um frasco de tinta de lula', 'uma pérola turva', '12 moedas de cobre', 'um mapa molhado', 'uma runa rachada']

export function itensDoBau(semente: string): [string, string] {
  const r = rngDe(semente + '|bau')
  const a = Math.floor(r() * ITENS_BAU.length)
  let b = Math.floor(r() * ITENS_BAU.length)
  if (b === a) b = (b + 3) % ITENS_BAU.length
  return [ITENS_BAU[a], ITENS_BAU[b]]
}

export const TITULO_DO_LANCE = { pegou: 'Pegou!', escapou: 'Escapou', fugiu: 'Fugiu' } as const

export function textoDoEncerramento(motivo: PescaMotivoDoFim): { titulo: string; texto: string } {
  if (motivo === 'mestre') return { titulo: 'O mestre encerrou a pesca', texto: 'O que você pegou fica no cesto. Sem prêmio e sem consequência.' }
  return { titulo: 'A conexão caiu no meio da pesca', texto: 'Os lances que você terminou já tinham chegado ao mestre.' }
}

/** O desfecho de um lance, como as palavras do estado o leem. */
export interface UltimoLance {
  tipo: 'pegou' | 'escapou' | 'fugiu'
  /** Nome do peixe, no pegou. */
  peixe?: string
}

/**
 * O que alguém está fazendo, em palavras (o `estadoTexto` do protótipo): a
 * mesa do jogador e o placar do mestre falam igual. `medidor` só no placar.
 */
export function estadoEmPalavras(fase: FaseDaPesca, ultimo: UltimoLance | null, medidor?: number): string {
  switch (fase) {
    case 'convite':
      return 'no convite'
    case 'lance':
    case 'voo':
      return 'lançando'
    case 'espera':
      return 'esperando'
    case 'cedo':
      return 'puxou cedo'
    case 'fisgada':
      return 'fisgou!'
    case 'puxada':
      return medidor === undefined ? 'puxando' : `puxando ${pct(medidor)}`
    default:
      if (ultimo === null) return '—'
      return ultimo.tipo === 'pegou' ? `pegou ${ultimo.peixe ?? 'um peixe'}` : ultimo.tipo
  }
}

/** "1 lance", "3 lances". */
export const textoDosLances = (n: number): string => (n === 1 ? '1 lance' : `${n} lances`)
