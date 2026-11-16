import type { LeituraDoCenario, LeiturasDoJogador, LeiturasDosCenarios } from '../types/cenarioEFalas'

/**
 * "!" CENÁRIO NA SESSÃO DO HOST (P4): por pino, por jogador, se o mestre leu o
 * cenário para ele ("Ler agora": `lendo`) e se ele já leu (`leu`, com a hora).
 * Vive só nesta sessão, como o "Quem vê" e o painel Pistas: os ids de jogador
 * nascem a cada sala. É daqui que a névoa sabe que o "!" "só quando eu mandar"
 * já pode ir com o texto a ele (`LeiturasDoJogador`).
 */
export interface CenariosNaSessao {
  /** O que a névoa precisa deste jogador: os "!" já lidos para ele ou por ele. */
  doJogador(playerId: string): LeiturasDoJogador
  /** "Ler agora" saiu para ele: lendo, a partir de `hora`. Quem já leu volta a "lendo" (leu de novo). */
  lendo(pinId: string, playerId: string, hora: number): void
  /** Ele fechou a revelação. */
  leu(pinId: string, playerId: string, hora: number): void
  /** Ele está ou esteve com este cenário (o host confere o `cenario.lido` por aqui ou pelo recorte). */
  tem(pinId: string, playerId: string): boolean
  /** Para a ficha do pino e o "Ler junto" do mestre. */
  todas(): LeiturasDosCenarios
  /** O jogador saiu da sala (kick): some de todas as listas. */
  esquecer(playerId: string): void
  /** Sala nova: começa do zero. */
  limpar(): void
}

export function criarCenariosNaSessao(): CenariosNaSessao {
  const porPino = new Map<string, Map<string, LeituraDoCenario>>()
  const marcar = (pinId: string, playerId: string, leitura: LeituraDoCenario) => {
    const doPino = porPino.get(pinId) ?? new Map<string, LeituraDoCenario>()
    doPino.set(playerId, leitura)
    porPino.set(pinId, doPino)
  }
  return {
    doJogador(playerId) {
      const cenarios = new Set<string>()
      for (const [pinId, doPino] of porPino) if (doPino.has(playerId)) cenarios.add(pinId)
      return { cenarios }
    },
    lendo(pinId, playerId, hora) {
      marcar(pinId, playerId, { estado: 'lendo', hora })
    },
    leu(pinId, playerId, hora) {
      marcar(pinId, playerId, { estado: 'leu', hora })
    },
    tem(pinId, playerId) {
      return porPino.get(pinId)?.has(playerId) === true
    },
    todas() {
      const todas: Record<string, Record<string, LeituraDoCenario>> = {}
      for (const [pinId, doPino] of porPino) todas[pinId] = Object.fromEntries(doPino)
      return todas
    },
    esquecer(playerId) {
      for (const [pinId, doPino] of porPino) {
        doPino.delete(playerId)
        if (doPino.size === 0) porPino.delete(pinId)
      }
    },
    limpar() {
      porPino.clear()
    },
  }
}
