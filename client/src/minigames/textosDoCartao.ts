/**
 * OS TEXTOS DO CARTÃO DO SELO, por jogo: os do cartão do jogador
 * (`player/PlayerPinCard.tsx`) e os da prévia "O jogador vê" da ficha do
 * desafio (`components/livro/desafio/PreviaDoJogador.tsx`). Um lugar só, para
 * a prévia nunca dizer outra coisa que o cartão. Só dados, sem React.
 */
import type { JogoDoMinigame, MinigameVisivel } from './tipos'

/**
 * O REGISTRO DOS JOGOS no cartão: o que cada um diz quando o mestre não
 * escreveu nada no pino (`vazio`) e quando quem chama é o mestre (`doMestre`).
 * `Record` de todos os jogos: jogo novo sem frase não compila — nenhum cai na
 * frase da dança por engano (bug de 09/11/2026: o Fogo dizia "Desafio de dança").
 */
export const TEXTOS_DO_JOGO: Record<JogoDoMinigame, { titulo: string; vazio: string; doMestre: string }> = {
  danca: { titulo: 'Dança', vazio: 'Um desafio de dança espera por aqui.', doMestre: 'Desafio de dança. O mestre chama quando for a hora.' },
  pesca: { titulo: 'Pesca', vazio: 'Um lugar para pescar.', doMestre: 'Pesca. O mestre chama quando for a hora.' },
  tiro: { titulo: 'Barraca de tiro', vazio: 'Uma barraca de tiro ao alvo.', doMestre: 'Barraca de tiro. O mestre chama quando for a hora.' },
  fogo: { titulo: 'Fogo na Floresta', vazio: 'Fogo na floresta! Alguém precisa de ajuda aqui.', doMestre: 'Fogo na floresta. O mestre chama quando for a hora.' },
  bolha: { titulo: "Bolha d'Água", vazio: 'Fogo! Alguém precisa de ajuda para apagar com bolhas.', doMestre: "Bolha d'Água. O mestre chama quando for a hora." },
  alavanca: { titulo: 'Alavanca da ponte', vazio: 'Uma alavanca diante da ponte levadiça erguida.', doMestre: 'Alavanca da ponte. O mestre chama quando for a hora.' },
  // O puzzle começa pelo jogador ("Examinar", na tela do puzzle); o mestre nunca chama. O nome dele não vem no recorte.
  puzzle: { titulo: 'Puzzle', vazio: 'Há algo aqui para examinar de perto.', doMestre: 'Um mecanismo para examinar de perto.' },
}
/**
 * A ALAVANCA NA CENA DO CANHÃO (B6 das NOTAS do editor, 21/11/2026): o mesmo
 * jogo, outra coisa no mapa. Sem cena no recorte (host de antes), a ponte.
 */
const TEXTOS_DA_ALAVANCA_DO_CANHAO = {
  titulo: 'Alavanca do canhão',
  vazio: 'Uma alavanca ao lado das lajes do baluarte.',
  doMestre: 'Alavanca do canhão. O mestre chama quando for a hora.',
}
/** Os textos do jogo deste selo: os do registro do cartão, com a cena da alavanca. */
export function textosDoJogoDoSelo(visivel: MinigameVisivel | undefined): { titulo: string; vazio: string; doMestre: string } {
  const jogo = visivel?.jogo ?? 'danca'
  if (jogo === 'alavanca' && visivel?.cena === 'canhao') return TEXTOS_DA_ALAVANCA_DO_CANHAO
  return TEXTOS_DO_JOGO[jogo] ?? TEXTOS_DO_JOGO.danca
}
