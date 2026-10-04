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
  id: number;
  poll_id: number;
  option_text: string;
  votes: number;
};

type Poll = {
  id: number;
  question: string;
  is_active: boolean;
  created_at: string;
  poll_options: PollOption[];
};

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);

  const [search, setSearch] = useState("");

  const [geminiQuestion, setGeminiQuestion] = useState("");
  const [geminiAnswer, setGeminiAnswer] = useState("");
  const [geminiLoading, setGeminiLoading] = useState(false);

  const [aiAnswers, setAiAnswers] = useState<
    Record<number, string>
  >({});

  const [aiLoading, setAiLoading] = useState<number | null>(
    null
  );

  const [loadingQuestions, setLoadingQuestions] =
    useState(true);

  const [loadingPolls, setLoadingPolls] = useState(true);

  const [votingPoll, setVotingPoll] = useState<number | null>(
    null
  );

  const [votedPolls, setVotedPolls] = useState<number[]>([]);

  // ==================================================
  // LOAD QUESTIONS
  // ==================================================

  async function loadQuestions() {
    setLoadingQuestions(true);

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase questions error:", error);
      setQuestions([]);
    } else {
      setQuestions(data || []);
    }

    setLoadingQuestions(false);
  }

  // ==================================================
  // LOAD POLLS
  // ==================================================

  async function loadPolls() {
    setLoadingPolls(true);

    const { data: pollData, error: pollError } =
      await supabase
        .from("polls")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (pollError) {
      console.error("Supabase polls error:", pollError);
      setPolls([]);
      setLoadingPolls(false);
      return;
    }

    const { data: optionData, error: optionError } =
      await supabase
        .from("poll_options")
        .select("*")
        .order("id", { ascending: true });

    if (optionError) {
      console.error(
        "Supabase poll options error:",
        optionError
      );

      setPolls([]);
      setLoadingPolls(false);
      return;
    }

    const combinedPolls: Poll[] = (pollData || []).map(
      (poll) => ({
        ...poll,
        poll_options: (optionData || []).filter(
          (option) => option.poll_id === poll.id
        ),
      })
    );

    setPolls(combinedPolls);
    setLoadingPolls(false);
  }

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadQuestions();
    loadPolls();

    const savedVotes = localStorage.getItem(
      "live-qa-voted-polls"
    );

    if (savedVotes) {
      try {
        setVotedPolls(JSON.parse(savedVotes));
      } catch {
        setVotedPolls([]);
      }
    }
  }, []);

  // ==================================================
  // SEARCH
  // ==================================================

  const filteredQuestions = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return questions;
    }

    return questions.filter((item) =>
      item.question.toLowerCase().includes(value)
    );
  }, [questions, search]);

  // ==================================================
  // ASK GEMINI
  // ==================================================

  async function askGemini(question: string) {
    if (!question.trim()) return;

    setGeminiLoading(true);
    setGeminiAnswer("");

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGeminiAnswer(
          data.error ||
            "Gemini is temporarily unavailable. Please try again shortly."
        );
        return;
      }

      setGeminiAnswer(
        data.answer || "No answer was generated."
      );
    } catch (error) {
      console.error("Gemini error:", error);

      setGeminiAnswer(
        "Gemini is temporarily unavailable. Please try again shortly."
      );
    } finally {
      setGeminiLoading(false);
    }
  }

  // ==================================================
  // ASK AI FOR QUESTION
  // ==================================================

  async function askAIForQuestion(question: Question) {
    setAiLoading(question.id);

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
        setAiAnswers((previous) => ({
          ...previous,
          [question.id]:
            data.error ||
            "Gemini is temporarily unavailable. Please try again shortly.",
        }));

        return;
      }

      setAiAnswers((previous) => ({
        ...previous,
        [question.id]:
          data.answer || "No answer was generated.",
      }));
    } catch (error) {
      console.error("AI error:", error);

      setAiAnswers((previous) => ({
        ...previous,
        [question.id]:
          "Gemini is temporarily unavailable. Please try again shortly.",
      }));
    } finally {
      setAiLoading(null);
    }
  }

  // ==================================================
  // VOTE QUESTION
  // ==================================================

  async function voteQuestion(
    id: number,
    currentVotes: number
  ) {
    const { error } = await supabase
      .from("questions")
      .update({
        votes: currentVotes + 1,
      })
      .eq("id", id);

    if (error) {
      console.error("Question vote error:", error);
      return;
    }

    setQuestions((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              votes: item.votes + 1,
            }
          : item
      )
    );
  }

  // ==================================================
  // VOTE POLL
  // ==================================================

  async function votePoll(
    pollId: number,
    optionId: number,
    currentVotes: number
  ) {
    if (votedPolls.includes(pollId)) {
      return;
    }

    setVotingPoll(pollId);

    const { error } = await supabase
      .from("poll_options")
      .update({
        votes: currentVotes + 1,
      })
      .eq("id", optionId);

    if (error) {
      console.error("Poll vote error:", error);
      setVotingPoll(null);
      return;
    }

    const updatedPolls = polls.map((poll) => {
      if (poll.id !== pollId) {
        return poll;
      }

      return {
        ...poll,

        poll_options: poll.poll_options.map(
          (option) =>
            option.id === optionId
              ? {
                  ...option,
                  votes: option.votes + 1,
                }
              : option
        ),
      };
    });

    setPolls(updatedPolls);

    const newVotedPolls = [
      ...votedPolls,
      pollId,
    ];

    setVotedPolls(newVotedPolls);

    localStorage.setItem(
      "live-qa-voted-polls",
      JSON.stringify(newVotedPolls)
    );

    setVotingPoll(null);
  }

  // ==================================================
  // TOTAL POLL VOTES
  // ==================================================

  function getTotalVotes(options: PollOption[]) {
    return options.reduce(
      (total, option) => total + option.votes,
      0
    );
  }

  // ==================================================
  // PERCENTAGE
  // ==================================================

  function getPercentage(
    votes: number,
    totalVotes: number
  ) {
    if (totalVotes === 0) {
      return 0;
    }

    return Math.round(
      (votes / totalVotes) * 100
    );
  }

  // ==================================================
  // WINNER
  // ==================================================

  function getWinner(options: PollOption[]) {
    if (!options.length) {
      return null;
    }

    return options.reduce((winner, option) =>
      option.votes > winner.votes
        ? option
        : winner
    );
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-4xl px-5 py-10">

        {/* ============================================
            HEADER
        ============================================ */}

        <header className="text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-indigo-500">
            ✦ COMMUNITY • KNOWLEDGE • DISCUSSION ✦
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-900">
            LIVE Q &amp; A
          </h1>

          <p className="mt-3 text-base text-slate-500">
            Ask questions, share knowledge, and learn together
          </p>
        </header>

        {/* ============================================
            GEMINI
        ============================================ */}

        <section className="mt-10 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm">

          <div className="flex items-center gap-2">
            <span className="text-xl">
              ✦
            </span>

            <h2 className="text-xl font-bold text-slate-900">
              Ask a question to Gemini
            </h2>
          </div>

          <textarea
            value={geminiQuestion}
            onChange={(event) =>
              setGeminiQuestion(event.target.value)
            }
            placeholder="Ask anything..."
            className="mt-5 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />

          <button
            onClick={() =>
              askGemini(geminiQuestion)
            }
            disabled={
              geminiLoading ||
              !geminiQuestion.trim()
            }
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {geminiLoading
              ? "Thinking..."
              : "Ask Gemini"}
          </button>

          {geminiAnswer && (
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-white p-5">

              <p className="text-sm font-bold text-indigo-600">
                🤖 Gemini Answer
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {geminiAnswer}
              </p>

            </div>
          )}

        </section>

        {/* ============================================
            SEARCH
        ============================================ */}

        <section className="mt-8">

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

            <span className="text-lg">
              🔎
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search questions..."
              className="w-full bg-transparent text-sm outline-none"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}

          </div>

          <button
            onClick={() =>
              setSearch(search.trim())
            }
            className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100"
          >
            Improve
          </button>

        </section>

        {/* ============================================
            QUESTIONS
        ============================================ */}

        <section className="mt-10">

          <div className="mb-5">

            <p className="text-xs font-bold tracking-[0.25em] text-indigo-500">
              COMMUNITY QUESTIONS
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Questions
            </h2>

          </div>

          {loadingQuestions ? (
            <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
              Loading questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">

              <p className="font-semibold text-slate-700">
                No questions found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try another search.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {filteredQuestions.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >

                  {/* USER */}

                  <p className="text-xs font-semibold text-slate-400">
                    Asked by{" "}
                    {item.asked_by || "Student"}
                  </p>

                  {/* QUESTION */}

                  <h3 className="mt-3 text-lg font-bold leading-7 text-slate-900">
                    {item.question}
                  </h3>

                  {/* AI ANSWER */}

                  {aiAnswers[item.id] && (
                    <div className="mt-4 rounded-xl bg-indigo-50 p-4">

                      <p className="text-xs font-bold text-indigo-600">
                        🤖 AI Answer
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {aiAnswers[item.id]}
                      </p>

                    </div>
                  )}

                  {/* BUTTONS */}

                  <div className="mt-5 flex items-center gap-3">

                    <button
                      onClick={() =>
                        voteQuestion(
                          item.id,
                          item.votes
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      👍 {item.votes}
                    </button>

                    <button
                      onClick={() =>
                        askAIForQuestion(item)
                      }
                      disabled={
                        aiLoading === item.id
                      }
                      className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                    >
                      {aiLoading === item.id
                        ? "Thinking..."
                        : "Ask AI"}
                    </button>

                  </div>

                </article>
              ))}

            </div>
          )}

        </section>

        {/* ============================================
            POLLS
        ============================================ */}

        <section className="mt-14">

          <div className="mb-6">

            <p className="text-xs font-bold tracking-[0.25em] text-indigo-500">
              COMMUNITY OPINION
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Polls
            </h2>

          </div>

          {loadingPolls ? (
            <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
              Loading polls...
            </div>
          ) : polls.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">

              <p className="font-semibold text-slate-700">
                No active polls
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create a poll in Supabase to display it here.
              </p>

            </div>
          ) : (
            <div className="space-y-6">

              {polls.map((poll) => {

                const totalVotes =
                  getTotalVotes(
                    poll.poll_options
                  );

                const winner =
                  getWinner(
                    poll.poll_options
                  );

                const alreadyVoted =
                  votedPolls.includes(
                    poll.id
                  );

                return (
                  <article
                    key={poll.id}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                  >

                    {/* POLL BADGES */}

                    <div className="flex items-center justify-between gap-4">

                      <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600">
                        📊 COMMUNITY POLL
                      </span>

                      <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-600">
                        LIVE
                      </span>

                    </div>

                    {/* POLL QUESTION */}

                    <h3 className="mt-5 text-xl font-bold leading-7 text-slate-900">
                      {poll.question}
                    </h3>

                    {/* OPTIONS */}

                    <div className="mt-5 space-y-4">

                      {poll.poll_options.map(
                        (option) => {

                          const percentage =
                            getPercentage(
                              option.votes,
                              totalVotes
                            );

                          return (
                            <button
                              key={option.id}
                              onClick={() =>
                                votePoll(
                                  poll.id,
                                  option.id,
                                  option.votes
                                )
                              }
                              disabled={
                                alreadyVoted ||
                                votingPoll === poll.id
                              }
                              className="block w-full text-left disabled:cursor-default"
                            >

                              <div className="flex items-center justify-between text-sm">

                                <span className="font-semibold text-slate-700">
                                  {option.option_text}
                                </span>

                                <span className="font-bold text-slate-500">
                                  {option.votes}{" "}
                                  ({percentage}%)
                                </span>

                              </div>

                              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">

                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                  style={{
                                    width:
                                      `${percentage}%`,
                                  }}
                                />

                              </div>

                            </button>
                          );
                        }
                      )}

                    </div>

                    {/* POLL RESULT */}

                    <div className="mt-5 border-t border-slate-100 pt-4">

                      {alreadyVoted ? (
                        <p className="text-sm font-semibold text-green-600">
                          ✓ You have already voted
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Select an option to vote
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">

                        <span>
                          Total votes:{" "}
                          {totalVotes}
                        </span>

                        {winner &&
                          totalVotes > 0 && (
                            <span>
                              Winner:{" "}
                              <strong className="text-slate-600">
                                {winner.option_text}
                              </strong>
                            </span>
                          )}

                      </div>

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>

        {/* ============================================
            FOOTER
        ============================================ */}

        <footer className="mt-14 border-t border-slate-100 pt-6 text-center">

          <p className="text-xs text-slate-400">
            LIVE Q &amp; A • Community • Knowledge • Discussion
          </p>

        </footer>

      </div>
    </main>
  );
}