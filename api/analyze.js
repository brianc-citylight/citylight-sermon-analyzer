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

// ── DEVOTIONS AND DISCUSSION GUIDE ─────────────────────────────────────────
// Two on-demand outputs built from the same sermon. They run on this endpoint
// (?action=devotion and ?action=discussion-guide) so they share the existing
// timeout and API key. Each devotional is its own request, so three can run side
// by side and one can be regenerated without touching the others.

const HYPE_RULE = 'Do not oversell. No hype words or phrases such as "powerful," "incredible," "life-changing," "game-changer," "must-see," or "you won\'t believe." No all caps, no emojis, no stacked exclamation points. Do not use em dashes.';

function hasRealTranscript(t) {
  return !!t && t.trim().length > 500 && !/^\s*\[No transcript available/i.test(t);
}

// The transcript is only held in the browser during a live session. When it is
// missing (a sermon reloaded from History) we work from the summary and key ideas
// and forbid anything beyond them. This is a pastor's content: nothing invented.
function sourceBlockFor({ transcript, summary, keyIdeas, scriptureRef }) {
  const ideas = (Array.isArray(keyIdeas) ? keyIdeas : []).filter(Boolean);
  const ideaText = ideas.length ? '\n\nKey ideas, in the order preached:\n' + ideas.map((k, i) => `${i + 1}. ${k}`).join('\n') : '';
  const refText = scriptureRef ? `\n\nMain passage: ${scriptureRef}` : '';
  if (hasRealTranscript(transcript)) {
    return {
      hasTranscript: true,
      text: `Here is the sermon transcript. Ignore any [MM:SS] time markers.\n---\n${transcript.substring(0, 100000)}\n---${refText}${ideaText}`
    };
  }
  return {
    hasTranscript: false,
    text: `The full transcript is NOT available. Use ONLY the summary and key ideas below. Do NOT invent stories, illustrations, quotes, statistics, scripture references, or claims of any kind. Do NOT write out verse text.\n\nSermon summary:\n---\n${(summary || '').substring(0, 8000)}\n---${refText}${ideaText}`
  };
}

async function claudeText(apiKey, prompt, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Claude API error');
  return data.content.map(b => b.text || '').join('').trim();
}

// Em and en dashes become commas, except en dashes inside Scripture ranges (18:1-8).
function plainText(s) {
  return String(s || '')
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// Reads "LABEL: text" sections. A label may repeat. Text runs until the next label.
function parseLabeled(raw, labels) {
  const re = new RegExp('^\\s*(' + labels.join('|') + ')\\s*:[ \\t]*', 'gmi');
  const out = {};
  const hits = [];
  let m;
  while ((m = re.exec(raw)) !== null) hits.push({ key: m[1].toUpperCase(), start: m.index, textStart: re.lastIndex });
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : raw.length;
    (out[h.key] = out[h.key] || []).push(plainText(raw.slice(h.textStart, end)));
  });
  return out;
}

const wordCount = s => (s || '').split(/\s+/).filter(Boolean).length;

// A verse is only kept when its words really appear in the transcript.
function verseInTranscript(verse, transcript) {
  const norm = s => String(s).toLowerCase().replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, ' ').replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const v = norm(verse), t = norm(transcript);
  if (v.length < 4 || t.length < 4) return false;
  const grams = new Set();
  for (let i = 0; i <= t.length - 4; i++) grams.add(t.slice(i, i + 4).join(' '));
  let hit = 0, total = 0;
  for (let i = 0; i <= v.length - 4; i++) { total++; if (grams.has(v.slice(i, i + 4).join(' '))) hit++; }
  return total > 0 && hit / total >= 0.7;
}

function speakerRule(speakerName) {
  return speakerName
    ? `Mention the speaker at most once, as "${speakerName}", and only if it reads naturally. Never say "this pastor."`
    : 'Do not name the speaker. Never say "this pastor" or "the pastor."';
}

async function devotion(req, res, apiKey) {
  const { sermonTitle, speaker, date, transcript, summary, keyIdeas, scriptureRef, day, currentDevotion } = req.body;
  const dayNum = parseInt(day);
  if (!(dayNum >= 1 && dayNum <= 3)) return res.status(400).json({ error: 'Day must be 1, 2, or 3' });
  if (!sermonTitle) return res.status(400).json({ error: 'Missing sermonTitle' });
  if (!hasRealTranscript(transcript) && !(summary && summary.trim())) {
    return res.status(400).json({ error: 'No transcript or summary is available to build the devotions from.' });
  }

  const speakerName = (speaker || '').trim();
  const source = sourceBlockFor({ transcript, summary, keyIdeas, scriptureRef });
  const ideas = (Array.isArray(keyIdeas) ? keyIdeas : []).filter(Boolean);
  const dayPlan = ideas.length >= 3
    ? `The three days follow the sermon's three key ideas, in order:\nDay 1: ${ideas[0]}\nDay 2: ${ideas[1]}\nDay 3: ${ideas[2]}\nWrite Day ${dayNum} only, built on: "${ideas[dayNum - 1]}". Do not repeat what the other two days cover.`
    : `The three days follow the sermon's three main points, in the order they were preached. Write Day ${dayNum} only, built on main point number ${dayNum}. Do not repeat what the other two days would cover.`;
  const different = currentDevotion && currentDevotion.body
    ? `\n\nA version of this day already exists. Write a noticeably different one: a new opening, a new angle, and a different part of the sermon to lean on, while keeping the same point. Existing title: "${currentDevotion.title || ''}". Existing opening: "${(currentDevotion.body || '').substring(0, 220)}"`
    : '';

  const basePrompt = `You are writing one short daily devotional from a sermon preached at City Light Church in Vicksburg, MS.${speakerName ? ' The speaker is ' + speakerName + '.' : ''}

Sermon title: "${sermonTitle}"
Date: ${date || ''}

${source.text}

This is Day ${dayNum} of a 3 day devotional series. ${dayPlan}${different}

Rules:
- Stay faithful to the sermon. Keep the preacher's message and emphasis. Do not add teaching the sermon did not give. Do not invent stories, illustrations, statistics, or quotes. Only quote words that are actually in the sermon.
- BODY length: 250 to 400 words, about 2 to 3 minutes to read aloud. Three to five short paragraphs. Open with the real tension, question, or picture from the sermon. Close by leading the reader toward the reflection question.
- Voice: warm, humble, and plainspoken, like a pastor writing to a friend. Point to God and the Scripture, not to the preacher. Use plain words and short sentences, about an 8th grade reading level. Write to "you."
- ${HYPE_RULE}
- ${speakerRule(speakerName)}
- SCRIPTURE: one reference (book chapter:verse) that the speaker read or cited for this point. If the speaker gave no passage for this point, use the main passage of the sermon. Reference only.
- VERSE: only when the speaker read or quoted this verse aloud in the transcript and it fits today's devotion. Copy the words exactly as they appear in the transcript. Otherwise write NONE. Never write out a verse from memory.
- QUESTION: exactly one reflection question. Open-ended, personal, and answerable in a minute.
- ACTION: exactly one concrete action the reader can do today or this week. One or two sentences. Start with a verb.

Format EXACTLY, with each label at the start of its own line:
TITLE: [a short, plain title]
SCRIPTURE: [reference]
VERSE: [verse text or NONE]
BODY:
[the devotional paragraphs, separated by blank lines]
QUESTION: [one question]
ACTION: [one action]`;

  try {
    let prompt = basePrompt;
    let result = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await claudeText(apiKey, prompt, 1500);
      const p = parseLabeled(raw, ['TITLE', 'SCRIPTURE', 'VERSE', 'BODY', 'QUESTION', 'ACTION']);
      const body = (p.BODY && p.BODY[0]) || '';
      const words = wordCount(body);
      result = {
        title: (p.TITLE && p.TITLE[0] || '').split('\n')[0],
        scripture: (p.SCRIPTURE && p.SCRIPTURE[0] || '').split('\n')[0],
        verse: (p.VERSE && p.VERSE[0] || '').replace(/^["']|["']$/g, '').trim(),
        body,
        question: (p.QUESTION && p.QUESTION[0] || '').split('\n')[0],
        action: (p.ACTION && p.ACTION[0] || '').split('\n')[0]
      };
      const complete = result.title && body && result.question && result.action;
      if (complete && words >= 240 && words <= 410) break;
      prompt = basePrompt + `\n\nYour last attempt did not work: ${complete ? 'the BODY was ' + words + ' words' : 'it was missing a required part'}. Write the whole devotional again. The BODY must be between 280 and 380 words, and every label must be present.`;
    }
    // Keep a verse only when the preacher really said it
    if (/^none\b/i.test(result.verse) || !source.hasTranscript || !verseInTranscript(result.verse, transcript)) result.verse = '';
    result.wordCount = wordCount(result.body);
    if (!result.title || !result.body) return res.status(500).json({ error: 'The devotional came back incomplete. Please try again.' });
    return res.status(200).json({ devotion: result, usedTranscript: source.hasTranscript });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function discussionGuide(req, res, apiKey) {
  const { sermonTitle, speaker, date, transcript, summary, keyIdeas, scriptureRef } = req.body;
  if (!sermonTitle) return res.status(400).json({ error: 'Missing sermonTitle' });
  if (!hasRealTranscript(transcript) && !(summary && summary.trim())) {
    return res.status(400).json({ error: 'No transcript or summary is available to build the guide from.' });
  }
  const speakerName = (speaker || '').trim();
  const source = sourceBlockFor({ transcript, summary, keyIdeas, scriptureRef });
  const ideas = (Array.isArray(keyIdeas) ? keyIdeas : []).filter(Boolean);
  const pointPlan = ideas.length >= 3
    ? `The three sermon points are the sermon's key ideas, in order:\n1. ${ideas[0]}\n2. ${ideas[1]}\n3. ${ideas[2]}`
    : `The three sermon points are the sermon's three main points, in the order preached.`;

  const prompt = `You are writing a small group discussion guide from a sermon preached at City Light Church in Vicksburg, MS.${speakerName ? ' The speaker is ' + speakerName + '.' : ''}

Sermon title: "${sermonTitle}"
Date: ${date || ''}

${source.text}

${pointPlan}

Rules:
- Stay faithful to the sermon. Do not add teaching the sermon did not give. Do not invent stories, statistics, or quotes. Use scripture references only. Never write out verse text.
- Voice: warm, humble, and plain. Short sentences, about an 8th grade reading level. ${HYPE_RULE}
- ${speakerRule(speakerName)}
- BIG_IDEA: one or two sentences that sum up the whole sermon.
- SCRIPTURES: three to six references the speaker read or cited, separated by semicolons.
- POINT: exactly 3. Each is "short point title | scripture reference | one or two sentences from the sermon that explain it." Do not use the pipe character anywhere else.
- QUESTION: exactly 6, open-ended, short, and good for a group. Question 1 is an easy opener that connects to everyday life and needs no Bible knowledge. Questions 2 and 3 look at what the passage says. Questions 4 and 5 ask what it means for our lives. Question 6 asks for personal application. No yes or no questions.
- APPLICATION: exactly 2 concrete things to do this week. One or two sentences each. Start with a verb. The second can involve another person.
- PRAYER: 60 to 100 words, addressed to God, plain language, reflecting the sermon's themes. End with "In Jesus' name, amen."

Format EXACTLY, with each label at the start of its own line:
BIG_IDEA: ...
SCRIPTURES: ...
POINT: title | reference | explanation
POINT: title | reference | explanation
POINT: title | reference | explanation
QUESTION: ...
(six QUESTION lines in total)
APPLICATION: ...
APPLICATION: ...
PRAYER: ...`;

  try {
    let guide = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await claudeText(apiKey, prompt, 2000);
      const p = parseLabeled(raw, ['BIG_IDEA', 'SCRIPTURES', 'POINT', 'QUESTION', 'APPLICATION', 'PRAYER']);
      const points = (p.POINT || []).map(line => {
        const parts = line.replace(/\n+/g, ' ').split('|').map(s => s.trim());
        return { title: parts[0] || '', reference: parts[1] || '', text: parts.slice(2).join(' ').trim() };
      }).filter(x => x.title);
      guide = {
        bigIdea: (p.BIG_IDEA && p.BIG_IDEA[0] || '').replace(/\n+/g, ' '),
        scriptures: (p.SCRIPTURES && p.SCRIPTURES[0] || '').replace(/\n+/g, ' '),
        points,
        questions: (p.QUESTION || []).map(q => q.replace(/\n+/g, ' ')).filter(Boolean),
        applications: (p.APPLICATION || []).map(a => a.replace(/\n+/g, ' ')).filter(Boolean),
        prayer: (p.PRAYER && p.PRAYER[0] || '').replace(/\n+/g, ' ')
      };
      if (guide.points.length >= 3 && guide.questions.length >= 5 && guide.applications.length >= 1 && guide.prayer) break;
    }
    if (!(guide.points.length >= 2 && guide.questions.length >= 3 && guide.prayer)) {
      return res.status(500).json({ error: 'The discussion guide came back incomplete. Please try again.' });
    }
    return res.status(200).json({ guide, usedTranscript: source.hasTranscript });
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

  // Devotions and Discussion Guide are generated on demand from the new tabs
  if (req.query.action === 'devotion') {
    return await devotion(req, res, apiKey);
  }
  if (req.query.action === 'discussion-guide') {
    return await discussionGuide(req, res, apiKey);
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
