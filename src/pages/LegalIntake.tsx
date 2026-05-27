import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import AiThinkingState from "../components/chat/AiThinkingState";
import MissingInfoQuestions from "../components/chat/MissingInfoQuestions";
import { useAuth } from "../lib/auth";
import { callLegalIntake } from "../lib/aiClient";
import { getRequest, saveLegalCase, appendChatTurns } from "../lib/requests";
import type {
  ChatMessage,
  LegalIntakeResponse,
} from "../lib/aiTypes";
import type { RequestRecord } from "../lib/types";

/**
 * Chat-based legal intake. The page loads the request, replays the original
 * conversation, then asks the LLM (legal_intake mode) for the next questions
 * to ask. The user can answer partially; saying "תמשיך" jumps to summary.
 */
export default function LegalIntake() {
  const { id } = useParams();
  const { user: _user } = useAuth();
  const nav = useNavigate();

  const [req, setReq] = useState<RequestRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latest, setLatest] = useState<LegalIntakeResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialRunRef = useRef(false);

  // Load + start the chat (first call)
  useEffect(() => {
    if (!id || initialRunRef.current) return;
    initialRunRef.current = true;
    (async () => {
      try {
        const r = await getRequest(id);
        if (!r) {
          setError("פנייה לא נמצאה");
          return;
        }
        setReq(r);

        const priorMessages: ChatMessage[] = Array.isArray(r.chat_messages)
          ? (r.chat_messages as ChatMessage[])
          : [];

        // If there's no chat history, seed with the description.
        const seed: ChatMessage[] =
          priorMessages.length > 0
            ? priorMessages
            : [
                {
                  role: "user",
                  content: r.description,
                  ts: new Date().toISOString(),
                },
              ];

        setMessages(seed);
        await runLegalIntake(seed, r);
      } catch (e: any) {
        setError(e?.message ?? "שגיאה בטעינה");
      }
    })();
  }, [id]);

  async function runLegalIntake(
    history: ChatMessage[],
    record: RequestRecord
  ): Promise<void> {
    setThinking(true);
    setError(null);
    try {
      const result = await callLegalIntake({
        messages: history,
        initialSummary: record.llm_output ?? null,
      });
      setLatest(result);
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.assistant_message_he,
        ts: new Date().toISOString(),
      };
      const newHistory = [...history, aiMsg];
      setMessages(newHistory);
      await appendChatTurns({ id: record.id, messages: newHistory });
      await saveLegalCase(record.id, result);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בקריאה ל-AI");
    } finally {
      setThinking(false);
    }
  }

  async function handleSend(text: string) {
    if (!req) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    await runLegalIntake(next, req);
  }

  async function goToSummary() {
    if (!req) return;
    nav(`/requests/${req.id}/confirm`);
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  if (!req) {
    return (
      <Layout>
        <div className="text-slate-500">{error ?? "טוען..."}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current="final_summary" legalActive />
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">השלמת פרטים לבדיקה משפטית</h1>
          <p className="text-slate-500 mt-1">
            צ'אט קצר. כדאי לענות רק על מה שידוע — אפשר תמיד לומר "תמשיך" כדי
            לעבור לסיכום עם המידע הקיים.
          </p>
        </div>

        <div
          ref={scrollRef}
          className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 mb-4"
        >
          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}
          {thinking && <AiThinkingState />}
        </div>

        {latest && !latest.ready_for_summary && !thinking && (
          <div className="mb-4">
            <MissingInfoQuestions
              questions={latest.questions_to_complete_he}
            />
          </div>
        )}

        {!thinking && latest && (
          <>
            <ChatInput
              placeholder='ענה/י כאן, או כתבו "תמשיך" כדי לעבור לסיכום'
              onSend={handleSend}
              disabled={thinking}
            />
            <div className="flex items-center gap-3 justify-end mt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => nav(`/requests/${req.id}`)}
              >
                חזור
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={goToSummary}
              >
                {latest.ready_for_summary
                  ? "המשך לסיכום משפטי"
                  : "שלח לבדיקה משפטית עם המידע הקיים"}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm mt-4">
            {error}
          </div>
        )}
      </div>
    </Layout>
  );
}
