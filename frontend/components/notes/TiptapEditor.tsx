'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { WikiLinkHighlight } from './WikiLinkHighlight';

interface SuggestionState {
  query: string;
  replaceFrom: number;
  x: number;
  y: number;
}

interface NoteRef {
  id: number;
  title: string;
}

interface TiptapEditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

function Sep() {
  return <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5 self-center" />;
}

function Btn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function TiptapEditor({ initialContent, onChange, placeholder }: TiptapEditorProps) {
  const initialRef = useRef(initialContent);

  // Suggestion state
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [suggestItems, setSuggestItems] = useState<NoteRef[]>([]);
  const [suggestIdx, setSuggestIdx] = useState(0);

  // Refs to avoid stale closures in handleKeyDown (called from within useEditor)
  const suggestionActiveRef = useRef(false);
  const suggestItemsRef = useRef<NoteRef[]>([]);
  const suggestIdxRef = useRef(0);
  const selectFnRef = useRef<((item: NoteRef) => void) | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state
  useEffect(() => { suggestItemsRef.current = suggestItems; }, [suggestItems]);
  useEffect(() => { suggestIdxRef.current = suggestIdx; }, [suggestIdx]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { languageClassPrefix: 'language-' } }),
      Markdown.configure({ transformPastedText: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      WikiLinkHighlight,
    ],
    content: initialRef.current,
    editorProps: {
      attributes: {
        class: 'ProseMirror px-3 py-2 text-sm text-gray-900 dark:text-gray-100 prose prose-sm max-w-none dark:prose-invert',
      },
      handleKeyDown(_view, event) {
        if (!suggestionActiveRef.current || suggestItemsRef.current.length === 0) return false;
        if (event.key === 'Escape') {
          setSuggestion(null); setSuggestItems([]); suggestionActiveRef.current = false;
          return true;
        }
        if (event.key === 'ArrowDown') {
          const next = Math.min(suggestIdxRef.current + 1, suggestItemsRef.current.length - 1);
          setSuggestIdx(next); suggestIdxRef.current = next;
          return true;
        }
        if (event.key === 'ArrowUp') {
          const prev = Math.max(suggestIdxRef.current - 1, 0);
          setSuggestIdx(prev); suggestIdxRef.current = prev;
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = suggestItemsRef.current[suggestIdxRef.current];
          if (item && selectFnRef.current) { selectFnRef.current(item); return true; }
        }
        return false;
      },
    },
    onUpdate({ editor: e }) {
      // tiptap-markdown escapes [ as \[ in text, which breaks [[wiki]] links.
      // Unescape \[\[title\]\] back to [[title]] before storing.
      const md = e.storage.markdown.getMarkdown()
        .replace(/\\\[\\\[([^\]]+)\\\]\\\]/g, '[[$1]]');
      onChange(md);

      // Detect open [[...]] pattern before cursor
      const { state } = e;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 200), from, '\n', '\0');
      const match = /\[\[([^\]\n]*)$/.exec(textBefore);

      if (match) {
        const query = match[1];
        const coords = e.view.coordsAtPos(from);
        setSuggestion({ query, replaceFrom: from - match[0].length, x: coords.left, y: coords.bottom + 4 });
        suggestionActiveRef.current = true;

        if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = setTimeout(async () => {
          try {
            const res = await api.get<NoteRef[]>('/api/notes/resolve', { params: { q: query, limit: 8 } });
            setSuggestItems(res.data); suggestItemsRef.current = res.data;
            setSuggestIdx(0); suggestIdxRef.current = 0;
          } catch {
            setSuggestItems([]); suggestItemsRef.current = [];
          }
        }, 150);
      } else {
        setSuggestion(null); setSuggestItems([]);
        suggestionActiveRef.current = false;
        if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      }
    },
  });

  // Keep selectFnRef current with latest editor + suggestion
  useEffect(() => {
    selectFnRef.current = (item: NoteRef) => {
      if (!editor || !suggestion) return;
      const to = editor.state.selection.from;
      editor.chain().focus()
        .deleteRange({ from: suggestion.replaceFrom, to })
        .insertContent(`[[${item.title}]]`)
        .run();
      setSuggestion(null); setSuggestItems([]);
      suggestItemsRef.current = []; suggestionActiveRef.current = false;
    };
  }, [editor, suggestion]);

  const handleLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="relative">
      <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <Btn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold (Ctrl+B)">
            <strong>B</strong>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic (Ctrl+I)">
            <em>I</em>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
            <s>S</s>
          </Btn>
          <Btn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} title="Inline code">
            {`\``}
          </Btn>
          <Sep />
          <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">H1</Btn>
          <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">H2</Btn>
          <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">H3</Btn>
          <Sep />
          <Btn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list">•–</Btn>
          <Btn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered list">1.</Btn>
          <Btn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive('taskList')} title="Task list">☑</Btn>
          <Sep />
          <Btn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">&ldquo;</Btn>
          <Btn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code block">{`</>`}</Btn>
          <Btn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</Btn>
          <Sep />
          <Btn onClick={handleLink} active={editor?.isActive('link')} title="Link">🔗</Btn>
          <Sep />
          <Btn onClick={() => editor?.chain().focus().insertContent('[[').run()} title="Wiki link [[">[[</Btn>
        </div>

        <EditorContent
          editor={editor}
          placeholder={placeholder}
          className="bg-white dark:bg-gray-700"
        />
      </div>

      {/* Wiki-link suggestion dropdown */}
      {suggestion && suggestItems.length > 0 && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px] max-w-[320px]"
          style={{ left: suggestion.x, top: suggestion.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestItems.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectFnRef.current?.(item)}
              className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${
                i === suggestIdx
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
