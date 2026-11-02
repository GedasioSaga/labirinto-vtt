# Digest — Suplementos lote B (16 arquivos)

Fonte das transcrições: `md/supB-*.md`. Dados estruturados: `json/supB-racas.json` (16 entradas), gerado por `build-supB.js` a partir de `json/supB-meta.json` + regiões `<!-- json:... -->` das md (rodar `node build-supB.js` de novo se editar as md).

## Inventário

| Arquivo | id | Tipo | Base | Vida/10k PDL | Traços | Transf. | Técnicas | Talentos |
|---|---|---|---|---|---|---|---|---|
| Os Lupinos | lupino | raça | — | +12 | 3 + 3 por cor | 0 | 0 | 0 |
| Saiyajin da Lâmina de Ki | saiyajin-lamina-de-ki | técnicas | Saiyajin | — | 0 | 0 | 22 (18 of. + 4 esp.) | 0 |
| Saiyajin do Potêncial | saiyajin-potencial | variante | Saiyajin | +12 | 3 | 2 (Ōzaru, SSJ Potêncial 1-3) | 24 (18 + 6) | 10 passivas |
| Terráqueo Artista Marcial | terraqueo-artista-marcial | técnicas | Terráqueo | — | 0 | 0 | 22 (18 + 4) | 0 |
| Terráqueo Vital | terraqueo-vital | técnicas | Terráqueo | — | 0 | 0 | 23 (18 + 5) | 0 |
| Tribo Glass | tribo-glass | raça | — | +10 | 3 + 1 esp. | 0 | 0 | 0 |
| Variante – Saiyajin Maligno | saiyajin-maligno | variante | Saiyajin | +12 | 3 + 2 esp. | 0 | 0 | 0 |
| Zahha Clan | zahha-clan | clan | — | +08 | 3 + 1 esp. | 0 | 0 | 0 |
| Heeters | heeter | raça | — | +12 | 3 + 1 esp. | 0 | 0 | 0 |
| Hera-seijins | hera-seijin | raça | — | +12 | 3 | 1 (Núcleos de Ressonância) | 0 | 0 |
| Makyans | makyan | raça | — | +08 | 3 + 1 esp. | 0 | 0 | 0 |
| Metal Freeza Clan | metal-freeza-clan | variante | Freeza Clan | +14 | 3 + 1 esp. | 0 | 0 | 0 |
| Moroans | moroan | raça | — | +10 | 3 + 2 esp. | 0 | 0 | 0 |
| Namekuseijin Mutante | namekuseijin-mutante | variante | Namekuseijin | +10 | 3 | 1 (Verdadeira Gigantificação) | 0 | 0 |
| O Legado da Destruição | purrlian | raça | — | **ausente** | 3 + 1 esp. | 1 + 6 estágios | 0 | 0 |
| Saibamans | saibaman | raça | — | +08 | 3 + 2 esp. | 0 | 0 | 0 |

## Padrões de estrutura

1. **Molde fixo** (todos, mesma equipe VLiscius/FNishiguchi): p.1 créditos, p.2 aviso padrão ("material é inspiração, não definitivo"), depois 2-8 páginas de lore numeradas (1.0, 1.1, 2.0…), depois a seção da raça.
2. **Bloco de raça**: parágrafo-resumo terminando em "A cada 10.000 PDL base, um X adiciona +N extra na sua vida" → "X.0.1 NOME – Variação Única" com **exatamente 3 traços** (marcador ➢ ou ✓) → 1 ou 2 "Característica Especial: …" (X.0.1.1, X.0.1.2). Variantes de raça base repetem antes o parágrafo da raça base do livro.
3. **Nenhum** dos 16 traz ajustes de atributo (campo `ajustes_de_atributo: null` em todos). Atributos vêm só do livro básico.
4. **Suplementos de técnicas** (Lâmina de Ki, Artista Marcial, Vital, e o kit do Potêncial): sempre 3 técnicas ofensivas por rank E, D, C, B, A, Z + 4-6 Técnicas Especiais. Formato: `[Nome - Rank]: descrição [Dano: a-b-c] [Ki: N] - Alcance: …` + "Rótulos Positivos (n)" + "Rótulos Negativos (n)". O número entre parênteses é o orçamento do rank (E 2/1, D 4/2, C 6/3, B 8/4, A 10/5, Z 12/6), não a contagem de rótulos listados. Especiais: `[Ação|Reação] [N KI]`.
5. **Texto reaproveitado** entre suplementos: "Manipulação de Aura Maligna" (Saiyajin Maligno) ≡ "Telecinese de Zahha" (ataque genérico 26 Ki→124 / 12 Ki→68; redirecionar Projétil por meio Ki; agarrar à distância com Inteligência). Bloco de "bônus por tamanho" idêntico em Lupino Azul e Namekuseijin Mutante. "Corpo Mutante" e "Regeneração Mutante" são versões reforçadas de "Corpo do Guerreiro"/"Regeneração de Namek" do livro básico. Ōzaru do Potêncial = texto do livro básico.
6. **Escala de custos recorrente**: "pague PK igual à Escala de Poder (EP) do inimigo/alvo" aparece em ~10 traços (Glass, Hera, Moroan, Saibaman, Makyan Dead Zone, Purrlian Est. 2/5) — é o padrão do sistema para escalar custo com o oponente.

## Mecânicas novas (não achadas nas md do livro básico j1/j2/j3)

- **Bônus por tamanho (Grande/Enorme/Imenso/Final)**: tabela de grid 2x2→5x5, +3 m de alcance por estágio, imune a agarrar/flanquear por menores, desvantagem em testes físicos impostos a alvos de outra escala, mitiga 5 por escala de diferença, inimigos menores com vantagem, físicos viram Contundente. Livro básico só cita "Enorme" no Ōzaru e "agarrar só mesma escala ou menor".
- **Estado de Ruptura + Cargas de Potencial** (Saiyajin Potêncial): recurso próprio de 2-3 cargas por 3 rodadas, gasto em efeitos (mover 9 m, -1 estágio de dano, ignorar ½ mitigação, +1 estágio), Carga Latente, Dano Latente, Marcas de Caça.
- **Avatares** (Metal Freeza Clan): PV divididos entre cópias da ficha que compartilham PK e agem todas no turno (mínimo 10% da vida cada); corpo verdadeiro remoto; renascimento imune à última técnica.
- **Clones da Técnica Multiforma** (Artista Marcial): Ki dividido por 2 por clone, até EP Base clones; dano repassado ao original.
- **Dívida de descanso** e **humor 1d6 por combate** (Purrlians); **Anjo-mentor** com 5 poderes 1x/descanso longo (inclui retroceder 1 rodada).
- **Transformação em 6 estágios "Legado da Destruição"** com anulação de técnicas pagando o Ki do atacante, dano verdadeiro (Est. 4) e "Hakai" de morte instantânea (Est. 6, custo EP do alvo ×2). Cita a passiva "Acesso ao Ki Divino" (não existe nas md do livro).
- **Distância da Estrela Makyo (1d100 no início da batalha)** → +20% a +100% PK, regeneração, vantagens; 100 = desvantagem em tudo.
- **Zona Morta/Dead Zone**: custo = área (1,5 m de cone/PK) + soma das EP dos alvos; testes de Força/Destreza vs Poder em 2 etapas.
- **Névoa corruptora com contágio** (Makyan): CD 15 + EP Base, 3 falhas = transformação demoníaca e "Vampirismo Demoníaco" contagioso, permanente após 24 h.
- **Assimilação Moroan**: troca atributos pelo maior, aprende técnicas/talentos/raça/transformações, assume EP base maior; limite = EP Base. **Absorção Vital**: PK bônus permanentes (1 PK = 1 ano de vida) e "Destruição Planetária" Moroan (1d20 × EP do planeta) revertida só pela técnica especial "Fissão Espiritual" (não definida em lugar nenhum).
- **Refração de Ki** (Glass): redirecionar técnica de Ki recebida com o próprio acerto, sem PK, um estágio a menos. **Reconstrução de Cacos**: volta com 10% da vida; morre só com dano negativo = vida total.
- **Ki que não se perde** (Hera-seijin): PK não usado acumula para o turno seguinte; regenera metade dos PK na reação (só para técnicas Reativas).
- **Erro custa meio PK** (Heeter, Estado Relaxado) e **+1 acumulativo após falhar em testes resistidos/salvaguarda** (Progressão Pura).
- **Modo berserker** recorrente: Liberação de Instinto (Heeter), Aura Maligna (força o alvo a gastar todo PK no alvo mais próximo, do maior para o menor custo).
- **Zenkai Brutal** (Maligno): ativado por matar com crueldade, teste estilo Portas da Morte (3 sucessos vs 3 falhas, CD 10).
- **Aura Negativa**: -1 acumulativo em todas as rolagens do alvo a cada 2 rodadas de combate ativo.
- **Anti-magia** (Zahha): ½ dano de técnicas Mágicas, anulação em reação sem teste se EP do mago ≤ a sua, aura com 50% de falha de conjuração (raio 1,5 m × EP).
- **Rótulo concedido por PK** (Glass, Heeter, Moroan): pagar o custo do rótulo para adicioná-lo na conjuração (tipo de dano, elemental, Fragmentação, Ricochete etc.).
- **Espada da Esperança** (Lâmina de Ki): Genki-Dama em toque, dano inicial 1d20 × EP do planeta, crítico garantido contra "maligno", usos = EP Total.
- **Hokuto Hyakuretsu Ken** (Vital): armazena 1d20 de dano fixo por condição aplicada, liberado sem reação/mitigação a 1 PK por condição.
- **Reprodução por semente** (Saibaman) e **autoexplosão** (3 de dano fixo por PK acumulado agarrado).

Todas as condições (Lacuna Mental, Quebrado, Sobrecarregado, Controle Mental etc.) e todos os rótulos usados nas técnicas existem nas md do livro básico (verificado por `rg` em `md/j1-* j2-* j3-*`).

## Ambiguidades e erros do original

- **Purrlians**: sem a regra de vida por 10.000 PDL; "Furioso" termina truncado; Estágio 5 confuso sobre quem paga Ki; "Acesso ao Ki Divino" não definido.
- **Moroans**: "O Majin só absorve a Escala natural" (sobra de texto copiado da absorção Majin).
- **Namekuseijin Mutante**: texto diz "entre o Grande e Imenso", tabela vai até "Final" (5x5, ≈60 m); refere "Gigantificação comum dos Namekuseijins" que não está nas md do livro básico.
- **Tribo Glass / Refração de Luz**: "PK's equivalente ao inimigo mais poderoso" sem dizer a medida (provável EP).
- **Hera-seijin**: frase da proporção 1:3 incompleta (subentende +3 de dano por PK).
- **Saibamans**: título "A Génese de Yardrat" sobre o planeta Vexx (título reaproveitado); custo do ácido não declarado.
- **Lupinos**: não diz se a cor é escolha única; Lupino Vermelho dura "Escala de Poder Base" rodadas.
- **Artista Marcial**: duas técnicas Rank E chamadas "Soco de Impacto"; "Soco Reativo - B" tem dano 14-22-44 (padrão do rank seria 11-22-44).
- **Saiyajin do Potêncial**: Masenko 12-22-44; "Ultimate Kamehameha" repete o texto do Super Kamehameha. Ōzaru: "perdendo parte do controle ... caso seja uma criança".
- **Metal Freeza Clan**: "Estrela Gete" (lore) × "Estrela Gate" (regra).
- **Zahha Clan**: frase truncada "podem se na área de raio".
