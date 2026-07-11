// City Light Church — SermonReach
// Calls Claude API to produce three outputs from a sermon transcript:
//   1. Top 5 sermon clips (Outreach, Discipleship, or Custom focus)
//   2. Sermon notes slides (6 fixed slides) for mature believers
//   3. Sermon summary (500 words or less) for social media
// Reads ANTHROPIC_API_KEY from Vercel environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    sermonTitle,
    url,
    transcript,
    date,
    speaker,
    customQuestion,
    clipMode
  } = req.body;

  if (!transcript || !sermonTitle) {
    return res.status(400).json({ error: 'Missing required fields: sermonTitle and transcript' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured in environment variables' });
  }

  const speakerName = speaker || 'the pastor';
  const sermonDate = date || '';

  // 90-second maximum enforced in prompt — complete thought within 45 to 90 seconds
  const clipWindowInstruction = 'IMPORTANT: Each clip window must be between 45 and 90 seconds. ' +
    'When the transcript contains [MM:SS] timestamp markers, you MUST use those exact markers to identify clip boundaries. ' +
    'The start and end timestamps you provide MUST match or encapsulate the actual text where the speaker says these things. ' +
    'Do not invent or approximate timestamps — only use timestamps anchored to the [MM:SS] markers present in the transcript. ' +
    'Find moments that are complete and land within that window — a tight illustration, a clear point with a strong landing, a question fully answered. ' +
    'Do not identify windows longer than 90 seconds. Do not cut a thought mid-sentence to hit the limit — choose moments that naturally conclude within 90 seconds.';

  const captionInstruction = `Caption writing rules: Open with a narrative hook that drops the viewer into the scene or tension of the moment — no throat-clearing, no "Pastor Brian says...". Build tension or subvert an expectation in the second sentence. Land with a clear resonant thought that makes someone want to watch. Write as a connected community member, use the speaker's name (e.g. Pastor Brian) naturally if needed — never "this pastor". End with 4-5 broad searchable hashtags relevant to the topic (e.g. #Faith #Brokenness #Grace #BibleStudy #ChristianLife) — choose hashtags people actually search, not church-specific ones. Add #CityLightChurch as the final tag only.`;

  const clipModeInstruction = clipMode === 'discipleship'
    ? `Find the TOP 5 moments in this sermon that would most help someone who already believes grow deeper in their faith. Look for theological depth, doctrinal content, practical application, moments that would fuel personal devotion or small group discussion, and passages that demand something of a believer's obedience or trust. These clips are for maturing disciples, not first-time seekers.

For each clip format EXACTLY as one line:
Q|[a compelling discipleship-focused insight or question]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption — ${captionInstruction}]`

    : clipMode === 'custom'
    ? `The user wants to know if this sermon addresses the following question: "${customQuestion}"

Search the sermon carefully for any moments that directly speak to this question.

If the sermon DOES address it: Find up to 5 clips that best answer or speak to this question. For each clip format EXACTLY as one line:
Q|[the custom question or a direct variation of it]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption directly connecting this moment to the question — ${captionInstruction}]

If the sermon does NOT address this question at all, respond with exactly one line:
NOANSWER|[honest explanation of what the sermon is actually about and why it does not address this question]`

    : `Find the TOP 5 moments in this sermon that most directly speak to someone who does not yet believe. Look for moments where the gospel intersects with real questions, doubts, cultural tensions, or felt needs. These clips are for people outside the faith scrolling social media. What would make someone who has never set foot in a church stop and watch?

For each question format EXACTLY as one line:
Q|[sharp culturally relevant question that a skeptic or seeker would genuinely ask]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption written for someone outside the faith — ${captionInstruction}]`;

  const prompt = `You are analyzing a sermon for City Light Church in Vicksburg, MS. The speaker is ${speakerName}. This church preaches expository, Christ-centered sermons for both believers and seekers.

Sermon title: "${sermonTitle}"
Date: ${sermonDate}
Speaker: ${speakerName}
YouTube: ${url || ''}

Transcript:
---
${transcript.substring(0, 50000)}
---

Produce THREE outputs. Do NOT use em dashes anywhere in your response. Use plain alternatives like "and", "to", or a comma instead. When referencing the speaker by name, use "${speakerName}" exactly as written.

OUTPUT 1 - SERMON CLIPS
${clipModeInstruction}

${clipWindowInstruction}

OUTPUT 2 - SERMON NOTES SLIDES
Produce exactly 6 slides. Keep all text concise and punchy — this is for a slide, not a paragraph.

Format EXACTLY as:

TITLE_SLIDE
Sermon Title: ${sermonTitle}
Sermon Date: ${sermonDate}
Speaker: ${speakerName}

SCRIPTURE_SLIDE
Scripture Reference: [the primary passage reference, e.g. Luke 18:1-8]
Scripture Text: [the key verse or 1-2 sentence excerpt from the passage that anchors the whole sermon — use the actual text, not a paraphrase]

IDEA_1
Key Idea: [one sharp declarative sentence capturing the first major idea — 8-14 words]
Summary Statement: [exactly 2 sentences that capture this idea — a vivid statement or significant quote from the sermon followed by its implication. 25-35 words total.]

IDEA_2
Key Idea: [one sharp declarative sentence capturing the second major idea — 8-14 words]
Summary Statement: [exactly 2 sentences — 25-35 words total]

IDEA_3
Key Idea: [one sharp declarative sentence capturing the third major idea — 8-14 words]
Summary Statement: [exactly 2 sentences — 25-35 words total]

CALL_SLIDE
Call To Action: [if a direct quote from the sermon works as a standalone closing challenge, use it exactly. If not, write 1-2 tight sentences anchored to what was actually preached that call the listener to a specific response. 20-35 words.]

OUTPUT 3 - SERMON SUMMARY
Write a sermon summary of 500 words or less for social media. Use narrative prose. Use the main point and each subpoint as bold headers formatted like: **Main Point: [text]** and **[Subpoint text]**. Leave a blank line between each section. Do not use em dashes. When referencing the speaker, use "${speakerName}". Write as if summarizing for someone who did not attend but wants to understand what was taught. Do NOT begin the summary with any label, heading, or prefix like "Output 3", "Sermon Summary", or similar. Begin directly with the first content header or sentence.

Separate outputs with these exact lines:
---SLIDES---
---SUMMARY---`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API error' });
    }

    const result = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ result });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
