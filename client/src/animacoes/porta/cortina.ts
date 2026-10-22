import type { AnimacaoDePorta, PecaDaFolha } from '../../portas/animacoesDePorta'
import { pintarFolha } from '../../portas/animacoesDePorta'
import { comecarQuadro, escalaDa, quantasPecas, suave, trecho } from './_folha'

/**
 * CORTINA DE CONTAS: a folha cheia vira uma fileira de contas redondas ao longo
 * do vão inteiro (a faixa some e as contas incham um pouco além da espessura),
 * que se abre pelo meio: cada metade corre para a sua ponta e se amontoa ali,
 * no batente, balançando ao longo da normal como cortina que alguém afasta. No
 * fim os dois montes entram nas pontas. Fechando, as contas voltam balançando
 * e a faixa se fecha. Uma conta a cada 5 px de tela; faixa e contas pintadas
 * juntas (`pintarFolha`), com um contorno só. Opaca o caminho inteiro.
 */

const PASSO_DA_CONTA_PX = 5
/** O vão inteiro tem 1/0,6 do comprimento da folha do protótipo: os limites crescem na mesma conta. */
const CONTAS_MIN = 8
const CONTAS_MAX = 23
/** A faixa cheia afina até sumir aqui: daí em diante só as contas. */
const FIM_DA_FAIXA = 0.16
/** Raio da conta solta, em relação à meia espessura da porta (passa um pouco dela). */
const CONTA = 1.15
const INICIO_DA_ABERTURA = 0.06
const FIM_DA_ABERTURA = 0.74
/** No monte, cada conta ocupa esta fração do passo (elas se sobrepõem: o monte é cheio). */
const APERTO = 0.45
const BALANCO_PX = 2
const BALANCO_ONDAS = 2
const BALANCO_DEFASAGEM = 0.8
const INICIO_DO_RECOLHER = 0.62

const desenhar: AnimacaoDePorta['desenhar'] = (g, porta, progresso) => {
  const p = comecarQuadro(g, porta, progresso)
  if (p === null) return

  const L = porta.meioComprimento
  const contas = quantasPecas(porta, PASSO_DA_CONTA_PX, CONTAS_MIN, CONTAS_MAX)
  const passo = (2 * L) / contas
  const faixa = suave(trecho(p, 0, FIM_DA_FAIXA))
  const meiaFaixa = (porta.espessura / 2) * (1 - faixa)
  const pecas: PecaDaFolha[] = []
  if (meiaFaixa > 0) pecas.push({ forma: 'retangulo', cx: porta.cx, cy: porta.cy, dx: porta.ux, dy: porta.uy, meioComprimento: L, meiaEspessura: meiaFaixa })

  const abre = suave(trecho(p, INICIO_DA_ABERTURA, FIM_DA_ABERTURA))
  // Recolher acelera (quadrático): a curva de tempo já freia o fim, e as duas freadas juntas
  // deixavam ~150 ms parados no final. Assim o monte some no último quadro, não antes.
  const r = trecho(p, INICIO_DO_RECOLHER, 1)
  const recolhe = r * r
  const tamanho = 1 - recolhe
  // Com a faixa ainda cheia a conta cabe nela (raio = meia espessura); solta, incha até CONTA.
  const raio = Math.min(passo / 2, (porta.espessura / 2) * (1 + (CONTA - 1) * faixa)) * tamanho
  if (raio > 0) {
    const nx = -porta.uy
    const ny = porta.ux
    const balancoMax = BALANCO_PX / escalaDa(porta)
    for (let i = 0; i < contas; i += 1) {
      const lado = i < contas / 2 ? -1 : 1
      const daPonta = lado < 0 ? i : contas - 1 - i
      const inicio = -L + passo * (i + 0.5)
      const noMonte = lado * (L - passo * APERTO * (daPonta + 0.5))
      // Recolhendo, o monte escorrega para dentro da ponta junto com o encolher.
      const destino = noMonte + (lado * L - noMonte) * recolhe
      const ao = inicio + (destino - inicio) * abre
      const balanco = balancoMax * Math.sin(Math.PI * abre) * Math.sin(2 * Math.PI * BALANCO_ONDAS * abre - i * BALANCO_DEFASAGEM)
      pecas.push({ forma: 'circulo', cx: porta.cx + porta.ux * ao + nx * balanco, cy: porta.cy + porta.uy * ao + ny * balanco, raio })
    }
  }
  pintarFolha(g, porta, pecas)
}

export default desenhar
