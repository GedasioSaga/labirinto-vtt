# Plano: técnica de Invocação (Chamado do Lobo), 31/10/2026

Pedido literal e respostas do grilling em PEDIDOS.md (31/10/2026, "esse tecnica, como iremos fazer ela cria um token em campo."). O plano da primeira versão da batalha (docs/planos/batalha-one-piece-2026-10-30.md:38) deixou "invocações com status próprio" de fora; este plano as traz.

## Decisões do usuário

1. Tipo novo "Invocação" na ficha (8º tipo). O app lê os números do texto: "Lobos comuns: 40 de HP, andam 3 blocos, 30 de dano, máximo 3". "Lobos comuns" e "Ultra Lobo" viram as opções da técnica.
2. Os lobos são do MESTRE (ele move e ataca).
3. Vez própria: UMA carta para o bando, logo depois do dono, na ordem dos turnos.
4. 1 lobo por uso (5 SP, recarga normal da técnica).
5. O MESTRE coloca o lobo no mapa: o app avisa "Ryoko invocou 1 lobo" e ele clica onde nasce.
6. Imagem: a do cartão da técnica na ficha; sem imagem, disco com "LB".
7. Quem está do mesmo lado do dono vê o HP dos lobos, como aliado. Inimigos não veem.
8. Lobo não reage: atacado, só toma o dano.
9. Somem com HP 0 ou no fim da batalha.
10. Ultra Lobo: exige Concentrar 3 e gasta as 3 cargas; o app sugere os 3 juntos + 1 (121 HP, 91 de dano) e o mestre ajusta; só 1; ao entrar, os lobos comuns somem.
11. Desfazer: tira o lobo e devolve o SP.

## Fatos do código (batedor, 31/10)

- HP mora no Personagem (lib/personagem.ts:105). Token sem personagem não é alvo nem toma dano (lib/batalha/golpe.ts:156, stores/batalhaStore.ts:1499). Então cada lobo precisa de um personagem temporário (molde: novaVariacao / fichaMinima em lib/livros/combate.ts:189-210).
- Carta entra no meio da batalha por incluirCombatente (lib/batalha/turnos.ts:484, store:1202, com reversão). Hoje carta = 1 token; não há carta de grupo.
- Nada remove token ou carta com HP 0 (turnos.ts:141 só marca caído). Remoção manual: tirarCombatente (turnos.ts:501).
- Não existe "exige Concentração N" (lib/batalha/acoes.ts:168-203); a carga é por personagem, 0..3 (lib/batalha/combate.ts:44-52).
- Não há movimento fixo por token; o "Mov" vem do rank de Agilidade (acoes.ts:53-66).
- Token só nasce no editor do mestre (stores/criarToken.ts:48); o mestre é o host, então criar o token no app do mestre é caminho direto.
- Opções: variantesDe (lib/batalha/escolhaEEvolucao.ts:146) já pega extras "Opção ..."/"Efeito N"; "Lobos comuns"/"Ultra Lobo" precisam entrar como opções da invocação.
- Imagem: token.imageData atravessa ao jogador (types/map.ts:1447); null vira disco de iniciais (components/batalha/CartaDaOrdem.tsx:114).

## Fases

**F1, lógica pura (lib/batalha/invocacao.ts, tiposDaHabilidade.ts):** tipo 'invocacao'; leitura do texto (HP, blocos, dano, máximo, "concentração Nx", "só pode ter 1"); opções comum/ultra; motivo de recusa (máximo atingido, carga insuficiente, recarga, SP); sugestão do Ultra (soma dos comuns + 1); personagem temporário do lobo (HP, máximos, golpe com o dano, blocos fixos, sem reação, marca `invocadoPor`).

**F2, host e store (stores/batalhaStore.ts, net/batalhaNoHost.ts, lib/batalha/turnos.ts, vistaDoJogador.ts):**
- Pedido do jogador "invocar" validado no host (ficha dele de verdade, como a reação com técnica); cobra SP/recarga/carga e cria uma invocação PENDENTE (sem token ainda).
- Mestre coloca: cria personagem temporário + token (imagem da técnica) + entra no bando do dono numa operação só, com reversão (Desfazer tira tudo e devolve SP, recarga e carga).
- Carta do bando: uma carta por dono com a lista de tokens invocados, logo depois da carta do dono; na vez dela o mestre age com cada lobo (movimento e golpe por lobo).
- Ultra: ao entrar, os comuns do mesmo dono saem (token, personagem, lugar no bando), também com reversão.
- HP 0 de invocado: sai do mapa e do bando. Fim da batalha: todos os invocados e seus personagens temporários saem (nada vai ao bestiário).
- Golpe contra invocado: sem caixa de reação, dano direto.
- Vista: HP do invocado aparece para quem é do lado do dono (como aliado); nunca para o lado oposto.

**F3, telas:** técnica Invocação na mira com as duas opções; Ultra com os números sugeridos editáveis (só o mestre confirma); aviso ao mestre "Ryoko invocou 1 lobo · Colocar" e clique no mapa; carta do bando na faixa (mestre e jogador); menu da vez do bando com cada lobo (Mover/Atacar); campo Tipo "Invocação" na ficha.

**F4, revisão e versão:** revisores fio/vazamento e Desfazer/estado; corrigir; versão nova; lote de dados na ficha real só para o Chamado do Lobo (Tipo Invocação), com o app fechado e backup.

## Critério de pronto

1. `rtk proxy npx tsc --noEmit` sem erro em client/ e `npm run build --workspace=client` ok.
2. Script descartável (tsx) sobre a cópia de backup da ficha mostra: Chamado do Lobo lido como invocação com 40 HP, 3 blocos, 30 de dano, máximo 3; Ultra pede carga 3; quarto lobo comum recusado; Ultra tira os comuns; HP 0 tira o lobo; fim da batalha limpa tudo; Desfazer devolve SP, carga e tira o lobo.
3. Revisores de fio/vazamento e Desfazer sem achado alto aberto.
4. Prints das telas novas em scratchpad/invocacao/.
