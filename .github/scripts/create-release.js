const fs = require('node:fs');
const cp = require('node:child_process');

const repository = process.env.REPOSITORY;
const currentPrNumber = Number(process.env.CURRENT_PR_NUMBER);
const config = JSON.parse(fs.readFileSync('.github/release-config.json', 'utf8'));

function run(command) {
  return cp.execFileSync('bash', ['-lc', command], { encoding: 'utf8' }).trim();
}

function ghApi(path) {
  const output = run(`gh api ${JSON.stringify(path)}`);
  return JSON.parse(output || '[]');
}

function normalizeLabel(label) {
  return label.toLowerCase().trim();
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function getLatestVersion() {
  try {
    const tags = run('git tag --list "v*" --sort=-version:refname')
      .split('\n')
      .filter(Boolean);

    if (!tags.length) return config.initialVersion;
    return tags[0].replace(/^v/, '');
  } catch {
    return config.initialVersion;
  }
}

function getMergedPullRequestsSinceLastRelease() {
  let latestTag = '';
  try {
    latestTag = run('git tag --list "v*" --sort=-version:refname | head -n 1');
  } catch {
    latestTag = '';
  }

  const query = latestTag
    ? `/repos/${repository}/compare/${latestTag}...main`
    : `/repos/${repository}/commits?sha=main&per_page=100`;

  if (!latestTag) {
    return [ghApi(`/repos/${repository}/pulls?state=closed&base=main&per_page=100`)
      .filter((pr) => pr.merged_at)
      .sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at))];
  }

  const comparison = ghApi(query);
  const prs = [];
  for (const commit of comparison.commits || []) {
    try {
      const associated = ghApi(`/repos/${repository}/commits/${commit.sha}/pulls`);
      for (const pr of associated) {
        if (pr.base?.ref === 'main' && pr.merged_at && !prs.some((item) => item.number === pr.number)) {
          prs.push(pr);
        }
      }
    } catch {
      // Ignore commits for which the API does not return associated PRs.
    }
  }

  if (currentPrNumber && !prs.some((pr) => pr.number === currentPrNumber)) {
    const current = ghApi(`/repos/${repository}/pulls/${currentPrNumber}`);
    if (current.merged_at) prs.push(current);
  }

  return prs.sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at));
}

function determineBump(prs) {
  let highest = 'patch';
  const rank = { patch: 1, minor: 2, major: 3 };

  for (const pr of prs) {
    const labels = (pr.labels || []).map((label) => normalizeLabel(label.name));
    const title = (pr.title || '').toLowerCase();
    let bump = config.defaultBump;

    for (const label of labels) {
      if (config.labels[label]) bump = config.labels[label];
    }

    if (/^breaking\s*:/i.test(pr.title) || title.includes('breaking change')) bump = 'major';
    else if (/^(feat|feature)\s*:/i.test(pr.title) && rank[bump] < rank.minor) bump = 'minor';
    else if (/^(fix|bugfix)\s*:/i.test(pr.title) && !config.labels.fix) bump = 'patch';

    if (rank[bump] > rank[highest]) highest = bump;
  }

  return highest;
}

function sectionFor(pr) {
  const labels = (pr.labels || []).map((label) => normalizeLabel(label.name));
  for (const label of labels) {
    if (config.sections[label]) return config.sections[label];
  }

  const title = pr.title || '';
  if (/^(feat|feature)\s*:/i.test(title)) return 'Features';
  if (/^(fix|bugfix)\s*:/i.test(title)) return 'Fixes';
  if (/^breaking\s*:/i.test(title)) return 'Breaking Changes';
  return 'Changes';
}

const prs = getMergedPullRequestsSinceLastRelease();
const currentVersion = getLatestVersion();
const bump = determineBump(prs);
const nextVersion = bumpVersion(currentVersion, bump);

const grouped = new Map();
for (const pr of prs) {
  const section = sectionFor(pr);
  if (!grouped.has(section)) grouped.set(section, []);
  grouped.get(section).push(`- ${pr.title} (#${pr.number})`);
}

let notes = `## What's Changed\n\n`;
for (const [section, entries] of grouped) {
  notes += `### ${section}\n${entries.join('\n')}\n\n`;
}
if (!prs.length) notes += '- Maintenance update\n\n';
notes += `**Previous version:** v${currentVersion}\n`;
notes += `**Version bump:** ${bump}\n`;
notes += `**Release type:** Production\n`;

const notesPath = `/tmp/release-notes-v${nextVersion}.md`;
fs.writeFileSync(notesPath, notes);

const outputPath = process.env.GITHUB_OUTPUT;
fs.appendFileSync(outputPath, `version=${nextVersion}\n`);
fs.appendFileSync(outputPath, `release_notes_file=${notesPath}\n`);
console.log(notes);
console.log(`Next version: v${nextVersion}`);
