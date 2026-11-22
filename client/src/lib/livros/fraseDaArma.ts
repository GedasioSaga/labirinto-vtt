import { quemUsaDeTreino } from '../batalha/ensaio/ensaioDoItem'
import { ABA_DAS_ARMAS, CAMPO_DO_EFEITO } from '../batalha/leituraDaFicha'
import { lerMecanica } from '../batalha/mecanica/modelo'
import { resumoDaMecanica } from '../batalha/mecanica/resumo'
import type { CartaoDaFicha, MecanicaGuardada } from '../personagem'
import { abaDoSistema, type SistemaDeRpg } from '../sistemaDeRpg'

/**
 * O "O QUE ELA FAZ" DA ARMA EM TEXTO (ARMAS-FONTE-UNICA; regra do dono: "não
 * posso ter nada que um lugar diz uma coisa e em outro diz outra"). A arma
 * montada tem o campo Efeito em texto livre ao lado da mecânica: os dois não
 * podem se contradizer. Escolher um modelo troca o texto pela frase do resumo;
 * o texto que já era a frase (ou vazio) segue a mecânica a cada mudança; o
 * texto escrito à mão fica até o próximo modelo. Puro.
 */

/** O que a arma sem mecânica faz: a mesma frase do editor fechado. */
export const ARMA_SO_COM_O_DANO = 'Sem mecânica, o Atacar usa só o dano da arma.'

/** "O que ela faz" numa frase: a mesma nos 3 lugares (o boneco de treino dá os números, como no Testar). */
export function fraseDoQueElaFaz(mecanica: MecanicaGuardada | undefined, sistema: SistemaDeRpg): string {
  const lida = lerMecanica(mecanica)
  if (lida.tipo === 'nenhuma') return ARMA_SO_COM_O_DANO
  if (lida.tipo !== 'pecas') return 'Montada num app mais novo: atualize o app para ver.'
  return resumoDaMecanica(lida.mecanica, { personagem: quemUsaDeTreino(sistema), sistema }).join(' ')
}

/** A aba Armas deste sistema tem o campo Efeito? Sem ele, não há texto a seguir. */
export function armaTemCampoDeEfeito(sistema: SistemaDeRpg): boolean {
  return abaDoSistema(sistema, ABA_DAS_ARMAS)?.campos.some((campo) => campo.id === CAMPO_DO_EFEITO) === true
}

/**
 * O texto do Efeito depois de a mecânica mudar de `antes` para `depois`.
 * Modelo escolhido, texto vazio ou texto igual à frase de antes: vira a frase
 * nova. Mecânica tirada: a frase automática sai (ela diria o que não existe
 * mais); o texto à mão fica.
 */
export function efeitoQueSegueAMecanica(texto: string, antes: MecanicaGuardada | undefined, depois: MecanicaGuardada | undefined, sistema: SistemaDeRpg, escolheuModelo: boolean): string {
  const atual = texto.trim()
  const fraseDeAntes = lerMecanica(antes).tipo === 'pecas' ? fraseDoQueElaFaz(antes, sistema) : null
  const eraAFrase = atual === '' || atual === fraseDeAntes
  if (lerMecanica(depois).tipo !== 'pecas') return eraAFrase ? '' : texto
  return escolheuModelo || eraAFrase ? fraseDoQueElaFaz(depois, sistema) : texto
}

/** O cartão de arma da ficha com o Efeito que segue a mecânica nova (só quando a mecânica mudou; a proposta do dono não conta). */
export function cartaoComOEfeitoDaMecanica(antes: CartaoDaFicha, depois: CartaoDaFicha, sistema: SistemaDeRpg, escolheuModelo: boolean): CartaoDaFicha {
  if (depois.mecanica === antes.mecanica || !armaTemCampoDeEfeito(sistema)) return depois
  const atual = depois.campos[CAMPO_DO_EFEITO] ?? ''
  const texto = efeitoQueSegueAMecanica(atual, antes.mecanica, depois.mecanica, sistema, escolheuModelo)
  return texto === atual ? depois : { ...depois, campos: { ...depois.campos, [CAMPO_DO_EFEITO]: texto } }
}
