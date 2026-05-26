// City Light Church — Sermon Analyzer
// Calls Claude API to produce three outputs from a sermon transcript:
//   1. Top 5 seeker questions with timestamps and social media captions
//   2. Sermon notes slides (3-5 slides) for mature believers
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
    slideCount,
    date,
    speaker,
    customQuestion
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
  const numSlides = parseInt(slideCount) || 3;

  const customQSection = customQuestion
    ? `\nCUSTOM SEEKER QUESTION CHECK
The user has submitted this specific question: "${customQuestion}"
After your top 5 questions, add one more line formatted as:
CQ|[restate the question clearly]|[timestamp MM:SS-MM:SS or NONE if not addressed]|[explanation: either the timestamp range where this is answered, or a clear statement that this sermon does not directly address it]`
    : '';

  const slide4 = numSlides > 3 ? `SLIDE_4
Subpoint: [fourth major subpoint, one clear declarative sentence]
Key Takeaway: [core insight, 40-55 words]
Key Reflection: [personal application question, 15-30 words]
Scripture: [optional key verse reference]` : '';

  const slide5 = numSlides > 4 ? `SLIDE_5
Subpoint: [fifth major subpoint, one clear declarative sentence]
Key Takeaway: [core insight, 40-55 words]
Key Reflection: [personal application question, 15-30 words]
Scripture: [optional key verse reference]` : '';

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

OUTPUT 1 - SEEKER QUESTIONS
Identify the TOP 5 culturally resonant questions this sermon answers. Real questions people in 2026 are genuinely asking about suffering, identity, purpose, faith, doubt, relationships, meaning, or who Jesus is. No churchy language. Written for someone who may not attend church.

For each question format EXACTLY as one line:
Q|[sharp culturally relevant question]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence social media caption that intrigues a skeptic, not preachy]

IMPORTANT: Each clip window must be at least 60 seconds long. Choose timestamps that capture the full answer to the question, not just the hook. If the answer runs longer, let it run.
${customQSection}

OUTPUT 2 - SERMON NOTES SLIDES
Produce exactly ${numSlides} content slides for a mature Christian taking notes.

Word count targets (aim for these, accuracy comes first):
- Subpoint: 8-17 words, sweet spot 12
- Key Takeaway: 40-55 words, sweet spot 48
- Key Reflection: 15-30 words, sweet spot 25

Format EXACTLY as:

TITLE_SLIDE
Sermon Title: ${sermonTitle}
Sermon Date: ${sermonDate}
Speaker: ${speakerName}

INTRO_SLIDE
Scripture: [key passage reference and 1-2 line excerpt]
Key Point: [the single big idea in one punchy memorable sentence]

SLIDE_1
Subpoint: [first major subpoint, one clear declarative sentence]
Key Takeaway: [the core insight a note-taker would underline, 40-55 words]
Key Reflection: [one personal application question, 15-30 words]
Scripture: [optional key verse reference]

SLIDE_2
Subpoint: [second major subpoint]
Key Takeaway: [core insight, 40-55 words]
Key Reflection: [personal application question, 15-30 words]
Scripture: [optional key verse reference]

SLIDE_3
Subpoint: [third major subpoint]
Key Takeaway: [core insight, 40-55 words]
Key Reflection: [personal application question, 15-30 words]
Scripture: [optional key verse reference]

${slide4}

${slide5}

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
