# Design consolidado da interface (aprovado em 09/10/2026)

O usuário aprovou este design para aplicar no app **exatamente como está**. Ele junta três propostas:

- a base do **Grimório** (layout geral);
- o ponto de interesse e a porta aberta da **Mesa limpa**, com a porta animada;
- a animação do cenário do **Estúdio**, que aqui virou uma prévia viva na ficha do pino.

Página publicada (privada): https://claude.ai/artifact/2JApP1xH65fjrhhMsu5zEG

## O que tem nesta pasta

| Caminho | O que é |
|---|---|
| `prototipo/index.html` | O protótipo navegável. Abra o arquivo no navegador, sem servidor. "Editor do mestre" e "Tela do jogador" trocam a tela, e "Onde foi parar?" mostra onde cada controle de hoje passou a morar. |
| `prototipo/css/`, `prototipo/js/` | Estilo e comportamento do protótipo. Tokens em `grimorio.css` (`--lb-*` do app, `--gr-*` novos). |
| `inventario.md` | Todos os controles do app de hoje (barra esquerda, barra direita, barra de ferramentas, propriedades, tela do jogador). Serve para conferir que nenhum controle some. |
| `PLANO.md` | O plano da aplicação no app: 22 fatias, riscos, as features B, C e D e as 7 decisões. |
| `provas/` | Prints do protótipo (editor 1440 px, jogador 390 px), folha de contato da porta abrindo e o relatório do teste automático do protótipo (todos os itens OK). |

Diferenças desta cópia para o protótipo publicado: o endereço de rede de exemplo e um nome de jogador de exemplo foram trocados, porque o repositório é público. O design é o mesmo.

## Situação

Aplicação no app **não começou**. Está parada por decisão do usuário (10/10/2026) e só começa quando ele mandar. A forma de trabalho está no fim do `PEDIDOS.md` e no `PLANO.md`.
