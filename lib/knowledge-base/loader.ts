import fs from 'fs';
import path from 'path';

const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), 'knowledge-base');

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

export function searchKnowledgeBase(query: string): string {
  const fullContent = loadKnowledgeBase();
  
  // For hackathon: simple keyword matching
  // In production: use vector embeddings
  const queryLower = query.toLowerCase();
  
  // Split into sections
  const sections = fullContent.split('\n## ');
  
  // Find relevant sections
  const relevantSections = sections.filter((section) =>
    section.toLowerCase().includes(queryLower) ||
    section.toLowerCase().includes('revenue') ||
    section.toLowerCase().includes('return') ||
    section.toLowerCase().includes('risk')
  );

  if (relevantSections.length === 0) {
    return fullContent; // Return full content if no specific match
  }

  return relevantSections.join('\n## ');
}
