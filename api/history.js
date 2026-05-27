// SermonReach History API
// Handles sermon analysis history and publish tracking
// Uses Supabase service role key for secure server-side database access

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export default async function handler(req, res) {
  const { action } = req.query;
  const userId = req.headers['x-user-id'];

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();

  // ── CHECK: Does a matching analysis exist? ──────────────────────────────
  if (req.method === 'GET' && action === 'check') {
    const { videoId, clipMode, slideCount } = req.query;
    if (!videoId || !clipMode || !slideCount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const { data, error } = await supabase
        .from('sermon_analyses')
        .select('id, sermon_title, sermon_date, clip_mode, slide_count, speaker, created_at')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .eq('clip_mode', clipMode)
        .eq('slide_count', parseInt(slideCount))
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ match: data && data.length > 0 ? data[0] : null });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── LOAD: Fetch last 10 analyses for user ───────────────────────────────
  if (req.method === 'GET' && action === 'load') {
    try {
      const { data, error } = await supabase
        .from('sermon_analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ analyses: data || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GET ONE: Fetch a single full analysis by ID ─────────────────────────
  if (req.method === 'GET' && action === 'get') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    try {
      const { data, error } = await supabase
        .from('sermon_analyses')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ analysis: data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── SAVE: Upsert analysis, trim to 10 per user ──────────────────────────
  if (req.method === 'POST' && action === 'save') {
    const {
      videoId, sermonTitle, sermonDate, clipMode,
      slideCount, speaker, questions, slides, summary, customQ
    } = req.body;

    if (!videoId || !sermonTitle || !clipMode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Check if matching record exists to upsert
      const { data: existing } = await supabase
        .from('sermon_analyses')
        .select('id')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .eq('clip_mode', clipMode)
        .eq('slide_count', parseInt(slideCount))
        .limit(1);

      let savedId;

      if (existing && existing.length > 0) {
        // Update existing record
        const { data, error } = await supabase
          .from('sermon_analyses')
          .update({
            sermon_title: sermonTitle,
            sermon_date: sermonDate,
            speaker: speaker || null,
            questions: questions || [],
            slides: slides || [],
            summary: summary || '',
            custom_q: customQ || null,
            created_at: new Date().toISOString()
          })
          .eq('id', existing[0].id)
          .select('id')
          .single();

        if (error) return res.status(500).json({ error: error.message });
        savedId = data.id;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('sermon_analyses')
          .insert({
            user_id: userId,
            video_id: videoId,
            sermon_title: sermonTitle,
            sermon_date: sermonDate,
            clip_mode: clipMode,
            slide_count: parseInt(slideCount),
            speaker: speaker || null,
            questions: questions || [],
            slides: slides || [],
            summary: summary || '',
            custom_q: customQ || null
          })
          .select('id')
          .single();

        if (error) return res.status(500).json({ error: error.message });
        savedId = data.id;
      }

      // Trim to 10 most recent per user
      const { data: allRecords } = await supabase
        .from('sermon_analyses')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (allRecords && allRecords.length > 10) {
        const toDelete = allRecords.slice(10).map(r => r.id);
        await supabase
          .from('sermon_analyses')
          .delete()
          .in('id', toDelete);
      }

      return res.status(200).json({ success: true, id: savedId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PUBLISH: Mark clip as published to a platform ───────────────────────
  if (req.method === 'POST' && action === 'publish') {
    const { analysisId, clipIndex, platform, postId } = req.body;

    if (analysisId === undefined || clipIndex === undefined || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Fetch current questions array
      const { data: record, error: fetchErr } = await supabase
        .from('sermon_analyses')
        .select('questions')
        .eq('id', analysisId)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !record) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const questions = record.questions || [];
      if (!questions[clipIndex]) {
        return res.status(400).json({ error: 'Clip index out of range' });
      }

      // Update publish record for this clip
      if (!questions[clipIndex].published) {
        questions[clipIndex].published = {};
      }
      questions[clipIndex].published[platform] = {
        publishedAt: new Date().toISOString(),
        postId: postId || null
      };

      // Save back
      const { error: updateErr } = await supabase
        .from('sermon_analyses')
        .update({ questions })
        .eq('id', analysisId)
        .eq('user_id', userId);

      if (updateErr) return res.status(500).json({ error: updateErr.message });
      return res.status(200).json({ success: true, questions });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: 'Unknown action' });
}
