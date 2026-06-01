// City Light Church — SermonReach
// Calls Claude API to produce three outputs from a sermon transcript:
//   1. Top 5 sermon clips (Outreach, Discipleship, or Custom focus)
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
  const numSlides = parseInt(slideCount) || 3;

  // 90-second maximum enforced in prompt — complete thought within 30 to 90 seconds
  const clipWindowInstruction = 'IMPORTANT: Each clip window must be between 30 and 90 seconds. Find moments that are complete and land within that window — a tight illustration, a clear point with a strong landing, a question fully answered. Do not identify windows longer than 90 seconds. Do not cut a thought mid-sentence to hit the limit — choose moments that naturally conclude within 90 seconds.';

  const clipModeInstruction = clipMode === 'discipleship'
    ? `Find the TOP 5 moments in this sermon that would most help someone who already believes grow deeper in their faith. Look for theological depth, doctrinal content, practical application, moments that would fuel personal devotion or small group discussion, and passages that demand something of a believer's obedience or trust. These clips are for maturing disciples, not first-time seekers.

For each clip format EXACTLY as one line:
Q|[a compelling discipleship-focused insight or question]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption written for a believer who wants to grow — theologically honest, reflective, inviting depth, never shallow. Write as a connected community member, use the speaker's name (e.g. Pastor Brian) not "this pastor". End with exactly one relevant hashtag (e.g. #PrayerLife #GrowingInFaith #BiblicalTruth) followed by #CityLightChurch #Vicksburg]`
    : clipMode === 'custom'
    ? `The user wants to know if this sermon addresses the following question: "${customQuestion}"

Search the sermon carefully for any moments that directly speak to this question.

If the sermon DOES address it: Find up to 5 clips that best answer or speak to this question. For each clip format EXACTLY as one line:
Q|[the custom question or a direct variation of it]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption directly connecting this moment to the question. Write as a connected community member, use the speaker's name (e.g. Pastor Brian) not "this pastor". End with exactly one relevant hashtag followed by #CityLightChurch #Vicksburg]

If the sermon does NOT address this question at all, respond with exactly one line:
NOANSWER|[honest explanation of what the sermon is actually about and why it does not address this question]`
    : `Find the TOP 5 moments in this sermon that most directly speak to someone who does not yet believe. Look for moments where the gospel intersects with real questions, doubts, cultural tensions, or felt needs. These clips are for people outside the faith scrolling social media. What would make someone who has never set foot in a church stop and watch?

For each question format EXACTLY as one line:
Q|[sharp culturally relevant question that a skeptic or seeker would genuinely ask]|[start timestamp MM:SS]-[end timestamp MM:SS]|[2-3 sentence caption written for someone outside the faith — intriguing, never preachy, speaks to a real felt need or cultural tension. Write as a connected community member, not an outside observer. Use the speaker's name (e.g. Pastor Brian) not "this pastor". End with exactly one relevant hashtag (e.g. #Faith #Purpose #RealTalk) followed by #CityLightChurch #Vicksburg]`;

  const customQSection = '';

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

OUTPUT 1 - SERMON CLIPS
${clipModeInstruction}

${clipWindowInstruction}
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
