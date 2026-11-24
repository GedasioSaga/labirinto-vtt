# Plano: Companion no app (23/11/2026)

Fonte: protótipo aprovado (`prototipo.html`, estados 1 a 4; `NOTAS.md`) e PEDIDOS.md, 23/11 19h19 a 21h59.
Regras do dono: companion genérico (qualquer NPC da aventura), vários grupos por ficha (nome + limite), ficha/HP/nível próprios, "Luta no campo" ou "Dá efeito", vez própria na ordem do lado do dono, quem joga é o jogador dono, escolha ao começar até o limite, HP 0 travado como "Desmaiada", mestre tem "Escolher por ela", Evoluir sem regra de HP.

## O que já existe e é reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| Ficha do personagem, leitor tolerante | `lib/personagem.ts` (`personagemDoArquivo`, `paraOFio`) | campo `caracteristicas` (fatia 1, feito) |
| Edição do jogador por lista fechada | `net/protocoloDoPersonagem.ts` (`PartesDoPersonagem`) | `caracteristicas` fica de fora: só o mestre muda |
| Carta da ordem, inserir carta, Agilidade | `lib/batalha/turnos.ts` (`inserirCarta`, `agilidadeDe`) | o companion ganha carta própria, posta pela Agilidade |
| Token do invocado entrando e saindo fora do desfazer do mapa | `stores/mesaDaAventura.ts` (`criarInvocado` com personagem `null`, `tirarToken`) | o token do companion nasce colado no dono e sai no fim; o personagem NUNCA é apagado |
| Ficha que o jogador controla na vez | `net/batalhaNoHost.ts` (`fichaDaVezQueEleControla`), `vistaDoJogador.ts` (`minhaVez` por `meusTokens`) | o token do companion entra em `meusTokens` do dono só durante a batalha: a vez, o menu inteiro e o Passar já funcionam |
| Caído pulado na ordem | `turnos.ts` (`tokensCaidos`, `primeiraQueJoga`) | companion derrubado sai da vez até ser curado (decisão 8 do NOTAS) |

A invocação temporária (carta de bando, jogada pelo mestre) continua como está: o companion é permanente, tem carta própria e é jogado pelo dono. Os dois não se misturam (pergunta do FORA DO ARTEFATO continua com o dono).

## Fatias (1 commit cada)

1. **Tipo** `lib/caracteristicas/tipos.ts` + campo `Personagem.caracteristicas` (feito, commitado cedo para a Cegueira importar).
2. **Bloco na ficha** (mestre e jogador): "Características especiais" abaixo dos atributos em `FichaDePersonagem.tsx`; chips; "+ Característica" só do mestre (menu Companion / Cegueira, a Cegueira travada se já tem); página do Companion no lugar das abas (nome do grupo, "Leva para a batalha até", fichas ligadas com Evoluir, Luta no campo / Dá efeito, tirar; "Ligar ficha" com busca e marcar todas); `Esc` volta. Arquivos novos em `components/caracteristicas/`.
3. **Store da batalha**: `TurnosDaCena.companions` (tokenId, personagemId, dono, grupo, modo, criado) e `escolhendoCompanions` (donos que ainda escolhem, calculado no `ligar`); ação `escolherCompanions(sceneKey, autor, donoPersonagemId, escolhidos)` que confere limite e HP, põe os tokens colados no dono (`mesa.porCompanionsAoLado`), insere as cartas pela Agilidade, grava a `ultimaEscolha` na ficha e escreve no registro; `desligar` tira os tokens criados. Regra pura em `lib/batalha/companions.ts`.
4. **Fio**: pedido `batalha.companions {reqId, donoPersonagemId, escolhidos}`; o host confere (personagem dele de verdade, dono escolhendo, ids do grupo, limite, HP) e chama a ponte; `batalha.estado` ganha `companions` (as escolhas que esperam ESTE jogador, com nome, nível, HP e modo de cada ficha) e `companionDe` na carta. `lugarNaBatalha` soma os tokens dos companions dele a `meusTokens`.
5. **Telas da batalha**: diálogo "Quem vai com a Aira?" (jogador; `Espaço` marca, `Enter` entra, "Entrar sozinha"), linha "Aira escolhendo… / Escolher por ela" no painel do mestre (mesmo diálogo, decide direto), selo "Companion de Aira · você joga" na carta.
6. **Prova** por gestos na cópia dos dados do dono, prints em `tmp/companion-app/`, diagrama `docs/diagrams/batalha-companion.html` + linha do INDEX.

## Contrato do fio

- Jogador → host: `{ type: 'batalha.companions', reqId, donoPersonagemId: string, escolhidos: string[] }` (até `LIGADOS_MAX` × grupos; `[]` = "Entrar sozinha"). Recusa com motivo pelo `batalha.resultado` de sempre.
- Host → jogador: em `batalha.estado.estado`, `companions?: EscolhaDeCompanions[]` (só as do jogador) e, na carta, `companionDe?: string` (nome do dono). Sem números de quem não é dele.

## Riscos

- **Batalha salva/retomada**: a marca `companions` some se o leitor da batalha salva não a conhece; o token fica no mapa e passa a ser NPC do mestre. Medir na fatia 3; se for o caso, fica como limite declarado.
- **Arena de testes e Dragon Ball**: sem `porCompanionsAoLado` na mesa, ninguém é escolhido (a linha não aparece). Fica para depois.
- **Token já no mapa**: se o NPC ligado já tem token na cena, ele é reaproveitado (não nasce outro) e não sai no fim.
- **Visão**: o companion NÃO entra na posse do jogador fora da batalha (não mexe na névoa, que é da frente da Cegueira).
- **Desfazer**: a entrada dos companions não tem Desfazer na primeira versão (o mestre tira pelo "Tirar combatente").
