export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sermonTitle, url, transcript, questionCount, slideCount, date } = req.body;

  if (!transcript || !sermonTitle) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `You are analyzing a sermon for City Light Church in Vicksburg, MS. The pastor preaches expository, Christ-centered sermons for both believers and seekers in the community.

Sermon title: "${sermonTitle}"
Date: ${date}
YouTube: ${url}

Transcript:
---
${transcript.substring(0, 14000)}
---

Produce TWO outputs:

OUTPUT 1 — SEEKER QUESTIONS
Identify the TOP ${questionCount} culturally resonant questions this sermon answers. These are real questions people in 2026 are genuinely asking — about suffering, identity, purpose, faith, doubt, relationships, meaning, or who Jesus is. No churchy language. Written for someone who may not attend church.

For each question format EXACTLY as:
Q|[sharp culturally relevant question]|[timestamp MM:SS]|[2-3 sentence social media caption that intrigues a skeptic — not preachy, ends with a hook]

OUTPUT 2 — SERMON NOTES SLIDES
Produce exactly ${slideCount} content slides formatted for a mature Christian taking notes. Each slide covers one major subpoint.

Format EXACTLY as:

TITLE_SLIDE
Sermon Title: ${sermonTitle}
Sermon Date: ${date}

INTRO_SLIDE
Scripture: [key passage reference and 1-2 line excerpt]
Key Point: [the single big idea of the sermon in one punchy memorable sentence]

SLIDE_1
Subpoint: [first major subpoint — one clear declarative sentence]
Key Takeaway: [the core insight a note-taker would underline]
Key Reflection: [one personal application question]
Scripture: [optional key verse reference only — e.g. Luke 18:13]

SLIDE_2
Subpoint: [second major subpoint]
Key Takeaway: [core insight]
Key Reflection: [personal application question]
Scripture: [optional key verse reference]

SLIDE_3
Subpoint: [third major subpoint]
Key Takeaway: [core insight]
Key Reflection: [personal application question]
Scripture: [optional key verse reference]

${parseInt(slideCount) > 3 ? `SLIDE_4
Subpoint: [fourth major subpoint]
Key Takeaway: [core insight]
Key Reflection: [personal application question]
Scripture: [optional key verse reference]` : ''}

${parseInt(slideCount) > 4 ? `SLIDE_5
Subpoint: [fifth major subpoint]
Key Takeaway: [core insight]
Key Reflection: [personal application question]
Scripture: [optional key verse reference]` : ''}

Separate the two outputs with exactly this line: ---SLIDES---

Output the Q lines first, then ---SLIDES---, then the slide content. Nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
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
