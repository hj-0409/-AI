/* ============================================================
   JOB INSIGHT · HTML 리포트 다운로드 모듈
   - 현재 보고 있는 직무 상세(Screen 3) 또는 비교 결과(Screen 4)를
     독립 실행 가능한 단일 HTML 파일로 내려받습니다.
   - index.html 의 전역 함수/상태를 읽어서 동작합니다.
     (getReportContext / buildDetailFor / computeMatchScore / evaluate 등)
   ============================================================ */

/* 문자열 escape (index.html 의 escapeHTML 과 동일 동작, 독립 사용 목적) */
function rptEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* 파일명에 쓸 수 없는 문자 제거 */
function rptSafeFileName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 80);
}

function rptToday() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rptStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* 상태 → 색상 토큰 */
const RPT_STATUS = {
  green:  { emoji: '🟢', label: '충족',   color: '#10b981', bg: '#ecfdf5' },
  yellow: { emoji: '🟡', label: '보완',   color: '#f59e0b', bg: '#fffbeb' },
  red:    { emoji: '🔴', label: '미충족', color: '#ef4444', bg: '#fef2f2' }
};

function rptTagLabel(type) {
  const t = String(type || '').replace(/\s+/g, '');
  if (t === '필수') return '필수';
  if (t === '우대' || t === '권장') return '우대';
  if (t === '가산점') return '가산점';
  if (t === 'AI분석') return 'AI 분석';
  if (t === 'AI분석우대') return 'AI 분석 우대';
  return type || '참고';
}

function rptTagColor(type) {
  const t = String(type || '').replace(/\s+/g, '');
  if (t === '필수') return { c: '#dc2626', b: '#fef2f2' };
  if (t === '우대' || t === '권장') return { c: '#2563eb', b: '#eff6ff' };
  if (t === '가산점') return { c: '#059669', b: '#ecfdf5' };
  if (t.indexOf('AI') === 0) return { c: '#8b5cf6', b: '#f5f3ff' };
  return { c: '#6b7280', b: '#f3f4f6' };
}

/* ------------------------------------------------------------
   프로필 요약 블록
   ------------------------------------------------------------ */
function rptProfileBlock(profile) {
  const langParts = [];
  const L = profile.language || {};
  if (L.toeic) langParts.push(`TOEIC ${L.toeic}`);
  if (L.toeicSpeaking) langParts.push(`토익스피킹 ${L.toeicSpeaking}`);
  if (L.opic) langParts.push(`OPIc ${L.opic}`);
  if (L.other) langParts.push(L.other);
  if (L.businessEnglish) langParts.push('비즈니스 영어 회화 가능');

  const rows = [
    ['이름', profile.name || '—'],
    ['학교', profile.school || '—'],
    ['전공 · 학년', `${profile.major || '—'}${profile.grade ? ' · ' + profile.grade : ''}`],
    ['학점', (profile.gpa || profile.gpa === 0) ? `${profile.gpa} / ${profile.gpaMax || '4.5'}` : '—'],
    ['이수 과목', (profile.courses || []).join(', ') || '—'],
    ['어학', langParts.join(' · ') || '—'],
    ['자격증', (profile.certificates || []).join(', ') || '—'],
    ['경험', (profile.experience || []).join(', ') || '—']
  ];

  return `
  <section class="card">
    <h2>내 프로필 요약</h2>
    <table class="kv">
      ${rows.map(([k, v]) => `<tr><th>${rptEsc(k)}</th><td>${rptEsc(v)}</td></tr>`).join('')}
    </table>
  </section>`;
}

/* ------------------------------------------------------------
   요구사항 항목 (평가 결과 포함)
   ------------------------------------------------------------ */
function rptReqRow(title, type, detail, ev) {
  const tc = rptTagColor(type);
  const st = ev ? RPT_STATUS[ev.s] : null;
  return `
    <div class="req" ${st ? `style="border-left:4px solid ${st.color};"` : ''}>
      <div class="req-h">
        <span class="req-t">${rptEsc(title)}</span>
        <span class="tag" style="color:${tc.c};background:${tc.b};">${rptEsc(rptTagLabel(type))}</span>
      </div>
      ${detail ? `<div class="req-d">${rptEsc(detail)}</div>` : ''}
      ${st ? `<div class="req-s" style="background:${st.bg};color:${st.color};">
        <span>${st.emoji}</span><span>${rptStripTags(ev.m)}</span>
      </div>` : ''}
    </div>`;
}

/* evaluate() 메시지에는 <b> 태그가 섞여 있으므로 텍스트만 추출 */
function rptStripTags(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html == null ? '' : html);
  return rptEsc(tmp.textContent || '');
}

/* ------------------------------------------------------------
   직무 상세 1건 → 리포트 본문
   ------------------------------------------------------------ */
function rptDetailSection(D, score, withEval) {
  const ev = key => (withEval ? window.evaluateFor(D, key, null) : null);
  const evName = (key, name) => (withEval ? window.evaluateFor(D, key, name) : null);

  const docs = D.documents || {};
  const certs = docs.certificate || [];
  const tools = (D.techStack && D.techStack.tools) || [];
  const comps = D.competency || [];
  const ins = D.insight || {};
  const w = D.workCondition || {};
  const tl = D.timeline || [];
  const dd = D.dday || {};

  const sc = score ? RPT_STATUS[score.pct >= 75 ? 'green' : score.pct >= 45 ? 'yellow' : 'red'] : null;

  return `
  <section class="card">
    <div class="job-head">
      <div>
        <h2 style="margin:0;">${rptEsc(D.company)} <span class="job-chip">${rptEsc(D.job)}</span></h2>
        <div class="muted" style="margin-top:6px;">${rptEsc(D.category)} · ${rptEsc(D.source || '')}</div>
      </div>
      ${dd.label ? `<div class="dday">${rptEsc(dd.label)}<small>${rptEsc(dd.note || '')}</small></div>` : ''}
    </div>

    ${score ? `
    <div class="score" style="border-color:${sc.color};background:${sc.bg};">
      <div class="score-num" style="color:${sc.color};">${score.pct}<small>/100</small></div>
      <div class="score-meta">
        <div class="score-label" style="color:${sc.color};">${rptEsc(window.matchLabel(score.pct))}</div>
        <div class="muted">🟢 충족 ${score.g}건 · 🟡 보완 ${score.y}건 · 🔴 미충족 ${score.r}건 (총 ${score.total}개 항목)</div>
        <div class="muted" style="font-size:11.5px;">가중치 — 필수 3점 / 우대·AI분석 2점 / 참고 1점</div>
      </div>
    </div>` : ''}

    <h3>지원 자격 · 서류</h3>
    ${docs.education ? rptReqRow('학력 · 전공', docs.education.type, docs.education.detail, ev('education')) : ''}
    ${docs.cutoff ? rptReqRow('어학 컷오프', docs.cutoff.type, docs.cutoff.detail, ev('cutoff')) : ''}
    ${docs.license ? rptReqRow('필수 자격', docs.license.type, docs.license.detail, ev('license')) : ''}
    ${certs.map(c => rptReqRow(c.name, c.type, c.detail, evName('cert', c.name))).join('')}

    <h3>기술 스택 · 활용 도구</h3>
    ${D.techStack && D.techStack.summary ? `<p class="summary">${rptEsc(D.techStack.summary)}</p>` : ''}
    ${tools.map(t => rptReqRow(`${t.name} (${t.category})`, t.level, '', evName('stack', t.name))).join('')}

    <h3>요구 역량</h3>
    ${comps.map(c => rptReqRow(c.name, c.type, c.detail, evName('comp', c.name))).join('')}

    <h3>기업 이슈 · 사업 현황</h3>
    <table class="kv">
      <tr><th>최근 이슈</th><td>${(ins.news || []).map(n => `• ${rptEsc(n)}`).join('<br>') || '—'}</td></tr>
      <tr><th>주요 제품</th><td>${(ins.products || []).map(rptEsc).join(', ') || '—'}</td></tr>
      <tr><th>경쟁사</th><td>${(ins.competitors || []).map(rptEsc).join(', ') || '—'}</td></tr>
    </table>

    <h3>근무 조건</h3>
    <table class="kv">
      <tr><th>근무지</th><td>${rptEsc(w.location || '—')}</td></tr>
      <tr><th>근무 형태</th><td>${rptEsc(w.shift || '—')}</td></tr>
      <tr><th>통근</th><td>${rptEsc(w.commute || '—')}</td></tr>
      <tr><th>기숙사 · 사택</th><td>${rptEsc(w.dorm || '—')}</td></tr>
      <tr><th>기타 복리</th><td>${rptEsc(w.etc || '—')}</td></tr>
    </table>

    <h3>전형 일정</h3>
    <ol class="timeline">
      ${tl.map(t => `
        <li class="tl-${rptEsc(t.state)}">
          <span class="tl-t">${rptEsc(t.title)}</span>
          <span class="tl-d">${rptEsc(t.desc)}</span>
        </li>`).join('')}
    </ol>
  </section>`;
}

/* ------------------------------------------------------------
   비교 리포트 (여러 직무)
   ------------------------------------------------------------ */
function rptCompareSection(rows) {
  const head = rows.map(r => {
    const sc = RPT_STATUS[r.score.pct >= 75 ? 'green' : r.score.pct >= 45 ? 'yellow' : 'red'];
    return `<th>
      <div class="cmp-nm">${rptEsc(r.detail.company)}</div>
      <div class="muted">${rptEsc(r.detail.job)}</div>
      <div class="cmp-sc" style="color:${sc.color};">${r.score.pct}<small>/100</small></div>
      <div class="muted" style="font-size:11px;">${rptEsc(window.matchLabel(r.score.pct))}</div>
    </th>`;
  }).join('');

  const line = (label, fn) =>
    `<tr><th class="rowh">${rptEsc(label)}</th>${rows.map(r => `<td>${fn(r)}</td>`).join('')}</tr>`;

  const docOf = (r, k) => {
    const x = (r.detail.documents || {})[k];
    return x ? `<span class="tag" style="color:${rptTagColor(x.type).c};background:${rptTagColor(x.type).b};">${rptEsc(rptTagLabel(x.type))}</span> ${rptEsc(x.detail)}` : '—';
  };

  return `
  <section class="card">
    <h2>기업 · 직무 비교</h2>
    <div class="scroll">
      <table class="cmp">
        <thead><tr><th class="rowh"></th>${head}</tr></thead>
        <tbody>
          ${line('마감일', r => {
            const dd = r.detail.dday || {};
            return `<b>${rptEsc(dd.label || '미정')}</b><div class="muted">${rptEsc(dd.note || '')}</div>`;
          })}
          ${line('매칭 결과', r => `🟢 ${r.score.g} · 🟡 ${r.score.y} · 🔴 ${r.score.r}`)}
          ${line('학력 · 전공', r => docOf(r, 'education'))}
          ${line('어학 컷오프', r => docOf(r, 'cutoff'))}
          ${line('필수 자격', r => docOf(r, 'license'))}
          ${line('자격증 · 가산점', r => {
            const arr = (r.detail.documents || {}).certificate || [];
            return arr.length
              ? arr.map(c => `• ${rptEsc(c.name)} <span class="tag" style="color:${rptTagColor(c.type).c};background:${rptTagColor(c.type).b};">${rptEsc(rptTagLabel(c.type))}</span>`).join('<br>')
              : '없음';
          })}
          ${line('기술 스택', r => {
            const arr = (r.detail.techStack || {}).tools || [];
            return arr.map(t => `<span class="chip">${rptEsc(t.name)}</span>`).join(' ') || '—';
          })}
          ${line('요구 역량', r => (r.detail.competency || []).map(c => `• ${rptEsc(c.name)}`).join('<br>') || '—')}
          ${line('근무 조건', r => {
            const w = r.detail.workCondition || {};
            return `📍 ${rptEsc(w.location || '—')}<br>🕒 ${rptEsc(w.shift || '—')}<br>🏠 ${rptEsc(w.dorm || '—')}`;
          })}
          ${line('최근 이슈', r => ((r.detail.insight || {}).news || []).slice(0, 3).map(n => `• ${rptEsc(n)}`).join('<br>') || '—')}
        </tbody>
      </table>
    </div>
  </section>`;
}

/* ------------------------------------------------------------
   리포트 스타일 (다운로드 파일 내부 CSS)
   ------------------------------------------------------------ */
function rptStyle() {
  return `
  *{box-sizing:border-box;}
  body{margin:0;padding:32px 20px;background:#f7f8fa;color:#111827;
       font-family:'Pretendard','Inter',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;
       line-height:1.65;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .wrap{max-width:880px;margin:0 auto;}
  .rpt-head{background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border-radius:16px;padding:26px 28px;margin-bottom:20px;}
  .rpt-head .brand{font-size:12.5px;font-weight:700;letter-spacing:.12em;opacity:.85;text-transform:uppercase;}
  .rpt-head h1{margin:8px 0 6px;font-size:23px;font-weight:800;line-height:1.35;}
  .rpt-head .sub{font-size:13px;opacity:.9;}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px 24px;margin-bottom:18px;}
  .card h2{margin:0 0 14px;font-size:18px;font-weight:800;}
  .card h3{margin:22px 0 10px;font-size:14.5px;font-weight:800;color:#1d4ed8;
           padding-bottom:7px;border-bottom:1px solid #e5e7eb;}
  .muted{color:#6b7280;font-size:12.5px;}
  .summary{background:#f2f4f7;border-radius:10px;padding:11px 13px;font-size:13px;color:#4b5563;margin:0 0 12px;}
  table.kv{width:100%;border-collapse:collapse;font-size:13px;}
  table.kv th{width:132px;text-align:left;vertical-align:top;padding:9px 10px;color:#4b5563;
              font-weight:700;background:#f9fafb;border:1px solid #e5e7eb;}
  table.kv td{padding:9px 12px;border:1px solid #e5e7eb;vertical-align:top;}
  .tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;}
  .req{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:9px;}
  .req-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
  .req-t{font-weight:700;font-size:13.5px;}
  .req-d{font-size:12.8px;color:#4b5563;margin-top:5px;}
  .req-s{display:flex;gap:7px;align-items:flex-start;margin-top:9px;padding:8px 11px;
         border-radius:8px;font-size:12.3px;font-weight:600;}
  .job-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;
            padding-bottom:14px;border-bottom:1px solid #e5e7eb;margin-bottom:6px;}
  .job-chip{display:inline-block;font-size:12.5px;font-weight:700;color:#1d4ed8;background:#eff6ff;
            padding:3px 10px;border-radius:999px;vertical-align:middle;margin-left:6px;}
  .dday{background:#fef2f2;color:#dc2626;border-radius:10px;padding:8px 14px;font-weight:800;
        font-size:15px;text-align:center;white-space:nowrap;}
  .dday small{display:block;font-size:10.5px;font-weight:600;opacity:.8;}
  .score{display:flex;align-items:center;gap:18px;border:1.5px solid;border-radius:12px;
         padding:15px 18px;margin:16px 0 4px;flex-wrap:wrap;}
  .score-num{font-size:34px;font-weight:800;line-height:1;}
  .score-num small{font-size:14px;font-weight:700;opacity:.65;}
  .score-label{font-size:14.5px;font-weight:800;margin-bottom:3px;}
  ol.timeline{list-style:none;margin:0;padding:0;}
  ol.timeline li{position:relative;padding:0 0 14px 22px;border-left:2px solid #e5e7eb;margin-left:5px;}
  ol.timeline li:last-child{border-left-color:transparent;padding-bottom:0;}
  ol.timeline li:before{content:'';position:absolute;left:-7px;top:4px;width:12px;height:12px;
                        border-radius:50%;background:#d1d5db;border:2px solid #fff;}
  ol.timeline li.tl-done:before{background:#10b981;}
  ol.timeline li.tl-next:before{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2);}
  .tl-t{display:block;font-weight:700;font-size:13.3px;}
  .tl-d{display:block;font-size:12.3px;color:#6b7280;}
  .scroll{overflow-x:auto;}
  table.cmp{width:100%;border-collapse:collapse;font-size:12.5px;min-width:560px;}
  table.cmp th,table.cmp td{border:1px solid #e5e7eb;padding:10px 12px;vertical-align:top;text-align:left;}
  table.cmp thead th{background:#f9fafb;}
  table.cmp .rowh{width:118px;background:#f9fafb;font-weight:700;color:#4b5563;}
  .cmp-nm{font-weight:800;font-size:13.5px;}
  .cmp-sc{font-size:20px;font-weight:800;margin-top:6px;}
  .cmp-sc small{font-size:11px;opacity:.6;}
  .chip{display:inline-block;background:#f2f4f7;border:1px solid #e5e7eb;border-radius:999px;
        padding:2px 8px;font-size:11.5px;margin:0 3px 3px 0;}
  .foot{text-align:center;color:#9ca3af;font-size:11.5px;padding:8px 0 4px;line-height:1.7;}
  @media print{
    body{background:#fff;padding:0;}
    .card{break-inside:avoid;border-radius:0;border-left:0;border-right:0;}
    .rpt-head{border-radius:0;}
  }
  @media (max-width:640px){
    body{padding:16px 12px;}
    .card{padding:18px 15px;}
    table.kv th{width:96px;}
  }`;
}

/* ------------------------------------------------------------
   최종 HTML 문서 조립
   ------------------------------------------------------------ */
function rptBuildDocument(opts) {
  const { title, heading, subline, body } = opts;
  // 주의: 문서 문자열 안에서 종료 태그는 분리 표기 (인라인 파서 사고 방지)
  const closeStyle = '<' + '/style>';
  const closeHead = '<' + '/head>';
  const closeBody = '<' + '/body>';
  const closeHtml = '<' + '/html>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${rptEsc(title)}</title>
<style>${rptStyle()}${closeStyle}
${closeHead}
<body>
<div class="wrap">
  <header class="rpt-head">
    <div class="brand">JOB INSIGHT REPORT</div>
    <h1>${rptEsc(heading)}</h1>
    <div class="sub">${rptEsc(subline)}</div>
  </header>
  ${body}
  <p class="foot">
    본 리포트는 JOB INSIGHT에서 ${rptEsc(rptStamp())} 기준으로 생성되었습니다.<br>
    채용 요구사항은 변경될 수 있으므로 반드시 기업 공식 채용 공고 원문을 확인하세요.
  </p>
</div>
${closeBody}
${closeHtml}`;
}

/* ------------------------------------------------------------
   Blob 다운로드 트리거
   ------------------------------------------------------------ */
function rptDownload(fileName, html) {
  const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------
   공개 API 1 : 현재 직무 상세 리포트 다운로드
   ------------------------------------------------------------ */
function downloadDetailReport() {
  const D = window.getCurrentDetail && window.getCurrentDetail();
  if (!D) {
    window.showToast('먼저 기업 · 직무 상세 화면을 열어주세요.');
    return;
  }
  const score = window.computeMatchScore(D);
  const body =
    rptProfileBlock(window.getProfile()) +
    rptDetailSection(D, score, true);

  const html = rptBuildDocument({
    title: `${D.company} ${D.job} 채용 분석 리포트`,
    heading: `${D.company} · ${D.job} 채용 분석 리포트`,
    subline: `${D.category} · 내 프로필 매칭 ${score.pct}점 · 생성일 ${rptStamp()}`,
    body
  });

  rptDownload(`JOBINSIGHT_${rptSafeFileName(D.company)}_${rptSafeFileName(D.job)}_${rptToday()}.html`, html);
  window.showToast('HTML 리포트를 다운로드했습니다.');
}

/* ------------------------------------------------------------
   공개 API 2 : 비교 결과 리포트 다운로드
   ------------------------------------------------------------ */
function downloadCompareReport() {
  const keys = window.getCompareKeys ? window.getCompareKeys() : [];
  if (!keys.length) {
    window.showToast('비교 목록이 비어 있습니다. 직무를 먼저 담아주세요.');
    return;
  }

  const rows = keys.map(key => {
    const { company, jobKey } = window.parseCompareKey(key);
    const detail = window.buildDetailFor(company, jobKey);
    return { key, detail, score: window.computeMatchScore(detail) };
  });

  const names = rows.map(r => r.detail.company).join(' vs ');
  const body =
    rptProfileBlock(window.getProfile()) +
    rptCompareSection(rows) +
    rows.map(r => rptDetailSection(r.detail, r.score, true)).join('');

  const html = rptBuildDocument({
    title: `${names} 비교 리포트`,
    heading: `${names} 비교 리포트`,
    subline: `${rows.length}개 기업 · 직무 비교 · 생성일 ${rptStamp()}`,
    body
  });

  rptDownload(`JOBINSIGHT_비교리포트_${rows.length}개_${rptToday()}.html`, html);
  window.showToast('비교 리포트를 다운로드했습니다.');
}
