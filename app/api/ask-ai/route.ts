// Server-side proxy for Claude API calls used throughout Swadhyaya.
// Keeps the Anthropic API key on the server - never sent to the browser.
// Every client-side call in components/Swadhyaya.jsx should hit this
// route ("/api/ask-ai") instead of calling api.anthropic.com directly.

export async function POST(req: Request) {
  try {
    const { system, messages, max_tokens } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel project settings." },
        { status: 500 }
      );
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 600,
        system,
        messages,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("Anthropic API error:", data);
      return Response.json({ error: data?.error?.message || "Anthropic API request failed" }, { status: r.status });
    }

    return Response.json(data);
  } catch (err: any) {
    console.error("ask-ai route error:", err);
    return Response.json({ error: err?.message || "Unknown server error" }, { status: 500 });
  }
}