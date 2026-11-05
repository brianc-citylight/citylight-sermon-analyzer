// City Light Church — SermonReach
// Calls Claude API to produce three outputs from a sermon transcript:
//   1. Top 5 sermon clips (Outreach, Discipleship, or Custom focus)
//   2. Sermon notes slides (6 fixed slides) for mature believers
//   3. Sermon summary (500 words or less) for social media
// Reads ANTHROPIC_API_KEY from Vercel environment variables

// Shared caption rules - used by BOTH the full analysis and the single-caption
// regenerate action so the house voice never drifts between the two.
// speakerName comes from the required Start Here fields. When it is missing
// (only possible on old saved sermons) the caption must not name the speaker.
function captionRules(speakerName) {
  const nameRule = speakerName
    ? `Mention the speaker at most once, as "${speakerName}", and only if it reads naturally. Never say "this pastor."`
    : 'Do not name the speaker. Never say "this pastor" or "the pastor."';
  // Kept on ONE line: the clip format requires each clip on a single line,
  // so line breaks inside these rules could leak into the output and break parsing.
  return [
    'Caption writing rules:',
    'Write the whole caption, hashtags included, on one line with no line breaks.',
    `Sentence 1 is the hook. Keep it under 125 characters so it shows before Instagram cuts it off. Open with the real tension, question, or picture from this moment in the sermon. No warm-up.`,
    `Sentence 2 adds depth. Name the struggle honestly, or turn the answer people expect.`,
    `Sentence 3 is optional. Land on a simple, honest invitation to watch or reflect.`,
    `Tone: warm, humble, and plainspoken, like a friend from church sharing something that helped them. Point to God and the Scripture, not to the preacher.`,
    `Do not oversell. Never promise the clip will change someone's life, blow their mind, or change how they see something forever. Do not use hype words or phrases such as "powerful," "incredible," "life-changing," "game-changer," "must-see," "you won't believe," or "watch how." No all caps, no stacked exclamation points, no emojis.`,
    nameRule,
    `Only quote words that are actually in the transcript. Never put words in the speaker's mouth.`,
    `End with 4 or 5 broad hashtags people actually search, chosen for this clip's topic and not church-specific. Then add #CityLightChurch as the final tag.`
  ].join(' ');
}

// ── REGENERATE A SINGLE CLIP CAPTION ────────────────────────────────────────
// Rewrites one caption with a fresh angle without re-running a full analysis.
// The transcript is only held in browser memory during a live session, so it may
// be absent (e.g. when a past analysis is reloaded from History). When it is
// absent we hard-constrain Claude to the facts already present in the existing
// caption. This is a pastor's content - it must never invent quotes or claims.
async function regenerateCaption(req, res, apiKey) {
  const { question, currentCaption, clipMode, speaker, transcript } = req.body;

  if (!question || !currentCaption) {
    return res.status(400).json({ error: 'Missing question or currentCaption' });
  }

  const speakerName = (speaker || '').trim();
  const audience = clipMode === 'discipleship'
    ? 'a believer who wants to grow deeper in their faith'
    : clipMode === 'custom'
    ? 'someone genuinely asking this specific question'
    : 'someone outside the faith scrolling social media';

  const sourceBlock = transcript && transcript.trim()
    ? `Here is the sermon transcript for context. Ground the caption in what was actually preached:
---
${transcript.substring(0, 30000)}
---`
    : `The sermon transcript is not available. You MUST write the new caption using ONLY the facts, ideas, and details already present in the existing caption below. Do NOT invent new quotes, statistics, illustrations, scripture references, or claims of any kind. Rephrase and re-angle what is already there.`;

  const prompt = `You are rewriting one social media caption for a sermon clip from City Light Church in Vicksburg, MS.${speakerName ? ' The speaker is ' + speakerName + '.' : ''}

The clip answers this question: "${question}"

The existing caption is:
"${currentCaption}"

${sourceBlock}

Write ONE new caption for this clip, targeted at ${audience}. Take a noticeably different angle from the existing caption, with a different hook and a different entry point, while staying true to the same moment in the sermon.

${captionRules(speakerName)}

Do NOT use em dashes. Use plain alternatives like "and", "to", or a comma instead.

Return ONLY the caption text itself. No preamble, no quotation marks around it, no labels, no explanation.`;

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
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API error' });
    }

    let caption = data.content.map(b => b.text || '').join('').trim();
    // Strip wrapping quotes if the model added them despite instructions
    caption = caption.replace(/^["']|["']$/g, '').trim();

    if (!caption) {
      return res.status(500).json({ error: 'No caption returned' });
    }

    return res.status(200).json({ caption });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured in environment variables' });
  }

  // Single-caption regenerate runs on this same endpoint so it inherits the
  // existing 60s timeout in vercel.json - no vercel.json change required.
  if (req.query.action === 'regenerate-caption') {
    return await regenerateCaption(req, res, apiKey);
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

  const speakerName = (speaker || '').trim();
  if (!speakerName) {
    return res.status(400).json({ error: 'Missing speaker name. Enter the speaker title, first name, and last name in Start Here.' });
  }
  const sermonDate = date || '';

  // Clip length stays 45 to 90 seconds (people can stretch it up to 3:00 in the app)
  const clipWindowInstruction = 'IMPORTANT: Each clip window must be between 45 and 90 seconds. ' +
    'When the transcript contains [MM:SS] timestamp markers, you MUST use those exact markers to identify clip boundaries. ' +
    'The start and end timestamps you provide MUST match or encapsulate the actual text where the speaker says these things. ' +
    'Do not invent or approximate timestamps. Only use timestamps anchored to the [MM:SS] markers present in the transcript. ' +
    'Find moments that are complete and land within that window: a tight illustration, a clear point with a strong landing, a question fully answered. ' +
    'Do not identify windows longer than 90 seconds. Do not cut a thought mid-sentence to hit the limit. Choose moments that naturally conclude within 90 seconds.\n\n' +
    'Clip selection rules:\n' +
    '- Start each clip on a line that grabs attention on its own in the first few seconds: a question, a bold but true statement, or the start of a story. Never start mid-thought or on filler like "and so" or "so anyway."\n' +
    '- Each clip must make sense to someone who has not heard the rest of the sermon. Skip moments that depend on earlier context, such as "as I said earlier" or "this passage."\n' +
    '- Pick 5 different ideas from different parts of the sermon. No two clips may overlap or come from the same few minutes.';

  const captionInstruction = captionRules(speakerName);

  const clipModeInstruction = clipMode === 'discipleship'
    ? `Find the TOP 5 moments in this sermon that would most help someone who already believes grow deeper in their faith. Look for theological depth, doctrinal content, practical application, moments that would fuel personal devotion or small group discussion, and passages that demand something of a believer's obedience or trust. These clips are for maturing disciples, not first-time seekers.

For each clip format EXACTLY as one line:
Q|[a compelling discipleship-focused insight or question]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption. ${captionInstruction}]`

    : clipMode === 'custom'
    ? `The user wants to know if this sermon addresses the following question: "${customQuestion}"

Search the sermon carefully for any moments that directly speak to this question.

If the sermon DOES address it: Find up to 5 clips that best answer or speak to this question. For each clip format EXACTLY as one line:
Q|[the custom question or a direct variation of it]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption directly connecting this moment to the question. ${captionInstruction}]

If the sermon does NOT address this question at all, respond with exactly one line:
NOANSWER|[honest explanation of what the sermon is actually about and why it does not address this question]`

    : `Find the TOP 5 moments in this sermon that most directly speak to someone who does not yet believe. Look for moments where the gospel intersects with real questions, doubts, cultural tensions, or felt needs. These clips are for people outside the faith scrolling social media. What would make someone who has never set foot in a church stop and watch?

For each question format EXACTLY as one line:
Q|[sharp culturally relevant question that a skeptic or seeker would genuinely ask]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption written for someone outside the faith. ${captionInstruction}]`;

  const prompt = `You are analyzing a sermon for City Light Church in Vicksburg, MS. The speaker is ${speakerName}. This church preaches expository, Christ-centered sermons for both believers and seekers.

Sermon title: "${sermonTitle}"
Date: ${sermonDate}
Speaker: ${speakerName}
YouTube: ${url || ''}

Transcript:
---
${transcript.substring(0, 100000)}
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
