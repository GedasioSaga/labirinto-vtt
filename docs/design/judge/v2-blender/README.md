# Judge v2 no Blender (parou no render herói)

**Situação: parado.** Em 30/10/2026 o usuário viu o render herói e decidiu esperar a versão montada dentro do Blender pelo MCP ("não gostei do feito sem MCP, vou esperar"). Por isso esta pasta não tem folha de sprites nem página de protótipo.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `judge-heroi.png` | Render herói, 1200 x 1500, fundo transparente, espelhado (ave olhando para a direita). |
| `judge-heroi-cena.jpg` | O mesmo render sobre céu lavanda com névoa, no espírito da pintura. |
| `fonte/judge_modelo.py` | O modelo inteiro em código: ave marrom de penas largas (cada pena é um cartão, sem pelo de partícula), peitoral com ameias, testeira com furo do olho, cavaleiro de placas com elmo de chifres de touro, ombreira redonda com ameias, capa, rédeas, cartão vermelho, materiais e luzes. |
| `fonte/render_heroi.py` | Renderiza o herói sem fundo. |
| `fonte/montar_heroi.py` | Espelha o render e gera as duas imagens acima. |
| `fonte/render_folha.py` e `fonte/montar_folhas.py` | Folha de 8 direções x 20 quadros (64 e 48 px por casa). **Nunca rodaram até o fim**: a folha foi cancelada. |

Não há arquivo `.blend`: a cena nasce do script a cada render.

## Como refazer o herói

De dentro de `fonte/`, com o Blender 5.2 (Cycles na GPU) e o Python do sistema com Pillow e numpy:

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P render_heroi.py -- heroi_bruto.png 1200 1500 160
python montar_heroi.py heroi_bruto.png
```

As duas imagens desta pasta saíram desses comandos, com 160 amostras.

## O que ficou abaixo da pintura

- Bordas claras nas penas, mais visíveis na barriga e nas coxas da ave.
- Reflexo manchado na placa do peito da ave.
- O pano azul do bico está duro: parece placa, não tecido.
- Braço e manopla simplificados; a gravura do aço é um padrão gerado, não desenho.
