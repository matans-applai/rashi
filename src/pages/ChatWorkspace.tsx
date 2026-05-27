import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import AIErrorPanel from "../components/chat/AIErrorPanel";
import IntakeReviewCards from "../components/chat/IntakeReviewCards";
import RequestSidebar from "../components/RequestSidebar";
import { useAuth, getUserDisplayName } from "../lib/auth";
import { callIntake, AIError } from "../lib/aiClient";
import {
  createIntakeRequest,
  updateIntake,
  saveEditedIntake,
  getRequest,
  listMyRequests,
  listRequestFiles,
  markSentToLegal,
  softDeleteRequest,
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
  // Editable copy of intake_summary during review phase
  const [editedIntake, setEditedIntake] = useState<IntakeSummary | null>(null);
  // Whether user chose to correct the summary
  const [correcting, setCorrecting] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isSent =
    activeRecord?.status === "sent_to_legal" ||
    activeRecord?.status === "ready_for_legal" ||
    activeRecord?.status === "completed";

  // Whether we're in the review/approval phase
  const showReview =
    !isSent &&
    !thinking &&
    !correcting &&
    intake?.ready_for_final_summary === true &&
    messages.length > 0;

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

  // When intake becomes ready for summary, populate the editable copy
  useEffect(() => {
    if (intake?.ready_for_final_summary && intake.intake_summary) {
      setEditedIntake({ ...intake.intake_summary });
    }
  }, [intake?.ready_for_final_summary]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setIntake(null);
      setActiveRecord(null);
      setUploadedFiles([]);
      setError(null);
      setEditedIntake(null);
      setCorrecting(false);
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
      if (llm?.ready_for_final_summary && llm.intake_summary) {
        // Use legal_case (edited version) if available, otherwise LLM output
        const edited = rec.legal_case as IntakeSummary | null;
        setEditedIntake(edited ?? { ...llm.intake_summary });
      }
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
  }, [messages, thinking, showReview]);

  function handleNewRequest() {
    setActiveId(null);
    setMessages([]);
    setIntake(null);
    setActiveRecord(null);
    setUploadedFiles([]);
    setError(null);
    setEditedIntake(null);
    setCorrecting(false);
    nav("/chat");
  }

  function handleSelectRequest(id: string) {
    setActiveId(id);
    setError(null);
    setCorrecting(false);
    nav(`/chat/${id}`);
    setSidebarOpen(false);
  }

  async function handleDeleteRequest(id: string) {
    await softDeleteRequest(id);
    if (activeId === id) {
      handleNewRequest();
    }
    loadRequests();
  }

  async function sendTurn(text: string) {
    setError(null);
    setLastUserMessage(text);
    setCorrecting(false);
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

  /** Approve: save edits → download Word → mark as sent */
  async function handleApprove() {
    if (!activeId || !activeRecord) return;
    const intakeSummary = editedIntake ?? intake?.intake_summary;
    if (!intakeSummary) return;

    setDownloading(true);
    try {
      // Save any user edits to the intake
      const saved = await saveEditedIntake(activeId, intakeSummary);
      setActiveRecord(saved);

      // Download Word
      await downloadLegalReviewDocx({
        req: saved,
        intake: intakeSummary,
        requesterName: getUserDisplayName(user),
        requesterEmail: user?.email ?? "",
        uploadedFileNames: uploadedFiles.map((f) => f.file_name),
      });

      // Mark as sent
      const sent = await markSentToLegal(activeId);
      setActiveRecord(sent);
      loadRequests();
    } finally {
      setDownloading(false);
    }
  }

  /** Download Word without changing status (for SentView re-downloads) */
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
          onDelete={handleDeleteRequest}
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
            <BlankState onSend={sendTurn} disabled={thinking} />
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

                  {/* In-chat review cards when ready */}
                  {showReview && editedIntake && (
                    <div className="mt-6 space-y-4">
                      <div className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3">
                        <h3 className="text-sm font-semibold text-brand-800 mb-1">
                          סיכום הפנייה
                        </h3>
                        <p className="text-xs text-brand-600">
                          בדקו את הפרטים ולחצו ״אשר״ או תקנו ישירות.
                        </p>
                      </div>

                      <IntakeReviewCards
                        intake={editedIntake}
                        onChange={(next) => setEditedIntake(next)}
                        missing={intake?.missing_information?.map(
                          (m) => m.question_he
                        )}
                        files={uploadedFiles}
                      />

                      {/* Approve / Correct buttons */}
                      <div className="flex flex-wrap gap-3 justify-center pt-2 pb-4">
                        <button
                          type="button"
                          className="btn-primary rounded-xl px-6 py-2.5 text-sm font-medium"
                          onClick={handleApprove}
                          disabled={downloading}
                        >
                          {downloading
                            ? "מכין מסמך..."
                            : "אשר והורד Word"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary rounded-xl px-6 py-2.5 text-sm font-medium"
                          onClick={() => setCorrecting(true)}
                        >
                          יש לי תיקון
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom input area */}
              <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                <div className="max-w-3xl mx-auto space-y-2">
                  {error && (
                    <AIErrorPanel
                      onRetry={retryLastTurn}
                      onContinueManual={() => {}}
                      manualBusy={false}
                    />
                  )}
                  {!error && !showReview && (
                    <ChatInput
                      placeholder={
                        correcting
                          ? "כתבו מה לתקן בסיכום..."
                          : 'ענה/י כאן...'
                      }
                      onSend={sendTurn}
                      busy={thinking}
                      disabled={thinking}
                    />
                  )}
                  {showReview && !correcting && (
                    <p className="text-xs text-slate-400 text-center py-1">
                      ערכו שדות בסיכום למעלה, או לחצו ״יש לי תיקון״ כדי לכתוב
                      חופשי.
                    </p>
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
}: {
  onSend: (t: string) => void;
  disabled?: boolean;
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
        <ChatInput
          size="hero"
          placeholder="כתבו כאן את פרטי הפנייה..."
          onSend={onSend}
          chips={HERO_CHIPS}
          disabled={disabled}
        />
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

      {/* No input area — read-only */}
      <div className="flex-shrink-0 border-t border-slate-100 bg-slate-100 px-4 py-3">
        <p className="text-xs text-slate-400 text-center">
          פנייה זו נשלחה למשפטית ואינה ניתנת לעריכה.
        </p>
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
    assistant_message_he: "",
    ready_for_final_summary: true,
  };
}
