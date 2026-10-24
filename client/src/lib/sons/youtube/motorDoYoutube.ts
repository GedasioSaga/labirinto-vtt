import { estaCalado, type PreferenciaDeSom } from '../../../stores/somStore'
import { ehVideoDoYoutube, VOLUME_DE_SOM_PADRAO, type FonteDoSom, type VideoDoYoutube } from '../biblioteca'
import { ESPERA_DO_EFEITO_CURTO_MS, MAX_YOUTUBE, PRAZO_DO_CARREGAMENTO_MS, type EventoDoMotor, type MotivoDaRecusa, type MotivoDoFim, type OpcoesDoToqueAoVivo, type ResultadoDoToque } from '../aoVivo/motor'
import { ESTADO_DO_YOUTUBE, type EventosDoPlayerYT, type PlayerYT } from './apiDoYoutube'

/**
 * O MOTOR DO YOUTUBE (Sistema 4, fatia F6): toca, para, muda o volume e repete
 * vídeos pelo player escondido, com os MESMOS eventos do motor de arquivos
 * (`aoVivo/motor.ts`), para a aba Sons e o jogador não saberem a diferença.
 * `aoVivo/motorComYoutube.ts` junta os dois.
 *
 *  - Nada do YouTube carrega antes do gesto: o pedido que chega antes espera
 *    (`esperando`, a faixinha) e o efeito curto desiste em 2 s, como no outro.
 *  - No máximo `MAX_YOUTUBE` players, reaproveitados: o 3º vídeo derruba o
 *    mais antigo.
 *  - Loop: o `ENDED` volta a `inicioS` (não ao zero do vídeo).
 *  - Volume = efeito × aparelho ao quadrado, a curva do outro motor; Mudo zera
 *    sem parar.
 *  - Erro do player vira recusa com motivo (o mestre lê "não deixa tocar fora
 *    do YouTube"); nada trava, a vaga fica para o próximo.
 *  - iOS: sem toque, o vídeo fica parado no começo. Se não tocar em
 *    `ESPERA_DO_PLAY_MS`, o loop volta a `esperando` e o toque na faixinha
 *    (`aoGesto`) chama `playVideo()` dentro do gesto. Não medido em aparelho.
 */

/** Depois de pedir o vídeo, quanto esperar o TOCANDO antes de concluir que o aparelho pede um toque. */
export const ESPERA_DO_PLAY_MS = 4000

export type FonteDoYoutube = Extract<FonteDoSom, { tipo: 'youtube' }>

export interface MotorDoYoutube {
  tocar(instancia: string, fonte: FonteDoYoutube, opcoes: OpcoesDoToqueAoVivo): ResultadoDoToque
  /** Para na hora (o player não tem rampa de volume que valha a pena: o fade seria em degraus). */
  parar(instancia: string): void
  pararTudo(): void
  mudarVolume(instancia: string, volumeDoEfeito: number): void
  assinar(ouvinte: (evento: EventoDoMotor) => void): () => void
  desmontar(): void
}

export interface DependenciasDoMotorDoYoutube {
  /** Um player escondido novo, já com o vídeo (`playerEscondido.ts`); o teste passa uma API falsa. */
  abrirPlayer: (video: VideoDoYoutube, eventos: EventosDoPlayerYT) => PlayerYT
  /** O áudio já foi destravado por um gesto nesta página. */
  destravado: () => boolean
  aoDestravar: (ouvinte: () => void) => () => void
  /** Um toque na faixinha (jogador e TV), avisado DENTRO do gesto. */
  aoGesto?: (ouvinte: () => void) => () => void
  lerPreferencia: () => PreferenciaDeSom
  assinarPreferencia: (ouvinte: () => void) => () => void
  /** Relógio em ms, monotônico. */
  agora: () => number
  /** Tira o palco da página ao desmontar. */
  fecharPalco?: () => void
}

/**
 * O erro do player como recusa: 2 = id torto; 5 = o player HTML5 falhou; 100 =
 * removido ou privado; 101 e 150 = o dono (ou a região) não deixa incorporar;
 * 153 = sem Referer ou origem (webview). Desconhecido = não carregou.
 */
export function motivoDoErroDoYoutube(codigo: number): MotivoDaRecusa {
  switch (codigo) {
    case 2:
      return 'fonte-invalida'
    case 100:
      return 'youtube-indisponivel'
    case 101:
    case 150:
    case 153:
      return 'youtube-bloqueado'
    default:
      return 'nao-carregou'
  }
}

interface Vaga {
  readonly player: PlayerYT
  pronto: boolean
  dona: Voz | null
}

interface Voz {
  readonly instancia: string
  readonly video: VideoDoYoutube
  readonly inicioS: number
  readonly fimS: number | undefined
  readonly loop: boolean
  readonly deslocamentoS: number
  volumeDoEfeito: number
  estado: 'esperando' | 'carregando' | 'tocando'
  avisouEspera: boolean
  /** O último estado do player para este vídeo; `null` antes do primeiro. */
  ultimoEstado: number | null
  relogio: ReturnType<typeof setTimeout> | null
  vaga: Vaga | null
}

function segundosValidos(valor: number | undefined): number {
  return valor !== undefined && Number.isFinite(valor) && valor > 0 ? valor : 0
}

function volumeValido(volume: number): number {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : VOLUME_DE_SOM_PADRAO
}

export function criarMotorDoYoutube(deps: DependenciasDoMotorDoYoutube): MotorDoYoutube {
  /** Ordem de inserção = idade: a primeira é a mais antiga. */
  const vozes = new Map<string, Voz>()
  const vagas: Vaga[] = []
  const ouvintes = new Set<(evento: EventoDoMotor) => void>()

  function emitir(evento: EventoDoMotor): void {
    for (const ouvinte of [...ouvintes]) {
      try {
        ouvinte(evento)
      } catch (erro) {
        // A tela quebrada não para o som; o erro ainda aparece no console.
        queueMicrotask(() => {
          throw erro
        })
      }
    }
  }

  function limparRelogio(voz: Voz): void {
    if (voz.relogio === null) return
    clearTimeout(voz.relogio)
    voz.relogio = null
  }

  /** Um relógio por voz: o novo troca o anterior, e o que dispara para uma voz que já saiu não faz nada. */
  function armar(voz: Voz, ms: number, quando: () => void): void {
    limparRelogio(voz)
    voz.relogio = setTimeout(() => {
      voz.relogio = null
      if (vozes.get(voz.instancia) === voz) quando()
    }, ms)
  }

  function volumeDoPlayer(voz: Voz): number {
    const preferencia = deps.lerPreferencia()
    return estaCalado(preferencia) ? 0 : Math.round(100 * voz.volumeDoEfeito * preferencia.volume * preferencia.volume)
  }

  function aplicarVolume(voz: Voz): void {
    if (voz.vaga !== null && voz.vaga.pronto) voz.vaga.player.setVolume(volumeDoPlayer(voz))
  }

  function soltar(voz: Voz): void {
    vozes.delete(voz.instancia)
    limparRelogio(voz)
    const vaga = voz.vaga
    voz.vaga = null
    if (vaga === null || vaga.dona !== voz) return
    vaga.dona = null
    if (vaga.pronto) vaga.player.pauseVideo()
  }

  function encerrar(voz: Voz, motivo: MotivoDoFim): void {
    soltar(voz)
    emitir({ tipo: 'terminou', instancia: voz.instancia, motivo })
  }

  function recusarVoz(voz: Voz, motivo: MotivoDaRecusa): void {
    soltar(voz)
    emitir({ tipo: 'recusado', instancia: voz.instancia, motivo })
  }

  function recusar(instancia: string, motivo: MotivoDaRecusa): ResultadoDoToque {
    emitir({ tipo: 'recusado', instancia, motivo })
    return { aceito: false, motivo }
  }

  function descartarVaga(vaga: Vaga): void {
    const indice = vagas.indexOf(vaga)
    if (indice >= 0) vagas.splice(indice, 1)
    vaga.player.destroy()
  }

  /** A duração do trecho (do início ao fim, ou ao fim do vídeo); 0 = ainda não se sabe. */
  function trechoS(voz: Voz, vaga: Vaga): number {
    const fim = voz.fimS ?? vaga.player.getDuration()
    return fim > voz.inicioS ? fim - voz.inicioS : 0
  }

  function pedirVideo(voz: Voz, vaga: Vaga): void {
    vaga.player.loadVideoById({ videoId: voz.video, startSeconds: voz.inicioS, ...(voz.fimS === undefined ? {} : { endSeconds: voz.fimS }) })
  }

  function semTocar(voz: Voz): void {
    if (voz.estado === 'tocando') return
    // Ainda baixando: espera o resto do prazo.
    if (voz.ultimoEstado === ESTADO_DO_YOUTUBE.carregando) {
      armar(voz, PRAZO_DO_CARREGAMENTO_MS, () => recusarVoz(voz, 'nao-carregou'))
      return
    }
    // Parado no começo: o aparelho pede um toque. O curto não espera (tocaria fora de hora).
    if (!voz.loop) {
      recusarVoz(voz, 'sem-gesto')
      return
    }
    voz.estado = 'esperando'
    voz.avisouEspera = true
    emitir({ tipo: 'esperando', instancia: voz.instancia })
  }

  function carregarNaVaga(voz: Voz, vaga: Vaga): void {
    vaga.player.setVolume(volumeDoPlayer(voz))
    pedirVideo(voz, vaga)
    armar(voz, ESPERA_DO_PLAY_MS, () => semTocar(voz))
  }

  function vagaParaVoz(voz: Voz): Vaga | null {
    const livre = vagas.find((vaga) => vaga.dona === null)
    if (livre !== undefined) return livre
    if (vagas.length >= MAX_YOUTUBE) return null
    const vaga: Vaga = {
      // Os eventos chegam depois (por mensagem): a vaga já existe quando o primeiro vem.
      player: deps.abrirPlayer(voz.video, {
        onReady: () => ficouPronta(vaga),
        onStateChange: (estado) => mudouEstado(vaga, estado),
        onError: (codigo) => deuErro(vaga, codigo),
      }),
      pronto: false,
      dona: null,
    }
    vagas.push(vaga)
    return vaga
  }

  function iniciar(voz: Voz): void {
    voz.estado = 'carregando'
    if (voz.avisouEspera) emitir({ tipo: 'carregando', instancia: voz.instancia })
    // Quem ouviu o aviso pode ter parado o som.
    if (vozes.get(voz.instancia) !== voz) return
    const vaga = vagaParaVoz(voz)
    if (vaga === null) {
      recusarVoz(voz, 'nao-carregou')
      return
    }
    vaga.dona = voz
    voz.vaga = vaga
    if (vaga.pronto) {
      carregarNaVaga(voz, vaga)
      return
    }
    armar(voz, PRAZO_DO_CARREGAMENTO_MS, () => {
      // O player nunca respondeu (sem internet, YouTube fora do ar): sai, e o próximo toque abre outro.
      descartarVaga(vaga)
      recusarVoz(voz, 'nao-carregou')
    })
  }

  function ficouPronta(vaga: Vaga): void {
    vaga.pronto = true
    if (vaga.dona !== null) carregarNaVaga(vaga.dona, vaga)
  }

  function mudouEstado(vaga: Vaga, estado: number): void {
    const voz = vaga.dona
    if (voz === null) return
    voz.ultimoEstado = estado
    if (estado === ESTADO_DO_YOUTUBE.tocando) {
      if (voz.estado === 'tocando') return
      voz.estado = 'tocando'
      limparRelogio(voz)
      const duracaoS = trechoS(voz, vaga)
      // O loop pego no meio (quem entrou depois) começa no ponto da volta de agora.
      const deslocamentoS = voz.loop && duracaoS > 0 ? voz.deslocamentoS % duracaoS : 0
      if (deslocamentoS > 0) vaga.player.seekTo(voz.inicioS + deslocamentoS, true)
      emitir({ tipo: 'tocando', instancia: voz.instancia, loop: voz.loop, duracaoS, deslocamentoS, inicioEmMs: deps.agora() })
      return
    }
    if (estado !== ESTADO_DO_YOUTUBE.terminou) return
    if (!voz.loop) {
      encerrar(voz, 'fim')
      return
    }
    // O loop volta para o início do trecho, não para o zero do vídeo. Com fim marcado, pede o trecho
    // inteiro de novo: o `endSeconds` do player vale uma passada só.
    if (voz.fimS === undefined) {
      vaga.player.seekTo(voz.inicioS, true)
      vaga.player.playVideo()
    } else {
      pedirVideo(voz, vaga)
    }
  }

  function deuErro(vaga: Vaga, codigo: number): void {
    if (vaga.dona !== null) recusarVoz(vaga.dona, motivoDoErroDoYoutube(codigo))
  }

  /** O áudio destravou (ou um toque): o que esperava o gesto começa; o vídeo parado pede play. */
  function retomar(dentroDoGesto: boolean): void {
    for (const voz of [...vozes.values()]) {
      if (voz.estado !== 'esperando') continue
      const vaga = voz.vaga
      if (vaga === null) {
        iniciar(voz)
        continue
      }
      if (!vaga.pronto) continue
      // Fora do gesto o play pode ser recusado de novo (iOS); dentro dele, vale. O play antes do aviso: ainda no gesto.
      voz.estado = 'carregando'
      vaga.player.playVideo()
      emitir({ tipo: 'carregando', instancia: voz.instancia })
      if (vozes.get(voz.instancia) !== voz) continue
      armar(voz, dentroDoGesto ? PRAZO_DO_CARREGAMENTO_MS : ESPERA_DO_PLAY_MS, () => (dentroDoGesto ? recusarVoz(voz, 'nao-carregou') : semTocar(voz)))
    }
  }

  const desligarPreferencia = deps.assinarPreferencia(() => {
    for (const voz of vozes.values()) aplicarVolume(voz)
  })
  const desligarDestravar = deps.aoDestravar(() => retomar(false))
  const desligarGesto = deps.aoGesto?.(() => retomar(true))

  return {
    tocar(instancia, fonte, opcoes) {
      // O tipo diz que o id foi conferido, mas ele pode ter vindo da rede: confere de novo antes de virar endereço de iframe.
      if (!ehVideoDoYoutube(fonte.video)) return recusar(instancia, 'fonte-invalida')
      const anterior = vozes.get(instancia)
      if (anterior !== undefined) encerrar(anterior, 'parado')
      // No máximo MAX_YOUTUBE vídeos: o mais antigo cede a vaga.
      if (vozes.size >= MAX_YOUTUBE) {
        for (const maisAntiga of vozes.values()) {
          encerrar(maisAntiga, 'derrubado')
          break
        }
      }
      const inicioS = segundosValidos(fonte.inicioS)
      const fimS = fonte.fimS !== undefined && Number.isFinite(fonte.fimS) && fonte.fimS > inicioS ? fonte.fimS : undefined
      const voz: Voz = {
        instancia,
        video: fonte.video,
        inicioS,
        fimS,
        loop: opcoes.loop,
        deslocamentoS: segundosValidos(opcoes.deslocamentoS),
        volumeDoEfeito: volumeValido(opcoes.volumeDoEfeito),
        estado: 'esperando',
        avisouEspera: false,
        ultimoEstado: null,
        relogio: null,
        vaga: null,
      }
      vozes.set(instancia, voz)
      if (deps.destravado()) {
        iniciar(voz)
      } else {
        // Antes do gesto nada do YouTube carrega: espera o toque (a faixinha), e o efeito curto desiste em 2 s.
        voz.avisouEspera = true
        emitir({ tipo: 'esperando', instancia })
        if (!voz.loop) armar(voz, ESPERA_DO_EFEITO_CURTO_MS, () => recusarVoz(voz, 'sem-gesto'))
      }
      return { aceito: true }
    },

    parar(instancia) {
      const voz = vozes.get(instancia)
      if (voz !== undefined) encerrar(voz, 'parado')
    },

    pararTudo() {
      for (const voz of [...vozes.values()]) encerrar(voz, 'parado')
    },

    mudarVolume(instancia, volumeDoEfeito) {
      const voz = vozes.get(instancia)
      if (voz === undefined || !Number.isFinite(volumeDoEfeito)) return
      voz.volumeDoEfeito = volumeValido(volumeDoEfeito)
      aplicarVolume(voz)
    },

    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },

    desmontar() {
      for (const voz of [...vozes.values()]) encerrar(voz, 'parado')
      for (const vaga of vagas.splice(0)) vaga.player.destroy()
      desligarPreferencia()
      desligarDestravar()
      desligarGesto?.()
      deps.fecharPalco?.()
      ouvintes.clear()
    },
  }
}
