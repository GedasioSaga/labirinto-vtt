import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { DancaHostMessage, DancaLinhaDaMesa, DancaPlacarFinal } from '../../../../net/protocoloDaDanca'
import { receberDanca, type DancaDoJogador } from '../../../../player/estadoDaDanca'
import { useSomStore } from '../../../../stores/somStore'
import { themeCss } from '../../../../theme'
import { notasDaMusica } from '../../coreografia'
import { letraDe } from '../../regras'
import { MINIGAME_PADRAO, type DificuldadeDanca, type MinigameDanca } from '../../tipos'
import { DancaOverlay, type AcoesDaDanca } from '../DancaOverlay'

/**
 * VITRINE DA DANÇA — só para desenvolvimento e provas, fora do build (não está
 * nas entradas do vite.config.ts). Um mestre de mentira manda as mensagens de
 * verdade pelo mesmo `receberDanca` da conexão; Iara e Tomé dançam por lotes
 * sintéticos; `?auto=1` toca as setas deste jogador por eventos de teclado.
 *
 *   npm run dev  ->  http://localhost:1420/src/minigames/danca/tela/vitrine/vitrine.html?auto=1
 *   window.__vitrine.comecar() / pausar() / retomar() / encerrar('mestre') / desfecho()
 */

const parametros = new URLSearchParams(location.search)
const SESSAO = 'vitrine'
const PINO = 'pino-porta-que-danca'
const EU = { playerId: 'eu', nome: 'Gedasio' }
const COLEGAS = [
  { playerId: 'iara', nome: 'Iara', dificuldade: 'diversao' as DificuldadeDanca, precisao: 0.93 },
  { playerId: 'tome', nome: 'Tomé', dificuldade: 'expert' as DificuldadeDanca, precisao: 0.86 },
]
const TECLA = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']
const permitida = (parametros.get('permitida') ?? 'escolha') as MinigameDanca['permitida']

interface Vitrine {
  comecar(): void
  pausar(): void
  retomar(): void
  encerrar(motivo: 'mestre' | 'fora' | 'saiu'): void
  desfecho(): void
  lotes: number
  fim: DancaPlacarFinal | null
}
declare global {
  interface Window {
    __vitrine: Vitrine
  }
}

const estilo = document.createElement('style')
estilo.textContent = themeCss()
document.head.append(estilo)
if (parametros.get('mudo') === '1') useSomStore.setState({ mudo: true })

let atual: DancaDoJogador | undefined
const ouvintes = new Set<() => void>()
function enviar(msg: DancaHostMessage): void {
  atual = receberDanca(atual, msg, performance.now())
  for (const o of ouvintes) o()
}
function mudar(d: DancaDoJogador | undefined): void {
  atual = d
  for (const o of ouvintes) o()
}

let inicioMs = 0
let fimDosBots = 0
let pausaEm = 0
let difDoAuto: DificuldadeDanca | null = null
const timers: number[] = []
const timersDoAuto: number[] = []

/** Iara e Tomé: a cada 250 ms, os toques que já passaram, com o placar. */
function simularColegas(): void {
  const dados = COLEGAS.map((c) => ({ ...c, notas: notasDaMusica({ tipo: 'demo' }, c.dificuldade, PINO), i: 0, julgadas: 0, combo: 0 }))
  fimDosBots = Math.max(...dados.map((d) => d.notas.at(-1)?.t ?? 0))
  const id = window.setInterval(() => {
    const st = (performance.now() - inicioMs) / 1000
    for (const c of dados) {
      const eventos = []
      while (c.i < c.notas.length && c.notas[c.i].t <= st) {
        const n = c.notas[c.i]
        const sorte = (c.i * 7919) % 100
        const j = sorte < 6 ? 'errou' : sorte < 70 ? 'perfeito' : 'bom'
        c.combo = j === 'errou' ? 0 : c.combo + 1
        eventos.push({ lane: n.lane, j, t: n.t } as const)
        c.i += 1
        c.julgadas += 1
      }
      if (eventos.length > 0 && atual?.desfecho === undefined) {
        enviar({ type: 'danca.colegas', sessao: SESSAO, playerId: c.playerId, eventos, placar: { precisao: c.precisao, combo: c.combo, vida: 70, julgadas: c.julgadas } })
      }
    }
  }, 250)
  timers.push(id)
}

/** Toca as setas deste jogador por teclado, na hora em que cada uma soa. */
function autoTocar(dif: DificuldadeDanca): void {
  difDoAuto = dif
  for (const n of notasDaMusica({ tipo: 'demo' }, dif, PINO)) {
    const quando = inicioMs + n.t * 1000 - performance.now()
    if (quando < 0) continue
    timersDoAuto.push(window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: TECLA[n.lane] })), quando))
    timersDoAuto.push(window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: TECLA[n.lane] })), quando + Math.max(80, n.len * 1000)))
  }
}

const acoes: AcoesDaDanca = {
  dancaPronto(dif) {
    if (atual === undefined) return false
    mudar({ ...atual, pronto: dif })
    enviar({ type: 'danca.estado', sessao: SESSAO, fase: 'convite', participantes: [{ playerId: 'eu', status: 'pronto' }, { playerId: 'iara', status: 'pronto' }, { playerId: 'tome', status: 'convidado' }] })
    return true
  },
  dancaToques() {
    window.__vitrine.lotes += 1
    return true
  },
  dancaFim(placar) {
    window.__vitrine.fim = placar
    if (atual !== undefined) mudar({ ...atual, fimEnviado: true })
    enviar({ type: 'danca.estado', sessao: SESSAO, fase: 'musica', participantes: [{ playerId: 'eu', status: 'terminou' }, { playerId: 'iara', status: 'dancando' }, { playerId: 'tome', status: 'dancando' }] })
    // Os outros terminam quando a última seta deles passa (mais um respiro).
    const espera = Math.max(1200, inicioMs + (fimDosBots + 1.5) * 1000 - performance.now())
    if (parametros.get('desfecho') !== '0') timers.push(window.setTimeout(() => window.__vitrine.desfecho(), espera))
    return true
  },
  fecharDanca() {
    for (const id of timers) window.clearTimeout(id)
    mudar(undefined)
  },
}

window.__vitrine = {
  lotes: 0,
  fim: null,
  comecar() {
    const dif = atual?.pronto ?? 'diversao'
    enviar({ type: 'danca.comecar', sessao: SESSAO, emMs: 3000, participantes: [{ ...EU, dificuldade: dif }, ...COLEGAS.map(({ playerId, nome, dificuldade }) => ({ playerId, nome, dificuldade }))] })
    inicioMs = (atual?.comecar?.recebidoEm ?? performance.now()) + 3000
    simularColegas()
    if (parametros.get('auto') === '1') autoTocar(dif)
  },
  pausar() {
    enviar({ type: 'danca.pausa', sessao: SESSAO })
    for (const id of timersDoAuto) window.clearTimeout(id)
    timersDoAuto.length = 0
    pausaEm = performance.now()
  },
  retomar() {
    enviar({ type: 'danca.retoma', sessao: SESSAO })
    // A música volta depois do 3-2-1 (3 x 450 ms): o resto das setas anda o tempo parado.
    inicioMs += performance.now() + 1350 - pausaEm
    if (difDoAuto !== null) autoTocar(difDoAuto)
  },
  encerrar: (motivo) => enviar({ type: 'danca.encerra', sessao: SESSAO, motivo }),
  desfecho() {
    const fim = window.__vitrine.fim
    const minha: DancaLinhaDaMesa = { playerId: 'eu', nome: EU.nome, letra: fim === null ? 'Saiu' : fim.falhou ? 'Falhou' : fim.letra, precisao: fim?.precisao ?? 0 }
    const mesa = [minha, ...COLEGAS.map((c) => ({ playerId: c.playerId, nome: c.nome, letra: letraDe(c.precisao), precisao: c.precisao }))]
    const passou = fim !== null && !fim.falhou && ['S', 'A', 'B'].includes(fim.letra)
    const todos = passou
    enviar({
      type: 'danca.desfecho',
      sessao: SESSAO,
      todosPassaram: todos,
      portaAberta: todos,
      mesa,
      seu: passou ? { passou, premio: { tipo: 'item', texto: 'Chave de latão' } } : { passou, consequencia: { tipo: 'teste', texto: '−2 no próximo teste de Agilidade' } },
    })
  },
}

function Vitrine() {
  const [, setVersao] = useState(0)
  useEffect(() => {
    const o = (): void => setVersao((v) => v + 1)
    ouvintes.add(o)
    return () => void ouvintes.delete(o)
  }, [])
  if (atual === undefined) {
    return (
      <p style={{ color: '#eceae4', font: '14px system-ui', padding: 24 }}>
        A dança fechou. <button onClick={() => enviarConvite()}>Novo convite</button>
      </p>
    )
  }
  return <DancaOverlay danca={atual} playerId="eu" acoes={acoes} />
}

function enviarConvite(): void {
  enviar({
    type: 'danca.convite',
    sessao: `${SESSAO}`,
    pinId: PINO,
    npc: MINIGAME_PADRAO.npc,
    fala: MINIGAME_PADRAO.fala,
    permitida,
    notaMin: 'B',
    premio: { tipo: 'item', texto: 'Chave de latão' },
    musica: { tipo: 'demo' },
    participantes: [EU, ...COLEGAS.map(({ playerId, nome }) => ({ playerId, nome }))],
  })
}

enviarConvite()
const raiz = document.getElementById('raiz')
if (raiz !== null) createRoot(raiz).render(<Vitrine />)
