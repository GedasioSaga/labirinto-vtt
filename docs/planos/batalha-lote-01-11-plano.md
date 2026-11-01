# Plano: lote de consertos e regras da batalha (01/11/2026)

Pedido literal (14 itens, 15 prints) e respostas em PEDIDOS.md (01/11/2026). Vem depois da F3 da invocação (docs/planos/batalha-invocacao-plano.md), que está em voo nas telas da batalha.

## Consertos sem decisão (o usuário descreveu o certo)

- C1 (item 2). Concentrar pela 3ª vez não gasta ação: com a 3ª carga ele ainda move e ataca normalmente. Só a 3ª é livre.
- C2 (item 4). Concentrou e zerou na mesma vez = não fez nada: zerar devolve a ação gasta no Concentrar daquela vez.
- C3 (item 3). Mira: a linha "chega 55 × 1,5 Surpresa = 82" passa por cima do alvo seguinte; nada pode encavalar.
- C4 (item 8). Ordem dos alvos na mira: inimigos do mais perto ao mais longe; aliados no fim (você por último).
- C5 (item 5). Tira Passivas: mostrar a descrição do que a passiva faz (curta, com "ler mais").
- C6 (item 6, parte 1). Transformação: mostrar o que é preciso para transformar (requisito); se a ficha não tem campo, ganhar um campo "Requisito".
- C7 (item 7). Tela grande da transformação: a foto dentro de um círculo, sem cortar torto.
- C8 (item 11). Faixa ATAQUE: a foto do token/retrato no círculo, não o disco com a inicial.
- C9 (item 12). Faixa "VEZ DE ...": a foto num círculo.
- C10 (item 13). Cartas da ordem: Escudo junto com HP e SP; com Escudo 0 a linha some (volta se algo recuperar Escudo); jogador nunca vê o Escudo de NPC.

## Regras novas com decisão do usuário

- R1 (item 1). Marca (Olhar Artístico e Desenhar o Alvo, Vincent):
  - Quando o Vincent acerta com arma de fogo, lembrete "Marcar o alvo? Pagar 40 SP · Teste de Percepção · Agora não" (nunca automático, como as passivas).
  - Teste "Os dois": o app rola d20 + modificador de Percepção (15 ou mais marca) E existe "rolei fora: Passou / Falhou".
  - Desenhar o Alvo: se acertar, marca sozinho (sem custo nem teste).
  - A marca não tem turnos: dura até o próximo golpe de qualquer um que acertar o marcado; esse golpe dá o dobro do dano que chega, e a marca some.
- R2 (item 6, parte 2). Campo "Grupo" na transformação: mesmo grupo troca (ativar a Parte 2 desliga a Parte 1 e fica só com os buffs da 2); grupos diferentes acumulam. As 3 partes da Ryoko vão para o mesmo grupo no lote de dados.
- R3 (item 9). Reação: botão "Passar sem tomar dano" para mestre e jogador; vai para o registro ("Siegfried passou sem dano") e o mestre pode desfazer.
- R4 (item 12, segundo). "Ajustar..." na carta: HP atual e máximo, SP, Escudo e modificador em atributo até o fim da batalha. O mestre ajusta qualquer um; o jogador só a própria ficha. Vai para o registro; o mestre pode desfazer.
- R5 (item 14). Polaridade (Vagn): gastar a reação (fica sem reação até o próximo turno dele) para ganhar 1 nível; nível 1/2/3 soma +10/+20/+30 de dano em todo golpe dele; máximo 3; fica até o fim da batalha (o mestre pode zerar).
- R6 (item 10). Lunarianos (Siegfried e Vagn): os DOIS modos para os dois, como transformações do mesmo grupo "Lunariano", que ligam e desligam sem gastar ação:
  - Ignição: velocidade até 1,2x; +2 quadrados de deslocamento (prevalece o maior); ao Atacar, 1 ataque adicional por rodada; não usa Controle do Fogo; 2 vezes por batalha.
  - Resiliente: recebe 20% a menos de dano sempre que ligado (o mestre ou o jogador desliga quando quiser); deslocamento máximo 6 quadrados.

## Lote de dados na ficha real (no fim, app FECHADO e backup antes)

Chamado do Lobo: Tipo Invocação. Rosa Fúnebre: Categoria De fogo e Soma no ataque Percepção. Forma Híbrida Parte 1/2/3: mesmo Grupo. Siegfried e Vagn: transformações Ignição e Resiliente (grupo Lunariano). Olhar Artístico e Desenhar o Alvo: marca e teste. Vagn: polaridade. Conferir cada troca no molde de scratchpad/saude/lote2/aplicar2.ts.

## Ordem e donos

1. Lógica (programador-frontend, um dono, em sequência, commit por parte): C1, C2, C4 (função de ordenar), C10 (recorte), R1, R2, R3, R4, R5, R6. Os arquivos que a F3 da invocação também mexe (vistaDoJogador.ts, protocoloDaBatalha.ts, playerConnection.ts) só depois do commit da F3.
2. Telas (designer-opus, depois da lógica): C3, C5, C6, C7, C8, C9, C10, e as caixas de R1, R3, R4, R5, R6.
3. Revisão (fio/vazamento e Desfazer), consertos, versão, lote de dados.

## Critério de pronto

1. `rtk proxy npx tsc --noEmit` sem erro em client/ e `npm run build --workspace=client` ok.
2. Script descartável (tsx) sobre a cópia de backup da ficha mostrando cada regra: 3ª carga sem gastar ação; zerar devolve a ação; alvos na ordem certa; marca dobra só o próximo golpe que acerta e some; teste com d20 + Percepção; Parte 2 desliga a Parte 1; passar sem dano e Desfazer; ajustar do jogador só na ficha dele; polaridade até 3 e +30; Resiliente -20%; Ignição 2 vezes por batalha; Escudo de NPC fora do recorte do jogador.
3. Telas vistas no app rodando (mestre e jogador), com 3 a 5 prints em scratchpad/lote-01-11/.
4. Revisores sem achado alto aberto.
