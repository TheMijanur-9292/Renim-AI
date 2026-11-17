import React, { useState } from 'react';
import { SMART_NOTE_TEMPLATES } from '../../services/powerups';

export interface NotesViewProps {
  isActive: boolean;
  handleNewNote: () => void;
  filteredNotes: any[];
  activeNoteId: string | null;
  selectNote: (n: any) => void;
  stripHtmlPreview: (html: string) => string;
  noteTitle: string;
  setNoteTitle: (t: string) => void;
  noteEditorRef: React.RefObject<HTMLDivElement>;
  noteContent: string;
  setNoteContent: (c: string) => void;
  triggerNoteSave: (title: string, html: string) => void;
  execEditorCmd: (cmd: string, val?: string) => void;
  noteLineSpacing: string;
  setNoteLineSpacing: (s: string) => void;
  handleInsertLink: () => void;
  handleInsertTable: () => void;
  handleInsertImage: () => void;
  handleInsertCodeBlock: () => void;
  noteSpellCheck: boolean;
  setNoteSpellCheck: (sc: boolean) => void;
  isVoiceDictating: boolean;
  toggleVoiceDictation: () => void;
  voiceDictationLang: 'bn-BD' | 'en-US';
  setVoiceDictationLang: (lang: 'bn-BD' | 'en-US') => void;
  handleNotePaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  noteSaveStatus: string;
  handleDeleteNote: () => void;
  noteSaveTimerRef: React.MutableRefObject<any>;
  persistNoteNow: (title: string, html: string, showToastFeedback?: boolean) => Promise<any>;
  handleNoteAI: (action: string) => void;
  handleOpenEmailModal: (type: 'note' | 'general') => void;
  handleExportPDF: () => void;
  handleExportMarkdown: () => void;
  setShowShareModal: (show: boolean) => void;
  onPublicShareNote?: () => void;
  onToggleTeamVisibility?: () => void;
  hasActiveOrg?: boolean;
}

export const NotesView: React.FC<NotesViewProps> = ({
  isActive,
  handleNewNote,
  filteredNotes,
  activeNoteId,
  selectNote,
  stripHtmlPreview,
  noteTitle,
  setNoteTitle,
  noteEditorRef,
  noteContent,
  setNoteContent,
  triggerNoteSave,
  execEditorCmd,
  noteLineSpacing,
  setNoteLineSpacing,
  handleInsertLink,
  handleInsertTable,
  handleInsertImage,
  handleInsertCodeBlock,
  noteSpellCheck,
  setNoteSpellCheck,
  isVoiceDictating,
  toggleVoiceDictation,
  voiceDictationLang,
  setVoiceDictationLang,
  handleNotePaste,
  noteSaveStatus,
  handleDeleteNote,
  noteSaveTimerRef,
  persistNoteNow,
  handleNoteAI,
  handleOpenEmailModal,
  handleExportPDF,
  handleExportMarkdown,
  setShowShareModal,
  onPublicShareNote,
  onToggleTeamVisibility,
  hasActiveOrg,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div id="view-notes" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="notes-layout">
        {/* Left: Notes List */}
        <div className="notes-list-pane">
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              className="mui-btn mui-btn-primary mui-btn-sm"
              id="btn-new-note"
              style={{ flex: 1 }}
              onClick={handleNewNote}
            >
              <span className="material-symbols-rounded icon-sm">add</span>
              <span>New Note</span>
            </button>
            <button
              className={`mui-btn mui-btn-sm ${showTemplates ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
              title="1-Click Smart Note Templates"
              onClick={() => setShowTemplates((v) => !v)}
            >
              <span className="material-symbols-rounded icon-sm">dashboard_customize</span>
            </button>
          </div>
          {showTemplates && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', padding: '8px', borderRadius: '8px', border: '1px solid var(--mui-border)', background: 'var(--mui-bg-paper)' }}>
              <span className="muted-sm" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>1-CLICK TEMPLATES</span>
              {SMART_NOTE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  className="mui-btn mui-btn-outlined mui-btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: '12px', padding: '5px 8px' }}
                  onClick={() => {
                    handleNewNote();
                    setTimeout(() => {
                      setNoteTitle(tpl.title);
                      setNoteContent(tpl.content);
                      if (noteEditorRef.current) {
                        noteEditorRef.current.innerHTML = tpl.content;
                      }
                      triggerNoteSave();
                    }, 30);
                    setShowTemplates(false);
                  }}
                >
                  <span className="material-symbols-rounded icon-sm" style={{ fontSize: '15px' }}>{tpl.icon}</span>
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          )}
          <div id="notes-list-container">
            {filteredNotes.length === 0 ? (
              <p className="user-status">No notes yet. Click New Note to begin.</p>
            ) : (
              filteredNotes.map(n => (
                <div
                  key={n.id}
                  className={`note-item-card ${activeNoteId === n.id ? 'active' : ''}`}
                  onClick={() => selectNote(n)}
                  style={{ marginBottom: '8px' }}
                >
                  <div className="note-item-title">{n.title || 'Untitled Note'}</div>
                  <div className="note-item-preview">{stripHtmlPreview(n.content || '') || 'Empty note...'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: Note Editor */}
        <div className="note-editor-pane">
          <input
            type="text"
            id="note-title-input"
            className="note-title-input"
            placeholder="Note Title..."
            value={noteTitle}
            onChange={e => {
              const val = e.target.value;
              setNoteTitle(val);
              const currentHtml = noteEditorRef.current ? noteEditorRef.current.innerHTML : noteContent;
              triggerNoteSave(val, currentHtml);
            }}
          />

          {/* Rich Formatting Toolbar */}
          <div className="rte-toolbar" role="toolbar" aria-label="Note formatting toolbar">
            {/* Undo / Redo */}
            <button type="button" className="rte-btn" title="Undo (Ctrl+Z)" onClick={() => execEditorCmd('undo')}>
              <span className="material-symbols-rounded">undo</span>
            </button>
            <button type="button" className="rte-btn" title="Redo (Ctrl+Y)" onClick={() => execEditorCmd('redo')}>
              <span className="material-symbols-rounded">redo</span>
            </button>

            <span className="rte-divider" />

            {/* Bold / Italic / Underline / Strikethrough */}
            <button type="button" className="rte-btn" title="Bold (Ctrl+B)" onClick={() => execEditorCmd('bold')}>
              <span className="material-symbols-rounded">format_bold</span>
            </button>
            <button type="button" className="rte-btn" title="Italic (Ctrl+I)" onClick={() => execEditorCmd('italic')}>
              <span className="material-symbols-rounded">format_italic</span>
            </button>
            <button type="button" className="rte-btn" title="Underline (Ctrl+U)" onClick={() => execEditorCmd('underline')}>
              <span className="material-symbols-rounded">format_underlined</span>
            </button>
            <button type="button" className="rte-btn" title="Strikethrough" onClick={() => execEditorCmd('strikeThrough')}>
              <span className="material-symbols-rounded">strikethrough_s</span>
            </button>

            <span className="rte-divider" />

            {/* Font Family */}
            <select
              className="rte-select"
              title="Font Family"
              defaultValue="Inter"
              onChange={e => execEditorCmd('fontName', e.target.value)}
            >
              <option value="Inter">Font</option>
              <option value="Inter">Inter Sans</option>
              <option value="Plus Jakarta Sans">Jakarta Sans</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Georgia">Serif</option>
            </select>

            {/* Font Size */}
            <select
              className="rte-select"
              title="Font Size"
              defaultValue="3"
              onChange={e => execEditorCmd('fontSize', e.target.value)}
            >
              <option value="1">8</option>
              <option value="2">10</option>
              <option value="3">12</option>
              <option value="4">14</option>
              <option value="5">18</option>
              <option value="6">24</option>
            </select>

            {/* Line Spacing & Block Style */}
            <select
              className="rte-select"
              title="Line Spacing & Paragraph Style"
              value={noteLineSpacing}
              onChange={e => {
                const val = e.target.value;
                if (val.startsWith('H') || val === 'P') {
                  execEditorCmd('formatBlock', val);
                } else {
                  setNoteLineSpacing(val);
                }
              }}
            >
              <option value="1.2">(1.2) Tight</option>
              <option value="1.65">(1.5) Normal</option>
              <option value="2.0">(2.0) Relaxed</option>
              <option value="H1">Heading 1</option>
              <option value="H2">Heading 2</option>
              <option value="H3">Heading 3</option>
              <option value="P">Paragraph</option>
            </select>

            <span className="rte-divider" />

            {/* Alignment */}
            <button type="button" className="rte-btn" title="Align Left" onClick={() => execEditorCmd('justifyLeft')}>
              <span className="material-symbols-rounded">format_align_left</span>
            </button>
            <button type="button" className="rte-btn" title="Align Center" onClick={() => execEditorCmd('justifyCenter')}>
              <span className="material-symbols-rounded">format_align_center</span>
            </button>

            {/* Lists & Indent */}
            <button type="button" className="rte-btn" title="Bulleted List" onClick={() => execEditorCmd('insertUnorderedList')}>
              <span className="material-symbols-rounded">format_list_bulleted</span>
            </button>
            <button type="button" className="rte-btn" title="Numbered List" onClick={() => execEditorCmd('insertOrderedList')}>
              <span className="material-symbols-rounded">format_list_numbered</span>
            </button>
            <button type="button" className="rte-btn" title="Indent" onClick={() => execEditorCmd('indent')}>
              <span className="material-symbols-rounded">format_indent_increase</span>
            </button>
            <button type="button" className="rte-btn" title="Outdent" onClick={() => execEditorCmd('outdent')}>
              <span className="material-symbols-rounded">format_indent_decrease</span>
            </button>

            <span className="rte-divider" />

            {/* Superscript / Subscript */}
            <button type="button" className="rte-btn" title="Superscript (x²)" onClick={() => execEditorCmd('superscript')}>
              <span className="material-symbols-rounded">superscript</span>
            </button>
            <button type="button" className="rte-btn" title="Subscript (x₂)" onClick={() => execEditorCmd('subscript')}>
              <span className="material-symbols-rounded">subscript</span>
            </button>

            {/* Text Color & Highlight Color */}
            <label className="rte-color-wrap" title="Text Color">
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--mui-text-secondary)' }}>
                format_color_text
              </span>
              <input
                type="color"
                className="rte-color-input"
                defaultValue="#818cf8"
                onChange={e => execEditorCmd('foreColor', e.target.value)}
              />
            </label>

            <label className="rte-color-wrap" title="Highlight Background">
              <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--mui-text-secondary)' }}>
                ink_highlighter
              </span>
              <input
                type="color"
                className="rte-color-input"
                defaultValue="#fef08a"
                onChange={e => execEditorCmd('hiliteColor', e.target.value)}
              />
            </label>

            {/* Clear Formatting */}
            <button type="button" className="rte-btn" title="Clear Formatting" onClick={() => execEditorCmd('removeFormat')}>
              <span className="material-symbols-rounded">ink_eraser</span>
            </button>

            <span className="rte-divider" />

            {/* Link, Table, Horizontal Rule, Image, Code Block, Spellcheck */}
            <button type="button" className="rte-btn" title="Insert Link" onClick={handleInsertLink}>
              <span className="material-symbols-rounded">link</span>
            </button>
            <button type="button" className="rte-btn" title="Insert Table" onClick={handleInsertTable}>
              <span className="material-symbols-rounded">table_chart</span>
            </button>
            <button type="button" className="rte-btn" title="Insert Horizontal Divider" onClick={() => execEditorCmd('insertHorizontalRule')}>
              <span className="material-symbols-rounded">horizontal_rule</span>
            </button>
            <button type="button" className="rte-btn" title="Insert Image" onClick={handleInsertImage}>
              <span className="material-symbols-rounded">add_photo_alternate</span>
            </button>
            <button type="button" className="rte-btn" title="Insert Code Block" onClick={handleInsertCodeBlock}>
              <span className="material-symbols-rounded">code</span>
            </button>
            <button
              type="button"
              className={`rte-btn ${noteSpellCheck ? 'active' : ''}`}
              title="Toggle Spellcheck"
              onClick={() => setNoteSpellCheck(!noteSpellCheck)}
            >
              <span className="material-symbols-rounded">spellcheck</span>
            </button>

            <span className="rte-divider" />

            {/* Voice Dictation (Web Speech API) */}
            <button
              type="button"
              className={`rte-btn ${isVoiceDictating ? 'voice-dictating-pulse' : ''}`}
              title={isVoiceDictating ? 'Stop Voice Dictation' : 'Start Live Voice Dictation'}
              onClick={toggleVoiceDictation}
              style={isVoiceDictating ? { background: '#ef4444', color: '#ffffff' } : {}}
            >
              <span className="material-symbols-rounded">
                {isVoiceDictating ? 'mic_off' : 'mic'}
              </span>
            </button>
            <select
              className="rte-select"
              value={voiceDictationLang}
              onChange={e => setVoiceDictationLang(e.target.value as any)}
              title="Voice Dictation Language"
              style={{ fontSize: '11px', height: '26px', padding: '0 4px' }}
            >
              <option value="bn-BD">বাংলা (BN)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>

          {/* Rich ContentEditable Note Surface */}
          <div
            ref={noteEditorRef}
            id="note-content-input"
            className="note-rich-editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck={noteSpellCheck}
            style={{ lineHeight: noteLineSpacing }}
            data-placeholder="Start writing, or paste formatted notes, lists, tables, and code..."
            onInput={e => {
              const html = e.currentTarget.innerHTML;
              setNoteContent(html);
              triggerNoteSave(noteTitle, html);
            }}
            onPaste={handleNotePaste}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              borderTop: '1px solid var(--mui-border)',
              paddingTop: '12px',
            }}
          >
            <span className="user-status" id="note-save-status">{noteSaveStatus}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                id="btn-delete-note"
                onClick={handleDeleteNote}
              >
                <span className="material-symbols-rounded icon-sm">delete</span>
              </button>
              <button
                className="mui-btn mui-btn-primary mui-btn-sm"
                id="btn-manual-save-note"
                onClick={() => {
                  if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
                  const html = noteEditorRef.current ? noteEditorRef.current.innerHTML : noteContent;
                  persistNoteNow(noteTitle, html, true);
                }}
              >
                <span className="material-symbols-rounded icon-sm">save</span>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: AI Writing Assistant */}
        <div className="notes-ai-sidebar">
          <h4 className="mui-card-title">
            <span className="material-symbols-rounded">auto_awesome</span>
            <span>AI Writing Assistant</span>
          </h4>
          <button className="ai-action-btn" onClick={() => handleNoteAI('summarize')}>
            <span className="material-symbols-rounded icon-sm">summarize</span>
            <span>Summarize Note</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('action_items')}>
            <span className="material-symbols-rounded icon-sm">checklist</span>
            <span>Extract Action Items</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('professional')}>
            <span className="material-symbols-rounded icon-sm">badge</span>
            <span>Make Professional</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('fix_grammar')}>
            <span className="material-symbols-rounded icon-sm">spellcheck</span>
            <span>Fix Grammar & Style</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('expand')}>
            <span className="material-symbols-rounded icon-sm">lightbulb</span>
            <span>Brainstorm Next Steps</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('translate_bn')}>
            <span className="material-symbols-rounded icon-sm">translate</span>
            <span>Translate to Bengali (বাংলা)</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('translate_en')}>
            <span className="material-symbols-rounded icon-sm">language</span>
            <span>Translate to English (US)</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('tone_clevel')}>
            <span className="material-symbols-rounded icon-sm">workspace_premium</span>
            <span>C-Level Executive Brief</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('tone_pitch')}>
            <span className="material-symbols-rounded icon-sm">campaign</span>
            <span>Pitch Deck / Client Tone</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleNoteAI('polish_voice_memo')}>
            <span className="material-symbols-rounded icon-sm">record_voice_over</span>
            <span>Polish Spoken Dictation</span>
          </button>
          <button className="ai-action-btn" onClick={() => handleOpenEmailModal('note')}>
            <span className="material-symbols-rounded icon-sm">forward_to_inbox</span>
            <span>Draft Email / Outreach</span>
          </button>

          <div style={{ margin: '14px 0 8px 0', borderTop: '1px solid var(--mui-border)', paddingTop: '10px' }}>
            <span className="nav-section-title" style={{ padding: 0, marginBottom: '8px', display: 'block' }}>Export & Share</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={handleExportPDF} title="Print or Save as PDF">
                <span className="material-symbols-rounded icon-sm">picture_as_pdf</span>
                <span>PDF</span>
              </button>
              <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={handleExportMarkdown} title="Download Markdown .md">
                <span className="material-symbols-rounded icon-sm">download</span>
                <span>Markdown</span>
              </button>
            </div>
            <button
              className="mui-btn mui-btn-outlined mui-btn-sm"
              style={{ width: '100%', marginTop: '6px' }}
              onClick={() => setShowShareModal(true)}
            >
              <span className="material-symbols-rounded icon-sm">share</span>
              <span>Share Preview</span>
            </button>
            {onPublicShareNote && (
              <button
                className="mui-btn mui-btn-primary mui-btn-sm"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={onPublicShareNote}
              >
                <span className="material-symbols-rounded icon-sm">public</span>
                <span>Copy Public Link</span>
              </button>
            )}
            {hasActiveOrg && onToggleTeamVisibility && (
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={onToggleTeamVisibility}
              >
                <span className="material-symbols-rounded icon-sm">groups</span>
                <span>Share to Team Feed</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
