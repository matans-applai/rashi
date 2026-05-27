import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import AIErrorPanel from "../components/chat/AIErrorPanel";
import FileUpload from "../components/chat/FileUpload";
import { useAuth } from "../lib/auth";
import { callIntake, AIError } from "../lib/aiClient";
import { createIntakeRequest, updateIntake, linkFilesToRequest } from "../lib/requests";
import type {
  ChatMessage,
  IntakeResponse,
  IntakeStep,
} from "../lib/aiTypes";
import type { RequestRecord, RequestFile } from "../lib/types";

const HERO_CHIPS = [
  { label: "יש לי ספק / יועץ", value: "אנחנו רוצים להתקשר עם " },
  { label: "מדובר במענק", value: "אנחנו רוצים להעביר מענק ל-" },
  { label: "יש הצעת מחיר", value: "יש בידינו הצעת מחיר. " },
  { label: "יש שותפים נוספים", value: "יש לנו שותפים נוספים לפעילות: " },
  { label: "לא בטוח מה צריך", value: "אני לא בטוח/ה איזה סוג הסכם צריך — " },
];

export default function NewRequest() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState<IntakeStep>("describe");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<RequestFile[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, intake, thinking]);

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
    setStep("chat");
    setThinking(true);
    try {
      const result = await callIntake({ messages: newMessages });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.assistant_message_he,
        ts: new Date().toISOString(),
      };
      const withAssistant = [...newMessages, assistantMsg];
      setMessages(withAssistant);
      setIntake(result);

      let record: RequestRecord | null = null;
      if (!recordId && user) {
        const description = newMessages.find((m) => m.role === "user")?.content ?? text;
        record = await createIntakeRequest({
          userId: user.id,
          userEmail: user.email ?? null,
          description,
          chatMessages: withAssistant,
          intake: result,
        });
        setRecordId(record.id);
        // Link any files uploaded before the record existed.
        const unlinked = uploadedFiles.filter((f) => !f.request_id);
        if (unlinked.length > 0) {
          await linkFilesToRequest(
            unlinked.map((f) => f.id),
            record.id
          );
          setUploadedFiles((prev) =>
            prev.map((f) => (f.request_id ? f : { ...f, request_id: record!.id }))
          );
        }
      } else if (recordId) {
        await updateIntake({
          id: recordId,
          chatMessages: withAssistant,
          intake: result,
        });
      }
    } catch (e) {
      const msg = e instanceof AIError ? e.message : String(e);
      setError(msg);
    } finally {
      setThinking(false);
    }
  }

  async function goToReview() {
    if (!recordId) return;
    setPersisting(true);
    try {
      nav(`/requests/${recordId}`);
    } finally {
      setPersisting(false);
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
    setPersisting(true);
    try {
      if (!recordId) {
        const description = messages.find((m) => m.role === "user")?.content ?? "";
        const fakeIntake = makeEmptyIntake(description);
        const record = await createIntakeRequest({
          userId: user.id,
          userEmail: user.email ?? null,
          description,
          chatMessages: messages,
          intake: fakeIntake,
        });
        setRecordId(record.id);
        const unlinked = uploadedFiles.filter((f) => !f.request_id);
        if (unlinked.length > 0) {
          await linkFilesToRequest(
            unlinked.map((f) => f.id),
            record.id
          );
        }
        nav(`/requests/${record.id}`);
      } else {
        nav(`/requests/${recordId}`);
      }
    } finally {
      setPersisting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current={step === "describe" ? "describe" : "chat"} />

        {step === "describe" && messages.length === 0 ? (
          <HeroDescribe
            onSend={sendTurn}
            disabled={thinking}
            userId={user?.id ?? ""}
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
          />
        ) : (
          <div className="space-y-4">
            <div
              ref={scrollRef}
              className="space-y-3 max-h-[55vh] overflow-y-auto pr-1"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {thinking && <AiThinkingState />}
            </div>

            {error && (
              <AIErrorPanel
                onRetry={retryLastTurn}
                onContinueManual={continueManually}
                manualBusy={persisting}
              />
            )}

            {!error && intake && (
              <>
                <ChatInput
                  placeholder='ענה/י כאן, או כתבו "תמשיך" כדי לעבור לסיכום'
                  onSend={sendTurn}
                  busy={thinking}
                  disabled={thinking}
                />
                {user && (
                  <FileUpload
                    userId={user.id}
                    requestId={recordId}
                    files={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                  />
                )}
                <div className="flex items-center gap-3 justify-start pt-2 flex-wrap">
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => nav("/dashboard")}
                  >
                    שמור וצא
                  </button>
                  <button
                    type="button"
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                    onClick={goToReview}
                    disabled={persisting || !recordId}
                  >
                    {persisting ? "טוען..." : "המשך לסיכום →"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function HeroDescribe({
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
    <div className="text-center pt-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
        ספרו לנו על הפנייה
      </h1>
      <p className="text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
        כתבו בקצרה את מה שידוע לכם. אפשר לציין מי הגורם שמולו עובדים, מה מטרת
        הפנייה, סכום משוער, לוחות זמנים, מסמכים קיימים ומה כל צד אמור לתת או
        לקבל.
      </p>
      <div className="max-w-2xl mx-auto space-y-3">
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
      special_notes: [],
    },
    known_information_he: [],
    missing_information: [],
    next_questions_he: [],
    can_continue_with_partial_info: true,
    assistant_message_he:
      "ניתן למלא ולערוך את הפרטים ידנית בעמוד הסיכום.",
    ready_for_final_summary: true,
  };
}
