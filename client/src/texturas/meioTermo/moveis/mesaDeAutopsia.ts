/**
 * MESA DE AUTÓPSIA de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a ideia
 * do objeto das referências): o tampo de INOX em forma de bandeja, com a ABA alta em volta, a BACIA rasa por dentro e,
 * no meio dela, a CHAPA de escorrer com o SULCO do meio e os sulcos em ESPINHA DE PEIXE que descem para ele e para o
 * pé. Entre a chapa e a aba corre a CALHA, que desce para o POÇO do pé da mesa, onde fica o RALO. Na cabeceira, o
 * APOIO DE CABEÇA de borracha com a cova em U e a TORNEIRA de bica curta presa na aba de trás; perto do ralo, uma
 * MANCHA seca, fraca e marrom (a única sujeira).
 *
 * A cabeceira fica à esquerda (o lado da luz) e o ralo à direita. A 25% de zoom sobram o retângulo claro de aço com
 * a moldura da aba, a espinha escura correndo para o pé e o ponto escuro do ralo: é o que diz "mesa de autópsia".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): o tampo é um tampo solto na altura da mesa, com a beirada da bandeja
 * (`ESPESSURA_DO_TAMPO_DA_MESA_DE_AUTOPSIA`), e debaixo dele aparecem o PEDESTAL de aço (uma coluna larga no meio) e a
 * CHAPA DA BASE no chão. Nada lê o giro: girada, a 3/4 gira a cena e mostra a ponta da bandeja.
 *
 * Sem material escolhido: o inox, a borracha e o níquel são fixos.
 */
import { caixa, capsula, elipse, elipseGirada, menos, uniao } from './formas'
import { contato } from './motor'
import { G, type MontarMovel } from './contexto'
import { BORRACHA, ESCURO, INOX, MANCHA, NIQUEL, BRILHO_DO_NIQUEL, PISO_DO_NECROTERIO, texEscovado } from './apoioDoNecroterio'

/** A altura do tampo em casas (um nada acima da mesa, 0,5) e a grossura da bandeja de aço na 3/4 (px do protótipo). */
const ALTURA_DO_TAMPO = 0.52
export const ESPESSURA_DO_TAMPO_DA_MESA_DE_AUTOPSIA = 0.08 * G

/** O tampo recua isto da pegada; a quina dele; a aba alta em volta; a calha entre a aba e a chapa (px do protótipo). */
const FOLGA = 0.6
const QUINA = 3.2
const ABA = 3.2
const CALHA = 2.3
/** O poço do ralo no pé da mesa: o comprimento dele e o raio do ralo (px). */
const POCO = 7.5
const RAIO_DO_RALO = 2.1
/**
 * Os sulcos da chapa: o passo entre duas espinhas, a meia grossura, quanto recuam da beira e a parte lisa da
 * cabeceira (px); a espinha anda esta parte do passo para o pé enquanto desce para o sulco do meio.
 */
const PASSO_DO_RASGO = 5.2
const ESPINHA = 0.9
const MEIO_RASGO = 0.5
const RECUO_DO_RASGO = 2.4
const CABECEIRA_LISA = 13
/** O apoio de cabeça: o meio dele a partir da beira da chapa, a meia largura e a meia altura (px). */
const APOIO = { daBeira: 6, meiaLargura: 2.6, meiaAltura: 5.4 } as const
/** O pedestal e a chapa da base, em fração do meio lado da pegada; a altura da chapa em casas. */
const PEDESTAL = { x: 0.14, tras: 0.35, frente: 0.45 } as const
const BASE = { x: 0.22, tras: 0.6, frente: 0.68 } as const
const ALTURA_DA_BASE = 0.05

/** Os tons do aço: o tampo, a bacia afundada, a chapa e o poço. */
const TOM_DA_ABA = 1.02
const TOM_DA_BACIA = 0.86
const TOM_DA_CHAPA = 0.97
const TOM_DO_POCO = 0.8
const BRILHO_DO_ACO = 0.3
/** A borracha do apoio de cabeça, mais clara que a preta (o cinza da borracha gasta, que se lê no aço). */
const TOM_DO_APOIO = 1.4

export const montarMesaDeAutopsia: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const zTampo = g * ALTURA_DO_TAMPO
  const [x0, y0, x1, y1] = [-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA]
  const tampo = caixa(x0, y0, x1, y1, QUINA)

  // As sombras: a de baixo (pesada, em volta do tampo), a do tampo (solta), o pedestal e a chapa da base.
  const alem = 1.3
  cena.sombras.push(
    { forma: caixa(x0 - alem, y0 - alem, x1 + alem, y1 + alem, QUINA + alem), z: 0, suave: alem, forca: 0.34 },
    { forma: tampo, z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
  )
  const pedestal = caixa(-hw * PEDESTAL.x, -hh * PEDESTAL.tras, hw * PEDESTAL.x, hh * PEDESTAL.frente, 2)
  const base = caixa(-hw * BASE.x, -hh * BASE.tras, hw * BASE.x, hh * BASE.frente, 2.4)
  cena.sombras.push(
    { forma: pedestal, z: zTampo - ESPESSURA_DO_TAMPO_DA_MESA_DE_AUTOPSIA, suave: 1, forca: 0.28 },
    { forma: base, z: g * ALTURA_DA_BASE, forca: 0.2 },
    contato(base, 0.34),
  )

  const L = cena.partes
  const aco = (tom: number, semente: number) => ({ eixo: 0, tabua: 0, tom, metal: BRILHO_DO_ACO, textura: texEscovado, semente })
  // O tampo com a aba alta e, dentro dela, a bacia afundada.
  L.push(P(tampo, INOX, { ...aco(TOM_DA_ABA, 7001), bisel: 1.6, contorno: 0.26 }))
  const [bx0, by0, bx1, by1] = [x0 + ABA, y0 + ABA, x1 - ABA, y1 - ABA]
  L.push(P(caixa(bx0, by0, bx1, by1, QUINA - 1), INOX, { ...aco(TOM_DA_BACIA, 7002), bisel: 0.6, contorno: 0.3, recesso: { k: 2.4, forca: 0.42 } }))
  // O poço do ralo, no pé, um degrau mais fundo.
  const xPoco = bx1 - CALHA - POCO
  L.push(P(caixa(xPoco, by0 + CALHA, bx1 - 0.8, by1 - CALHA, 1.6), INOX, { ...aco(TOM_DO_POCO, 7003), bisel: 0.5, contorno: 0.18, recesso: { k: 1.6, forca: 0.35 } }))
  // A chapa de escorrer, um nada acima da bacia (a sombra dela cai na calha).
  const [px0, py0, px1, py1] = [bx0 + CALHA, by0 + CALHA, xPoco - CALHA, by1 - CALHA]
  L.push(P(caixa(px0, py0, px1, py1, 1.5), INOX, { ...aco(TOM_DA_CHAPA, 7004), bisel: 0.9, contorno: 0.24, projeta: { dist: 0.8, forca: 0.26 } }))
  // O sulco do meio, da cabeceira lisa ao poço, e os sulcos em espinha de peixe que descem para ele e para o pé.
  const inicio = px0 + CABECEIRA_LISA
  const fim = px1 - RECUO_DO_RASGO
  const sulco = { tabua: 0, bisel: 0.2, contorno: 0.06, alfa: 0.8, recesso: { k: 0.6, forca: 0.3 } }
  L.push(P(capsula(inicio - 2, 0, px1 + 0.6, 0, MEIO_RASGO), ESCURO, { ...sulco, semente: 7009 }))
  const espinhas = Math.max(3, Math.floor((fim - inicio) / PASSO_DO_RASGO))
  const passo = (fim - inicio) / espinhas
  const meiaChapa = (py1 - py0) / 2
  for (let i = 0; i < espinhas; i += 1) {
    const x = inicio + i * passo
    for (const lado of [-1, 1]) {
      L.push(P(capsula(x, lado * (meiaChapa - RECUO_DO_RASGO), x + passo * ESPINHA, lado * 1.3, MEIO_RASGO * 0.8), ESCURO, { ...sulco, alfa: 0.62, semente: 7010 + i }))
    }
  }

  // O ralo no meio do poço: o aro de aço, o furo e a cruz da grelha.
  const xRalo = (xPoco + bx1 - 0.8) / 2
  L.push(P(elipse(xRalo, 0, RAIO_DO_RALO + 0.9, RAIO_DO_RALO + 0.9), INOX, { tabua: 0, bisel: 0.7, tom: 0.98, contorno: 0.26, metal: 0.45, textura: texEscovado, semente: 7030 }))
  L.push(P(elipse(xRalo, 0, RAIO_DO_RALO, RAIO_DO_RALO), ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.12, recesso: { k: 1, forca: 0.45 }, semente: 7031 }))
  L.push(P(uniao(capsula(xRalo - RAIO_DO_RALO, 0, xRalo + RAIO_DO_RALO, 0, 0.35), capsula(xRalo, -RAIO_DO_RALO, xRalo, RAIO_DO_RALO, 0.35)), INOX, { tabua: 0, bisel: 0.3, tom: 0.9, contorno: 0.14, metal: 0.4, semente: 7032 }))

  // A mancha seca: perto do ralo, na chapa e escorrendo pela calha (fraca, de beira macia).
  const mancha = uniao(elipseGirada(px1 - 9, 2.5, 5.5, 3.2, 0.35), elipseGirada(px1 - 4, 5.5, 3.6, 2, -0.2))
  L.push(P(mancha, MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 1.6, semente: 7040 }))
  L.push(P(capsula(px1 - 1.5, 4.5, xRalo - 1.6, 1.2, 0.8), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.16, suave: 0.8, semente: 7041 }))

  // O apoio de cabeça de borracha: o bloco com a cova em U do pescoço virada para o corpo.
  const xApoio = px0 + APOIO.daBeira
  const bloco = caixa(xApoio - APOIO.meiaLargura, -APOIO.meiaAltura, xApoio + APOIO.meiaLargura, APOIO.meiaAltura, 1.8)
  const cova = elipse(xApoio + APOIO.meiaLargura, 0, APOIO.meiaLargura * 0.9, APOIO.meiaAltura * 0.55)
  L.push(P(menos(bloco, cova), BORRACHA, { tabua: 0, bisel: 1.2, tom: TOM_DO_APOIO, contorno: 0.3, semente: 7050, projeta: { dist: 1.1, forca: 0.3 } }))

  // A torneira na aba de trás, junto da cabeceira: a canopla, a bica curta para dentro da bacia e a alavanca.
  const [tx, ty] = [px0 + 2.6, y0 + ABA / 2]
  L.push(P(elipse(tx, ty, 1.8, 1.8), NIQUEL, { tabua: 0, bisel: 1, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7060, projeta: { dist: 0.6, forca: 0.24 } }))
  L.push(P(capsula(tx, ty, tx + 1.2, ty + 4.2, 0.8), NIQUEL, { tabua: 0, bisel: 0.6, tom: 1.05, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente: 7061, projeta: { dist: 1, forca: 0.28 } }))
  L.push(P(capsula(tx, ty, tx - 3.4, ty - 0.6, 0.55), NIQUEL, { tabua: 0, bisel: 0.4, tom: 1.12, contorno: 0.24, metal: BRILHO_DO_NIQUEL, semente: 7062, projeta: { dist: 0.7, forca: 0.24 } }))
}
