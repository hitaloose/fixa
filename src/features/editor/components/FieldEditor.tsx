import { mergeAttributes, Node, type NodeViewRendererProps } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { type ChangeEvent, useEffect, useMemo, useRef } from "react";
import { t } from "../../../i18n/pt-BR";
import { Icon, IconButton, type IconName } from "../../../ui";
import { fromEditorHtml } from "../model/fieldHtml";

export interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  /** Saves a picked file and returns the file name to reference in the HTML. */
  storeMedia: (file: File) => Promise<string>;
  /** Display URL (blob:) for a stored file name. */
  resolveMedia: (fileName: string) => Promise<string | undefined>;
  /** When set, shows the cloze button, which creates cloze number `nextCloze`. */
  nextCloze?: number;
}

type Resolve = FieldEditorProps["resolveMedia"];

/** Media keeps its file name in the document (and the saved HTML) but displays a blob: URL. */
function mediaView(tag: "img" | "audio", resolve: { current: Resolve }) {
  return ({ node }: NodeViewRendererProps) => {
    const dom = document.createElement(tag);
    if (tag === "audio") dom.setAttribute("controls", "");
    const src = node.attrs.src as string | null;
    if (src) {
      void resolve.current(src).then((url) => {
        if (url) dom.setAttribute("src", url);
      });
    }
    return { dom };
  };
}

function extensions(resolve: { current: Resolve }) {
  const MediaImage = Image.extend({ addNodeView: () => mediaView("img", resolve) }).configure({
    inline: true,
  });
  const Audio = Node.create({
    name: "audio",
    group: "inline",
    inline: true,
    atom: true,
    addAttributes: () => ({ src: { default: null } }),
    parseHTML: () => [{ tag: "audio[src]" }],
    renderHTML: ({ HTMLAttributes }) => [
      "audio",
      mergeAttributes({ controls: "" }, HTMLAttributes),
    ],
    addNodeView: () => mediaView("audio", resolve),
  });
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      code: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      link: false,
    }),
    MediaImage,
    Audio,
  ];
}

function MediaPicker({
  icon,
  label,
  accept,
  onPick,
}: {
  icon: IconName;
  label: string;
  accept: string;
  onPick: (file: File) => void;
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPick(file);
  };
  return (
    <label className="inline-flex size-11 cursor-pointer items-center justify-center rounded-button text-ink focus-within:outline-2 focus-within:outline-primary">
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}

/** Rich-text editor for one note field (Tiptap); emits Anki-style field HTML. */
export function FieldEditor({
  label,
  value,
  onChange,
  storeMedia,
  resolveMedia,
  nextCloze,
}: FieldEditorProps) {
  const resolve = useRef(resolveMedia);
  resolve.current = resolveMedia;
  const emit = useRef(onChange);
  emit.current = onChange;
  const lastValue = useRef(value);
  const exts = useMemo(() => extensions(resolve), []);

  const editor = useEditor({
    extensions: exts,
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        class: "min-h-11 px-3 py-2.5 outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = fromEditorHtml(e.getHTML());
      lastValue.current = html;
      emit.current(html);
    },
  });

  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    lastValue.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
    }),
  });

  const insertMedia = async (file: File, kind: "image" | "audio") => {
    const src = await storeMedia(file);
    const chain = editor.chain().focus();
    if (kind === "image") chain.setImage({ src }).run();
    else chain.insertContent({ type: "audio", attrs: { src } }).run();
  };

  const wrapCloze = (n: number) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, { type: "text", text: `{{c${n}::${text}}}` })
      .run();
  };

  const mark = (name: "bold" | "italic" | "underline", icon: IconName, text: string) => (
    <IconButton
      icon={icon}
      label={text}
      aria-pressed={active?.[name] ?? false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor.chain().focus().toggleMark(name).run()}
      className="aria-pressed:bg-new-bg aria-pressed:text-primary"
    />
  );

  return (
    <div className="rounded-field border border-line bg-surface focus-within:border-primary">
      <EditorContent editor={editor} />
      <div className="flex flex-wrap items-center gap-1 border-t border-line-soft px-1">
        {mark("bold", "bold", t.editor.bold)}
        {mark("italic", "italic", t.editor.italic)}
        {mark("underline", "underline", t.editor.underline)}
        <MediaPicker
          icon="image"
          label={t.editor.addImage}
          accept="image/*"
          onPick={(f) => void insertMedia(f, "image")}
        />
        <MediaPicker
          icon="audio"
          label={t.editor.addAudio}
          accept="audio/*"
          onPick={(f) => void insertMedia(f, "audio")}
        />
        {nextCloze !== undefined && (
          <IconButton
            icon="cloze"
            label={t.editor.cloze}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => wrapCloze(nextCloze)}
          />
        )}
      </div>
    </div>
  );
}
