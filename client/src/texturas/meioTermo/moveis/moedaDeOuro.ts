/**
 * MOEDA DE OURO de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre:
 * "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): uma moeda só, deitada no chão,
 * grande o bastante para se ver no mapa. O disco de ouro com a BORDA alta em cordão (as contas pegam a luz uma
 * sim, uma não), o SULCO do aro de dentro, o campo liso com o reflexo largo e, no meio, uma COROA de três pontas
 * em relevo baixo (inventada), com a sombrinha dela no campo. A MEIA-LUA de luz na beira do lado da luz e a de
 * sombra do outro lado são o que faz ler metal cunhado, e não botão amarelo. Sombra fina.
 *
 * O desenho é o de `tesouroDeOuro.ts`, o mesmo das moedas da beira do monte de moedas (lá, menores e sem a
 * coroa de peça). Na 3/4 (derivada) a moeda é uma coluna fininha. Lê `c.giro` para a meia-lua e a luz pintada
 * ficarem do lado da luz NA TELA. Sem material no painel; sem luz. Esticada, a moeda fica oval: o raio sai do
 * menor lado e o achatado, da razão entre os dois.
 */
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import { ESCURO_DO_OURO, formaDaMoeda, paraALuz, pintarMoedaDeOuro, type MoedaDeOuro } from './tesouroDeOuro'

/** O disco ocupa esta fração da pegada (o resto é a sombra fina para baixo à direita). */
const OCUPA = 0.92
/** A grossura da moeda (casas): a altura da sombra e a da frente na 3/4. */
const GROSSURA = 0.035
const CONTATO = 0.34
const FORCA_DA_SOMBRA = 0.3

export const montarMoedaDeOuro: MontarMovel = (c, cena) => {
  const deitada = c.w >= c.h
  const r = (deitada ? c.hw : c.hh) * OCUPA
  const moeda: MoedaDeOuro = {
    x: 0,
    y: 0,
    r,
    achatado: Math.min(c.w, c.h) / Math.max(c.w, c.h),
    ang: deitada ? 0 : Math.PI / 2,
    tom: 1,
    detalhe: 'unica',
    projeta: 0,
    semente: 1750,
  }
  const disco = formaDaMoeda(moeda)
  cena.sombras.push({ forma: disco, z: c.g * GROSSURA, forca: FORCA_DA_SOMBRA }, contato(disco, CONTATO))
  pintarMoedaDeOuro(c.peca, cena, moeda, paraALuz(c.giro))
  cena.corDoPiso = ESCURO_DO_OURO
}
