# Conserto e automação das fichas (08/11/2026)

Base: `docs/auditoria-fichas/00-bugs-do-sistema.md` (12 bugs), os 11 relatórios por personagem e as
respostas do grilling em `docs/auditoria-fichas/respostas-do-grilling.md` (tudo respondido em 07-08/11).

Regra de trabalho: a batalha (`client/src/lib/batalha/`, `client/src/stores/batalhaFabrica.ts`) é um
sistema só, então tem **1 dono por vez, em sequência** (nada de vários escritores na batalha ao mesmo
tempo). Testes: no máximo 2 por situação durante a construção; a bateria completa só no fim.

## F0. Dados das fichas (sem código; app FECHADO e backup antes)
- Gravar os máximos (bug 4): Saga 700/60, Jimboy 1000/60, May 700/60, Aira HP 900, Vagn 1000/120,
  Ryoko 700/240, Harvey 700/60, Siegfried 900/140.
- Devolver as mochilas apagadas pela migração (B1): Vincent, Aira, Alexei, May.
- Corrigir dados: Rifle 20, Lança 20, Pá 10 em todos os golpes do Harvey, Bala de Prata como tipo de
  bala (+metade da Percepção), Boomerang como arma de arremesso, 1 Acrobacia, "Cirurgia", Vagn 21 anos
  Ferreiro, Harvey "Amaldiçoado: Infâmia", textos novos da Aira e do Alexei, formas (Caçada do Alexei
  como forma), arma padrão do Siegfried.
- Depois: "Publicar no Lobby" para o site ficar igual.

## F1. Regras do sistema e os 12 bugs (1 dono, em sequência)
- Bugs 1-12 (recusa muda, golpe sem resposta vira "Não reagiu" na virada da rodada, desfazer "Vez",
  máximo, −/+ rápido, Salvar do jogador, vez pula, ficha emprestada, desfazer forma tira o que deu,
  custo por turno, gravação recusada, barra do Escudo).
- Regras: Tempo N bloqueia N vezes; recarga e selo descem por vez (carta extra); batalha salva volta
  ao reabrir; +10 SP por vez sem gastar SP; técnica cara fica bloqueada com o motivo; Overload não erra
  (só outra Overload defende), gasta ação Completa, 1 por batalha, e deixa os atributos base pela metade
  até o fim; formas desligam no fim da batalha; Escudo volta cheio; Atordoado só "Passar a vez";
  vantagem/desvantagem = 2 d20; Sangramento com botão Aplicar, direto no HP; Determinação rank 4 avisa
  e aplica −10%; "Me dar dano" com Resiliente desconta e avisa; Preparação para a Batalha (+20 no
  atributo escolhido, pergunta no início); ao transformar, o app pergunta a ação ao jogador.

## F2. Automação por personagem (1 dono, em sequência, ficha por ficha)
Disputas que o app rola (Corta Cenoura, dança da Aira, Explosão, Entardecer, Imã-Gumelo, Campo de
Contenção com a CD da fruta), áreas (Aplauso 6x6, Giro de Pá, Lua Incandescente dividida, Projeção em
linha), selos (Aéreo, Cego zera Percepção, Ferido por prata só lembrete, Queimando 1 turno), perguntas
na hora (cortante ou perfurante, qual arma, vantagem da Ryoko), contas (Sai Dai Rin, Grande Chifre por
quadrado empurrado, Polaridade x3,5 no todo, furtivo x3 com Surpresa x1,5, Bala de Prata 72).

## F3. Recursos novos (cada um com plano curto antes)
1. Tela do mestre ao transformar ou invocar com números livres (Sulong, super lobo).
2. Habilidades ocultas: o jogador vê "???" até o mestre revelar.
3. Técnicas complementares (Orquídea → Florescer, redoma até o próximo golpe).
4. Efeito de arma com usos por combate (Boomerang atordoa, 3 por combate) e arma padrão.
5. Companion (Lovecats da Aira até 3, lobos e Planta do Alexei): ficha própria, vida, evolução, token no
   campo ou efeito especial. É o maior; plano próprio.

## F4. Entrega
Bateria completa de testes uma vez, verificador item por item contra as respostas do grilling,
versão nova do app e "Publicar no Lobby".

## Critério de pronto
Cada linha de `respostas-do-grilling.md` tem o arquivo:linha que a cumpre ou "à mão de propósito";
os 12 bugs têm o caso de reprodução do relatório passando; 0 fichas sem máximo; mochilas de volta.
