# O que a batalha sabe fazer mas o editor não monta (26/11/2026)

Leitura do código (batedor-fundo). M = client/src/lib/batalha/mecanicasAMao.ts (regras escritas à mão por carta). Ordem: mais útil primeiro.

1. Pergunta na hora que muda o golpe (dano, condição, perfurante): Projeção Letal, Grande Chifre, Quebra-Queixo (M:296,318,612,652,679).
2. Botão que vale em todo golpe do dono (+dano/−SP, desvantagem no alvo, Surpresa): Imbuir Eletricidade, Vantagem de Ogro, Aparência Inofensiva (M:310,508,693,827,1086).
3. Passiva com gatilho e efeito por turno (começo, rodada N, vida abaixo de N%): Fortaleza, Melodia (passivas.ts:147,303).
4. Raça: corta % do dano recebido, +N no corpo a corpo, marca de técnica corpo a corpo: Ogro, Ryoko (M:340-344,505,519-523,1270,1295).
5. Forma ligada deixa todo golpe Overload / Overload do tipo Transformação: A Caçada Começa (M:412,716,1475; acoes.ts:210).
6. Forma que multiplica a Velocidade (ordem da vez): Ignição (M:404,594,1465).
7. Partes da forma em ordem, técnica sobe uma Parte: Forma Híbrida, Fúria do Dragão (M:346-348,493-497; requisitos/modelo.ts:213; só em DarRequisitosAosAntigos.tsx).
8. "Só liga pela técnica X" (requisitos/modelo.ts:214): sem tela.
9. Forma ligada proíbe uma resposta (Ignição apaga Imbuir Fogo) (M:332,459,634,1158).
10. Usos da forma = ataques extras da batalha inteira (Ignição) (M:334,594; transformacao.ts:68).
11. +dano contra quem tem a condição da passiva do dono: Melodia +20 (M:388,743,1429).
12. Condição: quem a tem cura % do dano que causa: Bênção de uma Raposa (condicoes.ts:46,92).
13. Condição montada pelas respostas na mira (turnos e atributo): Bênção / A Virtude Traz Bênção (M:302,443,778,963).
14. Mesmo golpe: dano no inimigo + buff nos aliados marcados: A Luz do Sol Brilha Sobre Todos (M:304,825,977).
15. O Atacar muda enquanto um aliado tem a condição do dono: Aira (M:308,779,1029).
16. Aviso ao mestre quando o dono cai a 0, uma vez por batalha: Recuperação Espantosa (M:328,580,677,1123).
17. Rebate (dano recebido + Força em quem bateu): Aplauso do Deus do Trovão (M:326,649,1118).
18. Reação com duas saídas (Defender 90% ou Atacar e devolver ÷7): Armadura Humana (M:583-591).
19. Técnica mantida que ganha +1 de Concentração por vez: Campo de Contenção (M:338,601).
20. Dobra os turnos das condições negativas do alvo: Explosão (M:558-570; debuffs.ts).
21. Dono perde % do HP máximo no fim da vez em que andou/agiu: Doença das Trevas (M:398,770,1480).
22. Condição que no fim da vez do alvo tira SP dele, dá SP e tira % do HP de quem usou: Chamas Celestes (M:396,767).
23. Passiva de marca (acertar com tiro pergunta "Marcar?"; próximo golpe dobra): Olhar Artístico (marca.ts:94).
24. Invocação (HP, blocos, dano, máximo, Ultra com carga 3): Chamado do Lobo (invocacao.ts:207,226).
25. Opções da técnica (Escolha) com efeito vindo do texto: Medicina/Cirurgia (escolhaEEvolucao.ts:151; M:370,733).
26. Técnica sem alvo que só posiciona (armadilha): Armadilhar (M:300,799).
27. Condição que zera um atributo além da Percepção (condicoes.ts:36).

Fora desta lista: mecânicas de arma/bala, aoAcertarDoItem, companions, golpe.ts/turnos.ts por dentro.
