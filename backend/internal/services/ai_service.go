package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type AIService struct{}

func NewAIService() *AIService {
	return &AIService{}
}

func (s *AIService) complete(ctx context.Context, system, prompt string) (string, error) {
	claudePath, err := exec.LookPath("claude")
	if err != nil {
		claudePath = "claude"
	}
	full := system + "\n\n" + prompt
	out, err := exec.CommandContext(ctx, claudePath, "-p", full, "--output-format", "text").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("claude: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

// --- Interview Questions ---

type GeneratedQuestion struct {
	Type       string  `json:"type"`
	Question   string  `json:"question"`
	Difficulty *string `json:"difficulty"`
}

func (s *AIService) GenerateInterviewQuestions(
	ctx context.Context,
	company, role string,
	jobDesc *string,
	types []string,
	count int,
) ([]GeneratedQuestion, error) {
	jd := "(no job description provided)"
	if jobDesc != nil && *jobDesc != "" {
		jd = *jobDesc
	}

	prompt := fmt.Sprintf(`Generate %d interview questions for a %s role at %s.

Job description:
%s

Question types to include: %s

Return a JSON array of objects with this exact shape:
[{"type":"behavioral","question":"Tell me about...","difficulty":"medium"}, ...]

Valid types: behavioral, technical, situational, coding
Valid difficulties: easy, medium, hard

Return ONLY the JSON array, no other text.`,
		count, role, company, jd, strings.Join(types, ", "))

	raw, err := s.complete(ctx, "You are an expert technical recruiter and interview coach.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var questions []GeneratedQuestion
	if err := json.Unmarshal([]byte(raw), &questions); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return questions, nil
}

// --- Fit Scoring ---

type FitScoreResult struct {
	Score     int      `json:"score"`
	Reasoning string   `json:"reasoning"`
	Strengths []string `json:"strengths"`
	Gaps      []string `json:"gaps"`
}

func (s *AIService) ScoreFit(ctx context.Context, resumeText, jobDescription string) (*FitScoreResult, error) {
	prompt := fmt.Sprintf(`Score how well this resume matches the job description on a scale of 0-100.

RESUME:
%s

JOB DESCRIPTION:
%s

Return a JSON object with this exact shape:
{"score":75,"reasoning":"...","strengths":["..."],"gaps":["..."]}

Return ONLY the JSON object, no other text.`,
		resumeText, jobDescription)

	raw, err := s.complete(ctx, "You are an expert resume screener and career coach.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var result FitScoreResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return &result, nil
}

// --- Resume ATS Review ---

type ResumeReviewResult struct {
	ATSScore    int      `json:"ats_score"`
	Issues      []string `json:"issues"`
	Suggestions []string `json:"suggestions"`
	Keywords    []string `json:"keywords"`
	Summary     string   `json:"summary"`
}

func (s *AIService) ReviewResume(ctx context.Context, resumeText string) (*ResumeReviewResult, error) {
	prompt := fmt.Sprintf(`Analyze this resume for ATS (Applicant Tracking System) compliance and overall quality.

RESUME:
%s

Evaluate:
1. Keyword density and relevance
2. Formatting and structure (as parsed from text)
3. Quantified achievements
4. Action verbs
5. Section completeness

Return a JSON object with this exact shape:
{"ats_score":72,"issues":["..."],"suggestions":["..."],"keywords":["..."],"summary":"..."}

Return ONLY the JSON object, no other text.`,
		resumeText)

	raw, err := s.complete(ctx, "You are an expert ATS resume analyzer and career coach.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var result ResumeReviewResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return &result, nil
}

// --- Resume vs JD Comparison ---

type CompareResult struct {
	MatchScore  int      `json:"match_score"`
	Strengths   []string `json:"strengths"`
	Gaps        []string `json:"gaps"`
	Suggestions []string `json:"suggestions"`
	Summary     string   `json:"summary"`
}

func (s *AIService) CompareResumeToJob(ctx context.Context, resumeText, jobDescription string) (*CompareResult, error) {
	prompt := fmt.Sprintf(`Compare this resume against the job description and identify gaps and strengths.

RESUME:
%s

JOB DESCRIPTION:
%s

Return a JSON object with this exact shape:
{"match_score":68,"strengths":["..."],"gaps":["..."],"suggestions":["..."],"summary":"..."}

Return ONLY the JSON object, no other text.`,
		resumeText, jobDescription)

	raw, err := s.complete(ctx, "You are an expert career coach and resume consultant.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var result CompareResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return &result, nil
}

// --- Answer Feedback ---

func (s *AIService) ReviewAnswer(
	ctx context.Context,
	question, questionType, answerText string,
	codeContent, language *string,
) (feedback string, score int, err error) {
	var answerSection string
	if codeContent != nil && *codeContent != "" {
		lang := "code"
		if language != nil {
			lang = *language
		}
		answerSection = fmt.Sprintf("Written explanation:\n%s\n\nCode (%s):\n```%s\n%s\n```",
			answerText, lang, lang, *codeContent)
	} else {
		answerSection = answerText
	}

	prompt := fmt.Sprintf(`Evaluate this interview answer.

Question type: %s
Question: %s

Answer:
%s

Provide:
1. A score from 1-10 (10 = excellent)
2. Specific feedback on what was good
3. What could be improved
4. A suggested improvement or model answer hint

Return a JSON object with this exact shape:
{"score":7,"feedback":"..."}

The feedback field should be detailed markdown text covering strengths, weaknesses, and improvement suggestions.
Return ONLY the JSON object, no other text.`,
		questionType, question, answerSection)

	raw, err := s.complete(ctx, "You are a senior technical interviewer and career coach.", prompt)
	if err != nil {
		return "", 0, err
	}

	raw = extractJSON(raw)
	var result struct {
		Score    int    `json:"score"`
		Feedback string `json:"feedback"`
	}
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return "", 0, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return result.Feedback, result.Score, nil
}

// --- Resume Edit Suggestions ---

type ResumeEdit struct {
	ID          string `json:"id"`
	Section     string `json:"section"`
	Original    string `json:"original"`
	Replacement string `json:"replacement"`
	Reason      string `json:"reason"`
}

func (s *AIService) SuggestEdits(ctx context.Context, resumeText string) ([]*ResumeEdit, error) {
	prompt := fmt.Sprintf(`You are a professional resume writer. Analyze this resume and suggest 6-10 concrete text improvements.

RESUME:
%s

Return a JSON array with this exact shape:
[
  {
    "id": "edit_1",
    "section": "Experience",
    "original": "exact verbatim text copied from the resume",
    "replacement": "improved version of that text",
    "reason": "why this is better"
  }
]

Rules:
- The "original" field MUST be an exact verbatim copy from the resume (same spacing, punctuation, capitalization)
- Focus: weak action verbs, vague statements without metrics, passive voice, filler phrases, weak summary
- Prefer specific quantified achievements over generic claims
- Keep each original/replacement pair to a single sentence or bullet point

Return ONLY the JSON array, no other text.`, resumeText)

	raw, err := s.complete(ctx, "You are an expert resume writer and career coach.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var edits []*ResumeEdit
	if err := json.Unmarshal([]byte(raw), &edits); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return edits, nil
}

// --- Clarifying Questions ---

type ClarifyingQuestion struct {
	ID       string `json:"id"`
	Question string `json:"question"`
	Context  string `json:"context"`
}

func (s *AIService) GenerateClarifyingQuestions(
	ctx context.Context,
	resumeText, jobDescription, company, role string,
) ([]ClarifyingQuestion, error) {
	prompt := fmt.Sprintf(`You are a resume consultant preparing to tailor a resume for a job application. Before making any edits, you need to ask the applicant targeted questions to gather additional accurate details — NOT to fill in skills they don't have, but to surface real experience they may not have fully documented.

TARGET ROLE: %s at %s

JOB DESCRIPTION:
%s

RESUME:
%s

Generate 3-5 targeted questions that will help you write more accurate, detailed resume edits and a cover letter. Focus on:
- Specific technologies, tools, or methodologies used in past roles that may align with job requirements but aren't fully detailed in the resume
- Quantifiable outcomes (metrics, scale, impact) for achievements that are vague or missing numbers
- Projects or responsibilities that could be described more precisely to match job description language
- Do NOT ask about skills or experience the applicant clearly does not have

Return a JSON array with this exact shape:
[
  {
    "id": "q_1",
    "question": "The question to ask the applicant",
    "context": "One sentence explaining why this detail would help — which job requirement it relates to"
  }
]

Return ONLY the JSON array, no other text.`,
		role, company, jobDescription, resumeText)

	raw, err := s.complete(ctx, "You are a professional resume consultant gathering accurate details from an applicant.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var questions []ClarifyingQuestion
	if err := json.Unmarshal([]byte(raw), &questions); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return questions, nil
}

// --- Job-Targeted Resume Edit Suggestions ---

func (s *AIService) SuggestJobTargetedEdits(
	ctx context.Context,
	resumeText, jobDescription, company, role, userContext string,
) ([]*ResumeEdit, error) {
	additionalContext := ""
	if userContext != "" {
		additionalContext = fmt.Sprintf(`
ADDITIONAL CONTEXT FROM APPLICANT:
The applicant answered clarifying questions. Treat these answers as verified facts you may use in edits.
%s
`, userContext)
	}

	prompt := fmt.Sprintf(`You are a professional resume editor tailoring a resume for a specific job. Your job is to suggest edits using ONLY the information actually present in the resume and any additional context the applicant has provided below.

TARGET ROLE: %s at %s

JOB DESCRIPTION:
%s

RESUME:
%s
%s
Rules you MUST follow:
1. Only use facts, roles, and achievements from the resume or the applicant's additional context above. Do not invent or exaggerate anything.
2. You MAY rephrase existing content using industry-relevant keywords from the job description — but only when those keywords accurately describe what the applicant actually did.
3. If the job description requires a skill or experience not present in the resume or applicant context, do NOT add it. Instead, use the reason field to flag it: "GAP: [skill] — not present in resume."
4. Preserve all dates, titles, company names, and measurable results exactly as provided.
5. Do not use vague filler phrases ("results-driven", "passionate about", "team player") unless grounded in a specific example already in the resume.

Return a JSON array with this exact shape:
[
  {
    "id": "edit_1",
    "section": "Experience",
    "original": "exact verbatim text copied from the resume",
    "replacement": "rephrased version using job description language — based only on what is actually in the resume or applicant context",
    "reason": "one line noting what original content this is based on and why the rephrasing strengthens fit"
  }
]

Additional rules:
- The "original" field MUST be an exact verbatim copy from the resume (same spacing, punctuation, capitalization)
- For GAP flags, set "original" and "replacement" to empty strings
- Keep each original/replacement pair to a single sentence or bullet point

Return ONLY the JSON array, no other text.`,
		role, company, jobDescription, resumeText, additionalContext)

	raw, err := s.complete(ctx, "You are an expert resume editor and career coach.", prompt)
	if err != nil {
		return nil, err
	}

	raw = extractJSON(raw)
	var edits []*ResumeEdit
	if err := json.Unmarshal([]byte(raw), &edits); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nraw: %s", err, raw)
	}
	return edits, nil
}

// --- Cover Letter Generation ---

func (s *AIService) GenerateCoverLetter(
	ctx context.Context,
	company, role, jobDescription, resumeText, companyInfo, userContext string,
) (string, error) {
	companyContext := "(no additional company context provided)"
	if companyInfo != "" {
		companyContext = companyInfo
	}

	additionalContext := ""
	if userContext != "" {
		additionalContext = fmt.Sprintf(`
ADDITIONAL CONTEXT FROM APPLICANT:
The applicant answered clarifying questions. Treat these answers as verified facts you may reference in the letter.
%s
`, userContext)
	}

	prompt := fmt.Sprintf(`You are a professional cover letter writer. Write a cover letter grounded STRICTLY in the applicant's actual experience. You must never invent, fabricate, or imply experience, skills, or accomplishments not explicitly stated in the resume or the applicant's additional context below.

APPLICANT RESUME:
%s

COMPANY: %s
ROLE: %s

JOB DESCRIPTION:
%s

ADDITIONAL COMPANY CONTEXT:
%s
%s
Rules you MUST follow:
1. Only reference facts, roles, and achievements from the resume or the applicant's additional context above. Do not add, invent, or exaggerate anything.
2. You MAY rephrase existing content using industry-relevant keywords from the job description — but only when those keywords accurately describe what the applicant actually did.
3. If the job description requires a skill or experience not present in the resume or applicant context, do NOT imply the applicant has it. Omit it entirely.
4. Preserve all titles, company names, and measurable results exactly as provided.
5. Do not use vague filler phrases ("results-driven", "passionate about", "team player") unless grounded in a specific example from the resume.

Writing requirements:
1. Open with a specific hook referencing the company or role — never a generic opener
2. Connect 2-3 of the applicant's most relevant actual experiences directly to the job's key requirements
3. Demonstrate genuine interest in the company using the provided context
4. Close with a confident, action-oriented statement
5. Length: 3-4 paragraphs, no longer than 400 words
6. Tone: Professional but human — avoid buzzwords and corporate clichés
7. Write in first person from the applicant's perspective

Return ONLY the cover letter text, ready to send. No preamble, no commentary.`,
		resumeText, company, role, jobDescription, companyContext, additionalContext)

	return s.complete(ctx, "You are a professional cover letter writer who only uses facts explicitly present in the applicant's resume — never fabricating or implying experience.", prompt)
}

// extractJSON strips markdown code fences that models sometimes add.
func extractJSON(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		if len(lines) >= 2 {
			s = strings.Join(lines[1:], "\n")
		}
		s = strings.TrimSuffix(strings.TrimSpace(s), "```")
	}
	return strings.TrimSpace(s)
}
