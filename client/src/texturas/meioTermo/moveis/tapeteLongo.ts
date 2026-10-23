/**
 * TAPETE LONGO de cima com volume (peça nova da MT5): a passadeira de
 * comprimento livre, no chão como o tapete (quem a põe por baixo dos outros
 * móveis é `emOrdemDeDesenho`/`ehMovelDoChao` de `lib/mobilia.ts` e o
 * contêiner do chão do editor). Reusa o desenho do tapete (`tapete.ts`): a
 * franja de linho nas pontas curtas, a borda escura com o fio do meio e o
 * MOTIVO de losangos claros que se repete a cada meia casa.
 *
 * O que muda é a REPETIÇÃO POR CASA: a borda tem largura fixa em casas (não
 * cresce com o comprimento) e o campo leva UM medalhão em losango por casa,
 * contado da ponta. Assim a faixa de uma casa do meio é a mesma em qualquer
 * comprimento (3, 4, 7 casas...). A casa é a da grade de REFERÊNCIA (50 px):
 * em mapa de outra grade a conta muda (limite registrado no plano, seção MT5).
 * Material: `tecido`.
 */
import { caixa } from './formas'
import type { Textura } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  cobre,
  coresDoTapete,
  distanciaAoMotivo,
  FRANJA,
  MEIO_FIO_DO_MOTIVO,
  MIOLO_DO_MEDALHAO,
  pintarCampo,
  ruidoDeLa,
  SOMBRA_DO_TAPETE,
  texFranja,
  tingir,
  type CoresDoTapete,
} from './tapete'

/** Largura da borda em casas: fixa, para a casa do meio ser igual em qualquer comprimento. */
const BORDA_EM_CASAS = 0.14
/** Medalhão de cada casa: meia diagonal ao longo (em casas) e atravessada (fração do campo). */
const MEDALHAO_AO_LONGO = 0.3
const MEDALHAO_ATRAVESSADO = 0.62

interface GeometriaDoLongo {
  /** Meio comprimento do corpo (sem a franja) e meia largura. */
  readonly hu: number
  readonly hv: number
  readonly borda: number
  /** Onde a contagem das casas começa: a ponta do tapete inteiro (com a franja). */
  readonly ponta: number
  readonly mx: number
  readonly my: number
  readonly escalaM: number
}

/** O campo com um medalhão por casa, a borda com o motivo e o fio claro por dentro dela. */
function texLongo(t: CoresDoTapete, g: GeometriaDoLongo, deitado: boolean): Textura {
  return (u, v, x, y, _p, s, S) => {
    const U = deitado ? x : y
    const V = deitado ? y : x
    pintarCampo(s, t.campo)
    const au = Math.abs(U)
    const av = Math.abs(V)
    const ateU = g.hu - au
    const ateV = g.hv - av
    const de = Math.min(ateU, ateV)
    // Medalhão da casa: o centro dela, contado da ponta do tapete inteiro.
    const fase = (U - g.ponta) / G
    const du = Math.abs(fase - Math.floor(fase) - 0.5) * G
    const q = du / g.mx + av / g.my
    const dm = (q - 1) * g.escalaM
    tingir(s, t.escuro, cobre(dm, S))
    tingir(s, t.claro, cobre(Math.abs(dm) - 0.5, S))
    tingir(s, t.miolo, cobre((q / MIOLO_DO_MEDALHAO - 1) * g.escalaM * MIOLO_DO_MEDALHAO, S))
    const B = g.borda
    const kB = cobre(de - B, S)
    tingir(s, t.escuro, kB)
    if (kB > 0) {
      tingir(s, t.meio, cobre(Math.abs(de - B / 2) - MEIO_FIO_DO_MOTIVO, S) * kB)
      // No lado comprido o motivo corre ao longo, contado da ponta (o período divide a casa); nas pontas, atravessado.
      const dl = distanciaAoMotivo(ateV <= ateU ? U - g.ponta : V, de - B / 2, B)
      tingir(s, t.claro, cobre(dl, S) * kB)
      tingir(s, t.escuro, cobre(dl + B * 0.12, S) * kB)
    }
    tingir(s, t.claro, cobre(Math.abs(de - B - 0.75) - 0.55, S))
    s[3] += ruidoDeLa(u, v)
  }
}

export const montarTapeteLongo: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const tecido = c.m.tecido
  const cores = coresDoTapete(tecido.rgb)
  // O comprimento corre no lado maior: em pé (o padrão, 1 x 4), U = y.
  const deitado = w > h
  const hu = deitado ? hw : hh
  const hv = deitado ? hh : hw
  const fr = FRANJA * 2 * hv
  const corpoHU = hu - fr
  const noMundo = (u0: number, v0: number, u1: number, v1: number, raio: number) => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const corpo = noMundo(-corpoHU, -hv, corpoHU, hv, 1.2)
  cena.sombras.push({ forma: corpo, ...SOMBRA_DO_TAPETE })
  for (const ponta of [-1, 1]) {
    const u0 = ponta < 0 ? -hu : corpoHU - 1
    const u1 = ponta < 0 ? -corpoHU + 1 : hu
    cena.partes.push(P(noMundo(u0, -hv + 1.5, u1, hv - 1.5, 0), materialDaPeca('linho'), { textura: texFranja(corpoHU, fr, ponta, deitado), bisel: 0, contorno: 0 }))
  }
  const borda = Math.min(BORDA_EM_CASAS * G, 0.3 * hv)
  const mx = MEDALHAO_AO_LONGO * G
  const my = MEDALHAO_ATRAVESSADO * (hv - borda)
  const geometria: GeometriaDoLongo = { hu: corpoHU, hv, borda, ponta: -hu, mx, my, escalaM: (mx * my) / Math.hypot(mx, my) }
  cena.partes.push(P(corpo, tecido, { textura: texLongo(cores, geometria, deitado), bisel: 1.4, contorno: 0.16 }))
}
