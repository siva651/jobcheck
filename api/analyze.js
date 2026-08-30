import { GoogleGenAI } from '@google/genai';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { jobText, resumeFile, resumeText: previousResumeText } = req.body;

        if (!jobText || jobText.trim().length < 2) {
            res.status(400).json({ error: 'Please provide some text.' });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'Server configuration error: missing GEMINI_API_KEY' });
            return;
        }

        let resumeText = previousResumeText || '';
        let imageData = null;

        // Process uploaded file
        if (resumeFile && resumeFile.base64Data) {
            const buffer = Buffer.from(resumeFile.base64Data, 'base64');
            const fileType = resumeFile.type;

            if (fileType === 'application/pdf') {
                try {
                    const pdfData = await pdf(buffer);
                    resumeText = pdfData.text;
                } catch (e) {
                    res.status(400).json({ error: 'Could not read the PDF file.' });
                    return;
                }
            } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                try {
                    const result = await mammoth.extractRawText({ buffer });
                    resumeText = result.value;
                } catch (e) {
                    res.status(400).json({ error: 'Could not read the DOCX file.' });
                    return;
                }
            } else if (fileType === 'text/plain') {
                resumeText = buffer.toString('utf-8');
            } else if (['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
                imageData = {
                    inlineData: {
                        mimeType: fileType,
                        data: resumeFile.base64Data
                    }
                };
            } else {
                res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, JPG, PNG, or WEBP.' });
                return;
            }
        }

        const ai = new GoogleGenAI({ apiKey });
        const truncatedJobText = jobText.trim().slice(0, 5000);

        const lower = jobText.toLowerCase();
        const jobKeywords = [
            'responsibilities', 'qualifications', 'job description', 'requirements',
            'salary', 'company', 'role', 'position', 'experience', 'skills',
            'we are looking', 'about the job', 'what you must have', 'what sets you apart'
        ];
        const isJobListing = jobKeywords.some(kw => lower.includes(kw));
        const hasResume = resumeText.trim().length > 10;

        const resumeQuestionPatterns = [
            /what is (my|the) (name|email|phone|phone number|address|linkedin|github|summary|objective|education|educational|qualification|degree|university|college|skills|projects|experience|work history)/i,
            /extract (my|the) (name|email|phone|address|skills|experience|education|qualification|summary|objective)/i,
            /tell me (my|the) (name|email|phone|address|skills|experience|education|qualification|summary|objective)/i,
            /what are (my|the) (skills|educations?|qualifications?|experiences?|projects?)/i,
            /what is (my|the) (resume|name|contact|education)/i
        ];
        const isResumeQuestion = resumeQuestionPatterns.some(regex => regex.test(jobText));

        const careerQueryPattern = /(job|career|role|position|resume|match|fit|suitable|recommend|internship|work|apply|salary|company|skills|missing|advice|improve|next step)/i;
        const isCareerQuery = careerQueryPattern.test(jobText) && !isResumeQuestion;

        let prompt;
        let responseType;

        if (isJobListing) {
            responseType = 'job';
            prompt = `You are an expert job evaluator. Analyze the job listing below and return a JSON object. ${hasResume ? 'A resume is provided; include a matchScore and missingSkills based on that resume.' : 'No resume is provided; set matchScore to -1 and omit missingSkills.'}

Return ONLY JSON with keys:
{
  "legitimacy": { "text": string, "status": "green"|"red"|"amber", "details": string },
  "matchScore": number,
  "salary": string,
  "compensationBenefits": string,
  "location": string,
  "distance": string,
  "costOfLiving": string,
  "companyInfo": { "size": string, "age": string, "industry": string, "type": string },
  "experienceRequired": string,
  "fresherFriendly": { "text": string, "status": "green"|"red"|"amber" },
  "bondPeriod": string,
  "ratingsReviews": string,
  "growthProspects": string,
  "workSetup": string,
  "interviewProcess": string,
  "recommendation": string,
  "missingSkills": [string]
}

Job listing:
${truncatedJobText}

${hasResume ? `\nCandidate Resume:\n${resumeText}\n` : ''}`;
        } else if (hasResume && isResumeQuestion) {
            responseType = 'resumeQ';
            prompt = `You are JobCheck. Answer the user's question DIRECTLY using the resume text below. Be concise and do not give career advice unless asked.

Resume:
${resumeText}

User question: ${jobText}

Answer:`;
        } else if (hasResume && isCareerQuery) {
            responseType = 'resumeAdvice';
            prompt = `You are a career advisor. Based on the resume below, provide a JSON response with:
{
  "summary": string,
  "recommendedRoles": [string],
  "skillsToHighlight": [string],
  "missingSkills": [string],
  "advice": string
}

Resume:
${resumeText}

User query: ${jobText}`;
        } else {
            responseType = 'general';
            prompt = `You are JobCheck, a helpful assistant. Answer naturally and briefly.

User: ${jobText}

Assistant:`;
        }

        // Build contents for generateContent
        let contents;
        if (imageData) {
            contents = {
                parts: [
                    { text: prompt },
                    imageData
                ]
            };
        } else {
            contents = { text: prompt };
        }

        // Non-streaming: try models
        const models = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
        let lastError = null;

        for (const modelName of models) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: contents,
                });
                const rawText = response.text;

                if (responseType === 'general' || responseType === 'resumeQ') {
                    return res.status(200).json({ type: responseType, text: rawText.trim() });
                }

                // Parse JSON for structured responses
                let data;
                try {
                    data = JSON.parse(rawText);
                } catch (e) {
                    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (match) {
                        try { data = JSON.parse(match[1]); } catch (e2) { data = null; }
                    } else {
                        data = null;
                    }
                }

                if (!data) {
                    data = {
                        legitimacy: { text: 'Unknown', status: 'amber', details: '' },
                        matchScore: -1,
                        salary: 'Not provided',
                        compensationBenefits: 'Not provided',
                        location: 'Not provided',
                        distance: 'Not provided',
                        costOfLiving: 'Not provided',
                        companyInfo: { size: 'Unknown', age: 'Unknown', industry: 'Unknown', type: 'Unknown' },
                        experienceRequired: 'Not specified',
                        fresherFriendly: { text: 'Unknown', status: 'amber' },
                        bondPeriod: 'None mentioned',
                        ratingsReviews: 'No ratings found',
                        growthProspects: 'No information',
                        workSetup: 'Not specified',
                        interviewProcess: 'Not specified',
                        recommendation: 'Could not parse analysis. Please try again.',
                        missingSkills: []
                    };
                }

                if (responseType === 'job') {
                    data = {
                        legitimacy: data.legitimacy || { text: 'Unknown', status: 'amber', details: '' },
                        matchScore: data.matchScore !== undefined ? data.matchScore : -1,
                        salary: data.salary || 'Not provided',
                        compensationBenefits: data.compensationBenefits || 'Not provided',
                        location: data.location || 'Not provided',
                        distance: data.distance || 'Not provided',
                        costOfLiving: data.costOfLiving || 'Not provided',
                        companyInfo: data.companyInfo || { size: 'Unknown', age: 'Unknown', industry: 'Unknown', type: 'Unknown' },
                        experienceRequired: data.experienceRequired || 'Not specified',
                        fresherFriendly: data.fresherFriendly || { text: 'Unknown', status: 'amber' },
                        bondPeriod: data.bondPeriod || 'None mentioned',
                        ratingsReviews: data.ratingsReviews || 'No ratings found',
                        growthProspects: data.growthProspects || 'No information',
                        workSetup: data.workSetup || 'Not specified',
                        interviewProcess: data.interviewProcess || 'Not specified',
                        recommendation: data.recommendation || 'No recommendation available.',
                        missingSkills: data.missingSkills || [],
                        resumeText: resumeText
                    };
                    return res.status(200).json({ type: 'job', data });
                } else if (responseType === 'resumeAdvice') {
                    data = {
                        summary: data.summary || 'No summary.',
                        recommendedRoles: data.recommendedRoles || [],
                        skillsToHighlight: data.skillsToHighlight || [],
                        missingSkills: data.missingSkills || [],
                        advice: data.advice || 'No advice.',
                        resumeText: resumeText
                    };
                    return res.status(200).json({ type: 'resumeAdvice', data });
                }
            } catch (error) {
                lastError = error;
                if (error.status === 503 || error.status === 429) {
                    continue;
                }
                break;
            }
        }

        console.error('All models failed:', lastError);
        res.status(200).json({
            type: 'error',
            text: 'Sorry, the AI service is temporarily unavailable. Please try again in a few moments.'
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(200).json({
            type: 'error',
            text: 'Sorry, something went wrong. Please try again.'
        });
    }
}