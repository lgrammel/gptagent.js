import * as $ from "js-agent";

export async function summarizePdf({
  topic,
  pdfPath,
  openAiApiKey,
  context,
}: {
  topic: string;
  pdfPath: string;
  openAiApiKey: string;
  context: $.agent.RunContext;
}) {
  const gpt4 = $.provider.openai.chatModel({
    apiKey: openAiApiKey,
    model: "gpt-4",
  });

  const loadPdf = $.text.load({
    from: $.source.fileAsArrayBuffer(),
    convert: $.convert.pdfToText(),
  });

  const extract = $.text.extractAndRewrite({
    split: $.text.splitRecursivelyAtCharacter({
      maxCharactersPerChunk: 1024 * 4,
    }),
    extract: $.text.generateText({
      id: "extract-information",
      model: gpt4,
      prompt: $.prompt.extractAndExcludeChatPrompt({
        excludeKeyword: "IRRELEVANT",
      }),
    }),
    include: (text) => text !== "IRRELEVANT",
    rewrite: $.text.generateText({
      id: "rewrite-extracted-information",
      model: gpt4,
      prompt: $.prompt.rewriteChatPrompt(),
    }),
  });

  return await extract(
    {
      text: await loadPdf({ path: pdfPath }),
      topic,
    },
    context
  );
}