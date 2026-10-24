import { useSomStore } from '../../../stores/somStore'
import { obterSaidaAoVivoDoNavegador, quandoOAudioRodar } from '../contexto'
import { criarMotorDoYoutube, type MotorDoYoutube } from '../youtube/motorDoYoutube'
import { criarPalcoDoYoutube } from '../youtube/playerEscondido'
import { criarMotorAoVivoDoNavegador, MAX_LOOPS, type CarregadorDeBytes, type EventoDoMotor, type MotorAoVivo, type OpcoesDoMotorDoNavegador, type ResultadoDoToque } from './motor'

/**
 * O motor dos sons ao vivo com YouTube (Sistema 4, fatia F6): o MESMO contrato
 * de `MotorAoVivo`, com o arquivo indo ao motor do Web Audio e o vídeo ao
 * player escondido. A tela e o jogador falam só com isto e ouvem os eventos dos
 * dois. O teto de loops (`MAX_LOOPS`) conta os dois lados juntos.
 */
export function motorComYoutube(local: MotorAoVivo, youtube: MotorDoYoutube): MotorAoVivo {
  /** As instâncias em loop, tocando ou a caminho, dos dois lados. */
  const loops = new Set<string>()
  /** De que lado cada instância toca: tocar a mesma instância do outro lado troca o toque. */
  const lados = new Map<string, 'arquivo' | 'youtube'>()
  const ouvintes = new Set<(evento: EventoDoMotor) => void>()

  const acompanhar = (evento: EventoDoMotor): void => {
    if (evento.tipo !== 'terminou' && evento.tipo !== 'recusado') return
    loops.delete(evento.instancia)
    lados.delete(evento.instancia)
  }
  // Antes de qualquer ouvinte da tela: a conta de loops já está certa quando ela reage.
  const desligarLocal = local.assinar(acompanhar)
  const desligarYoutube = youtube.assinar(acompanhar)

  function recusarPorLoops(instancia: string): ResultadoDoToque {
    const evento: EventoDoMotor = { tipo: 'recusado', instancia, motivo: 'limite-de-loops' }
    for (const ouvinte of [...ouvintes]) {
      try {
        ouvinte(evento)
      } catch (erro) {
        queueMicrotask(() => {
          throw erro
        })
      }
    }
    return { aceito: false, motivo: 'limite-de-loops' }
  }

  return {
    tocar(instancia, fonte, opcoes) {
      // O limite antes de trocar: recusado, o que já tocava na instância segue (como no motor de arquivos).
      const outrosLoops = loops.size - (loops.has(instancia) ? 1 : 0)
      if (opcoes.loop && outrosLoops >= MAX_LOOPS) return recusarPorLoops(instancia)
      const antes = lados.get(instancia)
      if (antes === 'youtube' && fonte.tipo !== 'youtube') youtube.parar(instancia)
      if (antes === 'arquivo' && fonte.tipo === 'youtube') local.parar(instancia, 0)
      const resultado = fonte.tipo === 'youtube' ? youtube.tocar(instancia, fonte, opcoes) : local.tocar(instancia, fonte, opcoes)
      if (!resultado.aceito) return resultado
      lados.set(instancia, fonte.tipo)
      if (opcoes.loop) loops.add(instancia)
      else loops.delete(instancia)
      return resultado
    },
    parar(instancia, fadeMs) {
      local.parar(instancia, fadeMs)
      youtube.parar(instancia)
    },
    pararTudo() {
      local.pararTudo()
      youtube.pararTudo()
    },
    mudarVolume(instancia, volumeDoEfeito) {
      local.mudarVolume(instancia, volumeDoEfeito)
      youtube.mudarVolume(instancia, volumeDoEfeito)
    },
    precarregar(ids) {
      // Vídeo não se pré-carrega: o YouTube só abre no toque.
      local.precarregar(ids)
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      const tirarLocal = local.assinar(ouvinte)
      const tirarYoutube = youtube.assinar(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
        tirarLocal()
        tirarYoutube()
      }
    },
    desmontar() {
      local.desmontar()
      youtube.desmontar()
      desligarLocal()
      desligarYoutube()
      ouvintes.clear()
      loops.clear()
      lados.clear()
    },
  }
}

/**
 * O motor do app com YouTube: o de arquivos do navegador (`criarMotorAoVivoDoNavegador`)
 * e o player escondido no `document.body` desta página. Mestre, jogador e TV
 * usam este. A reserva do jogador e da TV avisa o toque na faixinha, que dá o
 * play dentro do gesto (iOS).
 */
export function criarMotorDoNavegadorComYoutube(carregarBytes: CarregadorDeBytes, opcoes: OpcoesDoMotorDoNavegador = {}): MotorAoVivo {
  const { reservas, preferencia } = opcoes
  const palco = criarPalcoDoYoutube()
  const youtube = criarMotorDoYoutube({
    abrirPlayer: (video, eventos) => palco.abrirPlayer(video, eventos),
    destravado: () => obterSaidaAoVivoDoNavegador() !== null,
    aoDestravar: quandoOAudioRodar,
    ...(reservas === undefined ? {} : { aoGesto: (ouvinte: () => void) => reservas.aoRepor(ouvinte) }),
    lerPreferencia: preferencia?.lerPreferencia ?? (() => useSomStore.getState()),
    assinarPreferencia: preferencia?.assinarPreferencia ?? ((ouvinte) => useSomStore.subscribe(() => ouvinte())),
    agora: () => performance.now(),
    fecharPalco: () => palco.fechar(),
  })
  return motorComYoutube(criarMotorAoVivoDoNavegador(carregarBytes, opcoes), youtube)
}
