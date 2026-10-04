"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Question = {
  id: number;
  question: string;
  asked_by: string | null;
  votes: number;
  created_at: string;
};

type PollOption = {
  id: string;
  label: string;
  votes: number;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
};

const initialPolls: Poll[] = [
  {
    id: "frontend",
    question: "Which technology is best for frontend development?",
    options: [
      { id: "react", label: "React", votes: 13 },
      { id: "next", label: "Next.js", votes: 18 },
      { id: "vue", label: "Vue", votes: 5 },
      { id: "angular", label: "Angular", votes: 3 },
    ],
  },
  {
    id: "deployment",
    question: "Which deployment platform do you prefer?",
    options: [
      { id: "vercel", label: "Vercel", votes: 26 },
      { id: "netlify", label: "Netlify", votes: 8 },
      { id: "aws", label: "AWS", votes: 5 },
      { id: "other", label: "Other", votes: 2 },
    ],
  },
];

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [geminiQuestion, setGeminiQuestion] = useState("");
  const [geminiAnswer, setGeminiAnswer] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState<number | null>(null);
  const [polls, setPolls] = useState<Poll[]>(initialPolls);
  const [votedPolls, setVotedPolls] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadQuestions();

    try {
      const saved = localStorage.getItem("live-qa-voted-polls");

      if (saved) {
        setVotedPolls(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  async function loadQuestions() {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      setMessage("Unable to load questions.");
      return;
    }

    setQuestions(data || []);
  }

  const filteredQuestions = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) {
      return questions;
    }

    return questions.filter((item) =>
      item.question.toLowerCase().includes(text)
    );
  }, [questions, search]);

  async function askGemini() {
    if (!geminiQuestion.trim()) {
      setGeminiAnswer("Please enter a question.");
      return;
    }

    setLoadingAI(true);
    setGeminiAnswer("");

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: geminiQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGeminiAnswer(data.error || "Unable to generate an AI answer.");
        return;
      }

      setGeminiAnswer(data.answer || "No answer was generated.");
    } catch (error) {
      console.error(error);
      setGeminiAnswer("Unable to generate an AI answer.");
    } finally {
      setLoadingAI(false);
    }
  }

  async function askAIForQuestion(question: Question) {
    setLoadingQuestion(question.id);

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.question,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAnswers((previous) => ({
          ...previous,
          [question.id]:
            data.error || "Unable to generate an AI answer.",
        }));

        return;
      }

      setAnswers((previous) => ({
        ...previous,
        [question.id]: data.answer || "No answer was generated.",
      }));
    } catch (error) {
      console.error(error);

      setAnswers((previous) => ({
        ...previous,
        [question.id]: "Unable to generate an AI answer.",
      }));
    } finally {
      setLoadingQuestion(null);
    }
  }

  async function voteQuestion(question: Question) {
    const newVotes = question.votes + 1;

    const { error } = await supabase
      .from("questions")
      .update({ votes: newVotes })
      .eq("id", question.id);

    if (error) {
      console.error("Vote error:", error);
      return;
    }

    setQuestions((previous) =>
      previous.map((item) =>
        item.id === question.id
          ? { ...item, votes: newVotes }
          : item
      )
    );
  }

  function votePoll(pollId: string, optionId: string) {
    if (votedPolls.includes(pollId)) {
      return;
    }

    setPolls((previous) =>
      previous.map((poll) => {
        if (poll.id !== pollId) {
          return poll;
        }

        return {
          ...poll,
          options: poll.options.map((option) =>
            option.id === optionId
              ? { ...option, votes: option.votes + 1 }
              : option
          ),
        };
      })
    );

    const updatedVotedPolls = [...votedPolls, pollId];

    setVotedPolls(updatedVotedPolls);

    localStorage.setItem(
      "live-qa-voted-polls",
      JSON.stringify(updatedVotedPolls)
    );
  }

  function getPollTotal(poll: Poll) {
    return poll.options.reduce(
      (total, option) => total + option.votes,
      0
    );
  }

  function getWinner(poll: Poll) {
    return poll.options.reduce((winner, option) =>
      option.votes > winner.votes ? option : winner
    );
  }

  function getPercentage(votes: number, total: number) {
    if (total === 0) {
      return 0;
    }

    return Math.round((votes / total) * 100);
  }

  return (
    <main className="page">
      <div className="container">
        <div className="top-label">
          ✦ COMMUNITY • KNOWLEDGE • DISCUSSION ✦
        </div>

        <h1 className="main-title">LIVE Q &amp; A</h1>

        <p className="subtitle">
          Ask questions, share knowledge, and learn together
        </p>

        {/* GEMINI */}
        <section className="ai-section">
          <div className="section-icon">✦</div>

          <h2>Ask a question to Gemini</h2>

          <textarea
            className="ai-input"
            placeholder="Ask anything..."
            value={geminiQuestion}
            onChange={(event) =>
              setGeminiQuestion(event.target.value)
            }
          />

          <button
            className="primary-button"
            onClick={askGemini}
            disabled={loadingAI}
          >
            {loadingAI ? "Asking..." : "Ask Gemini"}
          </button>

          {geminiAnswer && (
            <div className="ai-answer">
              <div className="answer-title">🤖 Gemini Answer</div>
              <p>{geminiAnswer}</p>
            </div>
          )}
        </section>

        {/* SEARCH */}
        <section className="search-section">
          <div className="search-row">
            <div className="search-box">
              <span>🔎</span>

              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <button className="improve-button">
              Improve
            </button>
          </div>
        </section>

        {/* QUESTIONS */}
        <section className="questions-section">
          <div className="section-label">
            COMMUNITY QUESTIONS
          </div>

          <h2 className="section-title">Questions</h2>

          {filteredQuestions.length === 0 ? (
            <div className="empty-card">
              No questions found.
            </div>
          ) : (
            <div className="question-list">
              {filteredQuestions.map((question) => (
                <article
                  className="question-card"
                  key={question.id}
                >
                  <div className="asked-by">
                    Asked by{" "}
                    <strong>
                      {question.asked_by || "Student"}
                    </strong>
                  </div>

                  <h3>{question.question}</h3>

                  {answers[question.id] && (
                    <div className="question-answer">
                      <div className="answer-title">
                        🤖 AI Answer
                      </div>

                      <p>{answers[question.id]}</p>
                    </div>
                  )}

                  <div className="question-actions">
                    <button
                      className="vote-button"
                      onClick={() => voteQuestion(question)}
                    >
                      👍 {question.votes}
                    </button>

                    <button
                      className="ai-button"
                      onClick={() =>
                        askAIForQuestion(question)
                      }
                      disabled={loadingQuestion === question.id}
                    >
                      {loadingQuestion === question.id
                        ? "Asking..."
                        : "Ask AI"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* POLLS */}
        <section className="poll-section">
          <div className="section-label">
            COMMUNITY OPINION
          </div>

          <h2 className="section-title">Polls</h2>

          <div className="poll-list">
            {polls.map((poll) => {
              const total = getPollTotal(poll);
              const winner = getWinner(poll);
              const alreadyVoted = votedPolls.includes(poll.id);

              return (
                <article className="poll-card" key={poll.id}>
                  <div className="poll-heading">
                    <span>📊 COMMUNITY POLL</span>

                    <span className="live-badge">
                      LIVE
                    </span>
                  </div>

                  <h3>{poll.question}</h3>

                  <div className="poll-options">
                    {poll.options.map((option) => {
                      const percentage = getPercentage(
                        option.votes,
                        total
                      );

                      return (
                        <div
                          className="poll-option"
                          key={option.id}
                        >
                          <button
                            className="poll-vote-button"
                            onClick={() =>
                              votePoll(
                                poll.id,
                                option.id
                              )
                            }
                            disabled={alreadyVoted}
                          >
                            <span>{option.label}</span>

                            <span>
                              {option.votes} (
                              {percentage}%)
                            </span>
                          </button>

                          <div className="progress-track">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {alreadyVoted ? (
                    <div className="already-voted">
                      ✓ You have already voted
                    </div>
                  ) : (
                    <div className="vote-hint">
                      Select an option to vote
                    </div>
                  )}

                  <div className="poll-footer">
                    <span>Total votes: {total}</span>

                    <span>
                      Winner: <strong>{winner.label}</strong>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="footer">
          LIVE Q &amp; A • Community • Knowledge • Discussion
        </footer>

        {message && <div className="message">{message}</div>}
      </div>
    </main>
  );
}
