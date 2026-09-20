// DocuMorph-CLI v2.0.0 - Universal Document & AST Morphology Engine
// Markdown AST, RFC 4180 CSV, Native YAML/JSON Transpiler, LCS Diff & Readability Metrics

const crypto = require('crypto');

/**
 * Text Metrics & Flesch-Kincaid Readability Calculator
 */
class TextMetricsEngine {
  static countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, '');
    word = word.replace(/^y/, '');
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? Math.max(1, syllables.length) : 1;
  }

  static analyze(text) {
    if (!text || typeof text !== 'string') {
      return {
        characters: 0,
        charactersNoSpaces: 0,
        words: 0,
        sentences: 0,
        paragraphs: 0,
        lines: 0,
        readingTimeMinutes: 0,
        fleschReadingEase: 100,
        fleschKincaidGrade: 0
      };
    }

    const lines = text.split('\n');
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const words = text.match(/\b[A-Za-z0-9_\-']+\b/g) || [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || (words.length > 0 ? [text] : []);

    const wordCount = Math.max(1, words.length);
    const sentenceCount = Math.max(1, sentences.length);

    let totalSyllables = 0;
    for (const w of words) {
      totalSyllables += this.countSyllables(w);
    }

    // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
    const wordsPerSentence = wordCount / sentenceCount;
    const syllablesPerWord = totalSyllables / wordCount;
    const readingEase = Math.max(0, Math.min(100, 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord)));

    // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    const gradeLevel = Math.max(0, (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59);

    return {
      characters: text.length,
      charactersNoSpaces: text.replace(/\s/g, '').length,
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      lines: lines.length,
      readingTimeMinutes: parseFloat((words.length / 200).toFixed(2)),
      fleschReadingEase: parseFloat(readingEase.toFixed(1)),
      fleschKincaidGrade: parseFloat(gradeLevel.toFixed(1))
    };
  }
}

/**
 * Recursive Markdown to Semantic HTML5 & AST Transpiler
 */
class MarkdownTranspiler {
  static slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  static escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  static parseInline(text) {
    const stash = [];
    const pushStash = (val) => {
      const idx = stash.length;
      stash.push(val);
      return `\x00STASH_${idx}\x00`;
    };

    let out = text;

    // 1. Display Math
    out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => pushStash(`<div class="math-display"><code>$$${eq}$$</code></div>`));

    // 2. Inline Math
    out = out.replace(/\$([^\$\n]+?)\$/g, (_, eq) => pushStash(`<span class="math-inline"><code>$${eq}$</code></span>`));

    // 3. Inline Code
    out = out.replace(/`([^`]+)`/g, (_, code) => pushStash(`<code>${this.escapeHtml(code)}</code>`));

    // 4. Escape remaining prose
    out = this.escapeHtml(out);

    // Bold + Italic: ***text***
    out = out.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold: **text** or __text__
    out = out.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    out = out.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    out = out.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough: ~~text~~
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Images: ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="doc-img" />');

    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Restore stashed tokens safely without $ interpretation
    for (let i = 0; i < stash.length; i++) {
      out = out.replace(`\x00STASH_${i}\x00`, () => stash[i]);
    }

    return out;
  }

  static toHtml(markdown) {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    const htmlBlocks = [];
    const ast = [];

    let inCodeBlock = false;
    let codeLang = '';
    let codeContent = [];

    let inTable = false;
    let tableRows = [];

    let inList = false;
    let listType = 'ul';
    let listItems = [];

    const flushList = () => {
      if (!inList) return;
      const tag = listType;
      const itemsHtml = listItems.map(item => `  <li>${this.parseInline(item)}</li>`).join('\n');
      htmlBlocks.push(`<${tag}>\n${itemsHtml}\n</${tag}>`);
      ast.push({ type: tag === 'ul' ? 'UnorderedList' : 'OrderedList', items: listItems });
      inList = false;
      listItems = [];
    };

    const flushTable = () => {
      if (!inTable || tableRows.length === 0) return;
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(2); // Skip separator row

      let tableHtml = '<table class="doc-table">\n  <thead>\n    <tr>\n';
      for (const col of headerRow) {
        tableHtml += `      <th>${this.parseInline(col.trim())}</th>\n`;
      }
      tableHtml += '    </tr>\n  </thead>\n  <tbody>\n';

      for (const row of dataRows) {
        tableHtml += '    <tr>\n';
        for (const col of row) {
          tableHtml += `      <td>${this.parseInline(col.trim())}</td>\n`;
        }
        tableHtml += '    </tr>\n';
      }
      tableHtml += '  </tbody>\n</table>';
      htmlBlocks.push(tableHtml);
      ast.push({ type: 'Table', headers: headerRow, rows: dataRows });
      inTable = false;
      tableRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Fenced Code Block
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          flushList();
          flushTable();
          inCodeBlock = true;
          codeLang = line.trim().substring(3).trim();
          codeContent = [];
        } else {
          inCodeBlock = false;
          const escapedCode = this.escapeHtml(codeContent.join('\n'));
          const langClass = codeLang ? ` class="language-${codeLang}"` : '';
          htmlBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
          ast.push({ type: 'FencedCode', language: codeLang, content: codeContent.join('\n') });
          codeContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // 2. Table Row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        inTable = true;
        const cols = line.trim().slice(1, -1).split('|');
        tableRows.push(cols);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // 3. Headings (# H1 to ###### H6)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const id = this.slugify(text);
        htmlBlocks.push(`<h${level} id="${id}">${this.parseInline(text)}</h${level}>`);
        ast.push({ type: 'Heading', level, text, id });
        continue;
      }

      // 4. Blockquotes
      if (line.startsWith('>')) {
        flushList();
        const text = line.substring(1).trim();
        htmlBlocks.push(`<blockquote><p>${this.parseInline(text)}</p></blockquote>`);
        ast.push({ type: 'Blockquote', text });
        continue;
      }

      // 5. Thematic Break
      if (/^(?:---|\*\*\*|___)\s*$/.test(line.trim())) {
        flushList();
        htmlBlocks.push('<hr />');
        ast.push({ type: 'ThematicBreak' });
        continue;
      }

      // 6. Lists
      const ulMatch = line.match(/^[\*\-]\s+(.*)$/);
      const olMatch = line.match(/^\d+\.\s+(.*)$/);

      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(ulMatch[1]);
        continue;
      } else if (olMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
        }
        listItems.push(olMatch[1]);
        continue;
      } else if (inList) {
        flushList();
      }

      // 7. Display Math Block
      if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length >= 4) {
        flushList();
        const mathContent = line.trim().slice(2, -2);
        htmlBlocks.push(`<div class="math-display"><code>$$${this.escapeHtml(mathContent)}$$</code></div>`);
        ast.push({ type: 'DisplayMath', content: mathContent });
        continue;
      }

      // 8. Paragraph
      if (line.trim().length > 0) {
        htmlBlocks.push(`<p>${this.parseInline(line.trim())}</p>`);
        ast.push({ type: 'Paragraph', text: line.trim() });
      }
    }

    flushList();
    flushTable();

    return {
      html: htmlBlocks.join('\n\n'),
      ast
    };
  }
}

/**
 * RFC 4180 Compliant CSV & Delimited Data Transformer
 */
class CsvTransformer {
  static parse(csvString, delimiter = ',') {
    if (!csvString || typeof csvString !== 'string') return [];
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
      const ch = csvString[i];
      const nextCh = csvString[i + 1];

      if (ch === '"') {
        if (inQuotes && nextCh === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
        if (ch === '\r' && nextCh === '\n') i++; // Skip \r\n
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  static csvToJson(csvString, delimiter = ',') {
    const rows = this.parse(csvString, delimiter);
    if (rows.length < 2) return [];

    const headers = rows[0];
    const data = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const val = row[c] !== undefined ? row[c] : '';
        // Auto convert numbers or booleans
        if (val === 'true') obj[headers[c]] = true;
        else if (val === 'false') obj[headers[c]] = false;
        else if (!isNaN(Number(val)) && val !== '') obj[headers[c]] = Number(val);
        else obj[headers[c]] = val;
      }
      data.push(obj);
    }

    return data;
  }

  static jsonToCsv(jsonArray, delimiter = ',') {
    if (!Array.isArray(jsonArray) || jsonArray.length === 0) return '';
    const headers = Object.keys(jsonArray[0]);

    const escapeField = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeField).join(delimiter);
    const dataLines = jsonArray.map(obj => {
      return headers.map(h => escapeField(obj[h])).join(delimiter);
    });

    return [headerLine, ...dataLines].join('\n');
  }

  static csvToMarkdownTable(csvString, delimiter = ',') {
    const rows = this.parse(csvString, delimiter);
    if (rows.length === 0) return '';

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const headerLine = '| ' + headers.join(' | ') + ' |';
    const dividerLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const rowLines = dataRows.map(r => '| ' + r.join(' | ') + ' |');

    return [headerLine, dividerLine, ...rowLines].join('\n');
  }
}

/**
 * Native YAML & JSON Transpiler (Zero External Dependencies)
 */
class YamlJsonTransformer {
  static jsonToYaml(obj, indent = 0) {
    const pad = ' '.repeat(indent);
    if (obj === null || obj === undefined) return pad + 'null\n';
    if (typeof obj === 'boolean' || typeof obj === 'number') return pad + obj + '\n';
    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj === '') {
        return pad + `"${obj.replace(/"/g, '\\"')}"\n`;
      }
      return pad + obj + '\n';
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return pad + '[]\n';
      let yaml = '';
      for (const item of obj) {
        if (typeof item === 'object' && item !== null) {
          yaml += pad + '-\n' + this.jsonToYaml(item, indent + 2);
        } else {
          yaml += pad + '- ' + item + '\n';
        }
      }
      return yaml;
    }

    let yaml = '';
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'object' && v !== null) {
        yaml += `${pad}${k}:\n${this.jsonToYaml(v, indent + 2)}`;
      } else {
        yaml += `${pad}${k}: ${this.jsonToYaml(v, 0)}`;
      }
    }
    return yaml;
  }

  static yamlToJson(yamlString) {
    if (!yamlString || typeof yamlString !== 'string') return {};
    const lines = yamlString.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
    const root = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        let val = line.substring(colonIdx + 1).trim();

        // Strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        } else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null') val = null;
        else if (!isNaN(Number(val)) && val !== '') val = Number(val);

        root[key] = val;
      }
    }
    return root;
  }
}

/**
 * Myers / Longest Common Subsequence (LCS) Line Diff Engine
 */
class DiffEngine {
  static computeDiff(textA, textB) {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');

    // LCS Matrix
    const n = linesA.length;
    const m = linesB.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build diff hunks
    const hunks = [];
    let i = n;
    let j = m;
    let added = 0;
    let deleted = 0;
    let unchanged = 0;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        hunks.unshift({ type: 'UNCHANGED', line: linesA[i - 1] });
        unchanged++;
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        hunks.unshift({ type: 'ADDED', line: linesB[j - 1] });
        added++;
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        hunks.unshift({ type: 'DELETED', line: linesA[i - 1] });
        deleted++;
        i--;
      }
    }

    const unifiedDiff = hunks.map(h => {
      if (h.type === 'ADDED') return `+ ${h.line}`;
      if (h.type === 'DELETED') return `- ${h.line}`;
      return `  ${h.line}`;
    }).join('\n');

    return {
      identical: added === 0 && deleted === 0,
      stats: { added, deleted, unchanged, totalLines: hunks.length },
      hunks,
      unifiedDiff
    };
  }
}

/**
 * Universal Document Transformer Coordinator
 */
class DocumentTransformer {
  constructor() {
    this.subscribers = new Set();
    this.totalTransformations = 0;
    this.startTime = Date.now();
  }

  markdownToHtml(md) {
    this.totalTransformations++;
    const res = MarkdownTranspiler.toHtml(md);
    this.broadcastEvent('transformed_markdown', { length: md.length });
    return res;
  }

  csvToJson(csv) {
    this.totalTransformations++;
    return CsvTransformer.csvToJson(csv);
  }

  jsonToCsv(json) {
    this.totalTransformations++;
    return CsvTransformer.jsonToCsv(json);
  }

  csvToMarkdownTable(csv) {
    this.totalTransformations++;
    return CsvTransformer.csvToMarkdownTable(csv);
  }

  jsonToYaml(json) {
    this.totalTransformations++;
    return YamlJsonTransformer.jsonToYaml(json);
  }

  yamlToJson(yaml) {
    this.totalTransformations++;
    return YamlJsonTransformer.yamlToJson(yaml);
  }

  diffDocuments(textA, textB) {
    this.totalTransformations++;
    return DiffEngine.computeDiff(textA, textB);
  }

  computeMetrics(text) {
    return TextMetricsEngine.analyze(text);
  }

  subscribe(res) {
    this.subscribers.add(res);
    res.on('close', () => this.subscribers.delete(res));
  }

  broadcastEvent(eventType, payload) {
    const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.subscribers) {
      try { res.write(data); } catch (e) { this.subscribers.delete(res); }
    }
  }

  metrics() {
    return {
      totalTransformations: this.totalTransformations,
      subscribers: this.subscribers.size,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

module.exports = {
  TextMetricsEngine,
  MarkdownTranspiler,
  CsvTransformer,
  YamlJsonTransformer,
  DiffEngine,
  DocumentTransformer
};