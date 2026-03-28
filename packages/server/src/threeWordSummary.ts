const THREE_WORD_SUMMARIZER_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

type StructuredThreeWordResponse = {
  words: [string, string, string];
};

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

export async function summarizeIntoThreeWords(ai: AiBinding, content: string) {
  const result = await ai.run(THREE_WORD_SUMMARIZER_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You summarize user text into exactly three words. Return only structured data. Each array item must contain exactly one concise word or one compact Japanese lexical unit. Do not include punctuation, numbering, explanations, or duplicate words unless repetition is essential.",
      },
      {
        role: "user",
        content,
      },
    ],
    response_format: structuredOutputSchema,
    temperature: 0.2,
    max_tokens: 32,
  });

  const { words } = parseStructuredOutput(result);

  return {
    words,
    summary: words.join(" "),
    model: THREE_WORD_SUMMARIZER_MODEL,
  };
}

export type { AiBinding };
