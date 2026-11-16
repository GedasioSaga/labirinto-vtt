/**
 * ROBÔS DA CAIXA (METAS.md, seção 1). O humano só enxerga o jogo pelo `Olho`
 * (atraso de 250 ± 60 ms, releitura a cada 0,15 s, erro de leitura ± 0,03) e
 * sabe sem atraso só o que a própria mão fez. Ele aperta uma reação depois de
 * ver o pé de cabra assentado e, pelo que vê da barra enchendo e pela forma da
 * curva, prevê quando a força passa pelo centro da faixa e solta nesse
 * instante, mais o erro da mão. O ruim segura e solta por durações ao acaso,
 * sem olhar.
 */
import { entre, rngDe } from '../abrir/rng'
import { Olho, PASSOS_POR_DECISAO, REACAO_MEDIA, erroDaMao, lerComErro } from '../abrir/robo'
import type { Rng } from '../abrir/rng'
import type { Visto } from '../abrir/robo'
import type { Dificuldade, Entrada, Politica } from '../abrir/tipos'
import { DIF, amostra, tempoDaForca } from './sim'
import type { AmostraDaCaixa, Estado, ParametrosDaDificuldade } from './sim'

/**
 * Desvio do erro de tempo da mão, em s: 55 ms (o padrão é 50). Soltar um botão
 * segurado no instante previsto é antecipação de coincidência, um gesto um
 * pouco menos preciso que o toque no ritmo.
 */
export const DESVIO_DA_MAO = 0.055

/**
 * Atraso que o robô compensa ao prever: só o MÉDIO do próprio olho, nunca o
 * atraso exato daquela leitura (250 ± 60 ms, que ele não sabe).
 *
 * Por que a reação média (0,25 s) e não reação + metade da releitura
 * (0,325 s): os 0,325 s são a idade média de uma leitura usada como se fosse
 * de agora durante os 0,15 s até a próxima. Nesse jeito, a leitura fica
 * congelada entre releituras e o robô só consegue soltar no instante de uma
 * releitura; como ele também aperta numa releitura, o tempo segurado ficava
 * preso a múltiplos de 0,15 s (medido: 11% de acerto por puxada no Difícil,
 * com janela de 81 ms e erro sem viés de ±100 ms, artefato do modelo e não
 * dificuldade). Aqui a previsão é ancorada no instante da releitura, como
 * gente que sabe quando olhou e deixa o tempo correr entre olhadas; nesse
 * instante, a idade média da tela vista é a reação média. A soma dos dois
 * jeitos dá o mesmo atraso médio; só some o degrau de 0,15 s.
 */
export const ATRASO_COMPENSADO = REACAO_MEDIA

/**
 * Teto da espera por ver o pé de cabra fora da fresta depois de soltar, em s
 * do relógio da própria mão. O olho quase sempre vê o reposicionamento
 * (≥ 0,3 s), mas duas releituras seguidas com reações muito diferentes podem
 * pular por cima dele; sem o teto, o robô ficaria parado para sempre.
 */
const ESPERA_MAXIMA = 0.9

/** Robô ruim (pedido): segura por uma duração ao acaso nesta faixa, em s... */
export const SEGURA_RUIM: readonly [number, number] = [0.1, 1.8]
/** ...e espera por uma duração ao acaso nesta faixa antes de segurar de novo, em s. */
export const ESPERA_RUIM: readonly [number, number] = [0.15, 0.6]

/** O que o olho leu de uma tela: força e faixa com erro de leitura; os estados discretos, exatos. */
interface Leitura {
  forca: number
  min: number
  max: number
  segurando: boolean
  pronto: boolean
}

function ler(r: Rng, a: Readonly<AmostraDaCaixa>): Leitura {
  return {
    forca: lerComErro(r, a.forca),
    min: lerComErro(r, a.faixaMin),
    max: lerComErro(r, a.faixaMax),
    segurando: a.segurando === 1,
    pronto: a.pronto === 1,
  }
}

const entrada = (segurando: boolean, aperto: boolean): Entrada => ({ segurando, toque: aperto ? 0 : -1 })

/** Procura: quer apertar; segura: fazendo força; espera: soltou e aguarda ver o pé de cabra sair da fresta. */
type FaseDoRobo = 'procura' | 'segura' | 'espera'

/** Robô que joga como gente (METAS.md, seção 1). Sorte própria em `semente + '|robo'`. */
export function roboHumano(semente: string, dif: Dificuldade): Politica<Estado> {
  const d = DIF[dif]
  const r = rngDe(semente + '|robo')
  const olho = new Olho<AmostraDaCaixa>(r)
  let visto: Visto<AmostraDaCaixa> | null = null
  let lido: Leitura | null = null
  let fase: FaseDoRobo = 'procura'
  let segurando = false
  let mao = 0
  let soltouEm = 0
  /** Instante previsto (relógio da mão) em que a força passa pelo centro da faixa; refeito a cada releitura. */
  let previsto = Infinity
  let n = 0
  return (e) => {
    // O relógio do jogo é o relógio da própria mão; o resto só pelo olho.
    const agora = e.t
    const v = olho.olhar(agora, amostra(e))
    // Uma leitura (com o seu erro) por releitura: sortear o erro a cada passo seria olhar 60 vezes por segundo.
    if (v !== visto) {
      visto = v
      lido = v === null ? null : ler(r, v.a)
      if (fase === 'segura' && lido !== null && lido.segurando) previsto = preverCentro(lido, agora, d)
    }
    if (n++ % PASSOS_POR_DECISAO !== 0 || lido === null) return entrada(segurando, false)
    if (fase === 'procura') {
      // Só aperta ao VER o pé de cabra assentado e parado: a reação vem do atraso do olho, nunca é zero.
      if (lido.pronto && !lido.segurando) {
        fase = 'segura'
        segurando = true
        mao = erroDaMao(r, DESVIO_DA_MAO)
        return entrada(true, true)
      }
    } else if (fase === 'segura') {
      // Solta no instante previsto mais o erro da mão; se já vê a força acima da faixa, solta na hora (e perde a puxada).
      if (lido.segurando && (lido.forca > lido.max || agora >= previsto + mao)) {
        fase = 'espera'
        segurando = false
        soltouEm = agora
        previsto = Infinity
      }
    } else if (!lido.pronto || agora - soltouEm > ESPERA_MAXIMA) fase = 'procura'
    return entrada(segurando, false)
  }
}

/**
 * Pela força vista e pela forma da curva, o instante em que a força passa
 * pelo centro da faixa: a tela vista agora é tratada como de
 * ATRASO_COMPENSADO s atrás.
 */
function preverCentro(l: Leitura, agora: number, d: Readonly<ParametrosDaDificuldade>): number {
  const centro = (l.min + l.max) / 2
  return agora - ATRASO_COMPENSADO + tempoDaForca(centro, d) - tempoDaForca(l.forca, d)
}

/** Robô ruim do pedido: segura e solta por durações ao acaso, sem olhar. Vence < 15% no Normal. */
export function roboRuim(semente: string, _dif: Dificuldade): Politica<Estado> {
  const r = rngDe(semente + '|robo')
  let segurando = false
  let trocaEm = entre(r, ESPERA_RUIM[0], ESPERA_RUIM[1])
  let n = 0
  return (e) => {
    let aperto = false
    if (n++ % PASSOS_POR_DECISAO === 0 && e.t >= trocaEm) {
      segurando = !segurando
      aperto = segurando
      const [a, b] = segurando ? SEGURA_RUIM : ESPERA_RUIM
      trocaEm = e.t + entre(r, a, b)
    }
    return entrada(segurando, aperto)
  }
}
