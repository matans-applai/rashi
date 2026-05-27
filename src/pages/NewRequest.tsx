import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import KnownInfoCard from "../components/chat/KnownInfoCard";
import AIErrorPanel from "../components/chat/AIErrorPanel";
import { useAuth } from "../lib/auth";
import { callIntake, AIError } from "../lib/aiClient";
import { createIntakeRequest, updateIntake } from "../lib/requests";
import type {
  ChatMessage,
  IntakeResponse,
  IntakeStep,
} from "../lib/aiTypes";
import type { RequestRecord } from "../lib/types";

const HERO_CHIPS = [
  { label: "יש לי ספק / יועץ", value: "אנחנו רוצים להתקשר עם " },
  { label: "מדובר במענק", value: "אנחנו רוצים להעביר מענק ל-" },
  { label: "יש הצעת מחיר", value: "יש בידינו הצעת מחיר. " },
  { label: "יש שותפים נוספים", value: "יש לנו שותפים נוספים לפעילות: " },
  { label: "לא בטוח מה צריך", value: "אני לא בטוח/ה איזה סוג הסכם צריך — " },
];

const SLOW_WARNING_MS = 15_000; // Show "taking longer" after 15s
const TIMEOUT_MS = 35_000;      // Show timeout error after 35s

/**
 * Chat-first legal-intake assistant.
 *
 * The user describes the request freely. The AI extracts structured intake
 * info and asks short follow-ups. When the user is done (or the AI says
 * ready_for_final_summary), we persist and navigate to the editable review.
 */
export default function NewRequest() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState<IntakeStep>("describe");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [thinkingSlow, setThinkingSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, intake, thinking]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  async function sendTurn(text: string) {
    setError(null);
    setErrorCode(null);
    setLastUserMessage(text);
    setThinkingSlow(false);

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStep("chat");
    setThinking(true);

    // Start slow-warning timer
    slowTimerRef.current = setTimeout(() => {
      setThinkingSlow(true);
    }, SLOW_WARNING_MS);

    try {
      const result = await callIntake({
        messages: newMessages,
        previousIntake: intake?.intake_summary ?? null,
      });

      // Clear slow timer
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      setThinkingSlow(false);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.assistant_message_he,
        ts: new Date().toISOString(),
      };
      const withAssistant = [...newMessages, assistantMsg];
      setMessages(withAssistant);
      setIntake(result);

      // Persist progressively so the user can leave and come back.
      let record: RequestRecord | null = null;
      if (!recordId && user) {
        const description =
          newMessages.find((m) => m.role === "user")?.content ?? text;
        record = await createIntakeRequest({
          userId: user.id,
          userEmail: user.email ?? null,
          description,
          chatMessages: withAssistant,
          intake: result,
        });
        setRecordId(record.id);
      } else if (recordId) {
        await updateIntake({
          id: recordId,
          chatMessages: withAssistant,
          intake: result,
        });
      }
    } catch (e) {
      // Clear slow timer
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      setThinkingSlow(false);

      if (e instanceof AIError) {
        setError(e.messageHe);
        setErrorCode(e.code);
      } else {
        setError(String(e));
        setErrorCode("AI_UNKNOWN_ERROR");
      }
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
      // Remove the last user message from history and resend.
      setMessages((m) => m.slice(0, -1));
      sendTurn(lastUserMessage);
    }
  }

  async function continueManually() {
    // If the AI is broken, save what we have and let the user edit manually.
    if (!user) return;
    setPersisting(true);
    try {
      if (!recordId) {
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
        setRecordId(record.id);
        nav(`/requests/${record.id}`);
      } else {
        nav(`/requests/${recordId}`);
      }
    } finally {
      setPersisting(false);
    }
  }

  // -------- Render --------
  const thinkingLabel = thinkingSlow
    ? "זה לוקח קצת יותר מהרגיל…"
    : "מנתח/ת...";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current={step === "describe" ? "describe" : "chat"} />

        {step === "describe" && messages.length === 0 ? (
          <HeroDescribe onSend={sendTurn} disabled={thinking} />
        ) : (
          <div className="space-y-4">
            <div
              ref={scrollRef}
              className="space-y-3 max-h-[55vh] overflow-y-auto pr-1"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {thinking && <AiThinkingState label={thinkingLabel} />}
            </div>

            {error && (
              <AIErrorPanel
                message={error}
                errorCode={errorCode}
                onRetry={retryLastTurn}
                onContinueManual={continueManually}
                manualBusy={persisting}
              />
            )}

            {!error && intake && (
              <>
                <KnownInfoCard intake={intake} />
                <ChatInput
                  placeholder='ענה/י כאן, או כתבו "תמשיך" כדי לעבור לסיכום'
                  onSend={sendTurn}
                  busy={thinking}
                  disabled={thinking}
                />
                <div className="flex items-center gap-3 justify-end pt-2 flex-wrap">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => nav("/dashboard")}
                  >
                    שמור וצא
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={goToReview}
                    disabled={persisting || !recordId}
                  >
                    {persisting ? "טוען..." : "המשך לסיכום"}
                  </button>
                </div>
              </>
            )}

            {/* If no intake yet and no error and not thinking, show input */}
            {!error && !intake && !thinking && (
              <ChatInput
                placeholder="כתבו כאן את פרטי הפנייה…"
                onSend={sendTurn}
                busy={false}
                disabled={false}
              />
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
}: {
  onSend: (t: string) => void;
  disabled?: boolean;
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
      <div className="max-w-2xl mx-auto">
        <ChatInput
          size="hero"
          placeholder="כתבו כאן את פרטי הפנייה…"
          onSend={onSend}
          chips={HERO_CHIPS}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/** Build an empty intake response — used when the AI fails and the user
 *  wants to proceed manually. The review screen lets them edit everything. */
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
    assistant_message_he:
      "ניתן למלא ולערוך את הפרטים ידנית בעמוד הסיכום.",
    ready_for_final_summary: true,
    approval_summary_he: "",
  };
}
