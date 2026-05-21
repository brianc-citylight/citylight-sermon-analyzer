import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const GOLD = '#C9A84C';
const BLACK = '#111111';
const WHITE = '#FFFFFF';

function buildSlideHtml(slide, sermonTitle, sermonDate, speaker) {
  const { header, fields } = slide;

  const logoSvg = `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
    <circle cx="26" cy="26" r="25" fill="${GOLD}"/>
    <circle cx="26" cy="26" r="16" fill="none" stroke="${BLACK}" stroke-width="2.5"/>
    <circle cx="26" cy="26" r="8" fill="${BLACK}"/>
    <line x1="26" y1="1" x2="26" y2="12" stroke="${BLACK}" stroke-width="2.5"/>
    <line x1="26" y1="40" x2="26" y2="51" stroke="${BLACK}" stroke-width="2.5"/>
    <line x1="1" y1="26" x2="12" y2="26" stroke="${BLACK}" stroke-width="2.5"/>
    <line x1="40" y1="26" x2="51" y2="26" stroke="${BLACK}" stroke-width="2.5"/>
  </svg>`;

  const cornerAccents = `
    <div style="position:absolute;top:0;left:0;width:3px;height:60px;background:${GOLD};"></div>
    <div style="position:absolute;top:0;left:0;width:60px;height:3px;background:${GOLD};"></div>
    <div style="position:absolute;top:0;right:0;width:3px;height:60px;background:${GOLD};"></div>
    <div style="position:absolute;top:0;right:0;width:60px;height:3px;background:${GOLD};"></div>
    <div style="position:absolute;bottom:0;left:0;width:3px;height:60px;background:${GOLD};"></div>
    <div style="position:absolute;bottom:0;left:0;width:60px;height:3px;background:${GOLD};"></div>
    <div style="position:absolute;bottom:0;right:0;width:3px;height:60px;background:${GOLD};"></div>
    <div style="position:absolute;bottom:0;right:0;width:60px;height:3px;background:${GOLD};"></div>
  `;

  const logoMark = `<div style="position:absolute;bottom:28px;right:28px;">${logoSvg}</div>`;

  let bodyContent = '';

  if (header === 'TITLE_SLIDE') {
    bodyContent = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:80px 60px;">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:72px;font-weight:900;letter-spacing:-0.02em;line-height:1;">
          <span style="color:${GOLD};">SERMON</span><span style="color:${BLACK};">NOTES</span>
        </div>
        <div style="width:80px;height:4px;background:${GOLD};margin:32px auto;"></div>
        <div style="font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:${BLACK};margin-bottom:12px;">${fields['Sermon Title'] || sermonTitle}</div>
        <div style="font-family:Arial,sans-serif;font-size:20px;color:#666;">${fields['Sermon Date'] || sermonDate}</div>
        ${speaker ? `<div style="font-family:Arial,sans-serif;font-size:18px;color:#888;margin-top:8px;">${speaker}</div>` : ''}
      </div>
    `;
  } else if (header === 'INTRO_SLIDE') {
    const scripture = fields['Scripture'] || '';
    const keyPoint = fields['Key Point'] || '';
    bodyContent = `
      <div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:70px 64px;">
        <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD};margin-bottom:24px;">The Text</div>
        <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:${BLACK};line-height:1.4;margin-bottom:36px;padding-bottom:32px;border-bottom:2px solid #eee;">${scripture}</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD};margin-bottom:16px;">Key Point</div>
        <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:700;color:${BLACK};line-height:1.4;">${keyPoint}</div>
      </div>
    `;
  } else {
    const num = header.match(/\d+/);
    const subpoint = fields['Subpoint'] || '';
    const takeaway = fields['Key Takeaway'] || '';
    const reflection = fields['Key Reflection'] || '';
    const scripture = fields['Scripture'] || '';
    bodyContent = `
      <div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:60px 64px;">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD};margin-bottom:4px;">TAKEAWAY ${num ? num[0] : ''}</div>
        <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:700;color:${BLACK};line-height:1.35;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #eee;">${subpoint}</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#999;margin-bottom:8px;">Key Takeaway</div>
        <div style="font-family:Arial,sans-serif;font-size:17px;color:#333;line-height:1.6;margin-bottom:20px;">${takeaway}</div>
        <div style="background:#f9f5eb;border-left:4px solid ${GOLD};padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:${scripture ? '16px' : '0'};">
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${GOLD};margin-bottom:6px;">Reflection</div>
          <div style="font-family:Arial,sans-serif;font-size:16px;color:#333;line-height:1.5;font-style:italic;">${reflection}</div>
        </div>
        ${scripture ? `<div style="font-family:Arial,sans-serif;font-size:14px;color:#999;font-weight:600;margin-top:12px;">${scripture}</div>` : ''}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1080px; height:1080px; background:${WHITE}; overflow:hidden; position:relative; }
</style>
</head>
<body>
  ${cornerAccents}
  ${bodyContent}
  ${logoMark}
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slide, sermonTitle, sermonDate, speaker } = req.body;
  if (!slide) return res.status(400).json({ error: 'Missing slide data' });

  let browser = null;
  try {
    const execPath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1080, height: 1080 },
      executablePath: execPath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });

    const html = buildSlideHtml(slide, sermonTitle || '', sermonDate || '', speaker || '');
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({ type: 'png', fullPage: false });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="slide.png"');
    return res.send(Buffer.from(screenshot));

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (closeErr) {}
    }
  }
}
