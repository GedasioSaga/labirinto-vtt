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
import { PIN_NOME_MAX_LENGTH } from '../../lib/pins'
import { quemDizEmDia, situacaoDaFonte } from '../../lib/preparo/pinoLigado'
import { comecarColocacao, definirFimDaColocacao, terminarColocacao, useColocacaoDoPreludio } from '../../stores/colocacaoDoPreludio'
import { sceneMaps } from '../../stores/adventureStore'
import { mapaNaMemoriaAgora } from '../mesa/catalogo'
import { lerCenarioAgora, type FimDoLerAgora } from '../../stores/mesaDoPino'
import type { LigaCena, LigaFicha } from '../../lib/preparo/tipos'
import type { Pin } from '../../types/map'
import { gravarFichaPelaMesa, prepararVerbeteNaMesa } from './verbeteNaMesa'
import {
  idDoMapaParaOFio,
  lerPedidoDoPreludio,
  lerSecaoParaOMapa,
  motivoParaOFio,
  NA_MESA_MAX,
  nomeDoCanal,
  nomeParaOFio,
  recadoDaMesa,
  type ComoVaiAoMapa,
  type CorpoDoRecado,
  type EstadoDaMesa,
  type ItemNaMesa,
  type PedidoDoPreludio,
  type SecaoParaOMapa,
  type TipoParaOMapa,
  type VerbeteParaOMapa,
} from './protocolo'

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
    mapa: { nome: nomeParaOFio(map.name.trim() || 'Mapa sem nome'), chave: idDoMapaParaOFio(mapaNaMemoriaAgora()?.chave) },
    cena: cena === undefined ? null : { id: cena.id, nome: nomeParaOFio(cena.name.trim() || 'Cena sem nome') },
    pino: pino === undefined ? null : { id: pino.id, nome: nomeParaOFio(nomeDoPino(pino.nome, pino.kind)) },
  }
}

/** As seções do Prelúdio que um pino usa: a dele (P3) e as das entradas do "?" (P5), sem repetir, no tamanho do fio. */
function secoesDoPino(pin: Pin): SecaoParaOMapa[] {
  const secoes: SecaoParaOMapa[] = []
  const vistas = new Set<string>()
  for (const fonte of [pin.fonte, ...(pin.falas ?? []).map((fala) => fala.fonte)]) {
    const noFio = fonte === undefined ? null : lerSecaoParaOMapa(fonte)
    if (noFio === null) continue
    const chave = `${noFio.verbeteId}\n${noFio.formaId}\n${noFio.secaoId}`
    if (vistas.has(chave)) continue
    vistas.add(chave)
    secoes.push(noFio)
  }
  return secoes
}

/**
 * "NA MESA" (P3): os pinos ligados a uma seção do Prelúdio, no mapa aberto e
 * nas cenas dele que estão na memória, no tamanho do fio. O "?" com entradas
 * ligadas (P5) aparece uma vez por seção. Pino com id que não cabe no fio fica
 * de fora (a lista inteira seria recusada do outro lado).
 */
export function itensNaMesaAgora(): ItemNaMesa[] {
  const chave = idDoMapaParaOFio(mapaNaMemoriaAgora()?.chave)
  if (chave === null) return []
  const aventura = useAdventureStore.getState()
  const nomeDaCena = (sceneId: string) => aventura.adventure?.scenes.find((cena) => cena.id === sceneId)?.name ?? ''
  const itens: ItemNaMesa[] = []
  for (const [sceneId, mapa] of sceneMaps(aventura, useMapStore.getState().map)) {
    for (const pin of mapa.pins) {
      // A cena vai como está ('' = mapa sem cenas): id torto não vai, senão o link não acharia a cena.
      if (idDoMapaParaOFio(pin.id) === null || (sceneId !== '' && idDoMapaParaOFio(sceneId) === null)) continue
      for (const fonteNoFio of secoesDoPino(pin)) {
        itens.push({
          pinoId: pin.id,
          nome: nomeParaOFio(nomeDoPino(pin.nome, pin.kind)),
          kind: pin.kind === 'exclamacao' || pin.kind === 'interrogacao' ? pin.kind : 'outro',
          chave,
          sceneId,
          cena: nomeParaOFio(nomeDaCena(sceneId)),
          ...fonteNoFio,
        })
        if (itens.length >= NA_MESA_MAX) return itens
      }
    }
  }
  return itens
}

/**
 * "LER AGORA" pedido pelo Prelúdio (P4): só um "!" do mapa ABERTO (a mesma
 * chave), achado pela cena e pelo id. O texto é o do pino (a cópia em dia da
 * seção), nunca o que viesse pelo fio; quem confere a cena de cada jogador é o host.
 */
export function lerAgoraPeloPreludio(alvo: LigaCena): FimDoLerAgora {
  const chave = idDoMapaParaOFio(mapaNaMemoriaAgora()?.chave)
  if (chave === null || chave !== alvo.chave) return { ok: false, motivo: 'Este pino não está no mapa aberto. Use Mostrar no mapa antes.' }
  let pin: Pin | undefined
  for (const [sceneId, mapa] of sceneMaps(useAdventureStore.getState(), useMapStore.getState().map)) {
    if (sceneId === alvo.sceneId) pin = mapa.pins.find((um) => um.id === alvo.pinoId)
  }
  if (pin === undefined) return { ok: false, motivo: 'O pino não está mais no mapa.' }
  if (pin.kind !== 'exclamacao') return { ok: false, motivo: 'Ler agora é do ! (cenário).' }
  return lerCenarioAgora(pin, null)
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

  let ultimosNaMesa = ''
  const mandarEstado = (sempre: boolean) => {
    const estado = estadoDaMesaAgora()
    const texto = JSON.stringify(estado)
    if (sempre || texto !== ultimoEstado) {
      ultimoEstado = texto
      enviar({ tipo: 'estado', estado })
    }
    // "Na mesa" (P3): os pinos ligados do mapa aberto, só quando mudam.
    const itens = itensNaMesaAgora()
    const textoDosItens = JSON.stringify(itens)
    if (!sempre && textoDosItens === ultimosNaMesa) return
    ultimosNaMesa = textoDosItens
    enviar({ tipo: 'na-mesa', itens })
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
    enviar({ tipo: 'abrir-verbete', verbeteId: focoPendente.verbeteId, aba: focoPendente.aba, secaoId: focoPendente.secaoId ?? null })
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
      case 'por-no-mapa':
        void porNoMapa(pedido.pedido, pedido.fonte, pedido.kind)
        return
      case 'cancelar-por':
        if (useColocacaoDoPreludio.getState().pendente?.pedido === pedido.pedido) terminarColocacao('cancelado')
        return
      case 'ler-agora': {
        const fim = lerAgoraPeloPreludio(pedido.alvo)
        enviar({ tipo: 'resposta', pedido: pedido.pedido, ok: fim.ok, motivo: fim.ok ? null : motivoParaOFio(fim.motivo) })
        return
      }
      case 'por-verbete':
        void porVerbeteNoMapa(pedido.pedido, pedido.fonte, pedido.como, pedido.ficha)
        return
      case 'gravar-ficha': {
        const numero = pedido.pedido
        void gravarFichaPelaMesa(pedido.pastaId, pedido.personagem).then((motivo) =>
          enviar({ tipo: 'resposta', pedido: numero, ok: motivo === null, motivo: motivo === null ? null : motivoParaOFio(motivo) }),
        )
        return
      }
    }
  }

  /** "PÔR NO MAPA" POR TIPO (E3): a mesa prepara o verbete inteiro (`verbeteNaMesa.ts`) e põe a ferramenta na mão. */
  const porVerbeteNoMapa = async (pedido: number, fonte: VerbeteParaOMapa, como: ComoVaiAoMapa, ficha: LigaFicha | null) => {
    const preparado = await prepararVerbeteNaMesa(fonte, como, ficha)
    if (!preparado.ok) {
      enviar({ tipo: 'pondo', pedido, andamento: 'recusado', motivo: motivoParaOFio(preparado.motivo) })
      return
    }
    comecarColocacao({ pedido, kind: 'exclamacao', nome: preparado.nome, coisa: preparado.coisa })
    enviar({ tipo: 'pondo', pedido, andamento: 'esperando', motivo: null })
  }

  /**
   * "PÔR NO MAPA" (P3): a mesa lê a seção do disco, no próprio verbete (o
   * texto nunca vem pelo fio), confere que existe e não é segredo, e põe a
   * ferramenta Pino na mão esperando o clique do mestre.
   */
  const porNoMapa = async (pedido: number, fonte: SecaoParaOMapa, kind: TipoParaOMapa) => {
    const recusar = (motivo: string) => enviar({ tipo: 'pondo', pedido, andamento: 'recusado', motivo: motivoParaOFio(motivo) })
    const preludio = usePreludio.getState()
    if (preludio.carga.t === 'pronta') await preludio.relerDoDisco({ o: 'verbete', id: fonte.verbeteId })
    else await preludio.carregar()
    const { carga, verbetes } = usePreludio.getState()
    if (carga.t !== 'pronta') {
      recusar('A janela do mapa não conseguiu ler o Prelúdio.')
      return
    }
    const situacao = situacaoDaFonte(fonte, verbetes)
    if (situacao.t === 'sumiu') {
      recusar(situacao.o === 'verbete' ? 'Este verbete ainda não está no disco. Espere o Prelúdio gravar e tente de novo.' : 'Esta seção ainda não está no disco. Espere o Prelúdio gravar e tente de novo.')
      return
    }
    if (situacao.t === 'segredo') {
      recusar('Seção de segredo não vai ao mapa.')
      return
    }
    // "?" da seção de um Personagem (P5): a entrada nasce "Fala", dita por ele.
    const quem = kind === 'interrogacao' ? quemDizEmDia(fonte.verbeteId, verbetes) : null
    comecarColocacao({
      pedido,
      fonte: { ...fonte, verbete: situacao.verbete, secao: situacao.secao },
      kind,
      texto: situacao.texto,
      nome: situacao.verbete.slice(0, PIN_NOME_MAX_LENGTH).trim(),
      ...(quem === null ? {} : { quem: { verbeteId: fonte.verbeteId, nome: quem } }),
    })
    enviar({ tipo: 'pondo', pedido, andamento: 'esperando', motivo: null })
  }
  definirFimDaColocacao((pedido, fim) => {
    if (aberta) enviar({ tipo: 'pondo', pedido, andamento: fim, motivo: null })
  })

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
    const { adventure, activeSceneId, pasta, dir, cache } = useAdventureStore.getState()
    // `map.id`, a pasta e o diretório dão a chave do mapa (a faixa "Ligar a cena aberta" da sessão);
    // o `cache` traz os pinos ligados das cenas de fundo ("Na mesa").
    const agora = [map.id, map.name, map.pins, selection, selectedPinId, adventure, activeSceneId, pasta, dir, cache]
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
