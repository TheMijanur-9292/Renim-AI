import React from 'react';

export interface MeetingsViewProps {
  isActive: boolean;
  waveformCanvasRef: React.RefObject<HTMLCanvasElement>;
  isMeetingRecording: boolean;
  startMeetingRecording: (source: 'mic' | 'tab') => void;
  setShowPasteModal: (show: boolean) => void;
  onUploadAudioClick: () => void;
  filteredMeetings: any[];
  activeMeetingId: string | null;
  setActiveMeetingId: (id: string | null) => void;
  activeMeeting: any | null;
  handleCopyMeetingMd: () => void;
  handleDeleteMeeting: () => void;
  liveTranscriptText: string;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  isActive,
  waveformCanvasRef,
  isMeetingRecording,
  startMeetingRecording,
  setShowPasteModal,
  onUploadAudioClick,
  filteredMeetings,
  activeMeetingId,
  setActiveMeetingId,
  activeMeeting,
  handleCopyMeetingMd,
  handleDeleteMeeting,
  liveTranscriptText,
}) => {
  return (
    <div id="view-meetings" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="meetings-layout">
        {/* Left: Recorder & Past Meetings List */}
        <div className="meetings-sidebar">
          <div className="meeting-recorder-card">
            <div className="mui-card-header">
              <h4 className="mui-card-title">
                <span className="material-symbols-rounded">graphic_eq</span>
                <span>Audio & Meeting Recorder</span>
              </h4>
            </div>

            {/* Live Audio Waveform Canvas */}
            <canvas
              ref={waveformCanvasRef}
              id="audio-waveform"
              className="canvas-waves"
              width={300}
              height={50}
            ></canvas>

            <div className="recording-controls-row">
              <button
                className="mui-btn mui-btn-primary mui-btn-sm"
                id="btn-meeting-record-toggle"
                style={{
                  flex: 1,
                  background: isMeetingRecording ? '#ef4444' : undefined,
                }}
                onClick={() => startMeetingRecording('mic')}
              >
                <span className="material-symbols-rounded icon-sm">mic</span>
                <span id="btn-record-label">
                  {isMeetingRecording ? 'Stop & Summarize' : 'Record Mic'}
                </span>
              </button>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                id="btn-meeting-tab-record"
                title="Record Chrome/Browser Tab Audio"
                onClick={() => startMeetingRecording('tab')}
              >
                <span className="material-symbols-rounded icon-sm">tab</span>
              </button>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                id="btn-meeting-paste-transcript"
                title="Paste Raw Transcript"
                onClick={() => setShowPasteModal(true)}
              >
                <span className="material-symbols-rounded icon-sm">content_paste</span>
              </button>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                title="Upload Audio File (.mp3, .wav, .m4a)"
                onClick={onUploadAudioClick}
              >
                <span className="material-symbols-rounded icon-sm">upload</span>
              </button>
            </div>
          </div>

          {/* Past Meetings Archive */}
          <div className="mui-card" style={{ flex: 1, overflowY: 'auto' }}>
            <h4 className="nav-section-title" style={{ paddingLeft: 0 }}>Meeting Archive</h4>
            <div id="meetings-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredMeetings.length === 0 ? (
                <p className="user-status">No recorded meetings yet.</p>
              ) : (
                filteredMeetings.map(m => (
                  <div
                    key={m.id}
                    className={`meeting-item-card ${activeMeetingId === m.id ? 'active' : ''}`}
                    onClick={() => setActiveMeetingId(m.id)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mui-text-primary)' }}>
                      {m.title}
                    </div>
                    <div className="user-status">
                      {new Date(m.created_at).toLocaleDateString()} • {m.action_items?.length || 0} action items
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Active Meeting Details & AI Summary */}
        <div className="meeting-detail-pane" id="meeting-detail-view">
          <div className="meeting-detail-header">
            <div>
              <h2 className="meeting-detail-title" id="meeting-view-title">
                {activeMeeting ? activeMeeting.title : 'Select a Meeting Session'}
              </h2>
              <span className="user-status" id="meeting-view-date">
                {activeMeeting
                  ? `Recorded on ${new Date(activeMeeting.created_at).toLocaleString()}`
                  : 'No session selected'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                id="btn-copy-meeting-md"
                onClick={handleCopyMeetingMd}
              >
                <span className="material-symbols-rounded icon-sm">content_copy</span>
                <span>Copy Markdown</span>
              </button>
              <button
                className="mui-btn mui-btn-outlined mui-btn-sm"
                id="btn-delete-meeting"
                onClick={handleDeleteMeeting}
              >
                <span className="material-symbols-rounded icon-sm">delete</span>
              </button>
            </div>
          </div>

          <div className="meeting-section-box">
            <h4 className="mui-card-title" style={{ marginBottom: '8px' }}>
              <span className="material-symbols-rounded">notes</span>
              <span>Executive Summary</span>
            </h4>
            <div id="meeting-view-summary" className="briefing-content">
              {activeMeeting
                ? activeMeeting.summary || 'No summary available.'
                : 'Click on any past meeting or record a new one to generate AI notes.'}
            </div>
          </div>

          <div className="meeting-section-box">
            <h4 className="mui-card-title" style={{ marginBottom: '8px' }}>
              <span className="material-symbols-rounded">check_circle</span>
              <span>Action Items & Decisions</span>
            </h4>
            <div id="meeting-view-actions">
              {activeMeeting && activeMeeting.action_items && activeMeeting.action_items.length > 0 ? (
                activeMeeting.action_items.map((a: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--mui-border)',
                    }}
                  >
                    <span
                      className="material-symbols-rounded icon-xs"
                      style={{ color: 'var(--mui-success)', verticalAlign: 'middle' }}
                    >
                      check_circle
                    </span>
                    <span>{a.task}</span>
                    <span className={`priority-badge priority-${(a.priority || 'medium').toLowerCase()}`}>
                      {a.priority || 'Medium'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="user-status">No action items recorded.</p>
              )}
            </div>
          </div>

          <div className="meeting-section-box">
            <h4 className="mui-card-title" style={{ marginBottom: '8px' }}>
              <span className="material-symbols-rounded">chat</span>
              <span>Raw Transcript Log</span>
            </h4>
            <div
              id="meeting-view-transcript"
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: 'var(--mui-text-secondary)',
              }}
            >
              {isMeetingRecording
                ? liveTranscriptText
                : activeMeeting
                ? activeMeeting.raw_transcript || 'No raw transcript stored.'
                : 'Transcript details will appear here.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
