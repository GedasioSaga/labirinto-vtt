import { useEffect } from 'react'
import { create } from 'zustand'
import { pegadaDaCasa, pegadaDaFicha, type PegadaNaGrade } from '../../lib/batalha/area'
import { usaDirecao } from '../../lib/batalha/alcance/forma'
import { mapaDoAlcance } from '../../lib/batalha/alcance/segmentos'
import { casaDoToken } from '../../lib/batalha/movimentoEmBatalha'
import { pisoDe } from '../../lib/pisos'
import { criarEnvioDaMira } from '../../net/envioDaMira'
import type { BatalhaMiraMessage, MiraNaMesaNoFio } from '../../net/protocoloDaBatalha'
import type { MapData, Token } from '../../types/map'
import { useMapStore } from '../mapStore'
import { useMiraNoMapa, type MiraNoMapa } from './miraNoMapa'

/**
 * A MIRA NA MESA (plano docs/design/habilidades/ALCANCE.md §6 e §7.2, fase D): as miras dos outros
 * que chegaram pela rede viram miras do chão (`useMiraNoMapa.remotas`), com a ficha e as paredes
 * DESTA tela: o jogador conta as casas com o recorte dele, então nenhuma parede escondida vaza pelo
 * desenho. Os outros veem só as casas na cor certa e o lado: sem alvo marcado, sem o mouse de quem
 * mira, sem nome nem número.
 *
 * Só leitura: quem escreve é a rede. No mestre, a ponte da mesa (`hostBridge`) põe aqui as miras dos
 * jogadores (`useMiraNaMesa`); no jogador, a conexão guarda as dela e a `BatalhaDoJogador` as entrega
 * (`useMirasDaMesaNoChao`).
 */

interface EstadoDaMiraNaMesa {
  /** As miras abertas dos jogadores, como o host as resolveu (a tela do mestre vê todas as fichas). */
  miras: readonly MiraNaMesaNoFio[]
  trocar: (miras: readonly MiraNaMesaNoFio[]) => void
}

export const useMiraNaMesa = create<EstadoDaMiraNaMesa>()((set, get) => ({
  miras: [],
  trocar: (miras) => {
    if (get().miras !== miras) set({ miras })
  },
}))

/** A mesma lista vazia sempre: a camada do chão compara pela referência. */
const NENHUMA: readonly MiraNoMapa[] = []

/** A ficha inteira na grade, pela mesma casa de referência do passo em batalha (`casaDoToken`), como a mira de quem usa. */
function pegadaDoToken(token: Pick<Token, 'x' | 'y' | 'size'>, grade: number): PegadaNaGrade {
  return pegadaDaFicha(casaDoToken({ x: token.x, y: token.y }, token.size, grade), token.size)
}

/**
 * As miras do fio como o chão desta tela as desenha. A ficha de quem mira que esta tela não tem
 * (ainda não chegou, ou saiu dela) não acende; o centro numa ficha que ela não tem, também não.
 * Grade hexagonal ou mapa sem grade: nada (a mira só diz o número).
 */
export function mirasNoChao(miras: readonly MiraNaMesaNoFio[], map: MapData | null | undefined): readonly MiraNoMapa[] {
  if (miras.length === 0 || map === null || map === undefined || !(map.grid > 0) || map.gridShape === 'hex') return NENHUMA
  const porId = new Map(map.tokens.map((token) => [token.id, token]))
  const noChao = miras.flatMap((mira): MiraNoMapa[] => {
    const token = porId.get(mira.tokenId)
    if (token === undefined) return []
    const doCentro = mira.centroId === undefined ? undefined : porId.get(mira.centroId)
    const centro = mira.ponto !== undefined ? pegadaDaCasa(mira.ponto) : doCentro === undefined ? null : pegadaDoToken(doCentro, map.grid)
    return [
      {
        tokenId: mira.tokenId,
        forma: mira.forma,
        cor: mira.cor,
        quemUsa: pegadaDoToken(token, map.grid),
        direcao: usaDirecao(mira.forma) ? (mira.direcao ?? null) : null,
        acendeQuemUsa: mira.acendeQuemUsa,
        mapa: mapaDoAlcance(map, pisoDe(token)),
        centro,
        alvos: [],
        fichas: [],
      },
    ]
  })
  return noChao.length === 0 ? NENHUMA : noChao
}

/**
 * Entrega as miras da mesa ao chão desta tela enquanto o componente vive; ao sair, o chão apaga as dos
 * outros. `miras` ausente = esta tela não recebe miras (a Arena, o Lobby): o chão fica como está.
 */
export function useMirasDaMesaNoChao(miras: readonly MiraNaMesaNoFio[] | undefined, map: MapData | undefined): void {
  const recebe = miras !== undefined
  useEffect(() => {
    if (miras !== undefined) useMiraNoMapa.getState().mostrarDaMesa(mirasNoChao(miras, map))
  }, [miras, map])
  useEffect(() => (recebe ? () => useMiraNoMapa.getState().mostrarDaMesa(NENHUMA) : undefined), [recebe])
}

/**
 * A mira desta tela como sai à mesa, para o mestre (a store dele já é a do host: a forma e a cor são
 * as que ele tem). Só o que os outros veem: sem alvo marcado, sem o mouse. `null` = sem mira, ou a
 * que não sai daqui (`fio` ausente).
 */
export function miraDaTelaNoFio(mira: MiraNoMapa | null): MiraNaMesaNoFio | null {
  if (mira === null || mira.fio === undefined) return null
  const { fio } = mira
  return {
    tokenId: mira.tokenId,
    forma: mira.forma,
    cor: mira.cor,
    acendeQuemUsa: mira.acendeQuemUsa,
    ...(mira.direcao === null ? {} : { direcao: mira.direcao }),
    ...(fio.ponto === undefined ? {} : { ponto: fio.ponto }),
    ...(fio.centroId === undefined ? {} : { centroId: fio.centroId }),
  }
}

/**
 * O mestre: as miras dos jogadores (`useMiraNaMesa`) no chão do mapa aberto, refeitas quando elas
 * ou o mapa mudam. Devolve o desligar (a sala fechou).
 */
export function ligarMirasDoMestreAoChao(): () => void {
  const mostrar = () => useMiraNoMapa.getState().mostrarDaMesa(mirasNoChao(useMiraNaMesa.getState().miras, useMapStore.getState().map))
  const pararMiras = useMiraNaMesa.subscribe((agora, antes) => {
    if (agora.miras !== antes.miras) mostrar()
  })
  const pararMapa = useMapStore.subscribe((agora, antes) => {
    if (agora.map !== antes.map && useMiraNaMesa.getState().miras.length > 0) mostrar()
  })
  mostrar()
  return () => {
    pararMiras()
    pararMapa()
    useMiraNaMesa.getState().trocar([])
    useMiraNoMapa.getState().mostrarDaMesa(NENHUMA)
  }
}

/**
 * A mira desta tela vai à mesa enquanto a batalha está na tela (`enviar` é a conexão). Só a mira
 * local muda o envio; o passar do mouse (o foco) não sai daqui. Devolve o desligar, que fecha a
 * mira que estiver no ar.
 */
export function ligarEnvioDaMira(enviar: (msg: BatalhaMiraMessage) => void): () => void {
  const envio = criarEnvioDaMira(enviar, {
    agora: () => performance.now(),
    agendar: (fazer, ms) => setTimeout(fazer, ms),
    cancelar: (id) => clearTimeout(id),
  })
  envio.mudou(useMiraNoMapa.getState().local)
  const parar = useMiraNoMapa.subscribe((agora, antes) => {
    if (agora.local !== antes.local) envio.mudou(agora.local)
  })
  return () => {
    parar()
    envio.parar()
  }
}
