import { type SubjectInfo } from '../../hooks/useSubjects';

/**
 * Escapes regex special characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wraps a pattern in word boundaries dynamically based on whether the clean characters
 * at the start and end of the pattern are alphanumeric word characters.
 */
function buildWordBoundaryRegExp(pattern: string, flags: string = 'i'): RegExp {
  const cleanPattern = pattern.replace(/\\/g, '');
  const startBoundary = cleanPattern.length > 0 && /^\w/.test(cleanPattern) ? '\\b' : '';
  const endBoundary = cleanPattern.length > 0 && /\w$/.test(cleanPattern) ? '\\b' : '';
  return new RegExp(`${startBoundary}${pattern}${endBoundary}`, flags);
}

/**
 * Heuristically matches an announcement to a subject.
 */
export function matchSubject(title: string, body: string, subjects: SubjectInfo[]): SubjectInfo | null {
  if (!subjects || subjects.length === 0) return null;

  const titleLower = (title || '').toLowerCase();
  const bodyLower = (body || '').toLowerCase();

  // 1. Explicit HTML comment tag check: <!-- subject_id:UUID -->
  const explicitMatch = bodyLower.match(/<!--\s*subject_id:([a-f0-9-]+)\s*-->/);
  if (explicitMatch && explicitMatch[1]) {
    const id = explicitMatch[1];
    const found = subjects.find(s => s.id === id);
    if (found) return found;
  }

  // 2. Exact subject code matching (whole word, ignoring punctuation)
  for (const subject of subjects) {
    const code = subject.code.toLowerCase();
    
    // Generate base variants in raw text
    const baseVariants = new Set<string>([code]);
    if (code.includes('(') || code.includes(')')) {
      baseVariants.add(code.replace(/[()]/g, ''));
      baseVariants.add(code.replace(/[()]/g, ' '));
      baseVariants.add(code.replace(/\([^)]*\)/g, ''));
    }

    // Expand all base variants with hyphen and space variations
    const finalRawVariants = new Set<string>();
    for (const base of baseVariants) {
      const trimmed = base.trim().replace(/\s+/g, ' ');
      if (!trimmed) continue;
      finalRawVariants.add(trimmed);
      
      if (trimmed.includes('-')) {
        finalRawVariants.add(trimmed.replace(/-/g, ''));
      }
      if (trimmed.includes(' ')) {
        finalRawVariants.add(trimmed.replace(/\s+/g, ''));
      }
    }

    // Escape and build regex for each variant
    for (const rawVariant of finalRawVariants) {
      const escaped = escapeRegExp(rawVariant);
      const regex = buildWordBoundaryRegExp(escaped);
      if (regex.test(titleLower) || regex.test(bodyLower)) {
        return subject;
      }
    }

    // Handle space/hyphen fuzzy matching regex variants safely using placeholders
    for (const rawVariant of finalRawVariants) {
      if (rawVariant.includes('-')) {
        const placeholder = '___HYPHEN_PLACEHOLDER___';
        const rawWithPlaceholder = rawVariant.replace(/-/g, placeholder);
        const escaped = escapeRegExp(rawWithPlaceholder);
        const variantRegexStr = escaped.replace(new RegExp(placeholder, 'g'), '\\s+');
        
        const regex = buildWordBoundaryRegExp(variantRegexStr);
        if (regex.test(titleLower) || regex.test(bodyLower)) {
          return subject;
        }
      }

      if (rawVariant.includes(' ')) {
        const placeholder = '___SPACE_PLACEHOLDER___';
        const rawWithPlaceholder = rawVariant.replace(/\s+/g, placeholder);
        const escaped = escapeRegExp(rawWithPlaceholder);
        const variantRegexStr = escaped.replace(new RegExp(placeholder, 'g'), '\\-');
        
        const regex = buildWordBoundaryRegExp(variantRegexStr);
        if (regex.test(titleLower) || regex.test(bodyLower)) {
          return subject;
        }
      }
    }
  }

  // 3. Smart Acronym Matching (e.g. Database Management System -> DBMS)
  for (const subject of subjects) {
    const name = subject.name.trim();
    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 1) {
      // Clean each word to keep only letters/numbers before selecting the first char
      const acronym = words
        .map(w => w.replace(/[^a-zA-Z0-9]/g, '')[0])
        .filter(Boolean)
        .join('')
        .toLowerCase();
      if (acronym.length >= 2) {
        const regex = buildWordBoundaryRegExp(escapeRegExp(acronym));
        if (regex.test(titleLower) || regex.test(bodyLower)) {
          return subject;
        }
      }
    }
  }

  // 4. Expanded common shortname / keyword mapping
  const commonMappings: Record<string, string[]> = {
    'maths': ['mathematics', 'math', 'm1', 'm2', 'm3', 'm4', 'm-1', 'm-2', 'm-3', 'm-4', 'discrete'],
    'math': ['mathematics', 'maths'],
    'dbms': ['database', 'sql'],
    'dsa': ['data structure', 'algorithm', 'ds'],
    'ds': ['data structure'],
    'oops': ['object oriented', 'oop', 'c++', 'java'],
    'oop': ['object oriented', 'oops', 'c++', 'java'],
    'os': ['operating system', 'operating systems'],
    'cn': ['computer network', 'computer networks', 'network'],
    'de': ['digital electronics', 'digital logic', 'dld'],
    'se': ['software engineering'],
    'toc': ['theory of computation', 'automata', 'flat', 'formal languages'],
    'flat': ['formal languages', 'automata', 'theory of computation', 'toc'],
    'cd': ['compiler design'],
    'ada': ['analysis design of algorithm', 'algorithms', 'daa'],
    'daa': ['analysis design of algorithm', 'algorithms', 'ada'],
    'physics': ['physics', 'phy'],
    'chemistry': ['chemistry', 'chem'],
    'graphics': ['graphics', 'drawing', 'eg'],
    'coa': ['computer organization', 'computer architecture', 'cao'],
    'cao': ['computer organization', 'computer architecture', 'coa'],
    'wt': ['web technology', 'web programming', 'html', 'css'],
    'ai': ['artificial intelligence'],
    'ml': ['machine learning'],
  };

  for (const subject of subjects) {
    const nameLower = subject.name.toLowerCase();
    const codeLower = subject.code.toLowerCase();

    for (const [shortForm, synonyms] of Object.entries(commonMappings)) {
      const isTargetSubject = nameLower.includes(shortForm) || codeLower.includes(shortForm) || 
                              synonyms.some(syn => nameLower.includes(syn) || codeLower.includes(syn));
      
      if (isTargetSubject) {
        const searchTerms = [shortForm, ...synonyms];
        for (const term of searchTerms) {
          const regex = buildWordBoundaryRegExp(escapeRegExp(term));
          if (regex.test(titleLower) || regex.test(bodyLower)) {
            return subject;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Computes a clean, short abbreviation for a subject.
 * First checks common mappings, then falls back to generating an acronym from the name,
 * and finally defaults to the subject code or the name itself.
 */
export function getSubjectAbbreviation(subject: SubjectInfo | null | undefined): string {
  if (!subject) return '';
  const name = (subject.name || '').trim();
  const nameLower = name.toLowerCase();

  // 1. Check direct common mapping dictionary rules
  const dict: Record<string, string> = {
    'computer networks': 'CN',
    'computer network': 'CN',
    'database management systems': 'DBMS',
    'database management system': 'DBMS',
    'data structures': 'DSA',
    'data structure': 'DSA',
    'discrete mathematics': 'Discrete',
    'discrete structure': 'Discrete',
    'object oriented programming': 'OOP',
    'object oriented': 'OOP',
    'operating systems': 'OS',
    'operating system': 'OS',
    'digital electronics': 'DE',
    'software engineering': 'SE',
    'theory of computation': 'TOC',
    'compiler design': 'CD',
    'analysis design of algorithms': 'DAA',
    'analysis design of algorithm': 'DAA',
    'computer organization': 'COA',
    'computer architecture': 'COA',
    'web technology': 'WT',
    'artificial intelligence': 'AI',
    'machine learning': 'ML',
    'engineering physics': 'Physics',
    'physics': 'Physics',
    'engineering chemistry': 'Chemistry',
    'chemistry': 'Chemistry',
    'engineering graphics': 'Graphics',
    'mechanical engineering': 'ME',
    'civil engineering': 'CE',
    'electrical engineering': 'EE',
    'mathematics': 'Maths',
    'math': 'Maths',
    'microprocessors': 'Micro',
    'microprocessor': 'Micro',
    'programming': 'Prog',
    'electronics': 'Electronics',
    'english': 'English',
    'biology': 'Biology',
    'economics': 'Eco',
    'seminar': 'Seminar',
    'workshop': 'Workshop',
    'project': 'Project',
  };

  // Check exact or partial match in dictionary
  for (const [key, val] of Object.entries(dict)) {
    if (nameLower === key || nameLower.includes(key)) {
      return val;
    }
  }

  // 2. Acronym Generation from multi-word names
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 1) {
    const acronym = words
      .map(w => w.replace(/[^a-zA-Z0-9]/g, '')[0])
      .filter(Boolean)
      .join('')
      .toUpperCase();
    if (acronym.length >= 2) {
      return acronym;
    }
  }

  // 3. Fallback: single word or short name (no code!)
  if (name.length > 0) {
    if (words.length === 1) {
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    // Capitalize each word if multi-word but acronym generation wasn't used
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  return '';
}

