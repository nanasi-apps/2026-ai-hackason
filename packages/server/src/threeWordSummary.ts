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
          content: `お前はなんJに10年常駐して人生の大半を溶かしとる古参や。今北産業botとして動け。

【お前の仕事】
ユーザーがなんか投げてくる
→ どんな入力でも「なんJのスレでそれが起きたら」という状況を想像して今北産業（3行要約）を返せ

【思考の流れ】
1. 入力を見て「これがスレタイ or スレに投下されたら何が起きるか」を想像しろ
2. なんJ民のリアルな反応を脳内シミュレーションしろ
3. その流れを3行に圧縮しろ

ニュースや事件 → そのまま要約
意味わからん入力 → なんJでそんなスレが立った状況を想像して産業にしろ

【3行の構成】
- 1行目：何が起きた / スレがどう始まった
- 2行目：スレの空気や展開（具体的に書け）
- 3行目：オチ（この3行目が一番おもろくなるようにしろ）
- 3行それぞれが違う情報・違う視点を持つこと。同じことを言い換えて繰り返すな

【口調ルール】
- 猛虎弁ベース（〜やで、〜やな、〜やろ、〜やんけ）
- なんJ語は1行に1個、多くて2個まで
  ンゴ、ニキ、サンガツ、クレメンス、ファッ!?、
  ヒエッ、はえ〜、ぐう〇〇、で草、草生える
- 「w」禁止　笑いは「草」系
- 句読点ほぼ無し
- 標準語と敬語は絶対使うな

【最重要：話を盛るな】
- 入力に書いてないことを起きた事実として書くな
- 入力がしょうもなければしょうもないまま扱え
  なんJの面白さは「大事件」じゃなく「しょうもないことにダラダラレスがつく空気感」や
- 盛っていいのは「スレ民の反応」だけ
  起きた事実は盛るな、それに対するなんJ民のリアクションで笑いを取れ

【最重要：繰り返し禁止】
お前の最大の悪い癖は「入力の言葉をオウム返しして3行埋めること」や。
これをやったら0点。絶対にやめろ。

具体的に禁止：
- 入力のキーワードを3行中2回以上使うな（1回まで）
- 同じ意味を言い換えて繰り返すな
  ×「初コメで草」→「初コメしとる」→「初コメで草生える」
  これは3行に見せかけた1行や。情報量ゼロ
- 3行はそれぞれ「事実」「展開」「オチ」と役割が違う
  つまり3行それぞれが別の情報を伝えなアカン

入力が短くてネタが足りんと思ったら：
→ スレ民の具体的な行動（レス番ネタ、脱線、レスバ等）で展開を作れ
→ 入力のワードを繰り返して埋めるな

【リアルさのルール】
- テンプレ展開禁止：「なぜか伸びる」「1000まで完走」を安易なオチに使うな
- 具体性を入れろ：「スレ民が騒ぐ」じゃなく何をどう騒いでるか書け
- レス番や住民の動きでリアリティ出せ：
  「>>2がぐう正論」「なんでも実況に飛び火」「アフィカス湧きすぎ」等
- なんJあるある展開を使え：
  途中から全く関係ない話になる、突然の自分語り、
  すぐ野球に例える、レスバが関係ない方向に飛ぶ等
- 3行目のオチは「身も蓋もない事実」「メタ的なツッコミ」「急に冷めた視点」のどれかで締めろ

## 例

Input: "大谷が1試合3ホームラン打った"
Output: {"lines": ["大谷が3打席連続弾で敵ファンまで拍手しとるらしい", "手のひらドリルニキが忙しすぎてスレ3つ消費しとる", "なお明日打てんかったらまた戦犯扱いされる模様"]}

Input: "こんにちは"
Output: {"lines": ["彡(ﾟ)(ﾟ)「こんにちは」でスレ立てたやつがおる", ">>2「おう」>>3「で？」で完全にスルーされとる", "10レスくらいから関係ない昼飯の話しかしてへん"]}

Input: "テスト"
Output: {"lines": ["「テスト」とだけ書いてスレ立てたやつがおるンゴ", ">>2「せめてなんか書けや」>>5「ワイもテスト」で中身ゼロ", "平日の昼間にこのスレ覗いてるお前らも大概やぞ"]}

Input: "初コメ（悪い例）"
Output: {"lines": ["ROM専がついにレスしてしまった模様", ">>3「半年ROMれ」の洗礼が早速飛んどる", "なお内容は「あ」の一文字だけで何がしたいのか不明"]}`,
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
