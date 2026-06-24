import fs from 'fs';
import path from 'path';

const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), 'knowledge-base');

export interface KnowledgeBaseSection {
  source: string;
  title: string;
  content: string;
}

export interface KnowledgeBaseSearchHit {
  source: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface KnowledgeBaseSearchResult {
  found: boolean;
  query: string;
  hits: KnowledgeBaseSearchHit[];
}

export function loadKnowledgeBase(): string {
  const files = [
    'akwa-ibom-hospitality.md',
    'nigerian-real-estate-guide.md',
  ];

  const content = files
    .map((file) => {
      const filePath = path.join(KNOWLEDGE_BASE_DIR, file);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n');

  return content;
}

function loadKnowledgeBaseFiles() {
  return [
    'akwa-ibom-hospitality.md',
    'nigerian-real-estate-guide.md',
  ].map((file) => ({
    file,
    filePath: path.join(KNOWLEDGE_BASE_DIR, file),
  }));
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeQuery(query: string): string[] {
  return normalizeValue(query)
    .split(/[^a-z0-9₦$]+/)
    .filter((token) => token.length > 2)
    .filter(
      (token) =>
        ![
          'what',
          'when',
          'where',
          'which',
          'will',
          'with',
          'this',
          'that',
          'your',
          'about',
          'does',
          'have',
        ].includes(token)
    );
}

function splitIntoSections(file: string, rawContent: string): KnowledgeBaseSection[] {
  const parts = rawContent
    .split(/^##\s+/gm)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  const [firstSection, ...rest] = parts;
  const sections: KnowledgeBaseSection[] = [
    {
      source: file,
      title: rawContent.match(/^#\s+(.+)$/m)?.[1] || file,
      content: firstSection,
    },
  ];

  for (const section of rest) {
    const [titleLine, ...bodyLines] = section.split('\n');
    sections.push({
      source: file,
      title: titleLine.trim(),
      content: bodyLines.join('\n').trim(),
    });
  }

  return sections;
}

function dedupeSections(
  sections: KnowledgeBaseSection[]
): KnowledgeBaseSection[] {
  const unique = new Map<string, KnowledgeBaseSection>();

  for (const section of sections) {
    const key = `${section.source}:${normalizeValue(section.title)}:${normalizeValue(
      section.content
    )}`;

    if (!unique.has(key)) {
      unique.set(key, section);
    }
  }

  return [...unique.values()];
}

function buildExcerpt(content: string, terms: string[]): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const matchingLine =
    lines.find((line) =>
      terms.some((term) => normalizeValue(line).includes(term))
    ) || lines[0] || content;

  return matchingLine.length > 280
    ? `${matchingLine.slice(0, 277)}...`
    : matchingLine;
}

export function searchKnowledgeBaseStructured(
  query: string
): KnowledgeBaseSearchResult {
  const terms = tokenizeQuery(query);
  const sections = dedupeSections(
    loadKnowledgeBaseFiles()
      .filter(({ filePath }) => fs.existsSync(filePath))
      .flatMap(({ file, filePath }) =>
        splitIntoSections(file, fs.readFileSync(filePath, 'utf-8'))
      )
  );

  const scoredHits = sections
    .map((section) => {
      const searchable = normalizeValue(
        `${section.title}\n${section.content}\n${section.source}`
      );
      const score = terms.reduce((total, term) => {
        if (!searchable.includes(term)) {
          return total;
        }

        const titleBoost = normalizeValue(section.title).includes(term) ? 3 : 0;
        return total + 1 + titleBoost;
      }, 0);

      return {
        source: section.source,
        title: section.title,
        excerpt: buildExcerpt(section.content, terms),
        score,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score);

  const uniqueHits = new Map<string, KnowledgeBaseSearchHit>();

  for (const hit of scoredHits) {
    const key = `${hit.source}:${normalizeValue(hit.title)}:${normalizeValue(
      hit.excerpt
    )}`;

    if (!uniqueHits.has(key)) {
      uniqueHits.set(key, hit);
    }
  }

  const dedupedHits = [...uniqueHits.values()].slice(0, 4);

  return {
    found: dedupedHits.length > 0,
    query,
    hits: dedupedHits,
  };
}

export function searchKnowledgeBase(query: string): string {
  const result = searchKnowledgeBaseStructured(query);

  if (!result.found) {
    return JSON.stringify(result);
  }

  return JSON.stringify(result, null, 2);
}
