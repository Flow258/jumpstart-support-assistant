"use client";

import { useState, useEffect, useCallback, useRef, FC, ReactNode } from 'react';
import {
  Bot,
  Settings,
  Mic,
  Power,
  StopCircle,
  MessageSquare,
  User,
  Save,
  ChevronsRight,
  ClipboardCopy,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';

// --- CONFIGURATION ---
const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

// --- TYPE DEFINITIONS (Matching FastAPI Pydantic Models) ---
type Status = "disconnected" | "connecting" | "connected" | "recording" | "error";
type Speaker = "customer" | "agent";
type Priority = "low" | "medium" | "high";

interface AudioDevice {
  name: string;
  index: number;
}

interface ApiTranscriptEntry {
  session_id: string;
  timestamp: string;
  speaker: Speaker;
  text: string;
  is_final?: boolean;
  intent?: string;
  confidence?: number;
  priority?: Priority;
  suggested_response?: string;
  escalation_needed?: boolean;
  audio_hash?: string;
}

interface TranscriptEntry extends ApiTranscriptEntry {
  id: string;
}

interface Suggestion {
  id: string;
  priority: Priority;
  title: string;
  text: string;
}

// --- REUSABLE UI COMPONENTS ---
const Card: FC<{ children: ReactNode, className?: string }> = ({ children, className }) => (
  <div className={clsx("bg-white border border-slate-200 rounded-lg shadow-sm", className)}>
    {children}
  </div>
);

const Section: FC<{ title: string, icon: ReactNode, children: ReactNode }> = ({ title, icon, children }) => (
  <div className="p-4 border-b border-slate-200">
    <h3 className="flex items-center gap-2 font-semibold text-sm text-slate-600 mb-4">
      {icon} {title}
    </h3>
    {children}
  </div>
);

const Button: FC<{
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}> = ({ onClick, variant = 'secondary', disabled, children, className }) => {
  const baseClasses = "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };
  const disabledClasses = "disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed";

  return (
    <button onClick={onClick} disabled={disabled} className={clsx(baseClasses, variantClasses[variant], disabledClasses, className)}>
      {children}
    </button>
  );
};

const StatCard: FC<{ label: string, value: string | number }> = ({ label, value }) => (
  <div className="bg-slate-50 p-3 rounded-md text-center border border-slate-200">
    <div className="text-xl font-bold text-blue-600">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);

// --- MAIN PANEL COMPONENTS ---
const SettingsPanel: FC<{
  onStart: () => void;
  onStop: () => void;
  onSave: () => void;
  isRecording: boolean;
  devices: { customer: AudioDevice[], agent: AudioDevice[] };
  selectedDevices: { customer: string, agent: string };
  onDeviceChange: (type: 'customer' | 'agent', value: string) => void;
  selectedModel: string;
  onModelChange: (value: string) => void;
}> = ({ onStart, onStop, onSave, isRecording, devices, selectedDevices, onDeviceChange, selectedModel, onModelChange }) => (
  <div className="flex flex-col h-full bg-white">
    <div className="p-4 border-b border-slate-200">
      <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={20} /> Settings</h2>
    </div>
    <div className="flex-grow overflow-y-auto">
      <Section title="Model Selection" icon={<Bot size={16} />}>
        <div>
          <label className="text-xs font-medium text-slate-600">Transcription Model</label>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="mt-1 block w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value="tiny">Tiny (Fastest, least accurate)</option>
            <option value="base">Base</option>
            <option value="small">Small</option>
            <option value="medium">Medium (Recommended)</option>
            <option value="large">Large (Most accurate, slowest)</option>
          </select>
        </div>
      </Section>
      <Section title="Audio Setup" icon={<Mic size={16} />}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Customer Audio (Loopback/Output)</label>
            <select
              value={selectedDevices.customer}
              onChange={(e) => onDeviceChange('customer', e.target.value)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={isRecording}
            >
              <option value="">Auto-detect</option>
              {devices.customer.map(d => <option key={d.index} value={d.index}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Agent Audio (Microphone/Input)</label>
            <select
              value={selectedDevices.agent}
              onChange={(e) => onDeviceChange('agent', e.target.value)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={isRecording}
            >
              <option value="">Auto-detect</option>
              {devices.agent.map(d => <option key={d.index} value={d.index}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </Section>
      <Section title="Session Control" icon={<Power size={16} />}>
        <div className="space-y-3">
          <Button onClick={onStart} variant="primary" disabled={isRecording}>
            <ChevronsRight size={16} /> Start Session
          </Button>
          <Button onClick={onStop} variant="danger" disabled={!isRecording}>
            <StopCircle size={16} /> Stop Session
          </Button>
        </div>
      </Section>
    </div>
    <div className="p-4 border-t border-slate-200 bg-slate-50">
      <Button onClick={onSave} variant="secondary" disabled={!isRecording}>
        <Save size={16} /> Download Transcript
      </Button>
    </div>
  </div>
);

const AssistantPanel: FC<{ suggestions: Suggestion[] }> = ({ suggestions }) => {
  const priorityClasses: Record<Priority, string> = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-bold flex items-center gap-2"><Bot size={20} /> AI Assistant</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {suggestions.length === 0 ? (
          <div className="text-center text-slate-500 pt-16">
            <Bot size={40} className="mx-auto opacity-50" />
            <p className="mt-2 text-sm">AI suggestions will appear here.</p>
          </div>
        ) : (
          suggestions.map(s => (
            <Card key={s.id} className="p-3 relative group">
              <span className={clsx("absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full border", priorityClasses[s.priority])}>
                {s.priority}
              </span>
              <h4 className="font-semibold text-sm pr-16">{s.title}</h4>
              <p className="text-xs text-slate-600 mt-1">{s.text}</p>
              <button
                onClick={() => navigator.clipboard.writeText(s.text)}
                className="absolute bottom-2 right-2 p-1 rounded-md bg-slate-100 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200"
                title="Copy to clipboard"
              >
                <ClipboardCopy size={14} />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const TranscriptPanel: FC<{ entries: TranscriptEntry[], status: Status, duration: string }> = ({ entries, status, duration }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const statusInfo: Record<Status, { text: string; icon: ReactNode; classes: string }> = {
    disconnected: { text: 'Ready to connect...', icon: <Power size={14} />, classes: 'bg-slate-100 text-slate-600' },
    connecting: { text: 'Connecting to session...', icon: <Power size={14} className="animate-pulse" />, classes: 'bg-yellow-100 text-yellow-700' },
    connected: { text: 'Connected. Waiting for audio...', icon: <Mic size={14} />, classes: 'bg-blue-100 text-blue-700' },
    recording: { text: 'Live transcription in progress...', icon: <Mic size={14} className="text-red-500 animate-pulse" />, classes: 'bg-green-100 text-green-800' },
    error: { text: 'Session ended or connection failed.', icon: <AlertTriangle size={14} />, classes: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50">
      <header className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-lg font-bold">Live Transcript</h2>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-2 gap-x-4">
            <StatCard label="Duration" value={duration} />
            <StatCard label="Lines" value={entries.length} />
          </div>
        </div>
      </header>
      <div className={clsx("p-3 text-sm flex items-center gap-2 border-b border-slate-200", statusInfo[status].classes)}>
        {statusInfo[status].icon}
        {statusInfo[status].text}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {entries.length === 0 ? (
          <div className="text-center text-slate-400 pt-20">
            <MessageSquare size={48} className="mx-auto opacity-50" />
            <p className="mt-4 text-sm">Start a session to see the live transcript.</p>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="flex items-start gap-3">
              <div className={clsx(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                { "bg-blue-500 text-white": entry.speaker === 'customer', "bg-slate-600 text-white": entry.speaker === 'agent' }
              )}>
                {entry.speaker === 'customer' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm capitalize">{entry.speaker}</span>
                  <span className="text-xs text-slate-400">{entry.timestamp}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 mt-1">
                  <p className="text-sm text-slate-800">{entry.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function VoiceAssistantPage() {
  const [activePanel, setActivePanel] = useState<'assistant' | 'settings'>('assistant');
  const [status, setStatus] = useState<Status>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [devices, setDevices] = useState<{ customer: AudioDevice[], agent: AudioDevice[] }>({ customer: [], agent: [] });
  const [selectedDevices, setSelectedDevices] = useState({ customer: '', agent: '' });
  const [selectedModel, setSelectedModel] = useState('medium');
  const [duration, setDuration] = useState("00:00");
  const sessionStartTime = useRef<number | null>(null);
  const websocket = useRef<WebSocket | null>(null);

  // Fetch audio devices on component mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/devices`);
        const data = await response.json();
        setDevices({
          customer: data.speech_recognition_devices || [],
          agent: data.pyaudio_devices || [],
        });
      } catch (err) {
        console.error("Failed to fetch audio devices:", err);
        setStatus("error");
      }
    };
    fetchDevices();
  }, []);

  // Manage the session timer
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    if (status === 'recording' && sessionStartTime.current) {
      timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - (sessionStartTime.current ?? now)) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        setDuration(`${mins}:${secs}`);
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [status]);

  const handleDeviceChange = (type: 'customer' | 'agent', value: string) => {
    setSelectedDevices(prev => ({ ...prev, [type]: value }));
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data: ApiTranscriptEntry = JSON.parse(event.data);
      const entryId = data.audio_hash || `${data.session_id}-${data.timestamp}`;
      setTranscript(prev => {
        const existingIndex = prev.findIndex(entry => entry.id === entryId);
        const newEntry: TranscriptEntry = { ...data, id: entryId };
        if (existingIndex > -1) {
          const updatedTranscript = [...prev];
          updatedTranscript[existingIndex] = newEntry;
          return updatedTranscript;
        } else {
          return [...prev, newEntry];
        }
      });
      if (data.speaker === 'customer' && data.suggested_response && data.priority && data.intent) {
        const newSuggestion: Suggestion = {
          id: entryId,
          priority: data.priority,
          title: `Intent: ${data.intent}${data.escalation_needed ? ' (Escalation Needed)' : ''}`,
          text: data.suggested_response
        };
        setSuggestions(prev => [newSuggestion, ...prev.filter(s => s.id !== entryId).slice(0, 4)]);
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  };

  const handleStart = useCallback(async () => {
    if (status !== 'disconnected') return;
    setStatus('connecting');
    setTranscript([]);
    setSuggestions([]);
    setDuration("00:00");
    try {
      const config = {
        customer_device_index: selectedDevices.customer ? parseInt(selectedDevices.customer) : null,
        agent_device_index: selectedDevices.agent ? parseInt(selectedDevices.agent) : null,
        model: selectedModel,
        enable_nlp: true,
      };
      const sessionResponse = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!sessionResponse.ok) throw new Error("Failed to create session");
      const sessionData = await sessionResponse.json();
      const newSessionId = sessionData.session_id;
      setSessionId(newSessionId);
      const startResponse = await fetch(`${API_BASE_URL}/sessions/${newSessionId}/start`, { method: 'POST' });
      if (!startResponse.ok) throw new Error("Failed to start session");
      const ws = new WebSocket(`${WS_BASE_URL}/sessions/${newSessionId}/ws`);
      websocket.current = ws;
      ws.onopen = () => {
        console.log("WebSocket connected");
        setStatus('recording');
        sessionStartTime.current = Date.now();
      };
      ws.onmessage = handleWebSocketMessage;
      ws.onclose = () => {
        console.log("WebSocket disconnected");
        if (status !== 'disconnected') setStatus('error');
      };
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setStatus('error');
      };
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [selectedDevices, selectedModel, status]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    if (websocket.current) {
      websocket.current.close();
      websocket.current = null;
    }
    try {
      await fetch(`${API_BASE_URL}/sessions/${sessionId}/stop`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to cleanly stop session on backend:", err);
    }
    setStatus('disconnected');
    setSessionId(null);
    sessionStartTime.current = null;
  }, [sessionId]);

  const handleSave = useCallback(async () => {
    if (!sessionId) {
      alert("No active session to save.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/save`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to save transcript");
      const data = await res.json();
      const filename = data.filename;
      const transcriptionResponse = await fetch(`${API_BASE_URL}/sessions/${sessionId}/transcription`);
      if (!transcriptionResponse.ok) throw new Error("Failed to fetch transcription");
      const transcriptionData = await transcriptionResponse.json();
      const transcriptText = transcriptionData.transcription
        .map((line: ApiTranscriptEntry) => `[${line.timestamp}] ${line.speaker.toUpperCase()}: ${line.text}`)
        .join('\n');
      const blob = new Blob([transcriptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `transcript_${sessionId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(`Transcript downloaded successfully: ${filename}`);
    } catch (err) {
      console.error(err);
      alert("Error downloading transcript.");
    }
  }, [sessionId]);

  return (
    <main className="flex h-screen bg-slate-100 font-sans text-slate-900">
      <nav className="w-16 bg-slate-800 flex flex-col items-center py-4 space-y-4 shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
          VA
        </div>
        <div className="flex flex-col space-y-2 border-t border-slate-700 pt-4">
          <button
            onClick={() => setActivePanel('assistant')}
            className={clsx(
              "p-3 rounded-lg transition-colors",
              activePanel === 'assistant' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title="Assistant"
          >
            <Bot size={20} />
          </button>
          <button
            onClick={() => setActivePanel('settings')}
            className={clsx(
              "p-3 rounded-lg transition-colors",
              activePanel === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </nav>
      <aside className="w-80 bg-white border-r border-slate-200 shadow-lg shrink-0">
        {activePanel === 'assistant' ? (
          <AssistantPanel suggestions={suggestions} />
        ) : (
          <SettingsPanel
            onStart={handleStart}
            onStop={handleStop}
            onSave={handleSave}
            isRecording={status === 'recording' || status === 'connecting'}
            devices={devices}
            selectedDevices={selectedDevices}
            onDeviceChange={handleDeviceChange}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
          />
        )}
      </aside>
      <TranscriptPanel
        entries={transcript}
        status={status}
        duration={duration}
      />
    </main>
  );
}
