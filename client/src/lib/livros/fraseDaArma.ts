import { camposComTextoGerado, cartaoComTextoGerado } from '../batalha/mecanica/textoGerado'
import type { CartaoDaFicha, MecanicaGuardada } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * O "O QUE ELA FAZ" DA ARMA EM TEXTO (ARMAS-FONTE-UNICA; regra do dono: "não
 * posso ter nada que um lugar diz uma coisa e em outro diz outra"). A arma
 * montada tem o campo Efeito em texto ao lado da mecânica: os dois não podem
 * se contradizer. Com mecânica, o Efeito É a frase do resumo, sempre (a
 * janela não o deixa escrever); sem mecânica, o texto é livre.
 *
 * Fase ED2 do editor novo: quem escreve é o ponto único do texto gerado
 * (`lib/batalha/mecanica/textoGerado.ts`), que também escreve os campos da
 * técnica. Os nomes de sempre ficam aqui para quem já os usa. Puro.
 */
export { ARMA_SO_COM_O_DANO, armaTemCampoDeEfeito, efeitoQueSegueAMecanica, fraseDoQueElaFaz } from '../batalha/mecanica/textoGerado'

/** Os campos da arma com o Efeito que a mecânica diz, para gravar: com peças, o Efeito é a frase (o texto à mão de antes sai); sem, os campos ficam. */
export function camposComOEfeitoDaMecanica(campos: Readonly<Record<string, string>>, mecanica: MecanicaGuardada | undefined, sistema: SistemaDeRpg): Record<string, string> {
  return camposComTextoGerado(campos, mecanica, sistema, 'arma')
}

/** O cartão de arma da ficha com o Efeito que segue a mecânica nova (só quando a mecânica mudou; a proposta do dono não conta). */
export function cartaoComOEfeitoDaMecanica(antes: CartaoDaFicha, depois: CartaoDaFicha, sistema: SistemaDeRpg): CartaoDaFicha {
  return cartaoComTextoGerado(antes, depois, sistema, 'arma')
}
