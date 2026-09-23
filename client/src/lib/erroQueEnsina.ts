/**
 * A FRONTEIRA ENTRE "AVISO QUE ENSINA" E "AVISO QUE SÓ INFORMA".
 *
 * Um aviso ENSINA quando a frase pede uma AÇÃO da pessoa para o gesto que ela
 * acabou de tentar poder acontecer: "escolha uma imagem para ele antes de
 * guardar no acervo". Ela precisa ler, achar o botão, abrir o seletor do
 * sistema, procurar o arquivo na pasta dela e voltar — e nada disso cabe num
 * cronômetro. Esse aviso espera ela DISPENSAR (`kind: 'instrucao'` em
 * `stores/toastStore.ts`, sem auto-dispensa).
 *
 * Um aviso só INFORMA quando relata um fato já consumado e não há nada a
 * fazer com ele: "Goblin entrou no acervo", "Mapa salvo", "A imagem deste
 * token não está mais no disco: ele foi colocado no mapa sem foto"
 * (`IMAGEM_SUMIU_DO_ACERVO` — a peça JÁ entrou, não sobrou passo). Esse
 * continua sumindo sozinho, como sempre.
 *
 * Quem decide é QUEM LANÇA, não quem mostra: só a função que descobriu o
 * problema sabe se a mensagem dela termina numa tarefa para a pessoa. Por isso
 * a marca viaja no próprio erro e não numa lista de textos em `App.tsx`, que
 * divergiria da frase no dia em que ela mudasse.
 *
 * O contrário — transformar todo erro em aviso que fica — era a outra opção e
 * foi recusada: uma pilha de cartões que só a pessoa apaga vira lixo na tela e
 * ensina ela a fechar tudo sem ler, que é justamente o que este arquivo quer
 * evitar.
 */
export class ErroQueEnsina extends Error {
  constructor(message: string) {
    super(message)
    // `name` explícito: sem ele o `Error` traz "Error", e um log ou um
    // `String(err)` não distinguiria este dos demais.
    this.name = 'ErroQueEnsina'
  }
}

/**
 * O erro pede uma ação da pessoa?
 *
 * Função (e não `err instanceof ErroQueEnsina` espalhado) para o teste do tipo
 * existir num lugar só: `App.tsx` pergunta, não sabe como a marca é feita.
 */
export function ensinaOQueFazer(err: unknown): boolean {
  return err instanceof ErroQueEnsina
}
