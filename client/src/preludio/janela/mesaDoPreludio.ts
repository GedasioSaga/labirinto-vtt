import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { PAGINA_DA_JANELA_DO_PRELUDIO, SESSAO_DA_JANELA_VALIDA } from '../../lib/janelaDoPreludio'
import { abrirCanalDoNavegador, type Canal } from '../../net/visaoDeTeste/canal'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { registrarSalvarNaJanela } from '../aoFechar'
import { usePreludio } from '../estado/preludio'
import { definirAvisoDeMudanca } from './mudancas'
import { marcarJanelaDoPreludio, type DepsDaMesa, type FocoNoPreludio } from './portaDaJanela'
import { lerPedidoDoPreludio, nomeDoCanal, nomeParaOFio, recadoDaMesa, type CorpoDoRecado, type EstadoDaMesa, type PedidoDoPreludio } from './protocolo'

/**
 * O FIO, VISTO DA MESA (a janela principal). Baixa no primeiro "Abrir o
 * Prelúdio" e vive enquanto a principal viver.
 *
 * - Abre a janela pelo Rust (`abrir_janela_preludio`), ou um popup no navegador.
 * - Confere cada pedido do Prelúdio (`lerPedidoDoPreludio`) e só então aplica:
 *   o `ir-a-mesa` passa pela mesma porta dos links do Livro do mestre.
 * - Conta ao Prelúdio o mapa, a cena e o pino selecionado, só quando mudam.
 * - Repassa o que a principal gravou em preparo/ (o Revelar do Livro), e relê
 *   o que o Prelúdio gravou.
 * - Fechar a principal pede à janela que grave antes (`aoFechar.ts`); o Rust
 *   derruba a janela depois.
 */

const CHAVE_DA_SESSAO = 'lb-preludio:sessao-da-janela'
const NOME_DO_POPUP = 'labirinto-preludio'
const EVENTO_FECHADA = 'preludio-janela:fechada'
/** O estado vai no máximo a cada tanto (arrastar a câmera mexe nas lojas o tempo todo). */
const ESTADO_A_CADA_MS = 150
/** Sem `ping` por isto, a janela conta como sumida (fechou no navegador, travou). */
const VIVA_MS = 6000
/** O prazo para a janela gravar ao fechar a principal (o `aoFechar` tem 5 s no total). */
const ESPERA_DA_GRAVACAO_MS = 4500
const VIGIA_DO_POPUP_MS = 500

const NAO_RESPONDEU = 'A janela do Prelúdio não respondeu a tempo: o que ela ainda não gravou pode se perder.'

interface Mesa {
  abrir(foco: FocoNoPreludio | null): Promise<void>
}

let unica: Mesa | null = null
let depsAtuais: DepsDaMesa | null = null

/** A mesa desta janela principal (uma só); `deps` = sempre a mais nova (o App redesenha). */
export function mesaDoPreludio(deps: DepsDaMesa): Mesa {
  depsAtuais = deps
  unica ??= criarMesa(sessaoDaMesa(window.sessionStorage), abrirCanalDoNavegador)
  return unica
}

/** A sessão sobrevive a recarregar a principal: a janela aberta continua no mesmo canal. */
export function sessaoDaMesa(armazenamento: Pick<Storage, 'getItem' | 'setItem'> | null): string {
  try {
    const guardada = armazenamento?.getItem(CHAVE_DA_SESSAO) ?? null
    if (guardada !== null && SESSAO_DA_JANELA_VALIDA.test(guardada)) return guardada
  } catch {
    // Sem armazenamento: uma sessão nova a cada abertura da principal.
  }
  const nova = crypto.randomUUID()
  try {
    armazenamento?.setItem(CHAVE_DA_SESSAO, nova)
  } catch {
    // Idem.
  }
  return nova
}

function nomeDoPino(nome: string | undefined, tipo: string): string {
  const limpo = nome?.trim() ?? ''
  if (limpo !== '') return limpo
  return tipo === 'interrogacao' ? 'Pino ?' : tipo === 'exclamacao' ? 'Pino !' : 'Pino sem nome'
}

/** O que está em jogo na mesa agora, no tamanho do fio. */
export function estadoDaMesaAgora(): EstadoDaMesa {
  const { map, selection, selectedPinId } = useMapStore.getState()
  const { adventure, activeSceneId } = useAdventureStore.getState()
  const cena = adventure?.scenes.find((uma) => uma.id === activeSceneId)
  // O pino aberto no painel (`selectedPinId`: clique, "ir ao pino") ou o único item da seleção, se for pino.
  const unico = selection.length === 1 ? selection[0] : undefined
  const pinoId = selectedPinId ?? (unico?.kind === 'pin' ? unico.id : null)
  const pino = pinoId === null ? undefined : map.pins.find((um) => um.id === pinoId)
  return {
    mapa: { nome: nomeParaOFio(map.name.trim() || 'Mapa sem nome') },
    cena: cena === undefined ? null : { id: cena.id, nome: nomeParaOFio(cena.name.trim() || 'Cena sem nome') },
    pino: pino === undefined ? null : { id: pino.id, nome: nomeParaOFio(nomeDoPino(pino.nome, pino.kind)) },
  }
}

function criarMesa(sessao: string, abrirCanal: (nome: string) => Canal): Mesa {
  const canal = abrirCanal(nomeDoCanal(sessao))
  let aberta = false
  let ultimoSinal = Number.NEGATIVE_INFINITY
  let focoPendente: FocoNoPreludio | null = null
  let ultimoEstado = ''
  let relogioDoEstado: ReturnType<typeof setTimeout> | null = null
  let gravacoes = 0
  const esperandoGravacao = new Map<number, (motivo: string | null) => void>()
  let popup: Window | null = null
  let vigiaDoPopup: ReturnType<typeof setInterval> | null = null

  const enviar = (corpo: CorpoDoRecado) => canal.enviar(recadoDaMesa(sessao, corpo))
  const viva = () => Date.now() - ultimoSinal < VIVA_MS

  const mandarEstado = (sempre: boolean) => {
    const estado = estadoDaMesaAgora()
    const texto = JSON.stringify(estado)
    if (!sempre && texto === ultimoEstado) return
    ultimoEstado = texto
    enviar({ tipo: 'estado', estado })
  }
  const agendarEstado = () => {
    if (!aberta || relogioDoEstado !== null) return
    relogioDoEstado = setTimeout(() => {
      relogioDoEstado = null
      mandarEstado(false)
    }, ESTADO_A_CADA_MS)
  }
  const mandarFoco = () => {
    if (focoPendente === null) return
    enviar({ tipo: 'abrir-verbete', verbeteId: focoPendente.verbeteId, aba: focoPendente.aba })
    focoPendente = null
  }

  /** A gravação da janela ao fechar a principal. Janela sumida não tem o que gravar. */
  const salvarNaJanela = (): Promise<string | null> => {
    if (!aberta || !viva()) return Promise.resolve(null)
    gravacoes += 1
    const pedido = gravacoes
    return new Promise((resolver) => {
      const relogio = setTimeout(() => {
        esperandoGravacao.delete(pedido)
        resolver(NAO_RESPONDEU)
      }, ESPERA_DA_GRAVACAO_MS)
      esperandoGravacao.set(pedido, (motivo) => {
        clearTimeout(relogio)
        resolver(motivo)
      })
      enviar({ tipo: 'salvar-agora', pedido })
    })
  }

  const marcarAberta = (estado: boolean) => {
    aberta = estado
    marcarJanelaDoPreludio(estado)
    registrarSalvarNaJanela(estado ? salvarNaJanela : null)
    if (!estado) {
      ultimoSinal = Number.NEGATIVE_INFINITY
      for (const responder of esperandoGravacao.values()) responder(null)
      esperandoGravacao.clear()
    }
  }

  /** A janela apareceu (abriu, recarregou, ou a principal recarregou com ela aberta). */
  const conectou = () => {
    const nova = !viva()
    ultimoSinal = Date.now()
    if (!aberta) marcarAberta(true)
    if (nova) {
      mandarEstado(true)
      mandarFoco()
    }
  }

  const atender = (pedido: PedidoDoPreludio) => {
    switch (pedido.tipo) {
      case 'ola':
        ultimoSinal = Number.NEGATIVE_INFINITY
        conectou()
        return
      case 'ping':
        conectou()
        enviar({ tipo: 'pong', n: pedido.n })
        return
      case 'ir-a-mesa': {
        const deps = depsAtuais
        if (deps === null) {
          enviar({ tipo: 'resposta', pedido: pedido.pedido, ok: false, motivo: 'A mesa ainda não está pronta.' })
          return
        }
        // A mesma porta dos links do Livro: abre o mapa (perguntando antes, se há trabalho não salvo), a cena e o pino.
        deps.abrirNaMesa(pedido.alvo)
        enviar({ tipo: 'resposta', pedido: pedido.pedido, ok: true, motivo: null })
        return
      }
      case 'mudou':
        void usePreludio.getState().relerDoDisco(pedido.mudanca)
        return
      case 'gravou':
        esperandoGravacao.get(pedido.pedido)?.(pedido.motivo)
        esperandoGravacao.delete(pedido.pedido)
        return
    }
  }

  canal.ouvir((dado) => {
    const pedido = lerPedidoDoPreludio(dado, sessao)
    if (pedido !== null) atender(pedido)
  })

  // O Revelar do Livro do mestre (e o resto que a principal grava em preparo/) vai à janela.
  definirAvisoDeMudanca((mudanca) => {
    if (aberta) enviar({ tipo: 'mudou', mudanca })
  })

  // Só mexe no fio quando o que a faixa mostra pode ter mudado (arrastar token troca o mapa, não os pinos).
  let referencias: readonly unknown[] = []
  const conferirLojas = () => {
    if (!aberta) return
    const { map, selection, selectedPinId } = useMapStore.getState()
    const { adventure, activeSceneId } = useAdventureStore.getState()
    const agora = [map.name, map.pins, selection, selectedPinId, adventure, activeSceneId]
    if (agora.length === referencias.length && agora.every((valor, indice) => valor === referencias[indice])) return
    referencias = agora
    agendarEstado()
  }
  useMapStore.subscribe(conferirLojas)
  useAdventureStore.subscribe(conferirLojas)

  const pararDeVigiarPopup = () => {
    if (vigiaDoPopup !== null) clearInterval(vigiaDoPopup)
    vigiaDoPopup = null
  }

  if (isTauri()) {
    // O X do sistema na janela do Prelúdio. Se uma janela nova abrir logo depois, o `ola` dela marca de novo.
    listen(EVENTO_FECHADA, () => marcarAberta(false)).catch(() => {
      // Sem o evento, a faixa e o aviso ao fechar só param pelo prazo do ping.
    })
  }

  const abrirNoNavegador = () => {
    const aberto = window.open(`${PAGINA_DA_JANELA_DO_PRELUDIO}?sessao=${encodeURIComponent(sessao)}`, NOME_DO_POPUP, 'popup,width=1280,height=820')
    if (aberto === null) throw new Error('o navegador bloqueou a janela nova')
    aberto.focus()
    popup = aberto
    pararDeVigiarPopup()
    vigiaDoPopup = setInterval(() => {
      if (popup !== aberto || !aberto.closed) return
      pararDeVigiarPopup()
      popup = null
      marcarAberta(false)
    }, VIGIA_DO_POPUP_MS)
  }

  return {
    async abrir(foco) {
      if (foco !== null) focoPendente = foco
      try {
        if (isTauri()) await invoke<boolean>('abrir_janela_preludio', { sessao })
        else if (popup === null || popup.closed) abrirNoNavegador()
        else popup.focus()
      } catch (erro) {
        depsAtuais?.avisar(`O Prelúdio não abriu em janela: ${erro instanceof Error ? erro.message : String(erro)}`)
        return
      }
      marcarAberta(true)
      // Janela já conversando: o foco vai já. Janela nascendo: vai no `ola` dela.
      if (viva()) mandarFoco()
    },
  }
}
