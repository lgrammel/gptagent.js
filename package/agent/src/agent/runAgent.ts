import { ToolAction } from "../action/tool/ToolAction";
import { OpenAIChatMessage } from "../ai/openai/createChatCompletion";
import { Agent } from "./Agent";
import { createGenerateGpt4Completion } from "./generateGpt4Completion";

function createSystemPrompt({ agent }: { agent: Agent }) {
  return `## ROLE
${agent.role}

## CONSTRAINTS
${agent.constraints};

## AVAILABLE ACTIONS
${agent.actionRegistry.getAvailableActionInstructions()}`;
}

async function run({
  agent,
  instructions,
}: {
  agent: Agent;
  instructions: string;
}) {
  const generateText = createGenerateGpt4Completion({
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  });

  console.log(instructions);

  const messages: Array<OpenAIChatMessage> = [
    {
      role: "system",
      content: createSystemPrompt({ agent }),
    },
    {
      role: "user",
      content: `## TASK\n${instructions}`,
    },
  ];

  let counter = 0;
  const maxSteps = 100;
  const startTime = new Date().getTime();

  let totalCostInMillCent = 0;

  while (counter < maxSteps) {
    console.log("========================================");

    const generatedTextResult = await generateText({ messages });

    if (!generatedTextResult.success) {
      console.log("Error generating text:", generatedTextResult.error);
      return;
    }

    const {
      generatedText: completion,
      metadata: { costInMilliCent },
    } = generatedTextResult;

    totalCostInMillCent += costInMilliCent;

    console.log();
    console.log(completion);
    messages.push({
      role: "assistant",
      content: completion,
    });

    if (completion.trim().endsWith("}")) {
      try {
        const firstOpeningBraceIndex = completion.indexOf("{");
        const jsonObject = JSON.parse(completion.slice(firstOpeningBraceIndex));

        console.log("========================================");
        console.log("EXECUTE");
        console.log(jsonObject);
        console.log();

        const actionType = jsonObject.action;
        const action = agent.actionRegistry.getAction(actionType);

        if (action === agent.actionRegistry.doneAction) {
          const costInDollar = (totalCostInMillCent / (1000 * 100)).toFixed(2);
          console.log(`Cost: $${costInDollar}`);

          const endTime = new Date().getTime();
          const duration = endTime - startTime;
          console.log(`Duration: ${duration} ms`);
          return;
        }

        // TODO introduce tasks
        const toolAction = action as ToolAction<any, any>;

        const executionResult = await toolAction.executor.execute({
          input: jsonObject,
          action: toolAction,
          workspacePath: process.cwd(), // TODO cleanup
        });

        // TODO better formatter for output / result

        console.log(executionResult);
        messages.push({
          role: "user",
          content: JSON.stringify(executionResult),
        });
      } catch (error: any) {
        console.log(error?.message);
        messages.push({
          role: "user",
          content: error?.message,
        });
      }
    }

    counter++;
  }
}

export const runAgent = ({ agent }: { agent: Agent }) => {
  run({
    agent,
    instructions: process.argv.slice(2).join(" "),
  }).catch((error) => {
    console.error("Error running instructions:", error);
  });
};