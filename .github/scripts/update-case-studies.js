const fs = require('fs');
const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl) => {
      https.get(requestUrl, { headers: { 'User-Agent': 'GitHub-Actions' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function main() {
  const html = await fetch('https://www.matejbaco.eu/projects');

  // Extract project entries using the consistent HTML pattern:
  // <a class="group" href="/projects/{slug}">
  //   <img src="/projects/{icon}" alt="{title}">
  //   <p class="text-xl ...">{title}</p>
  //   <p class="mt-0.5 text-white/50 text-sm">{description}</p>
  const projectRegex = /<a class="group" href="\/projects\/([^"]+)"[^>]*>[\s\S]*?<img src="(\/projects\/[^"]+)"[^>]*alt="[^"]*"[^>]*>[\s\S]*?<p class="text-xl[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>\s*<p class="mt-0\.5 text-white\/50 text-sm">\s*([\s\S]*?)\s*<\/p>/g;

  const projects = [];
  let match;
  while ((match = projectRegex.exec(html)) !== null) {
    const slug = match[1].trim();
    const iconPath = match[2].trim();
    const title = match[3].trim();
    const description = match[4].trim();

    projects.push({ slug, iconPath, title, description });
  }

  if (projects.length === 0) {
    console.error('No projects found - HTML structure may have changed');
    process.exit(1);
  }

  console.log(`Found ${projects.length} projects`);

  // Build markdown table
  let table = '| Logo | Title | Description |\n';
  table += '|------|-------|-------------|\n';

  for (const p of projects) {
    const url = `https://matejbaco.eu/projects/${p.slug}`;
    const iconUrl = `https://matejbaco.eu${p.iconPath}`;
    table += `| <a href="${url}" target="_blank"><img width="52px" height="52px" style="object-fit: contain;" alt="${p.title}" src="${iconUrl}" /></a> | [${p.title}](${url}) | ${p.description} |\n`;
  }

  // Update README between markers
  const readme = fs.readFileSync('README.md', 'utf8');
  const startMarker = '<!-- CASE-STUDIES:START -->';
  const endMarker = '<!-- CASE-STUDIES:END -->';

  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find CASE-STUDIES markers in README.md');
    process.exit(1);
  }

  const newReadme = readme.substring(0, startIdx + startMarker.length) + '\n' + table + endMarker + readme.substring(endIdx + endMarker.length);

  fs.writeFileSync('README.md', newReadme);
  console.log('README.md updated successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
