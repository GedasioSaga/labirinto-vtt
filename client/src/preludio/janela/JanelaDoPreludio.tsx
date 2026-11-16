import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LigaCena } from '../../lib/preparo/tipos'
import { abrirCanalDoNavegador } from '../../net/visaoDeTeste/canal'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { usePreludio } from '../estado/preludio'
import { TelaDoPreludio } from '../TelaDoPreludio'
import { ligarFioDoPreludio, type FioDoPreludio } from './fioDaJanela'
import { aoPondo, definirFioDaMesa, useMesaNaJanela } from './mesaNaJanela'
import { definirAvisoDeMudanca } from './mudancas'
import { nomeDoCanal, type AbaDoVerbete, type EstadoDaMesa } from './protocolo'
import './janela.css'

/**
 * A JANELA DO PRELÚDIO (P1): a faixa "Mesa" (o que está em jogo na janela
 * principal) em cima e o Prelúdio inteiro embaixo. Os links de cena e pino
 * pedem à mesa que leve o mapa até lá; o "Abrir no Prelúdio" da mesa traz um
 * verbete (a sessão, com o quadro dela) para a frente.
 */

/** Gravar não pode segurar a janela: passado isto, ela fecha avisando. */
const ESPERA_PARA_GRAVAR_MS = 4000
const AINDA_GRAVANDO = 'O Prelúdio ainda está gravando as últimas mudanças.'
const FALTOU = 'Uma mudança do Prelúdio ainda não foi para o disco.'

/** Tira o foco do campo (o editor segura o texto 250 ms) e grava tudo. `null` = tudo no disco. */
async function salvarTudo(): Promise<string | null> {
  const ativo = document.activeElement instanceof HTMLElement ? document.activeElement : null
  ativo?.blur()
  let relogio: ReturnType<typeof setTimeout> | undefined
  const prazo = new Promise<string>((resolver) => {
    relogio = setTimeout(() => resolver(AINDA_GRAVANDO), ESPERA_PARA_GRAVAR_MS)
  })
  try {
    const gravou = await Promise.race([usePreludio.getState().salvarPendentes(), prazo])
    if (gravou === true) return null
    if (gravou === false) {
      const salvamento = usePreludio.getState().salvamento
      return salvamento.t === 'falhou' ? salvamento.motivo : FALTOU
    }
    return gravou
  } finally {
    clearTimeout(relogio)
    if (ativo?.isConnected === true) ativo.focus({ preventScroll: true })
  }
}

/**
 * Leva o Prelúdio ao verbete; espera a leitura do disco, se ainda está lendo.
 * `decidir` não mexe na loja: o `ir` muda a loja, e a loja avisa quem escuta na
 * hora, então a ação só roda depois de parar de escutar (senão uma chama a outra sem fim).
 */
/** A seção do pino ligado (P3): rola até ela e a marca por um instante, depois que a página desenha. */
function marcarSecao(secaoId: string): void {
  let tentativas = 0
  const procurar = () => {
    const secao = document.querySelector<HTMLElement>(`[data-secao-id="${CSS.escape(secaoId)}"]`)
    if (secao === null) {
      tentativas += 1
      if (tentativas < MARCAR_TENTATIVAS) requestAnimationFrame(procurar)
      return
    }
    secao.scrollIntoView({ block: 'center' })
    secao.classList.add('e-marcada')
    setTimeout(() => secao.classList.remove('e-marcada'), MARCADA_MS)
  }
  requestAnimationFrame(procurar)
}

/** Quantos quadros esperar a seção aparecer (as seções de um verbete grande entram uma por quadro). */
const MARCAR_TENTATIVAS = 60
const MARCADA_MS = 2000

function irAoVerbete(verbeteId: string, aba: AbaDoVerbete | null, avisar: (aviso: string | null) => void, secaoId: string | null = null): void {
  const decidir = (): (() => void) | null => {
    const { carga, verbetes, ir } = usePreludio.getState()
    if (carga.t === 'falhou') return () => undefined
    if (carga.t !== 'pronta') return null
    const verbete = verbetes.get(verbeteId)
    if (verbete === undefined) return () => avisar('Este verbete não existe mais no Prelúdio.')
    return () => {
      if (verbete.tipo === 'sessao') ir(aba === null ? { secao: 'sessoes', sessaoId: verbeteId } : { secao: 'sessoes', sessaoId: verbeteId, aba })
      else ir(lugarDoVerbete(verbete, verbetes))
      avisar(null)
      if (secaoId !== null) marcarSecao(secaoId)
    }
  }
  const agora = decidir()
  if (agora !== null) {
    agora()
    return
  }
  const parar = usePreludio.subscribe(() => {
    const acao = decidir()
    if (acao === null) return
    parar()
    acao()
  })
}

function textoDaMesa(estado: EstadoDaMesa | null): string {
  if (estado === null || estado.mapa === null) return 'Nenhum mapa aberto na janela principal.'
  const onde = estado.cena === null ? estado.mapa.nome : `${estado.mapa.nome}, cena ${estado.cena.nome}`
  return estado.pino === null ? `${onde}.` : `${onde}. No mapa, selecionado: ${estado.pino.nome}.`
}

function FaixaDaMesa({ estado, viva, aviso }: { estado: EstadoDaMesa | null; viva: boolean; aviso: string | null }) {
  return (
    <div className={`pr-mesa-agora${viva ? '' : ' pr-mesa-agora--longe'}`} role="status" aria-live="polite">
      <span className="pr-mesa-agora__ponto" aria-hidden="true" />
      <span className="pr-mesa-agora__txt">
        <b>Mesa:</b> {viva ? textoDaMesa(estado) : 'a janela principal não está respondendo.'}
      </span>
      {aviso !== null && <span className="pr-mesa-agora__aviso">{aviso}</span>}
    </div>
  )
}

export function JanelaDoPreludio({ sessao }: { sessao: string }) {
  const [estado, setEstado] = useState<EstadoDaMesa | null>(null)
  const [viva, setViva] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const fio = useRef<FioDoPreludio | null>(null)

  useEffect(() => {
    const canal = abrirCanalDoNavegador(nomeDoCanal(sessao))
    useMesaNaJanela.setState({ ligada: true })
    const ligado = ligarFioDoPreludio({
      sessao,
      canal,
      aoEstado: (novo) => {
        setEstado(novo)
        useMesaNaJanela.setState({ estado: novo })
      },
      aoViva: (agora) => {
        setViva(agora)
        useMesaNaJanela.setState({ viva: agora })
      },
      aoAviso: setAviso,
      aoAbrirVerbete: (verbeteId, aba, secaoId) => irAoVerbete(verbeteId, aba, setAviso, secaoId),
      aoPondo,
      aoNaMesa: (itens) => useMesaNaJanela.setState({ naMesa: itens }),
      aoMudar: (mudanca) => void usePreludio.getState().relerDoDisco(mudanca),
      salvarTudo,
    })
    fio.current = ligado
    definirFioDaMesa(ligado)
    definirAvisoDeMudanca((mudanca) => ligado.avisarMudanca(mudanca))
    return () => {
      definirAvisoDeMudanca(null)
      definirFioDaMesa(null)
      fio.current = null
      ligado.desligar()
      canal.fechar()
    }
  }, [sessao])

  // O X desta janela grava antes; se algo não gravou, avisa uma vez e o segundo X fecha.
  const jaAvisou = useRef(false)
  useEffect(() => {
    if (!isTauri()) return
    let parar: (() => void) | null = null
    let desmontou = false
    getCurrentWindow()
      .onCloseRequested(async (pedido) => {
        const motivo = await salvarTudo()
        if (motivo === null || jaAvisou.current) return
        jaAvisou.current = true
        pedido.preventDefault()
        setAviso(`${motivo} Feche de novo para sair mesmo assim.`)
      })
      .then((desligar) => {
        if (desmontou) desligar()
        else parar = desligar
      })
      .catch(() => undefined)
    return () => {
      desmontou = true
      parar?.()
    }
  }, [])

  const irAMesa = useCallback((alvo: LigaCena) => fio.current?.irAMesa(alvo), [])

  return (
    <div className="pr-janela">
      <FaixaDaMesa estado={estado} viva={viva} aviso={aviso} />
      <div className="pr-janela__tela">
        <TelaDoPreludio naJanela onBack={() => undefined} aoAbrirNaMesa={irAMesa} />
      </div>
    </div>
  )
}
