import { ABA_DOS_ITENS, passarAbaItensParaMochila } from '../../lib/livros/coisaERegra'
import { fichaComAsBalasNaMochila, municoesQueFaltam, textoDasBalasConvertidas } from '../../lib/mochila/balasNaMochila'
import { cartoesDaAba } from '../../lib/personagem'
import { abaDoSistema } from '../../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from '../acervoDeItensStore'
import { mochilaMoraNaFicha, personagensAtivos, useAdventureStore } from '../adventureStore'
import { mesaDaAventura } from '../mesaDaAventura'
import { useToastStore } from '../toastStore'

/**
 * AS FICHAS DE ANTES NA MOCHILA (frente A do levantamento de mecânicas duplicadas, decisões do dono de
 * 25/11/2026): o que a ficha guardava num segundo lugar passa sozinho para a mochila, no app do mestre,
 * quando a aventura abre ou as fichas mudam. Roda de novo sem efeito: o que já passou não volta a passar.
 *
 * Só com a mochila morando na FICHA (aventura migrada): na que ainda mora no boneco, a ficha fica como
 * está até a migração (nada se perde, o tiro continua saindo como antes).
 */

/** Uma conversão por vez: a que chega no meio de outra (as fichas mudaram pela própria conversão) não roda. */
let convertendo = false

/**
 * Os tipos de bala de texto: o Acervo ganha antes os itens de Munição que faltam (sem eles gravados, a
 * bala não se liga), e depois cada ficha liga as balas e recebe a Quantidade na mochila. Um aviso por
 * ficha, só quando algo passou.
 */
async function passarAsBalasParaAMochila(): Promise<void> {
  const aventura = useAdventureStore.getState()
  if (!mochilaMoraNaFicha(aventura) || !useAcervoDeItensStore.getState().podeGravar) return
  const faltam = municoesQueFaltam(personagensAtivos(aventura), useAcervoDeItensStore.getState().itens)
  for (const item of faltam) await useAcervoDeItensStore.getState().salvarItem(item)
  const itens = useAcervoDeItensStore.getState().itens
  const avisos: string[] = []
  for (const personagem of personagensAtivos(useAdventureStore.getState())) {
    // Num objeto: o que o callback da aventura escreve, lido depois dele (um `let` o TS estreitaria para o valor inicial).
    const feito: { texto: string | null } = { texto: null }
    const gravou = useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => {
      const conversao = fichaComAsBalasNaMochila(atual, itens, () => crypto.randomUUID())
      feito.texto = conversao.convertidas.length === 0 ? null : textoDasBalasConvertidas(atual.nome, conversao.convertidas)
      return conversao.personagem
    })
    if (gravou && feito.texto !== null) avisos.push(feito.texto)
  }
  if (avisos.length > 0) useToastStore.getState().push('info', `As balas das fichas passaram para a mochila (cada tiro agora tira 1 de lá). ${avisos.join(' ')}`, null)
}

/**
 * Os cartões antigos da aba Itens: o mesmo "Passar para a mochila" do botão da ficha
 * (`passarAbaItensParaMochila`), sem esperar o mestre editar. O cartão que a mochila não guarda
 * (modificadores, subcartões, mecânica...) fica na aba, intacto. Um aviso só, com as fichas que passaram.
 */
function passarOsItensAntigosParaAMochila(): void {
  if (!mochilaMoraNaFicha(useAdventureStore.getState())) return
  const sistema = mesaDaAventura.sistema()
  if (sistema === null) return
  const aba = abaDoSistema(sistema, ABA_DOS_ITENS)
  const passaram: string[] = []
  for (const personagem of mesaDaAventura.personagens()) {
    if (cartoesDaAba(personagem, ABA_DOS_ITENS).length === 0) continue
    const feito: { passados: number } = { passados: 0 }
    const gravou = mesaDaAventura.ajustarPersonagem(personagem.id, (atual) => {
      const passagem = passarAbaItensParaMochila(atual, aba)
      feito.passados = passagem.passados
      return passagem.personagem
    })
    if (gravou && feito.passados > 0) passaram.push(`${personagem.nome.trim() || 'Ficha sem nome'} (${feito.passados})`)
  }
  if (passaram.length > 0) useToastStore.getState().push('info', `Os cartões antigos da aba Itens passaram para a mochila: ${passaram.join(', ')}. Agora aparecem no Usar da batalha.`, null)
}

/** Roda a conversão das fichas da aventura aberta. Erro de disco no Acervo vira aviso, e as fichas ficam como estavam. */
export async function converterAsFichasDeAntes(): Promise<void> {
  if (convertendo) return
  convertendo = true
  try {
    passarOsItensAntigosParaAMochila()
    await passarAsBalasParaAMochila()
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para passar as fichas de antes para a mochila: ${erro instanceof Error ? erro.message : String(erro)}`)
  } finally {
    convertendo = false
  }
}
