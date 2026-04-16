# AdCreative Pro

Plataforma de criação publicitária com Inteligência Artificial. Gera anúncios de alta conversão automaticamente a partir do manual da marca, referências visuais e configurações personalizadas — usando modelos Gemini e Imagen do Google AI.

---

## Funcionalidades

- **Análise de Marca com IA** — Upload de documento Markdown (.md) com as diretrizes da empresa (tom de voz, missão, produto). A IA extrai informações e gera copy + direção de arte.
- **Upload de Logo** — Logo da empresa (PNG transparente recomendado) é inserida automaticamente nos criativos gerados via Canvas overlay.
- **Referências de Estilo** — Envie imagens de referência visual para guiar a estética do criativo gerado.
- **Seleção Dinâmica de Modelos** — Carrega automaticamente os modelos disponíveis na sua conta Google AI Studio (LLMs de texto e geradores de imagem).
- **Geração de Copy Persuasiva** — Copywriting com gatilhos mentais, adaptada ao tom de voz da marca.
- **Direção de Arte Automática** — Conceito visual detalhado em inglês, otimizado para geradores de imagem IA.
- **Paleta de Cores Editável** — Extrai cores da marca e referências; permite ajuste manual via color picker.
- **Múltiplos Formatos** — Post (1:1), Story (9:16), Banner (16:9).
- **Variações em Lote** — Gere até 10 variações de criativos de uma vez.
- **Download com Logo** — Composição automática da logo sobre a imagem final via Canvas API.
- **Retry Automático** — Sistema de retry com backoff exponencial para lidar com rate limits da API.

---

## Tech Stack

| Camada       | Tecnologia                          |
|--------------|-------------------------------------|
| Framework    | React 19 + TypeScript               |
| Build        | Vite 8                               |
| Estilização  | Tailwind CSS 4                       |
| Ícones       | Lucide React                         |
| IA (Texto)   | Google Gemini API (2.5 Flash / 1.5 Pro / 1.5 Flash) |
| IA (Imagem)  | Google Gemini Image / Imagen 4.0     |
| Lint         | ESLint 9 + TypeScript ESLint         |

---

## Pré-requisitos

- **Node.js** 18+
- **Chave API do Google AI Studio** — [Obter aqui](https://aistudio.google.com/app/apikey)
- **Faturamento ativo (Pay-as-you-go)** no projeto do Google Cloud para acesso aos modelos visuais avançados — [Ativar faturamento](https://aistudio.google.com/app/billing)

---

## Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/criador.git
cd criador

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5173`.

---

## Scripts Disponíveis

| Comando           | Descrição                              |
|-------------------|----------------------------------------|
| `npm run dev`     | Servidor de desenvolvimento com HMR    |
| `npm run build`   | Build de produção (TypeScript + Vite)  |
| `npm run preview` | Preview do build de produção           |
| `npm run lint`    | Verificação de lint com ESLint         |

---

## Como Usar

### 1. Setup (Passo 1)
1. Insira sua **Chave API** do Google AI Studio e clique em **Carregar Modelos** para sincronizar os modelos disponíveis.
2. Selecione a **IA Analítica** (para análise de marca e copywriting) e a **IA Geradora de Imagens**.
3. Faça upload do **Manual da Empresa** (arquivo `.md` ou `.txt`).
4. (Opcional) Adicione a **Logo** e **Imagens de Referência** de estilo.
5. Escolha o **formato** (Post, Story ou Banner) e a **quantidade de variações**.
6. Clique em **Processar Diretrizes**.

### 2. Aprovação Criativa (Passo 2)
- Revise a **paleta de cores** gerada (clique nas cores para editar).
- Ajuste a **copy** do anúncio.
- Refine a **direção de arte** (prompt em inglês para o gerador de imagens).
- Clique em **Gerar Anúncio(s)**.

### 3. Resultado (Passo 3)
- Visualize os criativos gerados com preview de logo overlay.
- **Baixar Imagem** — exporta o criativo em PNG com a logo composited automaticamente.
- **Gerar Novamente** para novas variações ou **Novo Projeto** para recomeçar.

---

## Estrutura do Projeto

```
criador/
├── public/                  # Assets estáticos
├── src/
│   ├── App.tsx              # Componente principal (toda a aplicação)
│   ├── main.tsx             # Entry point React
│   └── index.css            # Tailwind CSS + animações customizadas
├── index.html               # HTML template
├── vite.config.ts           # Configuração Vite + Tailwind plugin
├── tsconfig.json             # Configuração TypeScript
├── package.json              # Dependências e scripts
└── eslint.config.js          # Configuração ESLint
```

---

## Modelos Suportados

### IA de Texto (Análise + Copywriting)
- Gemini 2.5 Flash (padrão)
- Gemini 1.5 Pro (alta complexidade)
- Gemini 1.5 Flash (rápido)
- + qualquer modelo carregado dinamicamente via API

### IA de Geração de Imagem
- Gemini Image Flash (Nano Banana)
- Gemini 3 Pro Image (Nano Banana Pro)
- Imagen 4.0
- + qualquer modelo carregado dinamicamente via API

---

## Licença

MIT
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
