const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { OpenAiProvider } = require("../dist/core/ai-openai.provider");

test("キーなしのローカルAPIでツール要求と結果を往復できる", async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      url: req.url,
      auth: req.headers.authorization,
      body: JSON.parse(body),
    });
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message:
              requests.length === 1
                ? {
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "lookup",
                          arguments: '{"name":"読書会"}',
                        },
                      },
                    ],
                  }
                : { content: "読書会は19時です。" },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const provider = new OpenAiProvider("", "neohorse", {
      baseUrl: `http://127.0.0.1:${server.address().port}/v1/`,
      local: true,
    });
    const tools = [
      {
        name: "lookup",
        description: "検索",
        parameters: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    ];
    const messages = [{ role: "user", content: "読書会はいつ？" }];
    const response = await provider.generate({ messages, tools });
    assert.deepEqual(response.toolCalls[0], {
      id: "call_1",
      name: "lookup",
      arguments: { name: "読書会" },
    });
    const final = await provider.generate({
      tools,
      messages: [
        ...messages,
        { role: "assistant", toolCall: response.toolCalls[0] },
        {
          role: "tool",
          toolName: "lookup",
          toolCallId: "call_1",
          content: { result: "19時" },
        },
      ],
    });
    assert.equal(final.content, "読書会は19時です。");
    assert.equal(requests[0].url, "/v1/chat/completions");
    assert.equal(requests[0].auth, undefined);
    assert.equal(requests[0].body.temperature, 0.1);
    assert.equal(requests[0].body.chat_template_kwargs.enable_thinking, false);
    assert.equal(requests[1].body.messages[2].tool_call_id, "call_1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("既存OpenAIのURLと認証・生成設定を維持する", async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      assert.equal(init.headers.Authorization, "Bearer test-only");
      const body = JSON.parse(init.body);
      assert.equal(body.temperature, undefined);
      assert.equal(body.chat_template_kwargs, undefined);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
      );
    };
    assert.equal(
      (await new OpenAiProvider("test-only", "test").generate({ messages: [] }))
        .content,
      "OK",
    );
  } finally {
    global.fetch = original;
  }
});
