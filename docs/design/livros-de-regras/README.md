# Mundo do livro de regras (protótipo)

Um espaço novo onde o mestre trabalha dentro das regras de um sistema. O One Piece é o primeiro; a estrutura serve para qualquer livro.

## Como abrir

Dê dois cliques em `prototipo.html` (Chrome ou Edge no PC). Não precisa de internet nem de instalar nada.

- Na tela inicial, a porta nova é a **04 · Livros de regras**. As portas 01 a 03 não abrem no protótipo.
- Escolha **One Piece** e você entra no mundo do livro: marcadores à esquerda, a página no meio e o assistente da IA à direita.
- Na pílula embaixo: **Para decidir** (as perguntas abaixo), **Movimento reduzido** e **Recomeçar** (volta tudo ao início).
- Nada é salvo: tudo vive só na página aberta. Os personagens são inventados (o repositório é público).

## O que cada tela faz

| Marcador | Para quê |
|---|---|
| **Jogadores** | Liga cada personagem ao jogador uma vez só, pelo nome com que ele entra na mesa. Em qualquer mapa deste livro, o token dele já chega com a ficha. Quem entrou e não tem ficha aparece embaixo, com "Criar ficha". |
| **NPCs de combate** | O bestiário. Só quem tem ficha de batalha entra na ordem dos turnos. Modelo ("Recruta da Marinha") e variações (Recruta Ilo, Recruta Teo) que herdam a ficha. A **força** (×0,5 a ×2) multiplica HP e dano, para balancear sem reescrever a ficha. NPC só de cenário ganha ficha com "Dar ficha". |
| **Comparar** | 2 a 4 fichas lado a lado: HP, SP, Escudo, os 8 atributos e o dano que as fórmulas dão de verdade. Embaixo, o **peso do encontro**: quantas rodadas cada lado leva para derrubar o outro (Fácil, Justo, Duro, Mortal) e um botão que ajusta a força dos inimigos. |
| **Saúde da ficha** | O que a batalha automática não consegue ler (custo "Seguir todas as condições", ação "ção Completa", dano com dado...), com sugestão de como escrever e "Corrigir" ali mesmo. Nas fichas de verdade o app lê hoje ~84% dos custos e ~57% dos danos; as fichas de exemplo foram montadas para ficar perto disso. |
| **Itens** | Catálogo com busca (atalho `/`). Arraste para a ficha ao lado ou use "Pôr em…". Perícias, vantagens e desvantagens já existem no livro; armas, habilidades prontas e itens são novos. |
| **Anotações** | Nota do mestre em cada ficha e NPC. Só o mestre vê. |
| **No mapa** | Dois quadros de como isso aparece no editor: o atalho **"Abrir o mundo do One Piece"** no livro do mestre, e a caixa **"Quem entra na batalha?"** quando há NPC sem ficha de combate no mapa. |

**Assistente (painel da direita).** Três modos, como no projeto-rpg-v2: **Conversa** (regras e fichas), **Equilíbrio** (Leitura, Desequilíbrios, Sugestões com número) e **Simulação** (combate rodada a rodada). Cite um nome na pergunta e a ficha entra na conversa (até 4). A linha "Lendo:" mostra o que a IA recebe: as seções de regra ligadas à pergunta, os catálogos, as fichas e os retratos. **Gerar NPC** devolve uma ficha pronta para revisar e salvar no bestiário. A engrenagem mostra onde o mestre põe a chave do Gemini (`gemini-2.5-flash-lite`). As respostas são **de exemplo**: o protótipo não chama a IA nem guarda a chave.

## Para decidir

1. **Como o app reconhece o jogador?** Pelo nome que ele digita ao entrar (como é hoje), ou por um código guardado no navegador dele. *Recomendo o nome*, com aviso quando dois entram com o mesmo nome.
2. **NPC sem ficha de combate ao iniciar a batalha: entra com quê?** Ficha mínima (HP 300, golpe 80) ou um modelo do bestiário escolhido na hora. *Recomendo oferecer os dois*, com a ficha mínima marcada.
3. **A força do NPC mexe também no Escudo e no SP?** O protótipo mexe só em HP e dano. *Recomendo só HP e dano*: é o que se sente na mesa e é fácil de explicar.
4. **A ficha ganha uma aba Itens?** O livro tem armas por ficha, mas não tem inventário. *Recomendo sim*, simples: nome, quantidade e efeito.
5. **As anotações do mestre entram no que a IA lê?** Ajuda a IA a sugerir ("a Vera foge com 50% do HP"). *Recomendo sim*, só quando a ficha é citada, e nunca na tela do jogador.
6. **Golpe "à mão de propósito" conta contra a saúde da ficha?** *Recomendo não*: aparece em cinza como "à mão", fora da porcentagem.

## Bom saber

- "10% de Vida Atual do Alvo" o app **já lê** quando quem usa vê a vida do alvo (o mestre vê; o jogador, contra NPC, digita). Por isso aparece como "Lê na hora", não como erro.
- O catálogo de armas e itens e a aba Itens são propostas novas; hoje o livro só tem a aba Armas dentro de cada ficha.
- As contas do peso do encontro são uma estimativa simples (melhor golpe todo turno, reação média tira 40%, sem cura). Servem para comparar, não para prever a batalha.
