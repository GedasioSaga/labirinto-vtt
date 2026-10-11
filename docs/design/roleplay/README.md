# Design da página Roleplay (salvo em 10/10/2026)

Protótipo de como seria a página Roleplay ("Mesa narrativa, sem mapa"), que hoje no app é só o aviso "em construção" (`client/src/screens/RoleplayScreen.tsx`). O usuário pediu para salvar este design. Ainda não foi aplicado no app.

Página publicada (privada): https://claude.ai/artifact/B5QmXjuhvRsnrRtS1dXWCr

## O que tem nesta pasta

| Caminho | O que é |
|---|---|
| `prototipo/index.html` | O protótipo navegável, num arquivo só. Abra no navegador, sem servidor. "Ver como: Mestre \| Jogador", no topo, troca a visão. |
| `provas/` | Prints (mestre em 1440 e 1024 px, jogador em 1440 e 390 px) e folhas de contato com o gráfico do movimento da rolagem de dado e da troca de cena. |

## O que a página tem

- **Topo:** migalhas, nome da sessão, tempo de jogo, presença dos jogadores (online, escrevendo, ausente), "Ao vivo", que pausa e retoma a mesa, e o seletor de visão.
- **Elenco:** cartões dos personagens com HP, SP, escudo, condições e o medidor de holofote (dourado a partir de 5 min sem agir, vermelho a partir de 10), mais o botão "Dar a vez". Logo abaixo, os NPCs da cena com "Falar como", tirar de cena e "Trazer à cena".
- **Palco:** capa da cena em SVG, com hora, tensão de 1 a 5 e ambiente sonoro (só visual). Embaixo, o registro: narração com capitular, fala em balão, ação, conversa fora do personagem, rolagem de dado com resultado contra dificuldade, sussurro privado, pista revelada, nota só do mestre e eventos do sistema.
- **Compositor:** "Falando como", modos Fala, Ação, Narração e Sussurro, dados rápidos, rolagem escondida e comandos com barra (`/r 2d6+3 vs 10`, `/me`, `/s`, `/ooc`, `/n`).
- **Bastidores (só o mestre vê):** Cenas preparadas, Relógios de progresso, Segredos com "Revelar aos jogadores", Turnos pela Agilidade e Resumo da sessão.
- **Jogador:** ficha com os atributos que rolam teste, Pontos Saga, pistas e itens, e só os próprios sussurros. No celular, a página vira as abas Palco, Elenco e Ficha.

Visual: tokens `--lb-color-*` e fontes do app, conceito "lampião" (palco iluminado, colunas na penumbra). A única cor nova é o papel quente da narração (`--rp-*`). A troca de cena é uma cortina com um fio de latão (680 ms).

## Conferido

Chrome headless: nenhum erro de página no console, sem rolagem horizontal em 1440, 1024 e 390 px, e 20 testes funcionais passando (soma dos dados, vantagem, teclado, troca de cena, Ponto Saga).

Não conferido: celular de verdade, leitor de tela, Firefox e Safari.

## Em aberto (decisão do usuário)

1. O teste de atributo rola 1d20 puro, sem somar o rank. A regra não foi achada no livro do sistema.
2. Os limites do holofote, hoje em 5 e 10 minutos.
3. Se o jogador deve ver o HP dos outros personagens.
4. Se a cortina com fio de latão fica como transição de cena.

As duas mensagens de jogadores que chegam sozinhas (por volta de 13 s e 36 s) são simulação do protótipo.
