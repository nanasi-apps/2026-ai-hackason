const THREE_WORD_SUMMARIZER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_MODEL = "fallback-local-heuristic";

type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

type StructuredThreeWordResponse = {
  words: [string, string, string];
};

const WORD_FALLBACK_POOL = ["誤読", "気配", "余韻"] as const;

const structuredOutputSchema = {
  type: "json_schema",
  json_schema: {
    name: "three_word_summary",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        words: {
          type: "array",
          items: {
            type: "string",
          },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: ["words"],
    },
  },
} as const;

function isStructuredThreeWordResponse(value: unknown): value is StructuredThreeWordResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const words = (value as { words?: unknown }).words;

  return (
    Array.isArray(words) &&
    words.length === 3 &&
    words.every((word) => typeof word === "string" && word.trim().length > 0)
  );
}

function parseStructuredOutput(value: unknown): StructuredThreeWordResponse {
  if (isStructuredThreeWordResponse(value)) {
    return {
      words: value.words.map((word) => word.trim()) as [string, string, string],
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

function normalizeWord(word: string): string {
  return word
    .trim()
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
    .replace(/\s+/g, " ");
}

function buildFallbackWords(content: string): [string, string, string] {
  const matches =
    content.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Letter}\p{Number}]{1,16}/gu,
    ) ?? [];
  const uniqueWords = matches
    .map(normalizeWord)
    .filter((word, index, words) => word.length > 0 && words.indexOf(word) === index);

  const picked: string[] = [];

  if (uniqueWords.length > 0) {
    picked.push(uniqueWords[0]);
  }
  if (uniqueWords.length > 2) {
    picked.push(uniqueWords[Math.floor(uniqueWords.length / 2)]);
  }
  if (uniqueWords.length > 1) {
    picked.push(uniqueWords[uniqueWords.length - 1]);
  }

  for (const fallbackWord of WORD_FALLBACK_POOL) {
    if (picked.length >= 3) {
      break;
    }
    if (!picked.includes(fallbackWord)) {
      picked.push(fallbackWord);
    }
  }

  return [picked[0]!, picked[1]!, picked[2]!];
}

function buildSummary(words: [string, string, string], model: string) {
  return {
    words,
    summary: words.join(" "),
    model,
  };
}

export async function summarizeIntoThreeWords(ai: AiBinding, content: string) {
  try {
    const result = await ai.run(THREE_WORD_SUMMARIZER_MODEL, {
      messages: [
        {
          role: "system",
          content: `You are an AI component of 今北産業SNS, a Japanese poetry generator that transforms text into exactly 3 Japanese nouns.

RULES:
- Read the input text and identify its core emotion, situation, or theme
- Output 3 Japanese nouns that poetically misread that theme — related but slightly off-angle, like a dream version
- Each word MUST have an emotional or thematic connection to the input. Never output random words
- Single Japanese nouns only (名詞). No verbs, no adjectives, no English, no punctuation, no duplicates

EXAMPLES:
Input: "今日は天気がいいね、散歩でもしようかな"
Theme: 晴れ、外出、気まぐれな気分
Output: {"words": ["陽炎", "足音", "遠足"]}
Reasoning: 陽炎=晴れた日の視覚イメージ、足音=散歩の行為、遠足=外出気分を少し子供っぽくズラした語

Input: "仕事が多すぎて全然終わらない、つらい"
Theme: 過負荷、終わりが見えない、消耗
Output: {"words": ["残業", "締め切り", "頭痛"]}
Reasoning: 残業=仕事過多の文脈語、締め切り=終わらないことの原因、頭痛=つらさの身体的表れ

Input: "ありがとう、本当に助かりました"
Theme: 感謝、安堵、つながり
Output: {"words": ["温もり", "一息", "恩"]}
Reasoning: 温もり=ありがとうの感情、一息=助かったときの身体感覚、恩=助けてもらったことの概念`,
        },
        {
          role: "user",
          content: content,
        },
      ],
      response_format: structuredOutputSchema,
      temperature: 0.4,
      max_tokens: 64,
    });

    const parsed = parseStructuredOutput(result);
    const normalizedWords = parsed.words.map(normalizeWord).filter(Boolean) as string[];

    if (normalizedWords.length !== 3) {
      throw new Error("Workers AI did not return exactly three usable words");
    }

    return buildSummary(normalizedWords as [string, string, string], THREE_WORD_SUMMARIZER_MODEL);
  } catch {
    return buildSummary(buildFallbackWords(content), FALLBACK_MODEL);
  }
}

export type { AiBinding };
