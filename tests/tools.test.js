// Node-only tests for the Phase 10 narration tools (tools/narration-export.js, tools/build-audio-manifest.js).
// They use the file system, so they live here rather than in tests/specs/ (which also run in the browser).
// Run with: node --test tests/*.test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadApp } = require('./load-app');
const exporter = require('../tools/narration-export');
const B = require('../tools/build-audio-manifest');

const { NumSys } = loadApp();

describe('narration export', () => {
  const lines = exporter.collect(NumSys);

  it('covers every step of every lesson and every movie card, with hashes', () => {
    const ids = new Set(lines.map((l) => l.id));
    assert.strictEqual(ids.size, lines.length);
    NumSys.lessons.list().forEach((lesson) => lesson.scenes.forEach((scene) => scene.steps.forEach((step, i) => {
      assert.ok(ids.has(NumSys.lessons.stepId(lesson.id, scene.id, i)), `${lesson.id}.${scene.id}.${i}`);
    })));
    assert.ok(ids.has('movie.start.0') && ids.has('movie.end.0') && ids.has('binary.movie-chapter.0'));
    lines.forEach((l) => assert.strictEqual(l.hash, NumSys.narrator.hashText(l.text)));
  });

  it('writes a readable script with every line in it, and the size budget', () => {
    const md = exporter.toMarkdown(NumSys, lines);
    lines.forEach((l) => assert.ok(md.includes('`' + l.id + '`: ' + l.text), l.id));
    const t = exporter.totals(NumSys, lines);
    assert.ok(md.includes(`${t.lines} lines`));
    assert.ok(t.mb < exporter.BUDGET_MB, `narration would be ${t.mb.toFixed(1)} MB`);
    const json = JSON.parse(exporter.toJson(lines));
    assert.deepStrictEqual(Object.keys(json[0]), ['id', 'text', 'hash', 'lesson', 'scene', 'step', 'interactive', 'movie']);
  });

  it('the committed docs/narration.md and tools/narration.json are up to date', () => {
    const root = path.resolve(__dirname, '..');
    assert.strictEqual(fs.readFileSync(path.join(root, 'docs/narration.md'), 'utf8'), exporter.toMarkdown(NumSys, lines),
      'run node tools/narration-export.js');
    assert.strictEqual(fs.readFileSync(path.join(root, 'tools/narration.json'), 'utf8'), exporter.toJson(lines));
  });
});

describe('build-audio-manifest', () => {
  const H = NumSys.narrator.hashText;
  const lines = [
    { id: 'a.x.0', text: 'One.', hash: H('One.') },
    { id: 'a.x.1', text: 'Two.', hash: H('Two.') },
    { id: 'b.y.0', text: 'Three.', hash: H('Three.') },
    { id: 'b.y.1', text: 'Four.', hash: H('Four.') }
  ];

  function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'numsys-audio-')); }

  it('scans audio files, preferring mp3 and ignoring other files', () => {
    const dir = tmpdir();
    ['a.x.0.webm', 'a.x.0.mp3', 'a.x.1.ogg', 'b.y.0.m4a', 'notes.txt', 'cues.json', 'README'].forEach((f) => fs.writeFileSync(path.join(dir, f), 'x'));
    assert.deepStrictEqual(B.scanAudio(dir), { 'a.x.0': 'a.x.0.mp3', 'a.x.1': 'a.x.1.ogg', 'b.y.0': 'b.y.0.m4a' });
    assert.deepStrictEqual(B.scanAudio(path.join(dir, 'missing')), {});
  });

  it('takes the hash from the newest cue sheet, then the old manifest, then assumes new files are fresh', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'old.json'), JSON.stringify({ kind: B.CUE_KIND, recordedAt: '2026-01-01T00:00:00Z',
      lines: [{ id: 'a.x.0', hash: 'old' }, { id: 'a.x.1', hash: H('Two.') }] }));
    fs.writeFileSync(path.join(dir, 'new.json'), JSON.stringify({ kind: B.CUE_KIND, recordedAt: '2026-05-01T00:00:00Z',
      lines: [{ id: 'a.x.0', hash: H('One.') }] }));
    fs.writeFileSync(path.join(dir, 'other.json'), JSON.stringify({ kind: 'something-else', lines: [{ id: 'b.y.1', hash: 'zzz' }] }));
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ nope');
    const cues = B.readCues(dir);
    assert.deepStrictEqual(Object.keys(cues).sort(), ['a.x.0', 'a.x.1']);
    assert.strictEqual(cues['a.x.0'].hash, H('One.'));

    const files = { 'a.x.0': 'a.x.0.mp3', 'a.x.1': 'a.x.1.mp3', 'b.y.0': 'b.y.0.mp3', 'zz.q.0': 'zz.q.0.mp3' };
    const old = { 'b.y.0': { src: 'assets/audio/b.y.0.mp3', hash: H('Three, as it used to be.') } };
    const { entries, report } = B.build({ lines, files, old, cues, accept: null });
    assert.deepStrictEqual(entries['a.x.0'], { src: 'assets/audio/a.x.0.mp3', hash: H('One.') });
    assert.strictEqual(entries['b.y.0'].hash, H('Three, as it used to be.'));
    assert.deepStrictEqual(report.fresh, ['a.x.0', 'a.x.1']);
    assert.deepStrictEqual(report.stale, ['b.y.0']);
    assert.deepStrictEqual(report.unknown, ['zz.q.0.mp3']);
    assert.deepStrictEqual(report.missing, ['b.y.1']);
    assert.deepStrictEqual(report.assumed, []);

    // A brand-new file with no cue sheet is assumed to match today's text.
    const fresh = B.build({ lines, files: { 'b.y.1': 'b.y.1.wav' }, old: {}, cues: {}, accept: null });
    assert.deepStrictEqual(fresh.report.assumed, ['b.y.1']);
    assert.strictEqual(fresh.entries['b.y.1'].hash, H('Four.'));

    // --accept marks files as matching today's text.
    const accepted = B.build({ lines, files, old, cues, accept: new Set(['b.y.0']) });
    assert.strictEqual(accepted.entries['b.y.0'].hash, H('Three.'));
    assert.strictEqual(B.build({ lines, files, old, cues: {}, accept: 'all' }).report.stale.length, 0);
  });

  it('lists what still needs recording', () => {
    const entries = { 'a.x.0': { src: 's', hash: H('One.') }, 'a.x.1': { src: 's', hash: 'stale' } };
    assert.deepStrictEqual(B.todo(lines, entries).map((l) => l.id), ['a.x.1', 'b.y.0', 'b.y.1']);
    assert.deepStrictEqual(B.todo(lines, entries, { only: 'b.' }).map((l) => l.id), ['b.y.0', 'b.y.1']);
    assert.deepStrictEqual(B.todo(lines, entries, { force: true }).length, 4);
  });

  it('writes a manifest the app and the narrator can read back', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'audio-manifest.js');
    const entries = { 'b.y.0': { src: 'assets/audio/b.y.0.mp3', hash: H('Three.') }, 'a.x.0': { src: 'assets/audio/a.x.0.mp3', hash: H('One.') } };
    fs.writeFileSync(file, B.renderManifest(entries));
    assert.deepStrictEqual(B.readManifest(file), entries);
    assert.ok(fs.readFileSync(file, 'utf8').indexOf('"a.x.0"') < fs.readFileSync(file, 'utf8').indexOf('"b.y.0"'));
    fs.writeFileSync(file, B.renderManifest({}));
    assert.deepStrictEqual(B.readManifest(file), {});
    // The committed manifest parses too.
    assert.strictEqual(typeof B.readManifest(path.resolve(__dirname, '../js/engine/audio-manifest.js')), 'object');
  });

  it('merges generated lines into its cue sheet', () => {
    const dir = tmpdir();
    const file = path.join(dir, 'cues-generated.json');
    fs.writeFileSync(file, B.mergeGenerated(file, [{ id: 'b.y.0', hash: '1' }, { id: 'a.x.0', hash: '2' }], '2026-01-01T00:00:00.000Z'));
    fs.writeFileSync(file, B.mergeGenerated(file, [{ id: 'b.y.0', hash: '3' }], '2026-02-01T00:00:00.000Z'));
    const sheet = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(sheet.kind, B.CUE_KIND);
    assert.deepStrictEqual(sheet.lines.map((l) => [l.id, l.hash]), [['a.x.0', '2'], ['b.y.0', '3']]);
    assert.strictEqual(B.readCues(dir)['b.y.0'].hash, '3');
  });
});
