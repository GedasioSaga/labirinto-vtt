import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MinigameControls } from '../../../../components/MinigameControls'
import type { PescaAoVivo, PescaParticipanteNoMestre } from '../../../../net/pescaNoHost'
import type { PescaStatus } from '../../../../net/protocoloDaPesca'
import { receberPesca, registrarLance, type PescaDaSessaoMessage, type PescaDoJogador } from '../../../../player/estadoDaPesca'
import { useSomStore } from '../../../../stores/somStore'
import { themeCss } from '../../../../theme'
import type { MinigameDoPino } from '../../../tipos'
import { DIF, DT, PEIXES, politicaSegue, type Politica } from '../../sim'
import { MINIGAME_PESCA_PADRAO, type DificuldadePesca, type MinigamePesca } from '../../tipos'
import { AMBIENTE_DO_NAVEGADOR, MotorDaPesca, type AmbienteDaPesca } from '../motor'
import { desfechoDe, PescaOverlay, type AcoesDaPesca } from '../PescaOverlay'

/**
 * VITRINE DA PESCA — só para desenvolvimento e provas, fora do build (não está
 * nas entradas do vite.config.ts). Um mestre de mentira manda as mensagens de
 * verdade pelo mesmo `receberPesca` da conexão; Iara e Tomé aparecem pelo
 * `pesca.estado`. Telas sem rede:
 *
 *   npm run dev  ->  http://localhost:1420/src/minigames/pesca/tela/vitrine/vitrine.html
 *   ?tela=convite (padrão) | jogo | resultado | cesto | mestre
 *   ?auto=1  o robô joga em tempo real (lança, fisga e segue o peixe); &parar=1 para no resultado
 *   ?lances=3 &permitida=escolha|normal|extremo &dif=normal|extremo &mudo=1 &pausa=1
 *   window.__vitrinePesca.pausar() / retomar() / encerrar() / medida()
 */

const parametros = new URLSearchParams(location.search)
const tela = parametros.get('tela') ?? 'convite'
const auto = parametros.get('auto') === '1' || tela === 'jogo'
const SESSAO = 'vitrine'
const PINO = 'pino-poco-afogado'
const EU = { playerId: 'eu', nome: 'Gedasio' }
const COLEGAS = [
  { playerId: 'iara', nome: 'Iara' },
  { playerId: 'tome', nome: 'Tomé' },
]
const lances = Math.min(5, Math.max(1, Number(parametros.get('lances') ?? '3') || 3))
const permitida = (parametros.get('permitida') ?? 'escolha') as MinigamePesca['permitida']
const difInicial: DificuldadePesca = parametros.get('dif') === 'extremo' ? 'extremo' : 'normal'

const estilo = document.createElement('style')
estilo.textContent = themeCss()
document.head.append(estilo)
if (parametros.get('mudo') === '1') useSomStore.setState({ mudo: true })

// ------------------------------------------------------------------ o mestre de mentira

let atual: PescaDoJogador | undefined
const ouvintes = new Set<() => void>()
function emitir(): void {
  for (const o of ouvintes) o()
}
function enviar(msg: PescaDaSessaoMessage): void {
  atual = receberPesca(atual, msg, performance.now())
  emitir()
}
function estado(meu: PescaStatus): void {
  enviar({
    type: 'pesca.estado',
    sessao: SESSAO,
    fase: atual?.pausada === true ? 'pausa' : 'aberta',
    participantes: [
      { ...EU, status: meu },
      { ...COLEGAS[0], status: 'pescando' },
      { ...COLEGAS[1], status: 'terminou' },
    ],
  })
}
function convidar(): void {
  const m = MINIGAME_PESCA_PADRAO
  enviar({ type: 'pesca.convite', sessao: SESSAO, pinId: PINO, npc: m.npc, fala: m.fala, lago: m.lago, lances, permitida, premio: m.premio, consequencia: m.consequencia, participantes: [EU, ...COLEGAS] })
  estado('convidado')
}

let ultimoVivo = 0
const vivos: unknown[] = []
const acoes: AcoesDaPesca = {
  prontoPesca(dificuldade) {
    if (atual === undefined || atual.pronto !== undefined) return false
    atual = { ...atual, pronto: dificuldade }
    estado('pescando')
    return true
  },
  vivoPesca(vivo) {
    const agora = performance.now()
    if (agora - ultimoVivo < 250) return false
    ultimoVivo = agora
    vivos.push(vivo)
    return true
  },
  lancePesca(lance) {
    if (atual === undefined) return false
    const registrada = registrarLance(atual, lance)
    if (registrada === null) return false
    atual = registrada
    emitir()
    return true
  },
  fimPesca() {
    if (atual === undefined) return false
    atual = { ...atual, fimEnviado: true }
    estado('terminou')
    return true
  },
  fecharPesca() {
    atual = undefined
    emitir()
    // A vitrine volta ao convite, para dar de novo.
    window.setTimeout(convidar, 600)
  },
}

// ------------------------------------------------------------------ o robô

const ALVO_DA_FORCA = 0.82
const REACAO_S = 0.18

/** O robô de tempo real: um passo por quadro, pelo estado do motor. */
function criarRobo(): (m: MotorDaPesca, agora: number) => void {
  let politica: Politica = politicaSegue(0.12)
  let faseAnt = ''
  let noResultadoDesde = 0
  return (m, agora) => {
    const J = m.J
    if (J.fase !== faseAnt) {
      if (J.fase === 'puxada') politica = politicaSegue(0.12)
      if (J.fase === 'resultado') noResultadoDesde = agora
      faseAnt = J.fase
    }
    if (J.fase === 'lance') {
      if (!J.carregando && J.tFase > 0.4) m.apertar('robo')
      else if (J.carregando && J.forca >= ALVO_DA_FORCA) m.soltar('robo')
    } else if (J.fase === 'fisgada') {
      if (J.tFase > REACAO_S && !m.segurando) m.apertar('robo')
    } else if (J.fase === 'puxada' && J.puxada !== null) {
      const quer = politica(J.puxada)
      if (quer && !m.segurando) m.apertar('robo')
      else if (!quer && m.segurando) m.soltar('robo')
    } else if (m.segurando) m.soltar('robo')
    if (J.fase === 'resultado' && parametros.get('parar') !== '1' && agora - noResultadoDesde > 1500) {
      noResultadoDesde = agora
      document.querySelector<HTMLButtonElement>('.pz-tela--resultado .pz-btn--primario')?.click()
    }
  }
}

/** Um lance inteiro, sem tempo real: para abrir a vitrine já no resultado ou no cesto. */
function jogarLance(m: MotorDaPesca, dif: DificuldadePesca): void {
  m.apertar('robo')
  m.rodar(DIF[dif].ciclo * ALVO_DA_FORCA)
  m.soltar('robo')
  for (let i = 0; i < 4000 && m.J.fase !== 'fisgada'; i++) m.rodar(DT * 6)
  m.rodar(REACAO_S * 0.8)
  m.apertar('robo')
  m.soltar('robo')
  const politica = politicaSegue(0.12)
  for (let i = 0; i < 4000 && m.J.fase === 'puxada'; i++) m.rodar(DT * 12, politica)
  for (let i = 0; i < 100 && m.J.fase === 'final'; i++) m.rodar(0.1)
}

const robo = criarRobo()
let motor: MotorDaPesca | null = null
const ambiente: AmbienteDaPesca = {
  ...AMBIENTE_DO_NAVEGADOR,
  quadro: (f) =>
    requestAnimationFrame((agora) => {
      if (auto && motor !== null) robo(motor, agora)
      f(agora)
    }),
}
motor = new MotorDaPesca(ambiente, matchMedia('(prefers-reduced-motion: reduce)').matches)

// ------------------------------------------------------------------ medida do quadro

let tarefasLongas = 0
try {
  new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) if (e.duration >= 200) tarefasLongas++
  }).observe({ type: 'longtask', buffered: true })
} catch {
  // Navegador sem longtask: a medida diz só o quadro.
}

function p95(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.floor(o.length * 0.95))]
}

interface VitrineDaPesca {
  motor: MotorDaPesca
  vivos: unknown[]
  pausar(): void
  retomar(): void
  encerrar(): void
  medida(): { quadros: number; p95IntervaloMs: number; p95TrabalhoMs: number; maxTrabalhoMs: number; tarefasLongas200: number }
}

// `window.__vitrine` já é da vitrine da dança (outro tipo): a da pesca mora em `__vitrinePesca`.
const vitrine: VitrineDaPesca = {
  motor,
  vivos,
  pausar: () => atual !== undefined && enviar({ type: 'pesca.pausa', sessao: SESSAO }),
  retomar: () => atual !== undefined && enviar({ type: 'pesca.retoma', sessao: SESSAO }),
  encerrar: () => atual !== undefined && enviar({ type: 'pesca.encerra', sessao: SESSAO, motivo: 'mestre' }),
  medida: () => {
    const { intervalos, trabalho } = vitrine.motor.amostras
    return {
      quadros: intervalos.length,
      p95IntervaloMs: Math.round(p95(intervalos) * 100) / 100,
      p95TrabalhoMs: Math.round(p95(trabalho) * 100) / 100,
      maxTrabalhoMs: Math.round(Math.max(0, ...trabalho) * 100) / 100,
      tarefasLongas200: tarefasLongas,
    }
  },
}
Reflect.set(window, '__vitrinePesca', vitrine)

// ------------------------------------------------------------------ telas

function Jogador() {
  const [, setN] = useState(0)
  useEffect(() => {
    const o = (): void => setN((n) => n + 1)
    ouvintes.add(o)
    return () => {
      ouvintes.delete(o)
    }
  }, [])
  useEffect(() => {
    // O cesto vem do "Ver o cesto" do último resultado, como o jogador faria.
    if (tela === 'cesto') document.querySelector<HTMLButtonElement>('.pz-tela--resultado .pz-btn--primario')?.click()
  }, [])
  if (atual === undefined || motor === null) return null
  return <PescaOverlay pesca={atual} playerId={EU.playerId} acoes={acoes} ambiente={ambiente} motor={motor} armazem={null} />
}

const peixe = (i: number, cm: number, estrelas: number) => ({ peixe: PEIXES[i].id, cm, estrelas, perfeito: false, bau: false })

function participantes(medidor: number): PescaParticipanteNoMestre[] {
  const robalo = peixe(1, 41, 2)
  const bagre = peixe(0, 28, 1)
  const grande = peixe(4, 96, 3)
  return [
    { playerId: 'eu', nome: 'Gedasio', status: 'pescando', conectado: true, dificuldade: 'normal', vivo: { fase: 'puxada', lance: 2, de: 3, medidor }, lances: [{ lance: 1, resultado: 'pegou', peixe: robalo }], cesto: [robalo], maior: robalo },
    { playerId: 'iara', nome: 'Iara', status: 'pescando', conectado: true, dificuldade: 'extremo', vivo: { fase: 'espera', lance: 1, de: 3, medidor: 0 }, lances: [], cesto: [] },
    { playerId: 'tome', nome: 'Tomé', status: 'terminou', conectado: true, dificuldade: 'normal', lances: [{ lance: 1, resultado: 'pegou', peixe: bagre }, { lance: 2, resultado: 'escapou' }, { lance: 3, resultado: 'pegou', peixe: grande }], cesto: [bagre, grande], maior: grande },
    { playerId: 'bia', nome: 'Bartolomeu de Albuquerque', status: 'convidado', conectado: false, lances: [], cesto: [] },
  ]
}

function Mestre() {
  const [minigame, setMinigame] = useState<MinigameDoPino>(MINIGAME_PESCA_PADRAO)
  const [medidor, setMedidor] = useState(0.63)
  const [fase, setFase] = useState<PescaAoVivo['fase']>('aberta')
  useEffect(() => {
    const id = window.setInterval(() => setMedidor((m) => Math.min(1, Math.max(0, m + (Math.random() - 0.45) * 0.12))), 250)
    return () => window.clearInterval(id)
  }, [])
  const pesca: PescaAoVivo = { sessao: SESSAO, pinId: PINO, npc: MINIGAME_PESCA_PADRAO.npc, lago: MINIGAME_PESCA_PADRAO.lago, entrada: 'mestre', lances: 3, fase, participantes: participantes(medidor) }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
      <div className="lb-panel" style={{ width: 'min(100%, 340px)', padding: 16, borderRadius: 14, background: 'var(--lb-color-stone)', border: '1px solid var(--lb-color-line-panel)' }}>
        <MinigameControls
          pinId={PINO}
          minigame={minigame}
          onChange={setMinigame}
          porta={{ value: null, options: [], onChange: () => undefined }}
          aoVivo={null}
          aoVivoDaPesca={{
            players: [
              { playerId: 'eu', name: 'Gedasio' },
              { playerId: 'joao', name: 'João' },
            ],
            pesca,
            onConvidar: (ids) => ({ ok: true, sessao: SESSAO, convidados: ids.length }),
            onPausar: () => {
              setFase('pausa')
              return true
            },
            onRetomar: () => {
              setFase('aberta')
              return true
            },
            onEncerrar: () => {
              setFase('encerrada')
              return true
            },
          }}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ começo

async function comecar(): Promise<void> {
  const raiz = document.getElementById('raiz')
  if (raiz === null) return
  // Sem exports, o Fast Refresh trata este arquivo como fronteira e o roda de
  // novo ao editar um componente importado: aí a página recarrega inteira, em
  // vez de montar uma segunda raiz sobre a primeira.
  if (Reflect.get(window, '__vitrinePescaMontada') === true) {
    location.reload()
    return
  }
  Reflect.set(window, '__vitrinePescaMontada', true)
  if (tela === 'mestre') {
    await import('../../../../main.css')
    createRoot(raiz).render(<Mestre />)
    return
  }
  convidar()
  if (parametros.get('pausa') === '1') enviar({ type: 'pesca.pausa', sessao: SESSAO })
  if ((tela === 'jogo' || tela === 'resultado' || tela === 'cesto') && motor !== null) {
    acoes.prontoPesca(difInicial)
    const m = motor
    const base = `${PINO}|${SESSAO}|${EU.playerId}`
    m.comecar(difInicial, lances, base)
    if (tela !== 'jogo') {
      m.ganchos = { ...m.ganchos, fimDoLance: (r) => void acoes.lancePesca({ lance: r.lance, ...desfechoDe(r) }) }
      const quantos = tela === 'cesto' ? lances : 1
      for (let k = 0; k < quantos; k++) {
        if (k > 0) m.proximoLance()
        jogarLance(m, difInicial)
      }
      if (tela === 'cesto') acoes.fimPesca()
    }
  }
  createRoot(raiz).render(<Jogador />)
}

void comecar()
