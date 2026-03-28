import { describe, it, expect } from 'vitest';
import {
  parseInlineMarks,
  parseParagraph,
  parseHeading,
  parseBlockquote,
  parseCodeBlock,
  parseTable,
  parseImage,
  createSubscribeWidget,
  createPaywall,
  createButton,
  markdownToProseMirror,
  buildParagraph,
  buildCaptionedImage,
  buildSubscribeWidget,
  extractYouTubeId,
  getNodeText,
  isFooterParagraph,
  splitMarkdownTableRow,
  isMarkdownTableSeparatorRow,
  parseMarkdownTableLines,
  normalizeTableHeader,
  stripTableMarkdown,
  classifyMarkdownTableForInline,
  assertInlineTableAllowed,
  ensureSubscribeButtons,
  ensureHeroFirstImage,
  validateProseMirrorBody,
  findUnknownNodeTypes,
  extractMetaFromMarkdown,
  DEFAULT_SUBSCRIBE_CAPTION,
  FOOTER_PARAGRAPH_PATTERNS,
  KNOWN_SUBSTACK_NODE_TYPES,
  type ProseMirrorDoc,
  type ProseMirrorNode,
} from '../../src/services/prosemirror.js';

// ─── Inline marks ────────────────────────────────────────────────────────────

describe('parseInlineMarks', () => {
  it('returns plain text with no marks', () => {
    const result = parseInlineMarks('hello world');
    expect(result).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('parses bold (**text**)', () => {
    const result = parseInlineMarks('before **bold** after');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', text: 'before ' });
    expect(result[1]).toEqual({ type: 'text', text: 'bold', marks: [{ type: 'strong' }] });
    expect(result[2]).toEqual({ type: 'text', text: ' after' });
  });

  it('parses italic (*text*)', () => {
    const result = parseInlineMarks('before *italic* after');
    expect(result[1]).toEqual({ type: 'text', text: 'italic', marks: [{ type: 'em' }] });
  });

  it('parses italic (_text_)', () => {
    const result = parseInlineMarks('before _italic_ after');
    expect(result[1]).toEqual({ type: 'text', text: 'italic', marks: [{ type: 'em' }] });
  });

  it('parses bold+italic (***text***)', () => {
    const result = parseInlineMarks('***both***');
    expect(result[0]).toEqual({
      type: 'text',
      text: 'both',
      marks: [{ type: 'strong' }, { type: 'em' }],
    });
  });

  it('parses links [text](url)', () => {
    const result = parseInlineMarks('click [here](https://example.com) now');
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({
      type: 'text',
      text: 'here',
      marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank' } }],
    });
  });

  it('parses inline code `code`', () => {
    const result = parseInlineMarks('run `npm install` now');
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({
      type: 'text',
      text: 'npm install',
      marks: [{ type: 'code' }],
    });
  });

  it('handles multiple marks in one line', () => {
    const result = parseInlineMarks('**bold** and *italic*');
    expect(result).toHaveLength(3);
    expect(result[0].marks![0].type).toBe('strong');
    expect(result[2].marks![0].type).toBe('em');
  });

  it('returns space for empty text', () => {
    const result = parseInlineMarks('');
    expect(result).toEqual([{ type: 'text', text: ' ' }]);
  });
});

// ─── Headings ────────────────────────────────────────────────────────────────

describe('parseHeading', () => {
  it('parses h1', () => {
    const node = parseHeading('# Title');
    expect(node.type).toBe('heading');
    expect(node.attrs).toEqual({ level: 1 });
    expect(node.content![0].text).toBe('Title');
  });

  it('parses h2', () => {
    const node = parseHeading('## Section');
    expect(node.attrs).toEqual({ level: 2 });
  });

  it('parses h3', () => {
    const node = parseHeading('### Subsection');
    expect(node.attrs).toEqual({ level: 3 });
  });

  it('parses h4-h6', () => {
    expect(parseHeading('#### H4').attrs).toEqual({ level: 4 });
    expect(parseHeading('##### H5').attrs).toEqual({ level: 5 });
    expect(parseHeading('###### H6').attrs).toEqual({ level: 6 });
  });

  it('preserves inline marks in headings', () => {
    const node = parseHeading('## **Bold** Heading');
    expect(node.content!.length).toBeGreaterThan(1);
    expect(node.content![0].marks![0].type).toBe('bold');
  });

  it('falls back to paragraph for non-heading', () => {
    const node = parseHeading('not a heading');
    expect(node.type).toBe('paragraph');
  });
});

// ─── Images ──────────────────────────────────────────────────────────────────

describe('parseImage', () => {
  it('parses simple image', () => {
    const node = parseImage('![alt text](https://img.com/pic.png)');
    expect(node.type).toBe('captionedImage');
    const img = node.content![0];
    expect(img.type).toBe('image2');
    expect(img.attrs!.src).toBe('https://img.com/pic.png');
    expect(img.attrs!.alt).toBe('alt text');
  });

  it('parses image with title attribute', () => {
    const node = parseImage('![alt](https://img.com/pic.png "My caption")');
    expect(node.type).toBe('captionedImage');
    const caption = node.content![1];
    expect(caption.type).toBe('caption');
    expect(getNodeText(caption)).toBe('My caption');
  });

  it('parses image with pipe caption in alt text', () => {
    const node = parseImage('![alt text|caption here](https://img.com/pic.png)');
    const img = node.content![0];
    expect(img.attrs!.alt).toBe('alt text');
    const caption = node.content![1];
    expect(getNodeText(caption)).toBe('caption here');
  });

  it('returns paragraph for non-image line', () => {
    const node = parseImage('not an image');
    expect(node.type).toBe('paragraph');
  });
});

describe('buildCaptionedImage', () => {
  it('creates correct structure', () => {
    const node = buildCaptionedImage('https://example.com/img.png', 'Alt', 'Caption');
    expect(node.type).toBe('captionedImage');
    expect(node.content).toHaveLength(2);
    expect(node.content![0].type).toBe('image2');
    expect(node.content![1].type).toBe('caption');
  });

  it('has all required image2 attrs', () => {
    const node = buildCaptionedImage('src.png');
    const img = node.content![0];
    expect(img.attrs).toHaveProperty('src', 'src.png');
    expect(img.attrs).toHaveProperty('imageSize', 'normal');
    expect(img.attrs).toHaveProperty('belowTheFold', false);
    expect(img.attrs).toHaveProperty('topImage', false);
    expect(img.attrs).toHaveProperty('isProcessing', false);
  });
});

// ─── Tables ──────────────────────────────────────────────────────────────────

describe('table parsing', () => {
  describe('splitMarkdownTableRow', () => {
    it('splits basic row', () => {
      expect(splitMarkdownTableRow('| a | b | c |')).toEqual(['a', 'b', 'c']);
    });

    it('handles escaped pipes', () => {
      expect(splitMarkdownTableRow('| a\\|b | c |')).toEqual(['a|b', 'c']);
    });

    it('handles no leading/trailing pipes', () => {
      expect(splitMarkdownTableRow('a | b | c')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isMarkdownTableSeparatorRow', () => {
    it('accepts standard separators', () => {
      expect(isMarkdownTableSeparatorRow(['---', '---', '---'])).toBe(true);
    });

    it('accepts short separators (1+ dashes)', () => {
      expect(isMarkdownTableSeparatorRow(['-', '-'])).toBe(true);
    });

    it('accepts alignment separators', () => {
      expect(isMarkdownTableSeparatorRow([':--', '--:', ':--:'])).toBe(true);
      // CRITICAL: short separators like :-- must be valid
      expect(isMarkdownTableSeparatorRow([':--'])).toBe(true);
      expect(isMarkdownTableSeparatorRow(['--:'])).toBe(true);
    });

    it('rejects non-separator content', () => {
      expect(isMarkdownTableSeparatorRow(['abc', '---'])).toBe(false);
      expect(isMarkdownTableSeparatorRow([''])).toBe(false);
    });

    it('rejects empty array', () => {
      expect(isMarkdownTableSeparatorRow([])).toBe(false);
    });
  });

  describe('parseMarkdownTableLines', () => {
    it('parses a standard GFM table', () => {
      const result = parseMarkdownTableLines([
        '| Name | Score |',
        '| --- | --- |',
        '| Alice | 90 |',
        '| Bob | 85 |',
      ]);
      expect(result).not.toBeNull();
      expect(result!.headerRow).toEqual(['Name', 'Score']);
      expect(result!.bodyRows).toHaveLength(2);
      expect(result!.columnCount).toBe(2);
    });

    it('handles short separator dashes (:--)', () => {
      const result = parseMarkdownTableLines([
        '| Name | Score |',
        '| :-- | --: |',
        '| Alice | 90 |',
      ]);
      expect(result).not.toBeNull();
      expect(result!.bodyRows).toHaveLength(1);
    });

    it('returns null for empty input', () => {
      expect(parseMarkdownTableLines([])).toBeNull();
    });

    it('filters empty body rows', () => {
      const result = parseMarkdownTableLines([
        '| Name | Score |',
        '| --- | --- |',
        '| Alice | 90 |',
        '|  |  |',
      ]);
      expect(result!.bodyRows).toHaveLength(1);
    });
  });

  describe('parseTable', () => {
    it('converts table to bullet list for unordered tables', () => {
      const lines = [
        '| Player | Position |',
        '| --- | --- |',
        '| Smith | WR |',
        '| Jones | CB |',
      ];
      const result = parseTable(lines) as ProseMirrorNode;
      expect(result.type).toBe('bullet_list');
      expect(result.content).toHaveLength(2);
    });

    it('converts table to ordered list when priority column present', () => {
      const lines = [
        '| Priority | Player |',
        '| --- | --- |',
        '| 1 | Smith |',
        '| 2 | Jones |',
      ];
      const result = parseTable(lines) as ProseMirrorNode;
      expect(result.type).toBe('ordered_list');
      expect(result.attrs!.start).toBe(1);
    });

    it('returns paragraph for header-only table', () => {
      const lines = [
        '| Col A | Col B |',
        '| --- | --- |',
      ];
      const result = parseTable(lines) as ProseMirrorNode;
      expect(result.type).toBe('paragraph');
    });

    it('returns null for empty/invalid input', () => {
      expect(parseTable([])).toBeNull();
    });
  });

  describe('stripTableMarkdown', () => {
    it('removes bold', () => {
      expect(stripTableMarkdown('**bold**')).toBe('bold');
    });

    it('removes inline code', () => {
      expect(stripTableMarkdown('`code`')).toBe('code');
    });

    it('removes links', () => {
      expect(stripTableMarkdown('[text](url)')).toBe('text');
    });
  });
});

// ─── Block quotes ────────────────────────────────────────────────────────────

describe('parseBlockquote', () => {
  it('parses single line', () => {
    const node = parseBlockquote(['> Hello world']);
    expect(node.type).toBe('blockquote');
    expect(node.content).toHaveLength(1);
    expect(node.content![0].type).toBe('paragraph');
    expect(getNodeText(node.content![0])).toBe('Hello world');
  });

  it('joins multiple lines', () => {
    const node = parseBlockquote(['> Line one', '> Line two']);
    expect(getNodeText(node.content![0])).toBe('Line one Line two');
  });
});

// ─── Code blocks ─────────────────────────────────────────────────────────────

describe('parseCodeBlock', () => {
  it('creates code block with language', () => {
    const node = parseCodeBlock(['const x = 1;', 'const y = 2;'], 'javascript');
    expect(node.type).toBe('code_block');
    expect(node.attrs!.language).toBe('javascript');
    expect(node.content![0].text).toBe('const x = 1;\nconst y = 2;');
  });

  it('creates code block without language', () => {
    const node = parseCodeBlock(['code here']);
    expect(node.attrs!.language).toBeNull();
  });
});

// ─── Horizontal rules ────────────────────────────────────────────────────────

describe('horizontal rules in markdownToProseMirror', () => {
  it('parses --- as horizontal rule', () => {
    const doc = markdownToProseMirror('---');
    expect(doc.content.some((n) => n.type === 'horizontal_rule')).toBe(true);
  });

  it('parses *** as horizontal rule', () => {
    const doc = markdownToProseMirror('***');
    expect(doc.content.some((n) => n.type === 'horizontal_rule')).toBe(true);
  });

  it('parses ___ as horizontal rule', () => {
    const doc = markdownToProseMirror('___');
    expect(doc.content.some((n) => n.type === 'horizontal_rule')).toBe(true);
  });
});

// ─── Lists ───────────────────────────────────────────────────────────────────

describe('lists in markdownToProseMirror', () => {
  it('parses unordered list', () => {
    const doc = markdownToProseMirror('- Item one\n- Item two\n- Item three');
    const list = doc.content.find((n) => n.type === 'bullet_list');
    expect(list).toBeDefined();
    expect(list!.content).toHaveLength(3);
    expect(list!.content![0].type).toBe('list_item');
  });

  it('parses ordered list', () => {
    const doc = markdownToProseMirror('1. First\n2. Second\n3. Third');
    const list = doc.content.find((n) => n.type === 'ordered_list');
    expect(list).toBeDefined();
    expect(list!.attrs!.start).toBe(1);
    expect(list!.content).toHaveLength(3);
  });

  it('preserves ordered list start number', () => {
    const doc = markdownToProseMirror('5. Fifth item\n6. Sixth item');
    const list = doc.content.find((n) => n.type === 'ordered_list');
    expect(list!.attrs!.start).toBe(5);
  });

  it('handles list items with inline marks', () => {
    const doc = markdownToProseMirror('- **bold item**\n- *italic item*');
    const list = doc.content.find((n) => n.type === 'bullet_list');
    const firstPara = list!.content![0].content![0]; // list_item → paragraph
    expect(firstPara.content![0].marks![0].type).toBe('bold');
  });
});

// ─── Subscribe widget ────────────────────────────────────────────────────────

describe('createSubscribeWidget', () => {
  it('creates widget with default caption', () => {
    const widget = createSubscribeWidget();
    expect(widget.type).toBe('subscribeWidget');
    expect(widget.attrs!.url).toBe('%%checkout_url%%');
    const ctaCaption = widget.content![0];
    expect(ctaCaption.type).toBe('ctaCaption');
    expect(ctaCaption.content![0].text).toBe(DEFAULT_SUBSCRIBE_CAPTION);
  });

  it('creates widget with custom caption', () => {
    const widget = createSubscribeWidget('Custom caption');
    expect(widget.content![0].content![0].text).toBe('Custom caption');
  });
});

describe('ensureSubscribeButtons', () => {
  it('adds subscribe widgets to a document', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Intro paragraph' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body paragraph' }] },
        { type: 'horizontal_rule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'The NFL Lab is here.' }] },
      ],
    };
    const result = ensureSubscribeButtons(doc);
    const widgetCount = result.content.filter((n) => n.type === 'subscribeWidget').length;
    expect(widgetCount).toBeGreaterThanOrEqual(1);
  });

  it('does not add widgets if already has two', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        createSubscribeWidget(),
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
        createSubscribeWidget(),
      ],
    };
    const result = ensureSubscribeButtons(doc);
    const widgetCount = result.content.filter((n) => n.type === 'subscribeWidget').length;
    expect(widgetCount).toBe(2);
  });
});

// ─── Paywall ─────────────────────────────────────────────────────────────────

describe('createPaywall', () => {
  it('creates paywall node', () => {
    const node = createPaywall();
    expect(node.type).toBe('paywall');
  });
});

// ─── Button ──────────────────────────────────────────────────────────────────

describe('createButton', () => {
  it('creates button with text and url', () => {
    const node = createButton('Click me', 'https://example.com');
    expect(node.type).toBe('button');
    expect(node.attrs!.text).toBe('Click me');
    expect(node.attrs!.url).toBe('https://example.com');
  });
});

// ─── Full document conversion ────────────────────────────────────────────────

describe('markdownToProseMirror', () => {
  it('produces a doc with correct type', () => {
    const doc = markdownToProseMirror('Hello world');
    expect(doc.type).toBe('doc');
    expect(doc.attrs).toEqual({ schemaVersion: 'v1' });
  });

  it('converts paragraphs', () => {
    const doc = markdownToProseMirror('Hello world');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('paragraph');
    expect(getNodeText(doc.content[0])).toBe('Hello world');
  });

  it('converts headings', () => {
    const doc = markdownToProseMirror('## Section Title');
    expect(doc.content[0].type).toBe('heading');
    expect(doc.content[0].attrs!.level).toBe(2);
  });

  it('converts images', () => {
    const doc = markdownToProseMirror('![hero](https://img.com/hero.png)');
    expect(doc.content[0].type).toBe('captionedImage');
  });

  it('converts tables', () => {
    const md = '| Name | Score |\n| --- | --- |\n| Alice | 90 |';
    const doc = markdownToProseMirror(md);
    // Tables become lists in Substack conversion
    const hasList = doc.content.some((n) => n.type === 'bullet_list' || n.type === 'ordered_list');
    expect(hasList).toBe(true);
  });

  it('converts blockquotes', () => {
    const doc = markdownToProseMirror('> A wise quote');
    expect(doc.content[0].type).toBe('blockquote');
  });

  it('converts code blocks', () => {
    const doc = markdownToProseMirror('```javascript\nconst x = 1;\n```');
    const codeBlock = doc.content.find((n) => n.type === 'code_block');
    expect(codeBlock).toBeDefined();
    expect(codeBlock!.attrs!.language).toBe('javascript');
    expect(codeBlock!.content![0].text).toBe('const x = 1;');
  });

  it('converts YouTube embeds', () => {
    const doc = markdownToProseMirror('::youtube dQw4w9WgXcQ');
    expect(doc.content[0].type).toBe('youtube2');
    expect(doc.content[0].attrs!.videoId).toBe('dQw4w9WgXcQ');
  });

  it('converts subscribe directive', () => {
    const doc = markdownToProseMirror('::subscribe Custom message');
    expect(doc.content[0].type).toBe('subscribeWidget');
  });

  it('handles mixed content', () => {
    const md = [
      '# Title',
      '',
      'A paragraph.',
      '',
      '## Section',
      '',
      '- Item one',
      '- Item two',
      '',
      '> A quote',
      '',
      '---',
      '',
      '![img](https://example.com/img.png)',
    ].join('\n');

    const doc = markdownToProseMirror(md);
    const types = doc.content.map((n) => n.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('bullet_list');
    expect(types).toContain('blockquote');
    expect(types).toContain('horizontal_rule');
    expect(types).toContain('captionedImage');
  });

  it('strips HTML comments', () => {
    const doc = markdownToProseMirror('Hello <!-- comment --> world');
    expect(getNodeText(doc.content[0])).toBe('Hello  world');
  });

  it('handles CRLF line endings', () => {
    const doc = markdownToProseMirror('# Title\r\n\r\nParagraph\r\n');
    expect(doc.content[0].type).toBe('heading');
    expect(doc.content[1].type).toBe('paragraph');
  });

  it('handles TL;DR blockquote with bullet list', () => {
    const md = '> **TLDR**\n> - Point one\n> - Point two';
    const doc = markdownToProseMirror(md);
    const para = doc.content.find((n) => n.type === 'paragraph');
    const list = doc.content.find((n) => n.type === 'bullet_list');
    expect(para).toBeDefined();
    expect(list).toBeDefined();
  });

  it('preview mode collects warnings instead of throwing for dense tables', () => {
    const md = [
      '| Player | AAV | Cap Hit | Dead Cap | Bonus | Cash |',
      '| --- | --- | --- | --- | --- | --- |',
      '| Smith | $10M | $12M | $8M | $4M | $10M |',
      '| Jones | $15M | $18M | $12M | $6M | $15M |',
    ].join('\n');
    const doc = markdownToProseMirror(md, { previewMode: true });
    expect(doc._warnings).toBeDefined();
    expect(doc._warnings!.length).toBeGreaterThan(0);
    expect(doc._warnings![0].type).toBe('dense_table');
  });
});

// ─── Footer pattern detection ────────────────────────────────────────────────

describe('isFooterParagraph', () => {
  it('detects "The NFL Lab" pattern', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'The NFL Lab brings you analysis.' }],
    };
    expect(isFooterParagraph(node)).toBe(true);
  });

  it('detects "Want us to evaluate" pattern', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Want us to evaluate your team?' }],
    };
    expect(isFooterParagraph(node)).toBe(true);
  });

  it('detects "virtual front office" pattern', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Your virtual front office awaits.' }],
    };
    expect(isFooterParagraph(node)).toBe(true);
  });

  it('rejects non-footer paragraphs', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Regular paragraph content.' }],
    };
    expect(isFooterParagraph(node)).toBe(false);
  });

  it('rejects non-paragraph nodes', () => {
    const node: ProseMirrorNode = { type: 'heading', content: [{ type: 'text', text: 'The NFL Lab' }] };
    expect(isFooterParagraph(node)).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isFooterParagraph(null)).toBe(false);
    expect(isFooterParagraph(undefined)).toBe(false);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty markdown', () => {
    const doc = markdownToProseMirror('');
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(0);
  });

  it('handles markdown with only whitespace', () => {
    const doc = markdownToProseMirror('   \n\n   \n');
    expect(doc.content).toHaveLength(0);
  });

  it('handles markdown with only newlines', () => {
    const doc = markdownToProseMirror('\n\n\n');
    expect(doc.content).toHaveLength(0);
  });

  it('handles nested marks (bold inside link is treated separately)', () => {
    // The regex parser handles these sequentially, not nested
    const result = parseInlineMarks('**bold** and [link](url)');
    expect(result).toHaveLength(3);
    expect(result[0].marks![0].type).toBe('strong');
    expect(result[2].marks![0].type).toBe('link');
  });

  it('contiguous paragraph lines are joined', () => {
    const doc = markdownToProseMirror('Line one\nLine two\nLine three');
    expect(doc.content).toHaveLength(1);
    expect(getNodeText(doc.content[0])).toBe('Line one Line two Line three');
  });
});

// ─── YouTube ─────────────────────────────────────────────────────────────────

describe('extractYouTubeId', () => {
  it('extracts bare 11-char ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from full URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for invalid input', () => {
    expect(extractYouTubeId('not a valid video id at all')).toBeNull();
  });
});

// ─── getNodeText ─────────────────────────────────────────────────────────────

describe('getNodeText', () => {
  it('returns text from text node', () => {
    expect(getNodeText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(getNodeText(null)).toBe('');
  });

  it('recursively extracts text from children', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(getNodeText(node)).toBe('hello world');
  });
});

// ─── Hero image safety ──────────────────────────────────────────────────────

describe('ensureHeroFirstImage', () => {
  it('returns safe when no images', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No images' }] }],
    };
    expect(ensureHeroFirstImage(doc).safe).toBe(true);
  });

  it('returns safe when first image is not a chart', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [buildCaptionedImage('https://img.com/hero.png', 'hero')],
    };
    expect(ensureHeroFirstImage(doc).safe).toBe(true);
  });

  it('swaps chart image with safe candidate', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        buildCaptionedImage('https://img.com/table-comparison.png', 'comparison table'),
        { type: 'paragraph', content: [{ type: 'text', text: 'Middle' }] },
        buildCaptionedImage('https://img.com/hero-inline-1.png', 'hero'),
      ],
    };
    const result = ensureHeroFirstImage(doc);
    expect(result.safe).toBe(true);
    expect(result.warning).toContain('swapped');
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe('validateProseMirrorBody', () => {
  it('validates a correct document', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        buildCaptionedImage('src.png', 'alt'),
        createSubscribeWidget(),
      ],
    };
    const result = validateProseMirrorBody(doc);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects unknown node types', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'unknownType', content: [] }],
    };
    const result = validateProseMirrorBody(doc);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('unknownType');
  });
});

describe('findUnknownNodeTypes', () => {
  it('returns empty for known types', () => {
    const node: ProseMirrorNode = { type: 'paragraph', content: [{ type: 'text', text: 'ok' }] };
    expect(findUnknownNodeTypes(node)).toHaveLength(0);
  });

  it('finds unknown types in nested content', () => {
    const node: ProseMirrorNode = {
      type: 'doc',
      content: [{ type: 'badNode', content: [] }],
    };
    const result = findUnknownNodeTypes(node);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('badNode');
  });
});

// ─── Meta extraction ─────────────────────────────────────────────────────────

describe('extractMetaFromMarkdown', () => {
  it('extracts title and subtitle', () => {
    const md = '# My Title\n*My subtitle*\n\nBody text';
    const result = extractMetaFromMarkdown(md);
    expect(result.title).toBe('My Title');
    expect(result.subtitle).toBe('My subtitle');
    expect(result.bodyMarkdown).toContain('Body text');
  });

  it('extracts title without subtitle', () => {
    const md = '# Only Title\n\nBody here';
    const result = extractMetaFromMarkdown(md);
    expect(result.title).toBe('Only Title');
    expect(result.subtitle).toBeNull();
  });

  it('handles no title', () => {
    const md = 'Just body text';
    const result = extractMetaFromMarkdown(md);
    expect(result.title).toBeNull();
    expect(result.subtitle).toBeNull();
  });

  it('strips leading separator after title', () => {
    const md = '# Title\n*Sub*\n\n---\n\nBody';
    const result = extractMetaFromMarkdown(md);
    expect(result.bodyMarkdown.trim()).toBe('Body');
  });
});

// ─── Dense table blocking ────────────────────────────────────────────────────

describe('assertInlineTableAllowed', () => {
  it('does not throw for simple table', () => {
    const table = parseMarkdownTableLines([
      '| Name | Team |',
      '| --- | --- |',
      '| Smith | SEA |',
    ]);
    expect(() => assertInlineTableAllowed(table, 1)).not.toThrow();
  });

  it('throws for dense table with financial headers', () => {
    const table = parseMarkdownTableLines([
      '| Player | AAV | Cap Hit | Dead Cap | Bonus | Cash |',
      '| --- | --- | --- | --- | --- | --- |',
      '| Smith | $10M | $12M | $8M | $4M | $10M |',
      '| Jones | $15M | $18M | $12M | $6M | $15M |',
    ]);
    expect(() => assertInlineTableAllowed(table, 1)).toThrow(/Dense markdown table blocked/);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('DEFAULT_SUBSCRIBE_CAPTION is defined', () => {
    expect(DEFAULT_SUBSCRIBE_CAPTION).toBeTruthy();
    expect(DEFAULT_SUBSCRIBE_CAPTION).toContain('NFL Lab');
  });

  it('FOOTER_PARAGRAPH_PATTERNS has entries', () => {
    expect(FOOTER_PARAGRAPH_PATTERNS.length).toBeGreaterThan(0);
  });

  it('KNOWN_SUBSTACK_NODE_TYPES includes essential types', () => {
    expect(KNOWN_SUBSTACK_NODE_TYPES.has('doc')).toBe(true);
    expect(KNOWN_SUBSTACK_NODE_TYPES.has('paragraph')).toBe(true);
    expect(KNOWN_SUBSTACK_NODE_TYPES.has('captionedImage')).toBe(true);
    expect(KNOWN_SUBSTACK_NODE_TYPES.has('subscribeWidget')).toBe(true);
  });
});

// ─── buildParagraph ──────────────────────────────────────────────────────────

describe('buildParagraph', () => {
  it('wraps content in paragraph', () => {
    const node = buildParagraph([{ type: 'text', text: 'Hello' }]);
    expect(node.type).toBe('paragraph');
    expect(node.content![0].text).toBe('Hello');
  });

  it('uses space text for empty content', () => {
    const node = buildParagraph([]);
    expect(node.content![0].text).toBe(' ');
  });
});

// ─── Table classification ────────────────────────────────────────────────────

describe('classifyMarkdownTableForInline', () => {
  it('allows simple 2-column table', () => {
    const table = parseMarkdownTableLines([
      '| Name | Team |',
      '| --- | --- |',
      '| Smith | SEA |',
    ]);
    expect(classifyMarkdownTableForInline(table).allowInline).toBe(true);
  });

  it('blocks dense financial table', () => {
    const table = parseMarkdownTableLines([
      '| Player | AAV | Cap Hit | Dead Cap | Bonus | Cash |',
      '| --- | --- | --- | --- | --- | --- |',
      '| Smith | $10M | $12M | $8M | $4M | $10M |',
    ]);
    expect(classifyMarkdownTableForInline(table).allowInline).toBe(false);
  });

  it('allows null table', () => {
    expect(classifyMarkdownTableForInline(null).allowInline).toBe(true);
  });
});

// ─── normalizeTableHeader ────────────────────────────────────────────────────

describe('normalizeTableHeader', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(normalizeTableHeader('Cap Hit ($)')).toBe('cap hit');
  });

  it('strips markdown', () => {
    expect(normalizeTableHeader('**Bold Header**')).toBe('bold header');
  });
});
