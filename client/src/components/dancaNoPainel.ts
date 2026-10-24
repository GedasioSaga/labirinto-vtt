import type { DancaAoVivo, DancaConviteResultado } from '../net/dancaNoHost'
import type { HostBridge } from '../net/hostBridge'
import type { EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import type { DancaAoVivoProps, JogadorDaDanca } from './DancaAoVivo'

/**
 * POR ONDE O PAINEL DO PINO CHAMA A DANÇA: a ponte da sala de verdade ou a
 * ponte de TESTE da Visão de jogador. Com o teste aberto, o teste ganha, mesmo
 * com a sala aberta ao lado: o mestre está testando a dança sozinho, então o
 * painel lista só o jogador de teste (marcado "Teste ·", para ninguém o
 * confundir com um jogador da mesa), lê a dança do teste e manda tudo à ponte
 * de teste. Fechar o teste devolve o painel à sala.
 */

/** Os comandos da dança que o painel manda (os mesmos nas duas pontes). */
export type PonteDaDanca = Pick<HostBridge, 'convidarParaDanca' | 'comecarDanca' | 'pausarDanca' | 'retomarDanca' | 'encerrarDanca'>

/** A dança ao vivo como o painel do pino a recebe (`MinigameControls`). */
export type DancaNoPainel = Omit<DancaAoVivoProps, 'pinId'>

/** Como o jogador de teste aparece na lista do "Chamar para dançar". */
export const PREFIXO_DO_TESTE = 'Teste · '

interface FonteDaDanca {
  players: readonly JogadorDaDanca[]
  danca: DancaAoVivo | null
  /** Lida na hora de cada comando: a ponte de teste é outra a cada geração, e a da sala pode ter fechado. */
  ponte: () => PonteDaDanca | null
}

export interface SalaDaDanca extends FonteDaDanca {
  aberta: boolean
  /**
   * SONS F5d: antes do convite da SALA, a música do pino pode sair para a mesa?
   * (`prepararMusicaDaDancaNaMesa`: a importada pede a pasta da aventura, de
   * onde `/sons` a serve.) `false` = o convite não sai e o painel avisa.
   * Ausente = sem conferência. O teste (Visão de jogador) nunca passa por aqui.
   */
  prepararMusica?: () => boolean
}

const SEM_PASTA_PARA_A_MUSICA: DancaConviteResultado = { ok: false, motivo: 'musica' }

export interface TesteDaDanca {
  estado: EstadoDaVisao
  ponte: () => PonteDaDanca | null
}

/** Sem ponte agora (sala fechada, teste entre gerações), o convite volta `null` e o resto `false`: o painel diz que não deu. */
function dancaPela(pinId: string, fonte: FonteDaDanca): DancaNoPainel {
  return {
    players: fonte.players,
    danca: fonte.danca,
    onConvidar: (playerIds) => fonte.ponte()?.convidarParaDanca(pinId, playerIds) ?? null,
    onComecar: () => fonte.ponte()?.comecarDanca() ?? false,
    onPausar: () => fonte.ponte()?.pausarDanca() ?? false,
    onRetomar: () => fonte.ponte()?.retomarDanca() ?? false,
    onEncerrar: () => fonte.ponte()?.encerrarDanca() ?? false,
  }
}

/** A dança ao vivo do painel do pino `pinId`; `null` = nem teste nem sala abertos (o painel pede para abrir a sala). */
export function dancaNoPainel(pinId: string, teste: TesteDaDanca, sala: SalaDaDanca): DancaNoPainel | null {
  if (teste.estado.aberta) {
    const players = teste.estado.jogadores.map(({ playerId, name }) => ({ playerId, name: `${PREFIXO_DO_TESTE}${name}` }))
    return dancaPela(pinId, { players, danca: teste.estado.danca, ponte: teste.ponte })
  }
  if (!sala.aberta) return null
  const painel = dancaPela(pinId, sala)
  const { prepararMusica } = sala
  if (prepararMusica === undefined) return painel
  return { ...painel, onConvidar: (playerIds) => (prepararMusica() ? painel.onConvidar(playerIds) : SEM_PASTA_PARA_A_MUSICA) }
}
