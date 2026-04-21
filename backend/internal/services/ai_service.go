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

// --- Job-Targeted Resume Edit Suggestions ---

func (s *AIService) SuggestJobTargetedEdits(
	ctx context.Context,
	resumeText, jobDescription, company, role string,
) ([]*ResumeEdit, error) {
	prompt := fmt.Sprintf(`You are an expert resume editor and career coach. Suggest 6-10 specific, concrete edits to tailor this resume for the target role.

TARGET ROLE: %s at %s

JOB DESCRIPTION:
%s

RESUME:
%s

Instructions:
1. Identify the most important keywords, skills, and requirements from the job description
2. Compare against the resume and find gaps or missed opportunities
3. Suggest specific rewrites — bullet points, section reorders, added keywords, rephrased accomplishments — tied directly to the job description language
4. Every edit must be directly tied to a requirement or keyword from the job description
5. Do not give generic advice

Return a JSON array with this exact shape:
[
  {
    "id": "edit_1",
    "section": "Experience",
    "original": "exact verbatim text copied from the resume",
    "replacement": "improved version targeting the job description",
    "reason": "one line explaining why this strengthens fit for this specific role"
  }
]

Rules:
- The "original" field MUST be an exact verbatim copy from the resume (same spacing, punctuation, capitalization)
- Each reason must reference specific language or requirements from the job description
- Keep each original/replacement pair to a single sentence or bullet point

Return ONLY the JSON array, no other text.`,
		role, company, jobDescription, resumeText)

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
	company, role, jobDescription, resumeText, companyInfo string,
) (string, error) {
	companyContext := "(no additional company context provided)"
	if companyInfo != "" {
		companyContext = companyInfo
	}

	prompt := fmt.Sprintf(`Write a compelling, personalized cover letter for this job application.

APPLICANT RESUME:
%s

COMPANY: %s
ROLE: %s

JOB DESCRIPTION:
%s

ADDITIONAL COMPANY CONTEXT:
%s

Requirements:
1. Open with a strong, specific hook referencing the company or role — never a generic opener
2. Connect 2-3 of the applicant's most relevant experiences or skills directly to the job's key requirements
3. Demonstrate genuine interest in the company using the provided context
4. Close with a confident, action-oriented statement
5. Length: 3-4 paragraphs, no longer than 400 words
6. Tone: Professional but human — avoid buzzwords and corporate clichés
7. Write in first person from the applicant's perspective
8. Do not simply restate the resume; synthesize and tell a story

Return ONLY the cover letter text, ready to send. No preamble, no commentary.`,
		resumeText, company, role, jobDescription, companyContext)

	return s.complete(ctx, "You are an expert cover letter writer who crafts compelling, personalized letters that stand out.", prompt)
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
