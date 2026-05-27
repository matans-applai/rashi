import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import AIErrorPanel from "../components/chat/AIErrorPanel";
import FileUpload from "../components/chat/FileUpload";
import RequestSidebar from "../components/RequestSidebar";
import { useAuth, getUserDisplayName } from "../lib/auth";
import { callIntake, AIError } from "../lib/aiClient";
import {
  createIntakeRequest,
  updateIntake,
  getRequest,
  linkFilesToRequest,
  listMyRequests,
  listRequestFiles,
} from "../lib/requests";
import { downloadLegalReviewDocx } from "../lib/docxBuilder";
import type {
  ChatMessage,
  IntakeResponse,
  IntakeSummary,
} from "../lib/aiTypes";
import type { RequestRecord, RequestFile } from "../lib/types";

const HERO_CHIPS = [
  { label: "יש לי ספק / יועץ", value: "אנחנו רוצים להתקשר עם " },
  { label: "מדובר במענק", value: "אנחנו רוצים להעביר מענק ל-" },
  { label: "יש הצעת מחיר", value: "יש בידינו הצעת מחיר. " },
  { label: "לא בטוח מה צריך", value: "אני לא בטוח/ה איזה סוג הסכם צריך — " },
];

export default function ChatWorkspace() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const { user, signOut } = useAuth();

  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(routeId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<RequestFile[]>([]);
  const [activeRecord, setActiveRecord] = useState<RequestRecord | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isSent =
    activeRecord?.status === "sent_to_legal" ||
    activeRecord?.status === "ready_for_legal" ||
    activeRecord?.status === "completed";

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const items = await listMyRequests(user.id);
    setRequests(items);
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (routeId && routeId !== activeId) {
      setActiveId(routeId);
    }
  }, [routeId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setIntake(null);
      setActiveRecord(null);
      setUploadedFiles([]);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const rec = await getRequest(activeId);
      if (cancelled || !rec) return;
      setActiveRecord(rec);
      const msgs = (rec.chat_messages as ChatMessage[] | null) ?? [];
      setMessages(msgs);
      const llm = rec.llm_output as IntakeResponse | null;
      setIntake(llm);
      const files = await listRequestFiles(activeId);
      if (!cancelled) setUploadedFiles(files);
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  function handleNewRequest() {
    setActiveId(null);
    setMessages([]);
    setIntake(null);
    setActiveRecord(null);
    setUploadedFiles([]);
    setError(null);
    nav("/chat");
  }

  function handleSelectRequest(id: string) {
    setActiveId(id);
    setError(null);
    nav(`/chat/${id}`);
    setSidebarOpen(false);
  }

  async function sendTurn(text: string) {
    setError(null);
    setLastUserMessage(text);
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setThinking(true);
    try {
      const result = await callIntake({
        messages: newMessages,
        previousIntake: intake?.intake_summary ?? null,
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.assistant_message_he,
        ts: new Date().toISOString(),
      };
      const withAssistant = [...newMessages, assistantMsg];
      setMessages(withAssistant);
      setIntake(result);

      if (!activeId && user) {
        const description =
          newMessages.find((m) => m.role === "user")?.content ?? text;
        const record = await createIntakeRequest({
          userId: user.id,
          userEmail: user.email ?? null,
          description,
          chatMessages: withAssistant,
          intake: result,
        });
        setActiveId(record.id);
        setActiveRecord(record);
        nav(`/chat/${record.id}`, { replace: true });

        const unlinked = uploadedFiles.filter((f) => !f.request_id);
        if (unlinked.length > 0) {
          await linkFilesToRequest(
            unlinked.map((f) => f.id),
            record.id
          );
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.request_id ? f : { ...f, request_id: record.id }
            )
          );
        }
        loadRequests();
      } else if (activeId) {
        const updated = await updateIntake({
          id: activeId,
          chatMessages: withAssistant,
          intake: result,
        });
        setActiveRecord(updated);
        loadRequests();
      }
    } catch (e) {
      const msg = e instanceof AIError ? e.message : String(e);
      setError(msg);
    } finally {
      setThinking(false);
    }
  }

  function retryLastTurn() {
    if (lastUserMessage) {
      setMessages((m) => m.slice(0, -1));
      sendTurn(lastUserMessage);
    }
  }

  async function continueManually() {
    if (!user) return;
    if (!activeId) {
      const description =
        messages.find((m) => m.role === "user")?.content ?? "";
      const fakeIntake = makeEmptyIntake(description);
      const record = await createIntakeRequest({
        userId: user.id,
        userEmail: user.email ?? null,
        description,
        chatMessages: messages,
        intake: fakeIntake,
      });
      setActiveId(record.id);
      setActiveRecord(record);
      nav(`/chat/${record.id}`, { replace: true });
      loadRequests();
    }
  }

  function goToReview() {
    if (!activeId) return;
    nav(`/requests/${activeId}`);
  }

  async function handleDownload() {
    if (!activeRecord) return;
    const intakeSummary =
      (activeRecord.legal_case as IntakeSummary | null) ??
      ((activeRecord.llm_output as IntakeResponse | null)?.intake_summary ??
        null);
    if (!intakeSummary) return;
    setDownloading(true);
    try {
      await downloadLegalReviewDocx({
        req: activeRecord,
        intake: intakeSummary,
        requesterName: getUserDisplayName(user),
        requesterEmail: user?.email ?? "",
        uploadedFileNames: uploadedFiles.map((f) => f.file_name),
      });
    } finally {
      setDownloading(false);
    }
  }

  const isBlank = !activeId && messages.length === 0;
  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen flex flex-col" dir="rtl">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 flex-shrink-0 z-20">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="תפריט"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="h-8 w-8 rounded-lg bg-brand-600 text-white grid place-items-center text-sm font-bold">
              ר
            </div>
            <span className="font-semibold text-sm hidden sm:block">
              עוזר הכנת פנייה למשפטית
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 hidden sm:block">
                {getUserDisplayName(user)}
              </span>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={async () => {
                  await signOut();
                  nav("/");
                }}
              >
                התנתק
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <RequestSidebar
          requests={requests}
          activeId={activeId}
          onSelect={handleSelectRequest}
          onNew={handleNewRequest}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {isSent && activeRecord ? (
            <SentView
              record={activeRecord}
              messages={messages}
              onDownload={handleDownload}
              downloading={downloading}
              onBack={handleNewRequest}
            />
          ) : isBlank ? (
            <BlankState
              onSend={sendTurn}
              disabled={thinking}
              userId={user?.id ?? ""}
              uploadedFiles={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-6"
              >
                <div className="max-w-3xl mx-auto space-y-3">
                  {messages.map((m, i) => (
                    <ChatBubble key={i} message={m} />
                  ))}
                  {thinking && <AiThinkingState />}
                </div>
              </div>

              {/* Bottom area */}
              <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                <div className="max-w-3xl mx-auto space-y-2">
                  {error && (
                    <AIErrorPanel
                      onRetry={retryLastTurn}
                      onContinueManual={continueManually}
                      manualBusy={false}
                    />
                  )}
                  {!error && (
                    <>
                      <ChatInput
                        placeholder='ענה/י כאן, או כתבו "תמשיך" כדי לעבור לסיכום'
                        onSend={sendTurn}
                        busy={thinking}
                        disabled={thinking}
                      />
                      <div className="flex items-center gap-4 justify-between">
                        <div className="flex-1">
                          {user && (
                            <FileUpload
                              userId={user.id}
                              requestId={activeId}
                              files={uploadedFiles}
                              onFilesChange={setUploadedFiles}
                            />
                          )}
                        </div>
                        {hasMessages && activeId && (
                          <button
                            type="button"
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
                            onClick={goToReview}
                          >
                            המשך לסיכום ועריכה
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function BlankState({
  onSend,
  disabled,
  userId,
  uploadedFiles,
  onFilesChange,
}: {
  onSend: (t: string) => void;
  disabled?: boolean;
  userId: string;
  uploadedFiles: RequestFile[];
  onFilesChange: (files: RequestFile[]) => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <div className="h-14 w-14 rounded-2xl bg-brand-600 text-white grid place-items-center text-2xl font-bold mx-auto mb-6">
          ר
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
          איך אפשר לעזור בהכנת הפנייה למשפטית?
        </h1>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto leading-relaxed text-sm">
          כתבו חופשי את מה שידוע לכם — הצד השני, מטרת ההתקשרות, סכום, לוחות
          זמנים, מסמכים קיימים ומה כל צד אמור לתת או לקבל.
        </p>
        <div className="space-y-3">
          <ChatInput
            size="hero"
            placeholder="כתבו כאן את פרטי הפנייה…"
            onSend={onSend}
            chips={HERO_CHIPS}
            disabled={disabled}
          />
          {userId && (
            <FileUpload
              userId={userId}
              requestId={null}
              files={uploadedFiles}
              onFilesChange={onFilesChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SentView({
  record,
  messages,
  onDownload,
  downloading,
  onBack,
}: {
  record: RequestRecord;
  messages: ChatMessage[];
  onDownload: () => void;
  downloading: boolean;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intake =
    (record.legal_case as IntakeSummary | null) ??
    ((record.llm_output as IntakeResponse | null)?.intake_summary ?? null);
  const title =
    intake?.request_purpose?.slice(0, 80) ||
    record.description.slice(0, 80) ||
    "פנייה";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sent banner */}
      <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              נשלח
            </span>
            <span className="text-sm font-medium text-emerald-900 truncate">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
              onClick={onDownload}
              disabled={!intake || downloading}
            >
              {downloading ? "מכין..." : "הורד Word"}
            </button>
            <button
              type="button"
              className="text-xs text-emerald-700 hover:text-emerald-900"
              onClick={onBack}
            >
              פנייה חדשה
            </button>
          </div>
        </div>
      </div>

      {/* Read-only chat history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">
              אין היסטוריית שיחה לפנייה זו.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function makeEmptyIntake(description: string): IntakeResponse {
  return {
    intake_summary: {
      department_or_project: null,
      request_purpose: description.slice(0, 200) || null,
      background: null,
      second_party_name: null,
      second_party_type: "unknown",
      party_roles: null,
      amount: null,
      currency: "unknown",
      timeline: null,
      is_new_or_existing: "unknown",
      quote_exists: "unknown",
      quote_details: null,
      supplier_selected: "unknown",
      selection_process: null,
      partners_involved: null,
      documents_mentioned: [],
      privacy_or_personal_data: "unknown",
      ip_or_copyrights: "unknown",
      participant_photography: "unknown",
      insurance_or_operational_risk: "unknown",
      subcontractors: "unknown",
      supplier_terms_or_contract: "unknown",
      grant_related: "unknown",
      urgency: "unknown",
      special_notes: [],
    },
    known_information_he: [],
    missing_information: [],
    next_questions_he: [],
    can_continue_with_partial_info: true,
    assistant_message_he: "ניתן למלא ולערוך את הפרטים ידנית בעמוד הסיכום.",
    ready_for_final_summary: true,
  };
}
