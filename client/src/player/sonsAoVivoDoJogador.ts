import { refDoId } from '../lib/midia'
import { criarMotorAoVivoDoNavegador, type CarregadorDeBytes, type ElementoDeAudio, type MotivoDaRecusa, type MotorAoVivo, type ReservaDeAudios } from '../lib/sons/aoVivo/motor'
import { destravarAudioAgora, destravarAudioNoPrimeiroGesto } from '../lib/sons/contexto'
import type { MotivoDaFalhaDoSom, SomHostMessage } from '../net/protocol'
import { criarCarregadorDaSala, type BuscarNaSala } from './carregadorDeSons'
import type { PlayerConnection, PlayerState } from './playerConnection'

/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 3): o jogador e a tela da mesa TOCAM o que o mestre manda. Liga os
 * `som.*` da conexão (`ouvirSons`) ao motor ao vivo, que busca o áudio na sala
 * (`/sons/<id>`, com a chave da conexão). Instala junto com a conexão de UMA
 * sessão e sai junto com ela (`main.tsx` e `TableScreen.tsx`).
 *
 *  - O que o motor recusa volta ao mestre como `som.falhou` (motivo da lista
 *    fechada): é o "não tocou para N" do botão dele. O loop que espera o gesto
 *    conta `sem-gesto` uma vez (a TV que ninguém tocou ainda); o efeito curto
 *    só conta se o motor o descartar depois dos 2 s.
 *  - Fim de sessão (sala fechada, expulso, aba trocada, erro, socket caído)
 *    para tudo: o mestre não manda nada nesses casos, e a conexão só limpa os
 *    loops guardados, sem avisar quem ouve. Por isso a regra assina o ESTADO.
 *  - A faixinha "Toque para ouvir" (`FaixaTocarParaOuvir.tsx`) lê `esperando()`
 *    e chama `tocarParaOuvir()` dentro do toque.
 */

/** Quantos `<audio>` cada toque na faixinha destrava (2 sons grandes por gesto, no iOS). */
export const RESERVAS_POR_GESTO = 2

/** O que o motor recusa, no vocabulário que atravessa a rede (a lista é a mesma: o compilador confere). */
const MOTIVO_DA_FALHA: Record<MotivoDaRecusa, MotivoDaFalhaDoSom> = {
  'limite-de-loops': 'limite-de-loops',
  'sem-gesto': 'sem-gesto',
  atrasado: 'atrasado',
  'nao-carregou': 'nao-carregou',
  'fonte-invalida': 'fonte-invalida',
  'fonte-sem-suporte': 'fonte-sem-suporte',
}

/** Um WAV mudo de 8 amostras (8 bits, 8 kHz): o `play()` dentro do toque que destrava o `<audio>` no iOS. */
function wavMudo(): string {
  const amostras = 8
  const bytes = new Uint8Array(44 + amostras)
  const vista = new DataView(bytes.buffer)
  const texto = (posicao: number, valor: string) => {
    for (let i = 0; i < valor.length; i++) bytes[posicao + i] = valor.charCodeAt(i)
  }
  texto(0, 'RIFF')
  vista.setUint32(4, 36 + amostras, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true)
  vista.setUint16(20, 1, true) // PCM
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, 8000, true) // amostras por segundo
  vista.setUint32(28, 8000, true) // bytes por segundo
  vista.setUint16(32, 1, true) // bytes por quadro
  vista.setUint16(34, 8, true) // bits por amostra
  texto(36, 'data')
  vista.setUint32(40, amostras, true)
  // Em 8 bits o silêncio é o meio da escala.
  bytes.fill(0x80, 44)
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
}

const SILENCIO_WAV = wavMudo()

/** A reserva que o toque repõe: o motor tira dela; a faixinha a completa. */
export interface ReservaDoGesto extends ReservaDeAudios {
  /** SÍNCRONO, dentro do toque: completa a reserva com `<audio>` que já deram `play()` e avisa o motor. */
  repor(): void
  /** Solta os `<audio>` que sobraram. */
  esvaziar(): void
}

export function criarReservaDoGesto(criarElemento: () => ElementoDeAudio = () => new Audio()): ReservaDoGesto {
  const prontos: ElementoDeAudio[] = []
  /** O que o motor já levou não é pausado pelo aquecimento atrasado. */
  const levados = new WeakSet<ElementoDeAudio>()
  const ouvintes = new Set<() => void>()
  return {
    repor() {
      while (prontos.length < RESERVAS_POR_GESTO) {
        const elemento = criarElemento()
        elemento.src = SILENCIO_WAV
        // O play() tem de COMEÇAR dentro do toque; a pausa pode vir depois. Recusado, o elemento só não destravou.
        Promise.resolve(elemento.play()).then(
          () => {
            if (!levados.has(elemento)) elemento.pause()
          },
          () => undefined,
        )
        prontos.push(elemento)
      }
      for (const ouvinte of [...ouvintes]) ouvinte()
    },
    tirar() {
      const elemento = prontos.shift()
      if (elemento === undefined) return null
      levados.add(elemento)
      return elemento
    },
    aoRepor(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    esvaziar() {
      for (const elemento of prontos.splice(0)) {
        elemento.pause()
        elemento.src = ''
      }
    },
  }
}

/** O pedaço da conexão que os sons usam. */
export type ConexaoDosSons = Pick<PlayerConnection, 'getState' | 'subscribe' | 'ouvirSons' | 'informarSomFalhou' | 'chaveDaMidia'>

export interface DependenciasDosSonsAoVivo {
  /** Quem toca; o padrão é o motor do navegador com os `<audio>` da reserva. */
  criarMotor?: (carregar: CarregadorDeBytes, reservas: ReservaDeAudios) => MotorAoVivo
  /** O `fetch` da página. */
  buscar?: BuscarNaSala
  reservas?: ReservaDoGesto
  /** Destrava o contexto de áudio AGORA (só vale dentro de um gesto). */
  destravarAgora?: () => void
  /** Escuta os gestos da página: o toque que o jogador já dá também destrava. */
  destravarNoPrimeiroGesto?: (alvo: EventTarget) => () => void
  alvoDoGesto?: EventTarget
}

export interface SonsAoVivo {
  /** Quantos toques esperam o gesto agora; a faixinha aparece com 1 ou mais. */
  esperando(): number
  /** Avisa quando `esperando()` muda. */
  assinar(ouvinte: () => void): () => void
  /** O toque na faixinha: SÍNCRONO, dentro do gesto. Destrava o áudio e repõe os `<audio>` de reserva. */
  tocarParaOuvir(): void
  desinstalar(): void
}

/** Sessão que acabou ou socket que caiu: o mestre não manda parar nesses casos. */
function foraDaSala(estado: PlayerState): boolean {
  return estado.status === 'closed' || estado.status === 'kicked' || estado.status === 'replaced' || estado.status === 'error' || estado.reconnecting !== undefined
}

export function instalarSonsAoVivo(conexao: ConexaoDosSons, deps: DependenciasDosSonsAoVivo = {}): SonsAoVivo {
  const reservas = deps.reservas ?? criarReservaDoGesto()
  const carregar = criarCarregadorDaSala({ chave: () => conexao.chaveDaMidia(), buscar: deps.buscar ?? ((url, init) => fetch(url, init)) })
  const criarMotor = deps.criarMotor ?? ((carregarBytes, reservasDoMotor) => criarMotorAoVivoDoNavegador(carregarBytes, { reservas: reservasDoMotor }))
  const motor = criarMotor(carregar, reservas)
  const destravarAgora = deps.destravarAgora ?? destravarAudioAgora

  const esperando = new Set<string>()
  /** As instâncias em loop (o loop que espera o gesto conta `sem-gesto`; o curto, só se for descartado). */
  const loops = new Set<string>()
  const contouSemGesto = new Set<string>()
  const ouvintes = new Set<() => void>()

  function mudarEspera(instancia: string, espera: boolean): void {
    if (espera === esperando.has(instancia)) return
    if (espera) esperando.add(instancia)
    else esperando.delete(instancia)
    for (const ouvinte of [...ouvintes]) ouvinte()
  }

  const desligarMotor = motor.assinar((evento) => {
    switch (evento.tipo) {
      case 'esperando':
        mudarEspera(evento.instancia, true)
        if (loops.has(evento.instancia) && !contouSemGesto.has(evento.instancia)) {
          contouSemGesto.add(evento.instancia)
          conexao.informarSomFalhou(evento.instancia, 'sem-gesto')
        }
        return
      case 'tocando':
      case 'terminou':
        mudarEspera(evento.instancia, false)
        return
      case 'recusado':
        mudarEspera(evento.instancia, false)
        conexao.informarSomFalhou(evento.instancia, MOTIVO_DA_FALHA[evento.motivo])
        return
    }
  })

  function pararTudo(): void {
    loops.clear()
    contouSemGesto.clear()
    motor.pararTudo()
  }

  function tratarSom(msg: SomHostMessage): void {
    switch (msg.type) {
      case 'som.tocar': {
        // Toque novo da instância: conta de novo se esperar.
        contouSemGesto.delete(msg.instancia)
        if (msg.loop) loops.add(msg.instancia)
        else loops.delete(msg.instancia)
        // `bytes` é o tamanho para a aba do mestre; o motor não o usa, e a rede não o leva.
        const fonte = { tipo: 'arquivo' as const, ref: refDoId(msg.fonte.midia), bytes: 0 }
        motor.tocar(msg.instancia, fonte, { loop: msg.loop, volumeDoEfeito: msg.volume, ...(msg.deslocamentoS === undefined ? {} : { deslocamentoS: msg.deslocamentoS }) })
        return
      }
      case 'som.parar':
        loops.delete(msg.instancia)
        motor.parar(msg.instancia, msg.fadeMs)
        return
      case 'som.pararTudo':
        pararTudo()
        return
      case 'som.volume':
        motor.mudarVolume(msg.instancia, msg.volume)
        return
      case 'som.precarregar':
        motor.precarregar(msg.midias)
        return
    }
  }

  let estavaFora = foraDaSala(conexao.getState())
  const desligarEstado = conexao.subscribe(() => {
    const fora = foraDaSala(conexao.getState())
    if (fora && !estavaFora) pararTudo()
    estavaFora = fora
  })

  // Por último: a conexão repassa já os loops que guardou, no ponto de agora.
  const pararDeOuvir = conexao.ouvirSons((msg) => {
    try {
      tratarSom(msg)
    } catch (erro) {
      // Roda dentro da mensagem do mestre: o erro aqui não corta o resto dela; ainda aparece no console.
      queueMicrotask(() => {
        throw erro
      })
    }
  })
  const pararDeDestravar = (deps.destravarNoPrimeiroGesto ?? destravarAudioNoPrimeiroGesto)(deps.alvoDoGesto ?? window)

  return {
    esperando: () => esperando.size,
    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    tocarParaOuvir() {
      destravarAgora()
      reservas.repor()
    },
    desinstalar() {
      pararDeOuvir()
      desligarEstado()
      pararDeDestravar()
      desligarMotor()
      motor.desmontar()
      reservas.esvaziar()
      ouvintes.clear()
      esperando.clear()
    },
  }
}
