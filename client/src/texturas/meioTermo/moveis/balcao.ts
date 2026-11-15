/**
 * BALCÃO de cima com volume (móveis de casa, 28/10/2026): o da cozinha e o da
 * taverna. ESTICA como o aparador: o mestre puxa o comprimento e as tábuas do
 * tampo correm por ele, sem nada que se repita por casa. A frente (o lado de
 * baixo, o do freguês) tem a moldura grossa do tampo e, rente ao chão, a
 * barra de pé de latão de ponta a ponta. A barra comprida e clara é o que
 * separa o balcão do aparador (que tem os dois puxadores no meio) a 25% de
 * zoom. A altura é a do aparador, perto da mesa, para a mesa posta (os Pratos)
 * ficar em cima dos dois na vista 3/4. Materiais: `madeira` e `barra`.
 *
 * NA 3/4 A FRENTE É DESENHADA (15/11/2026, "o balcão em 3/4 fica estranho"):
 * antes a frente era a madeira lisa que a 3/4 varre e a barra de pé subia do
 * chão como um muro baixo de latão. Agora a frente mostra a beira do tampo com
 * a sombra que ela faz, o quadro de madeira em pé com as almofadas em relevo
 * (uma a cada 2/3 de casa, correndo com o comprimento) e o rodapé escuro: é a
 * frente em faixas do guarda-roupa (`guardaRoupa.ts`), guardada debaixo do
 * tampo na vista de cima. A barra de pé fica no ar, presa na frente do corpo
 * por braços, como a do balcão de taverna: na 3/4 os braços aparecem saindo
 * da frente até ela.
 */
import { barra, caixa, capsula, type Forma } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, naFaixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { comMeioEm, quartosDeVolta } from './varalDeBandeirinhas'

/** Altura do balcão em casas (a do aparador). */
const ALTURA = 0.62
/** Altura da barra de pé em casas: no ar, presa por braços (antes 0,14, subindo do chão). */
const ALTURA_DA_BARRA = 0.18
/** Um braço da barra em cada ponta e um a cada tanto de comprimento, em casas. */
const PASSO_DOS_BRACOS = 1

// ---------- a frente na 3/4, desenhada de frente ----------

/** A beira do tampo vista de frente, a sombra que ela faz no corpo e o rodapé (px). */
const BEIRA_DO_TAMPO = 3.6
const ALTO_DA_SOMBRA_DO_TAMPO = 2.4
const RODAPE = 3.2
/** O quadro: a lateral de cada ponta, o montante entre duas almofadas e as travessas de cima e de baixo (px). */
const LATERAL = 3.2
const MONTANTE = 3.2
const TRAVESSA = 3.4
/** Uma almofada a cada tanto de comprimento (casas); o painel em relevo recua isto da moldura dela (px). */
const LARGURA_DA_ALMOFADA = 0.66
const RECUO_DO_PAINEL = 2.2
/** Os tons da madeira de frente: o quadro, o fundo da almofada, o painel que pega a luz, o rodapé e a beira do tampo. */
const TOM_DO_QUADRO = 0.86
const TOM_DO_FUNDO = 0.78
const TOM_DO_PAINEL = 1.04
const TOM_DO_RODAPE = 0.64
const TOM_DA_BEIRA = 1.02

/** A frente inteira, de frente (x como na pegada, y = 0 no chão e negativo para cima). */
function desenharFrente(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  const { hw, w, g } = c
  const mad = c.m.madeira
  const pecas: PecaDaFrente[] = []
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente): void => {
    pecas.push({ forma, mat, o })
  }
  const dePe = (tom: number, semente: number, bisel: number): OpcoesDaFrente => ({ eixo: QUARTO, tabua: 0, bisel, tom, semente })
  const alto = -H + BEIRA_DO_TAMPO
  // O quadro em pé, da beira do tampo ao rodapé (passa um pouco por baixo dos dois).
  por(caixa(-hw, alto - 0.5, hw, -RODAPE + 0.4, 0.5), mad, dePe(TOM_DO_QUADRO, 670, 0.9))
  // As almofadas: o fundo afundado e o painel em relevo, que corre com o comprimento.
  const almofadas = Math.max(1, Math.round(w / (g * LARGURA_DA_ALMOFADA)))
  const largura = (w - 2 * LATERAL - (almofadas - 1) * MONTANTE) / almofadas
  const topo = alto + TRAVESSA
  const pe = -RODAPE - TRAVESSA
  if (largura > 2 * RECUO_DO_PAINEL + 1) {
    for (let i = 0; i < almofadas; i += 1) {
      const x0 = -hw + LATERAL + i * (largura + MONTANTE)
      const x1 = x0 + largura
      por(caixa(x0, topo, x1, pe, 0.5), mad, { ...dePe(TOM_DO_FUNDO, 671 + i * 2, 0.3), recesso: { k: 2.4, forca: 0.36 }, contorno: 0.12 })
      por(caixa(x0 + RECUO_DO_PAINEL, topo + RECUO_DO_PAINEL, x1 - RECUO_DO_PAINEL, pe - RECUO_DO_PAINEL, 0.6), mad, { ...dePe(TOM_DO_PAINEL, 672 + i * 2, 2.1), contorno: 0.14 })
    }
  }
  // O rodapé escuro, rente ao chão.
  por(caixa(-hw, -RODAPE, hw, 0, 0.4), mad, { eixo: 0, tabua: 0, bisel: 0.8, tom: TOM_DO_RODAPE, semente: 690 })
  // A sombra que a beira do tampo faz no alto do quadro e, por cima de tudo, a beira.
  por(caixa(-hw + 0.6, alto - 0.4, hw - 0.6, alto + ALTO_DA_SOMBRA_DO_TAMPO, 0), SOMBRA_DA_MADEIRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4, semente: 691 })
  por(caixa(-hw, -H, hw, alto, 0.6), mad, { eixo: 0, tabua: 0, bisel: 1.1, tom: TOM_DA_BEIRA, luz: 0.06, semente: 692 })
  return pecas
}

/**
 * A frente toda guardada debaixo do tampo, na fundura do corpo (sem faixa de cima: de cima o balcão é o tampo): o
 * corpo até a frente, as cantoneiras, as frestas das faixas e as cópias da frente, que vêm antes do tampo na lista
 * para ele as cobrir de cima.
 */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number, fimDoTampo: number): void {
  const { hw, hh } = c
  const { faixas, frente } = fatiar(H, 0, 0, fimDoTampo + hh, fimDoTampo)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1.4), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, fimDoTampo), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const desenho = desenharFrente(c, H)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

export const montarBalcao: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const H = g * ALTURA
  // O tampo vai até a moldura; entre ela e a beira da frente fica a barra de pé.
  const fimDoTampo = hh - 0.24 * h
  const tampo = caixa(-hw, -hh, hw, fimDoTampo, 1.4)
  // Sem giro, a frente desenhada. Girado, ela fica de lado ou atrás na 3/4, que só varre a madeira, como antes: a
  // frente guardada ali só deixaria um fio dela na beira da lateral.
  if (quartosDeVolta(c.giro) === 0) guardarAFrente(c, cena, H, fimDoTampo)
  else cena.sombras.push({ forma: tampo, z: H })
  cena.sombras.push(contato(tampo))
  // A barra de pé de latão, no ar, rente ao chão.
  const yBarra = hh - 0.09 * h
  const barraDePe = capsula(-hw + 2.4, yBarra, hw - 2.4, yBarra, 1.5)
  cena.sombras.push({ forma: barraDePe, z: g * ALTURA_DA_BARRA, solta: true, suave: 1.2, forca: 0.22 })

  const L = cena.partes
  L.push(P(tampo, mad, { tabua: 7, bisel: 1.6, semente: 661 }))
  // A prateleira de trás, um degrau abaixo do tampo: o lado de quem serve.
  L.push(P(caixa(-hw + 1.2, -hh, hw - 1.2, -hh + 0.2 * h, 0.8), mad, { tabua: 0, bisel: 0.8, tom: 0.72, recesso: { k: 1.4, forca: 0.22 }, semente: 664 }))
  // A moldura da frente: a beira grossa do tampo, mais clara, onde se debruça.
  L.push(P(caixa(-hw, fimDoTampo - 0.22 * h, hw, fimDoTampo, 1.2), mad, { tabua: 0, bisel: 1.3, luz: 0.08, semente: 662, projeta: { dist: 1.2, forca: 0.26 } }))
  // Os braços da barra: o meio de cada um fica na barra, para subir com ela na 3/4 e ir, na altura dela, até a frente.
  const bracos = Math.max(2, Math.round(w / (g * PASSO_DOS_BRACOS)) + 1)
  for (let i = 0; i < bracos; i += 1) {
    const x = -hw + 5 + ((w - 10) * i) / (bracos - 1)
    L.push(P(comMeioEm(barra(x, fimDoTampo, x, yBarra, 1.4), x, yBarra), c.m.barra, { eixo: QUARTO, bisel: 0.5, contorno: 0.26, tom: 0.82, semente: 700 + i }))
  }
  L.push(P(barraDePe, c.m.barra, { tabua: 0, bisel: 1, contorno: 0.2, semente: 663 }))
}
