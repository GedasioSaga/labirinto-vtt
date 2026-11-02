# Digest — suplementos lote A (11 arquivos)

Fonte: transcrições em `md/supA-*.md`, dados em `json/supA-racas.json` (12 entradas; Demon Xenoverse rende 2). Comparado com o Livro do Jogador V0.5, cap. 4 (Raças).

## 1. Dois formatos de suplemento

| Formato | Arquivos | O que traz |
|---|---|---|
| **Raça nova** | Garotas Mágicas, Brench-seijin, Cereal-jins, Cinzento, Konatsuseijin, HitClan, Demon Xenoverse | Lore longa (3–8 pp.) + bloco de regras no mesmo molde do livro básico |
| **Pacote de técnicas** (temático de personagem canônico) | Androide do Furto de Ki (Super 17), Freeza Clan Armadurado (Duraza, OC), Majin do Coração Puro (Boo bom), Namek Guerreiro (Piccolo) | Conto + 18 técnicas ofensivas (3 por rank E, D, C, B, A, Z) + 3 a 5 técnicas especiais. **Não** mexe em traços da raça base |

Todos abrem com a mesma página de créditos (VLiscius e FNishiguchi) e o mesmo AVISO ("técnicas como inspiração, material não definitivo").

## 2. Molde de raça — idêntico ao livro básico

O livro básico (4.2 Freeza Clan, 4.3 Majin, 4.4 Namek...) usa: parágrafo de raça → "A cada 10.000 PDL base, um X adiciona +N extra na sua vida" → **Variação** com 3 traços (✓) → **Característica Especial** numerada `x.x.x.1`. Os suplementos repetem isso à risca:

| Raça | Vida /10.000 PDL | Variação | Característica(s) Especial(is) |
|---|---|---|---|
| Garota Mágica | +10 | Única (3 traços) | Coleta de Sentimentos |
| Brench-seijin | +08 | Única (3) | Afinidade com Ki Expansivo |
| Cereal-jin | +10 | Única (3) | Olho Direito Evoluído |
| Cinzento | +14 | Única (3) | Força Inabalável |
| Konatsu-seijin | +08 | Única (3) | A Maldição da Benevolência |
| Hit Clan | +12 | Única (3) | Punho Olho de Fênix **e** Domínio Temporal (2, como Namek/Saiyajin/Glind no básico) |
| Demônio (Xenoverse) | +12 | Puro (3) / Híbrido (regra de %) | Magia do Reino Demoníaco |

Faixa de vida dos suplementos (+08 a +14) é a mesma do básico (Terráqueo +06 ... Freeza Clan +14).

**Não há ajuste de atributo racial em nenhum arquivo** (nem no básico): a raça mexe em vida, traços e característica especial. `ajustes_de_atributo` = `null` em todas as entradas. Nenhum talento racial novo; nenhuma transformação com multiplicador (Hit Clan diz explicitamente que é "incapaz" de se transformar).

O **Demônio Híbrido** copia palavra por palavra a regra do **Saiyajin Híbrido** (4.5.2): Sangue 30%/60% + Alteração Genética 40%/70%, soma exatamente 100%, a maior porcentagem leva a Característica Especial.

## 3. Molde do pacote de técnicas

- Linha de técnica: `[Nome - Rank]: descrição [Dano: a-b-c] [Ki: n]`, depois `Alcance`, `Rótulos Positivos (2·rank)` e `Rótulos Negativos (1·rank)`. O número entre parênteses é o **orçamento** do rank (E=2/1, D=4/2, C=6/3, B=8/4, A=10/5, Z=12/6), não a contagem listada.
- É o mesmo formato do exemplo "[Kamehameha - B]" do livro básico (criação de técnicas, p. 86): dano em três estágios = ¼ · ½ · base (ex.: 11-22-44 no rank B sem rótulo de dano), rank B com Rótulos Positivos (8) / Negativos (4). Ou seja, as técnicas prontas são montadas pelas regras de criação do básico, sem regra nova. Defensivas usam `[Mitigação: ...]`; uma usa `[CA: +01]`.
- Técnica especial: texto + `[Ação]`/`[Ação ou Reação]` + `[KI n | Variável | Interpretativo | Passiva]`. "KI Variável" quase sempre = "PK igual à Escala de Poder (EP) do inimigo/alvo".

## 4. Mecânicas novas (não estão no livro básico)

1. **Segundo recurso além do Ki**
   - *Magia Negra* (Demônio): barra igual à de Ki, só volta com Descanso Longo; lista própria de 47 magias em 6 ranks (custo fixo 01/04/06/08/12/18); aprende 1 a cada 5.000 PDL + 1 grátis por rank novo. Técnicas feitas com ela ganham "Dano Elemental – Sombrio".
   - *Pool de Ki absorvido* (Super Absorção, Androide): segunda barra que não regenera; Ki de Dreno entra nela e passa a regenerar.
   - *Energia Negativa* (Konatsu): contador que sobe ao curar/limpar condições sem gastar Ki; ao igualar os PV nasce uma entidade com EP ×2 que assume o corpo quando o Konatsu cai.
   - *Tempo Perdido* (Hit Clan): acumula 0,1 s por Salto Temporal, persiste entre batalhas; 1 s = ação extra (Time Realese) ou esquiva garantida (Tide of Times).
2. **Habilidades raciais destravadas por PDL** (Hit Clan: 30.000 / 60.000 / 90.000 / 120.000) — o básico só escala vida/Ki/ST por PDL.
3. **Benefício condicionado à EP do planeta** (Brench-seijin): EP do personagem > EP do planeta ⇒ deslocamento 18,0 m, iniciativa com vantagem, várias reações ao mesmo golpe.
4. **Ganho de PK por adoração de população** (Garota Mágica): PK permanente = EP do planeta enquanto a população mantiver o sentimento; vantagem em todo combate num planeta "dominado".
5. **Troca de atributo do teste**: Garota Mágica (atributo do sentimento, EP vezes por rodada), Cinzento (Força em tudo), Hit Clan (Destreza no acerto corpo a corpo), Konatsu (Int/Força para magia).
6. **Subir EP Base durante a luta** (Hit Clan, Progresso Puro): Teste de Sabedoria vs EP do inimigo + 08.
7. **Converter reação em turno de ação** e ignorar rótulos negativos/condições pagando EP do alvo, com custo crescente por uso no mesmo alvo (Cinzento).
8. **Forma alternativa como segunda ficha** (Garota Mágica): ao trocar, PV vão ao máximo da nova forma e metade do dano anterior é reaplicada. Parente da "Forma Alternativa" do Freeza Clan (básico), mas aqui a ficha inteira pode mudar.
9. **Limites fixos e efeitos de "vitória automática"**: Armadura Absoluta ignora dano total ≤ 100 no turno do inimigo; Presença Definitiva (magia Z) zera PV de quem tem EP menor; Feixe de Transfiguração mata por diferença de EP 4.

Padrão recorrente: o custo de quase toda habilidade nova é **"PK igual à EP do inimigo"**, o que escala sozinho com o nível do oponente.

## 5. Ambiguidades para o narrador

- Brench "Afinidade com Ki Expansivo": diz "Gratuitamente" e logo cobra PK igual ao custo do rótulo.
- Garota Mágica: PK "de forma permanente" e "Não sendo permanente" na mesma frase.
- Demônio: várias magias cobram "PK's" além de Magia Negra, mas a regra diz "jamais Pontos de Ki comuns"; "Presença Definitiva" compara com EP "do alvo" (provável "do usuário").
- Androide: "Dreno de Ki" na Super Absorção = "Drenar Energia" do básico (nome diferente).
- Hit Clan: Time Realese e Tide of Times acumulam "Tempo Perdido" — não diz se o estoque é compartilhado. "30,000" com vírgula.
- Freeza Armadurado: "Super Soco Reativo - A" com orçamento de rank B (8/4); socos Z com alcance "Pessoal"; versão B do Soco Preciso mais fraca que a C.
- Namek/Androide: listas de rótulos negativos com contagem que não fecha ("(3)" com 4 itens; Z com 3 itens sob "(6)").
- Majin: "Feixe de Transfiguração" tem faixas de diferença de EP mal definidas; "Palmar Crítico" é queima-roupa com alcance 9,0 m.
