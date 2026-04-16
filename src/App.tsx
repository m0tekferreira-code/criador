import { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, FileText, Image as ImageIcon, Wand2,
  CheckCircle2, Palette, PenTool, Layout, Download,
  AlertCircle, Loader2, ChevronRight, RefreshCw, X, ImagePlus, Key, Cpu, Info, ExternalLink, BookOpen
} from 'lucide-react';

const apiKey = "";

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

interface ModelOption { id: string; label: string; }
interface ReferenceImage { base64: string; mimeType: string; }

const SIZE_TO_ASPECT: Record<string, string> = {
  "1080x1080": "1:1",
  "1080x1920": "9:16",
  "1920x1080": "16:9",
};

export default function App() {
  const [step, setStep] = useState(1);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState("");
  const [mdFile, setMdFile] = useState<File | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [selectedSize, setSelectedSize] = useState("1080x1080");
  const [numCreatives, setNumCreatives] = useState(1);
  const [availableTextModels, setAvailableTextModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash (Padrao)" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Alta Complexidade)" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Rapido)" }
  ]);
  const [availableImageModels, setAvailableImageModels] = useState<ModelOption[]>([
    { id: "gemini-2.5-flash-image-preview", label: "Gemini Image Flash (Nano Banana)" },
    { id: "gemini-3-pro-image-preview-11-2025", label: "Gemini 3 Pro Image (Nano Banana Pro)" },
    { id: "imagen-4.0-generate-001", label: "Imagen 4.0 (Estavel)" }
  ]);
  const [textModel, setTextModel] = useState("gemini-2.5-flash-preview-09-2025");
  const [imageModel, setImageModel] = useState("gemini-2.5-flash-image-preview");
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [palette, setPalette] = useState<string[]>([]);
  const [brandAnalysis, setBrandAnalysis] = useState("");
  const [copyText, setCopyText] = useState("");
  const [copyRationale, setCopyRationale] = useState("");
  const [designConcepts, setDesignConcepts] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const sizes = [
    { id: "1080x1080", label: "Post (1:1)", icon: <Layout className="w-5 h-5" /> },
    { id: "1080x1920", label: "Story (9:16)", icon: <Layout className="w-4 h-6" /> },
    { id: "1920x1080", label: "Banner (16:9)", icon: <Layout className="w-6 h-4" /> }
  ];

  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMdFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setMdContent(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setLogo(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImages: ReferenceImage[] = [];
    let loadedCount = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImages.push({ base64: event.target?.result as string, mimeType: file.type });
        loadedCount++;
        if (loadedCount === files.length) {
          setReferenceImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const fetchModelsFromApi = useCallback(async (key: string) => {
    if (!key || key.length < 10) return;
    setKeyStatus("loading");
    setError(null);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedText = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent") && !m.name.includes("image") && !m.name.includes("embedding"))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));
      if (fetchedText.length > 0) {
        setAvailableTextModels(fetchedText);
        setTextModel(prev => fetchedText.find((m: ModelOption) => m.id === prev) ? prev : fetchedText[0].id);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedImage = data.models
        .filter((m: any) => m.name.includes("imagen") || m.name.includes("image-preview") || (m.displayName && m.displayName.toLowerCase().includes("image")))
        .map((m: any) => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', '') }));
      if (fetchedImage.length > 0) {
        setAvailableImageModels(fetchedImage);
        setImageModel(prev => fetchedImage.find((m: ModelOption) => m.id === prev) ? prev : fetchedImage[0].id);
      }
      setKeyStatus("success");
    } catch (err) {
      console.error(err);
      setKeyStatus("error");
      setError("Falha ao carregar modelos. Verifique se a chave e valida e possui permissoes.");
    }
  }, []);

  useEffect(() => {
    if (!customApiKey || customApiKey.length < 10) {
      setKeyStatus("idle");
      return;
    }
    const timeout = setTimeout(() => {
      fetchModelsFromApi(customApiKey);
    }, 800);
    return () => clearTimeout(timeout);
  }, [customApiKey, fetchModelsFromApi]);

  // ========================================================================
  // AGENT 1 -- Diretor de Criacao (Analista de Marca + Direcao de Arte)
  // Produz: paleta, analise da marca, N conceitos de design DISTINTOS.
  // ========================================================================
  const analyzeInputs = async () => {
    if (!mdContent) { setError("Por favor, faca upload do arquivo Markdown com as informacoes da empresa."); return; }
    setStep(2); setLoadingMsg("Agente 1 -- Analisando marca e direcao de arte..."); setError(null);
    try {
      const activeKey = customApiKey || apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${activeKey}`;
      const systemPrompt = `
Voce e um Diretor de Criacao Senior em uma agencia de publicidade de elite com mais de 20 anos de experiencia.
Sua especialidade e analise de marca, direcao de arte e design de anuncios completos.

TAREFA:
Analise o manual/documento da marca e TODAS as imagens de referencia visual fornecidas.

ENTREGAVEIS:
1. **brand_analysis** -- Analise profunda da marca (em Portugues). Inclua:
   - Publico-alvo e persona identificados
   - Tom de voz e personalidade da marca
   - Proposta de valor principal
   - Diferenciais competitivos
   - Gatilhos emocionais que ressoam com o publico

2. **colors** -- Paleta de 3 a 5 cores em formato HEX.
   Baseie-se nas cores do manual, da logo e das referencias visuais.

3. **design_concepts** -- Um ARRAY de exatamente ${numCreatives} conceitos de design DISTINTOS em INGLES.
   CADA conceito sera usado como prompt para gerar um CRIATIVO PUBLICITARIO COMPLETO (imagem final com texto).
   
   CADA conceito DEVE ser COMPLETAMENTE DIFERENTE dos outros em:
   - Layout e composicao (centrado, assimetrico, diagonal, grid, split-screen, full-bleed, etc.)
   - Atmosfera e mood (vibrante, elegante, minimalista, ousado, dramatico, clean, etc.)
   - Estilo visual (fotografico, flat design, gradiente, texturizado, colagem, neon, etc.)
   - Posicionamento do texto e da logo (topo, centro, inferior, lateral, overlay, etc.)
   
   Para cada conceito, descreva DETALHADAMENTE:
   - Composicao completa do background e elementos visuais
   - Atmosfera, iluminacao e texturas
   - ONDE e COMO o texto da copy deve aparecer (posicao, tamanho relativo, estilo tipografico: bold, light, serif, sans-serif, etc.)
   - ONDE a logo deve ser posicionada
   - O estilo tipografico que combine com o mood do conceito
   - Baseie-se no estilo visual das imagens de referencia, mas VARIE a interpretacao entre conceitos
   - O formato final e ${selectedSize} (aspect ratio ${SIZE_TO_ASPECT[selectedSize]})

IMPORTANTE:
- Cada conceito DEVE resultar em um criativo VISUALMENTE UNICO e diferente dos demais.
- O texto da copy SERA parte da imagem gerada -- descreva como ele deve ser integrado visualmente.
- Responda APENAS com JSON valido.
`.trim();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = [{ text: `=== MANUAL DA EMPRESA ===\n${mdContent}` }];
      if (logo) {
        parts.push({ text: "=== LOGO DA EMPRESA (extraia as cores primarias) ===" });
        parts.push({ inlineData: { mimeType: "image/png", data: logo.split(',')[1] } });
      }
      if (referenceImages.length > 0) {
        parts.push({ text: `=== IMAGENS DE REFERENCIA DE ESTILO (${referenceImages.length} imagem(ns)) ===` });
        referenceImages.forEach((img, i) => {
          parts.push({ text: `Referencia visual #${i + 1}:` });
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } });
        });
      }

      const payload = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              brand_analysis: { type: "STRING", description: "Analise profunda da marca em Portugues" },
              colors: { type: "ARRAY", items: { type: "STRING" }, description: "Array de 3 a 5 codigos HEX" },
              design_concepts: { type: "ARRAY", items: { type: "STRING" }, description: `Array de exatamente ${numCreatives} conceitos de design DISTINTOS em INGLES para criativo completo com texto.` }
            },
            required: ["brand_analysis", "colors", "design_concepts"]
          }
        }
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("Resposta invalida da IA analitica.");
      const data = JSON.parse(responseText);

      setPalette(data.colors || []);
      setBrandAnalysis(data.brand_analysis || "");
      setDesignConcepts(data.design_concepts || []);

      await generateCopy(data.brand_analysis, data.colors);

    } catch (err: any) {
      console.error(err); setError("Erro no Agente Analitico. " + err.message); setStep(1);
    }
  };

  // ========================================================================
  // AGENT 2 -- Copywriter Senior
  // Produz: copy persuasiva de alta conversao + rationale.
  // ========================================================================
  const generateCopy = async (analysis: string, colors: string[]) => {
    setLoadingMsg("Agente 2 -- Copywriter escrevendo textos de alta conversao...");
    try {
      const activeKey = customApiKey || apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${textModel}:generateContent?key=${activeKey}`;

      const systemPrompt = `
Voce e um Copywriter Senior de elite com mais de 15 anos de experiencia em campanhas publicitarias de alta performance.
Voce domina frameworks de persuasao: AIDA, PAS, BAB e os 6 principios de Cialdini.

CONTEXTO:
Um Diretor de Criacao analisou a marca e produziu o seguinte briefing:
---
${analysis}
---
Paleta de cores: ${colors.join(', ')}
Formato: ${selectedSize} (${SIZE_TO_ASPECT[selectedSize]})

TAREFA:
Escreva a copy final do anuncio.

DIRETRIZES:
1. Copy em Portugues (pt-BR), curta e impactante.
2. Maximo de 2-3 linhas -- precisa caber visualmente em um banner ${selectedSize}.
3. Use gatilhos mentais poderosos.
4. Tom de voz IDENTICO ao da analise de marca.
5. Inclua CTA quando apropriado.
6. Evite cliches genericos. Seja original e especifico.

Responda APENAS com JSON valido.
`.trim();

      const payload = {
        contents: [{ role: "user", parts: [{ text: `=== MANUAL COMPLETO DA EMPRESA ===\n${mdContent}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              copy: { type: "STRING", description: "Copy curta e persuasiva em Portugues (pt-BR)" },
              copy_rationale: { type: "STRING", description: "Breve explicacao da estrategia e gatilhos utilizados" }
            },
            required: ["copy", "copy_rationale"]
          }
        }
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) throw new Error("Resposta invalida do Copywriter.");
      const data = JSON.parse(responseText);

      setCopyText(data.copy || "");
      setCopyRationale(data.copy_rationale || "");
      setStep(3);

    } catch (err: any) {
      console.error(err); setError("Erro no Agente Copywriter. " + err.message); setStep(1);
    }
  };

  // ========================================================================
  // AGENT 3 -- Criador de Anuncios Visuais Completos
  // Gera o CRIATIVO FINAL com copy + logo integrados na imagem.
  // Cada criativo usa um conceito de design DISTINTO do Agent 1.
  // ========================================================================
  const generateCreative = async () => {
    setStep(4); setLoadingMsg(`Agente 3 -- Gerando ${numCreatives} criativo(s) completo(s)...`); setError(null);
    try {
      const activeKey = customApiKey || apiKey;
      const aspectRatio = SIZE_TO_ASPECT[selectedSize] || "1:1";

      const promises = Array.from({ length: numCreatives }).map(async (_, index) => {
        const conceptForThisVariation = designConcepts[index] || designConcepts[0] || "Premium advertising composition";

        const finalPrompt = [
          `Create a COMPLETE, FINAL advertising creative ready for publication. This is creative variation ${index + 1} of ${numCreatives}.`,
          `Aspect ratio: ${aspectRatio}. Format: ${selectedSize}.`,
          "",
          "=== VISUAL CONCEPT FOR THIS SPECIFIC VARIATION ===",
          conceptForThisVariation,
          "",
          "=== MANDATORY TEXT TO RENDER ON THE IMAGE ===",
          `The following copy text MUST appear legibly and beautifully typeset on the image, integrated into the design:`,
          `"${copyText}"`,
          "",
          "=== COLOR PALETTE (must dominate the design) ===",
          palette.join(', '),
          "",
          "=== CRITICAL REQUIREMENTS ===",
          "1. The copy text above MUST be rendered clearly and legibly as part of the image composition.",
          "2. The typography must be professional, readable, and visually integrated with the overall design.",
          "3. Text should have proper contrast against the background -- use text shadows, overlays, or solid areas if needed.",
          "4. This is a FINAL advertising creative -- it must look polished, professional, and ready to publish.",
          "5. Follow the visual concept direction precisely for layout, mood, and typography style.",
        ].join("\n");

        let base64Image = "";
        if (imageModel.startsWith('imagen')) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict?key=${activeKey}`;
          const payload = {
            instances: [{ prompt: finalPrompt }],
            parameters: { sampleCount: 1, aspectRatio: aspectRatio }
          };
          const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!result.predictions || !result.predictions[0]) throw new Error("Erro ao gerar imagem. Tente modificar o conceito.");
          base64Image = result.predictions[0].bytesBase64Encoded;
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${activeKey}`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const contentParts: any[] = [{ text: finalPrompt }];

          if (logo) {
            contentParts.push({ text: "Place the following logo in the creative, integrated into the design as directed by the visual concept:" });
            contentParts.push({ inlineData: { mimeType: "image/png", data: logo.split(',')[1] } });
          }

          if (referenceImages.length > 0) {
            contentParts.push({ text: "Use the following reference images as style and visual guidance:" });
            referenceImages.forEach((img) => {
              contentParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } });
            });
          }

          const payload = {
            contents: [{ parts: contentParts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
          };
          const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inlineDataPart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
          if (!inlineDataPart || !inlineDataPart.inlineData) throw new Error("Erro ao gerar imagem com o modelo Gemini Image.");
          base64Image = inlineDataPart.inlineData.data;
        }
        return "data:image/png;base64," + base64Image;
      });

      const images = await Promise.all(promises);
      setGeneratedImages(images); setStep(5);
    } catch (err: any) {
      console.error(err); setError("Erro ao gerar criativo. " + err.message); setStep(3);
    }
  };

  // ========================================================================
  // RENDERIZACAO
  // ========================================================================

  const renderStep1 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-3xl mx-auto">
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">Configuracao de API e Modelos</h3>
        <p className="text-sm text-[#86868b] mb-5">Insira sua chave do Google AI Studio -- os modelos serao carregados automaticamente.</p>
        <div className="relative">
          <Key className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="password" placeholder="AIzaSy..." value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            className="w-full pl-12 pr-12 py-4 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-mono text-sm transition-all" />
          {keyStatus === "loading" && (
            <Loader2 className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] animate-spin" />
          )}
          {keyStatus === "success" && (
            <CheckCircle2 className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
          )}
          {keyStatus === "error" && (
            <AlertCircle className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-red-500" />
          )}
        </div>
        {keyStatus === "success" && (
          <p className="text-sm text-emerald-600 font-medium mt-3 flex items-center gap-1.5 ml-1">
            <CheckCircle2 className="w-4 h-4" /> Modelos sincronizados automaticamente!
          </p>
        )}
        {keyStatus === "error" && (
          <p className="text-sm text-red-500 font-medium mt-3 flex items-center gap-1.5 ml-1">
            <AlertCircle className="w-4 h-4" /> Chave invalida ou sem permissao. Verifique e tente novamente.
          </p>
        )}
        <div className="mt-6 p-5 bg-[#f0f7ff] rounded-2xl border border-[#cce4ff] flex items-start gap-4">
          <Info className="w-6 h-6 text-[#0071e3] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#004a99] mb-1">Requisito de Faturamento (Nivel 1)</p>
            <p className="text-sm text-[#0057b3]/90 leading-relaxed mb-3">
              Para ter acesso aos modelos visuais avancados (como <b>Gemini Image, Nano Banana Pro e Imagen 4.0</b>), sua Chave API precisa estar vinculada a um projeto com faturamento ativo (Pay-as-you-go).
            </p>
            <a href="https://aistudio.google.com/app/billing" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#0071e3] hover:text-[#0057b3] font-semibold text-sm transition-colors">
              Ativar faturamento no AI Studio <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Cpu className="w-5 h-5 text-[#1d1d1f]" /></div>
          Selecao de IA
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Analitica e Copywriter</p>
            <div className="relative">
              <select value={textModel} onChange={(e) => setTextModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer">
                {availableTextModels.map(model => (<option key={model.id} value={model.id}>{model.label}</option>))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[#86868b] mb-3">IA Geradora de Criativos</p>
            <div className="relative">
              <select value={imageModel} onChange={(e) => setImageModel(e.target.value)}
                className="w-full p-4 pr-12 bg-[#f5f5f7] border-transparent rounded-2xl outline-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 text-[#1d1d1f] font-medium text-sm transition-all appearance-none cursor-pointer">
                {availableImageModels.map(model => (<option key={model.id} value={model.id}>{model.label}</option>))}
              </select>
              <ChevronRight className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><FileText className="w-5 h-5 text-[#1d1d1f]" /></div>
          Manual da Empresa (.md)
        </h3>
        <input type="file" accept=".md,.txt" ref={mdInputRef} className="hidden" onChange={handleMdUpload} />
        {!mdFile ? (
          <div onClick={() => mdInputRef.current?.click()}
            className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-10 text-center cursor-pointer transition-colors border border-transparent hover:border-gray-200">
            <UploadCloud className="w-10 h-10 text-[#86868b] mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-[#1d1d1f] font-medium text-lg">Carregar documento de marca</p>
            <p className="text-[#86868b] text-sm mt-2">Tom de voz, missao, produto, etc.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#f5f5f7] p-5 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm"><FileText className="w-6 h-6 text-[#1d1d1f]" /></div>
              <div>
                <p className="font-semibold text-[#1d1d1f]">{mdFile.name}</p>
                <p className="text-sm text-[#86868b]">{(mdFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => setMdFile(null)} title="Remover arquivo" className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><ImagePlus className="w-5 h-5 text-[#1d1d1f]" /></div>
          Identidade Visual
        </h3>
        <input type="file" accept="image/png, image/jpeg, image/svg+xml" ref={logoInputRef} className="hidden" onChange={handleLogoUpload} />
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Logo da Empresa (Opcional)</p>
          {!logo ? (
            <div onClick={() => logoInputRef.current?.click()}
              className="bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl p-6 text-center cursor-pointer transition-colors">
              <p className="text-[#1d1d1f] font-medium">Adicionar Logo</p>
              <p className="text-[#86868b] text-xs mt-1">PNG transparente recomendado</p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-[#f5f5f7] p-4 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-sm p-2">
                  <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="font-medium text-[#1d1d1f]">Logo Carregada</p>
              </div>
              <button onClick={() => setLogo(null)} title="Remover logo" className="p-2 text-[#86868b] hover:text-red-500 hover:bg-white rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-[#86868b] mb-3">Referencias de Estilo</p>
          <input type="file" accept="image/*" multiple ref={imageInputRef} className="hidden" onChange={handleImageUpload} />
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {referenceImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square group rounded-2xl overflow-hidden shadow-sm">
                <img src={img.base64} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={() => removeImage(idx)} title="Remover referencia"
                  className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-md rounded-full text-[#1d1d1f] opacity-0 group-hover:opacity-100 transition-all hover:scale-105">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div onClick={() => imageInputRef.current?.click()}
              className="aspect-square bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors">
              <UploadCloud className="w-6 h-6 text-[#86868b] mb-2" strokeWidth={2} />
              <span className="text-xs text-[#86868b] font-medium">Adicionar</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-gray-100">
        <h3 className="text-xl font-semibold text-[#1d1d1f] mb-6 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-[#f5f5f7] rounded-xl"><Layout className="w-5 h-5 text-[#1d1d1f]" /></div>
          Configuracoes de Geracao
        </h3>
        <div className="mb-8">
          <p className="text-sm font-medium text-[#86868b] mb-3">Formato do Criativo</p>
          <div className="flex flex-col md:flex-row p-1.5 bg-[#f5f5f7] rounded-2xl gap-1">
            {sizes.map((size) => (
              <button key={size.id} onClick={() => setSelectedSize(size.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${selectedSize === size.id ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}>
                {size.icon} {size.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-[#86868b]">Quantidade de Variacoes</span>
            <span className="text-lg font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-4 py-1 rounded-full">{numCreatives}</span>
          </div>
          <input type="range" min="1" max="10" value={numCreatives}
            onChange={(e) => setNumCreatives(Number(e.target.value))}
            className="w-full h-2 bg-[#e8e8ed] rounded-full appearance-none cursor-pointer accent-[#1d1d1f]" />
        </div>
      </div>

      <button onClick={analyzeInputs} disabled={!mdFile}
        className="w-full py-5 bg-[#1d1d1f] hover:bg-black disabled:bg-[#e8e8ed] disabled:text-[#86868b] disabled:cursor-not-allowed text-white text-lg font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] disabled:shadow-none mt-4">
        <Wand2 className="w-5 h-5" /> Processar Diretrizes
      </button>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
      <Loader2 className="w-12 h-12 text-[#1d1d1f] animate-spin mb-6" strokeWidth={2} />
      <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2 tracking-tight">Processando</h2>
      <p className="text-[#86868b] font-medium">{loadingMsg}</p>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-fade-in w-full max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Aprovacao Criativa</h2>
        <p className="text-[#86868b] text-lg">Revise os resultados dos agentes antes de gerar os criativos finais.</p>
      </div>

      {brandAnalysis && (
        <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
          <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
            <BookOpen className="w-5 h-5 text-[#86868b]" /> Analise de Marca <span className="text-xs font-normal text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">Agente 1</span>
          </h3>
          <div className="p-5 bg-[#f5f5f7] rounded-2xl text-sm text-[#1d1d1f] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {brandAnalysis}
          </div>
        </div>
      )}

      <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="space-y-10">
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-5 tracking-tight">
              <Palette className="w-5 h-5 text-[#86868b]" /> Paleta de Cores <span className="text-xs font-normal text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">Agente 1</span>
            </h3>
            <div className="flex flex-wrap gap-5">
              {palette.map((color, idx) => (
                <div key={idx} className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] ring-1 ring-gray-200 relative overflow-hidden group hover:scale-105 transition-transform cursor-pointer"
                    style={{ backgroundColor: color }}>
                    <input type="color" value={color}
                      onChange={(e) => { const np = [...palette]; np[idx] = e.target.value; setPalette(np); }}
                      className="absolute inset-[-10px] w-[150%] h-[150%] opacity-0 cursor-pointer" />
                  </div>
                  <span className="text-xs font-mono text-[#86868b] uppercase">{color}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-gray-100"></div>

          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <PenTool className="w-5 h-5 text-[#86868b]" /> Copywriting <span className="text-xs font-normal text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">Agente 2 -- Copywriter</span>
            </h3>
            {copyRationale && (
              <div className="mb-4 p-4 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">{copyRationale}</p>
              </div>
            )}
            <textarea value={copyText} onChange={(e) => setCopyText(e.target.value)}
              className="w-full p-5 bg-[#f5f5f7] border-transparent rounded-2xl text-[#1d1d1f] font-medium text-lg resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-32 transition-all leading-relaxed" />
            <p className="text-xs text-[#86868b] mt-3 ml-2">Este texto sera renderizado diretamente nos criativos pela IA.</p>
          </div>

          <div className="h-px w-full bg-gray-100"></div>

          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f] flex items-center gap-2 mb-4 tracking-tight">
              <Wand2 className="w-5 h-5 text-[#86868b]" /> Conceitos de Design ({designConcepts.length} variacoes) <span className="text-xs font-normal text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">Agente 1</span>
            </h3>
            <div className="space-y-4">
              {designConcepts.map((concept, idx) => (
                <div key={idx}>
                  <p className="text-xs font-semibold text-[#86868b] mb-2 ml-1">Variacao {idx + 1}</p>
                  <textarea value={concept}
                    onChange={(e) => { const nc = [...designConcepts]; nc[idx] = e.target.value; setDesignConcepts(nc); }}
                    className="w-full p-4 bg-[#f5f5f7] border-transparent rounded-2xl text-[#86868b] text-sm resize-none focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 outline-none h-28 font-mono transition-all leading-relaxed" />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#86868b] mt-3 ml-2">Cada conceito gera um criativo COMPLETO e visualmente unico. Editavel.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button onClick={() => setStep(1)}
          className="px-8 py-4 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] font-semibold rounded-full transition-colors">
          Voltar
        </button>
        <button onClick={generateCreative}
          className="flex-1 py-4 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-lg rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,113,227,0.3)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.4)]">
          <ImageIcon className="w-5 h-5" /> Gerar {numCreatives} Criativo{numCreatives > 1 ? 's' : ''} Completo{numCreatives > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const aspectRatioClass = selectedSize === "1080x1080" ? "aspect-square" : selectedSize === "1080x1920" ? "aspect-[9/16]" : "aspect-video";

    const handleDownload = (imgBase64: string, index: number) => {
      const link = document.createElement('a');
      link.href = imgBase64;
      link.download = `criativo-${selectedSize}-var${index + 1}.png`;
      link.click();
    };

    return (
      <div className="space-y-10 animate-fade-in w-full max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1d1d1f] tracking-tight mb-3">Criativos Prontos</h2>
          <p className="text-[#86868b] text-lg">{generatedImages.length} criativo{generatedImages.length > 1 ? 's' : ''} completo{generatedImages.length > 1 ? 's' : ''} gerado{generatedImages.length > 1 ? 's' : ''}.</p>
        </div>
        <div className={`grid gap-8 ${generatedImages.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : selectedSize === "1080x1920" ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
          {generatedImages.map((img, idx) => (
            <div key={idx} className="flex flex-col">
              <div className={`relative w-full ${aspectRatioClass} bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 group`}>
                <img src={img} alt={`Criativo ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <button onClick={() => handleDownload(img, idx)}
                    className="px-6 py-3 bg-white/90 backdrop-blur-md text-[#1d1d1f] rounded-full font-semibold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:scale-105">
                    <Download className="w-5 h-5" /> Baixar Criativo
                  </button>
                </div>
              </div>
              <p className="text-center text-sm text-[#86868b] mt-3 font-medium">Variacao {idx + 1}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto pt-8">
          <button onClick={generateCreative}
            className="flex-1 py-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-full flex items-center justify-center gap-2 transition-colors">
            <RefreshCw className="w-5 h-5" /> Gerar Novamente
          </button>
          <button onClick={() => { setStep(1); setGeneratedImages([]); }}
            className="flex-1 py-4 bg-[#1d1d1f] hover:bg-black text-white font-semibold rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
            <Layout className="w-5 h-5" /> Novo Projeto
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-[#0071e3] selection:text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center pt-8">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-[#1d1d1f] mb-3 flex items-center justify-center gap-3">
            AdCreative <span className="text-[#0071e3]">Pro</span>
          </h1>
          <p className="text-[#86868b] text-lg font-medium tracking-tight">Inteligencia Artificial para criacao publicitaria.</p>
        </header>
        <div className="flex justify-center mb-16">
          <div className="inline-flex bg-[#f5f5f7] p-1.5 rounded-full border border-gray-100">
            {[{ n: 1, label: "Setup" }, { n: 3, label: "Aprovacao" }, { n: 5, label: "Resultado" }].map((s, i) => (
              <div key={s.n}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${step >= s.n ? 'bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= s.n ? 'bg-[#1d1d1f] text-white' : 'bg-transparent border border-[#86868b]'}`}>{i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50/50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 animate-fade-in backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        <main className="transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] pb-20">
          {step === 1 && renderStep1()}
          {(step === 2 || step === 4) && renderLoading()}
          {step === 3 && renderStep3()}
          {step === 5 && renderStep5()}
        </main>
      </div>
    </div>
  );
}