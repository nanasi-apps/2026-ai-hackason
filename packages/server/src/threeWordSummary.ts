const THREE_LINE_SUMMARIZER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "fallback-local-heuristic";

type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

type StructuredThreeLineResponse = {
  lines: [string, string, string];
};

const LINE_FALLBACK_POOL = ["言葉が滲んだ。", "誰かに届いた。", "それだけでいい。"] as const;

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

export async function summarizeIntoThreeWords(ai: AiBinding, content: string) {
  try {
    const result = await ai.run(THREE_LINE_SUMMARIZER_MODEL, {
      messages: [
        {
          role: "system",
          content: `あなたは「今北産業SNS」のAI要約エンジンです。
ユーザーの投稿を受け取り、その本質を3行の短い日本語の文に圧縮してください。

## ルール
- 出力は必ず3行。各行は10〜25文字の短い文（句でも可）
- 原文の感情・状況・テーマを正確に捉えること
- 詩的・哲学的・皮肉的など、少しズラした視点で表現してよい
- 日本語のみ。英語・記号・句読点の羅列は禁止
- 3行がそれぞれ独立した視点を持つように書く

## 例

Input: "今日は天気がいいね、散歩でもしようかな"
Output: {"lines": ["空が珍しく味方をした。", "足が勝手に動き出す。", "目的のない午後だった。"]}

Input: "仕事が多すぎて全然終わらない、つらい"
Output: {"lines": ["終わりは来ないかもしれない。", "机の上だけが世界だった。", "それでも朝はやってくる。"]}

Input: "ありがとう、本当に助かりました"
Output: {"lines": ["誰かの言葉が刺さった。", "重さが少し軽くなった日。", "それだけで十分だった。"]}`,
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
  } catch {
    return buildSummary(buildFallbackLines(content), FALLBACK_MODEL);
  }
}

export type { AiBinding };
