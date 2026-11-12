import { LIVRO_DRAGON_BALL } from './livro/livroDragonBall'
import { registrarLivroDragonBall } from './sistemaDragonBall'

/**
 * Põe o livro do Dragon Ball Tales no sistema embutido. Importado SÓ pelo app
 * do mestre (`src/main.tsx`), antes do primeiro render: a janela do livro, a
 * busca, o NPC pela IA e o envio do livro ao jogador leem `sistema.livro` na
 * hora, como antes. A página do jogador não importa este arquivo e não carrega
 * o livro (caça 12/11/2026, O7).
 */
registrarLivroDragonBall(LIVRO_DRAGON_BALL)
