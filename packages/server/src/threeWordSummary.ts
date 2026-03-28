const THREE_LINE_SUMMARIZER_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const FALLBACK_MODEL = "fallback-local-heuristic";

type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

type StructuredThreeLineResponse = {
  lines: [string, string, string];
};

const LINE_FALLBACK_POOL = [
  "なんかあったンゴ",
  "スレ民がざわついとるやで",
  "ワイにはわからんクレメンス",
] as const;

const structuredOutputSchema = {
  type: "json_schema",
  json_schema: {
    name: "three_line_summary",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        lines: {
          type: "array",
          items: {
            type: "string",
          },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ["lines"],
    },
  },
} as const;

function isStructuredThreeLineResponse(value: unknown): value is StructuredThreeLineResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const lines = (value as { lines?: unknown }).lines;

  return (
    Array.isArray(lines) &&
    lines.length === 3 &&
    lines.every((line) => typeof line === "string" && line.trim().length > 0)
  );
}

function parseStructuredOutput(value: unknown): StructuredThreeLineResponse {
  if (isStructuredThreeLineResponse(value)) {
    return {
      lines: value.lines.map((line) => line.trim()) as [string, string, string],
    };
  }

  if (typeof value === "string") {
    return parseStructuredOutput(JSON.parse(value) as unknown);
  }

  if (value && typeof value === "object" && "response" in value) {
    return parseStructuredOutput((value as { response: unknown }).response);
  }

  throw new Error("Workers AI returned an unexpected structured output payload");
}

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

function buildFallbackLines(content: string): [string, string, string] {
  const sentences =
    content
      .match(/[^。！？\n]{4,30}[。！？]?/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [];

  const picked: string[] = [];

  if (sentences.length > 0) picked.push(sentences[0].slice(0, 20));
  if (sentences.length > 2) picked.push(sentences[Math.floor(sentences.length / 2)].slice(0, 20));
  if (sentences.length > 1) picked.push(sentences[sentences.length - 1].slice(0, 20));

  for (const fallback of LINE_FALLBACK_POOL) {
    if (picked.length >= 3) break;
    if (!picked.includes(fallback)) picked.push(fallback);
  }

  return [picked[0]!, picked[1]!, picked[2]!];
}

function buildSummary(lines: [string, string, string], model: string) {
  return {
    words: lines,
    summary: lines.join("\n"),
    model,
  };
}

export async function summarizeIntoThreeWords(ai: AiBinding | undefined | null, content: string) {
  if (!ai) {
    console.warn("[threeWordSummary] AI binding is not available, using fallback");
    return buildSummary(buildFallbackLines(content), FALLBACK_MODEL);
  }

  try {
    const result = await ai.run(THREE_LINE_SUMMARIZER_MODEL, {
      messages: [
        {
          role: "system",
          content: `あなたはなんJに常駐しとる古参やで。ユーザーが話題やスレの内容を投げてくるから「今北産業」形式で3行にまとめてクレメンス。

【重要な前提】
- 今北産業は「スレの出来事を3行で要約する」レスや
- 挨拶や雑談をするもんやない
- どんな話題が来ても「スレで起きた事件」として扱って要約せえ
- もし「こんにちは」みたいな話題にならん内容が来たら{"lines":["スレタイと内容くれやクレメンス","",""]}と返せ（その場合だけ2行目3行目は空でええ）

【口調ルール】
- 猛虎弁が基本や（〜やで、〜やな、〜やろ、〜やんけ）
- なんJ用語を自然にブチ込め（ンゴ、ニキ、サンガツ、クレメンス、ファッ!?、ヒエッ、はえ〜すっごい、ぐう〇〇、○○で草、なんやこれ…）
- ただし全部盛りにすんな、1行になんJ語は1〜2個が限度や
- 「w」は使うな、笑いは「草」「で草」「草生える」や
- 句読点ほぼ無し、「。」で終わらすな
- 標準語・敬語は絶対禁止

【3行の構成】
- 1行目：何が起きたかズバッと（事実ベース）
- 2行目：スレがどうなったか（荒れた・盛り上がった・お通夜等）
- 3行目：オチ（皮肉、ツッコミ、身も蓋もない真実で締める）

## 例

Input: "大谷が1試合3ホームラン打った"
Output: {"lines": ["大谷が3打席連続ホームランかましたンゴ", "なんJ民全員手のひらクルクルで大谷スレ乱立しとる", "アンチさん今日も敗北で草"]}

Input: "有名YouTuberが引退発表"
Output: {"lines": ["〇〇が引退宣言してて草", "信者とアンチが殴り合っとるンゴ", "まとめ民が一番ウキウキで草生える"]}

Input: "仕事が多すぎて全然終わらない、つらい"
Output: {"lines": ["仕事多すぎてヒエッ…ってなっとるやで", "スレ民も残業仲間で草生える", "定時退社ニキだけが勝ち組やろ"]}`,
        },
        {
          role: "user",
          content: content,
        },
      ],
      response_format: structuredOutputSchema,
      temperature: 0.6,
      max_tokens: 128,
    });

    const parsed = parseStructuredOutput(result);
    const normalizedLines = parsed.lines.map(normalizeLine).filter(Boolean) as string[];

    if (normalizedLines.length !== 3) {
      throw new Error("Workers AI did not return exactly three usable lines");
    }

    return buildSummary(normalizedLines as [string, string, string], THREE_LINE_SUMMARIZER_MODEL);
  } catch (err) {
    console.error("[threeWordSummary] AI call failed, using fallback:", err);
    return buildSummary(buildFallbackLines(content), FALLBACK_MODEL);
  }
}

export type { AiBinding };
